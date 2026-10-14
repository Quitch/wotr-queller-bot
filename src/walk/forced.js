// Free Peoples table cards the Shadow may force off the table by using one Action die and discarding one Army Event card
// and one Character card from the hand (A Power too Great, The Power of Tom Bombadil). Neither the Queller flowcharts
// nor the rules say when. The player uses it from a Phase 5 action that the card blocks, in place of Not possible: the
// forced discard becomes that action, paid with the action's own die.
import * as engine from "../engine/index.js";
import {
  DECK,
  DIE_KIND,
  DIE_STATE,
  PHASE,
  STRATEGY,
  TRAIL,
  cardById,
  handCardsOfDeck,
} from "../engine/index.js";
import { NODE } from "../flow/index.js";
import { releaseCurrentDie, spendCurrentDie } from "./actions.js";
import { endWalk, trail } from "./core.js";
import { nodeByKey } from "./priority.js";
import { PROMPT, WALK_RESULT, offersNotPossible } from "./prompt.js";

export const FP_PROTECTION_CARDS = [
  {
    key: "powerTooGreat",
    title: "A Power too Great",
    regions: "Lórien, Rivendell and The Grey Havens",
  },
  {
    key: "bombadil",
    title: "The Power of Tom Bombadil",
    regions: "The Old Forest, The Shire and Buckland",
  },
];
export const fpCardByKey = (key) =>
  FP_PROTECTION_CARDS.find((fpCard) => fpCard.key === key);
// Why the cost cannot be paid, checked in this order so that only CARDS depends on the hand; CARDS stays vague on
// purpose, so the player does not learn what Queller holds. NO_ACTION: no Phase 5 action prompt with Not possible is open.
export const FORCED_DISCARD_BLOCK = {
  NO_ACTION: "noAction",
  DIE: "die",
  CARDS: "cards",
};

// The open prompt the forced discard can replace: a Phase 5 action, outside a battle, that the player could call not
// possible, whose die is still unspent (no earlier move paid with it) and is not the Muster die set aside for a minion.
// It never depends on the hand, so the UI may show it.
export function forceDiscardOpen(state) {
  const walk = state.walk,
    prompt = walk && !walk.done ? walk.prompt : null;
  return (
    !!prompt &&
    state.phase === PHASE.P5 &&
    walk.entry.page !== "BA" &&
    !!walk.die &&
    !walk.dieUsed &&
    !walk.fromReserve &&
    offersNotPossible(prompt) &&
    !prompt.pass
  );
}
// The die the action would use, when it is an unused Action die: the one the walk claimed, else one matching the walk's
// die requirement. A Faction die cannot pay, and the player may have marked the claimed die used.
function walkActionDie(state) {
  const walk = state.walk,
    usable = (die) =>
      die?.kind === DIE_KIND.ACTION && die.status === DIE_STATE.AVAIL;
  const claimed = walk.dieIndex == null ? null : state.dice.pool[walk.dieIndex];
  if (usable(claimed)) return claimed;
  if (engine.isFactionRequirement(walk.die)) return null;
  const matching = engine.findDie(state, walk.die);
  return usable(matching) ? matching : null;
}
// The strategy's Phases 1–4 discard priority: the order Queller gives up cards in. Under corruption the flowchart picks
// the list by "Holding more than 1 strategy card" (C14.strat1: Yes → disc14, No → disc18).
function discardPriority(state) {
  let key = "M14.disc";
  if (state.strategy !== STRATEGY.MILITARY)
    key = engine.handCounts(state).strategy > 1 ? "C14.disc14" : "C14.disc18";
  return NODE.extra(nodeByKey(key)).items;
}
// Faction cards never count (WoME rules: a discard condition naming a deck does not apply to Faction cards).
const armyEventCards = (state) =>
  handCardsOfDeck(state, DECK.STRATEGY).filter(
    (id) => cardById[id].type === "Army",
  );

// What Queller would pay now: {army, character, ownDie, dice} (ownDie: the action's own Action die, which pays when
// there is one; dice: the other Action dice that may pay otherwise; both empty with dice off), or {blocked}.
export function forcedDiscardCost(state) {
  if (!forceDiscardOpen(state))
    return { blocked: FORCED_DISCARD_BLOCK.NO_ACTION };
  let dice = [],
    ownDie = null;
  if (state.settings.dice) {
    ownDie = walkActionDie(state);
    if (!ownDie) dice = engine.availableActionDice(state);
    if (!ownDie && !dice.length) return { blocked: FORCED_DISCARD_BLOCK.DIE };
  }
  const army = armyEventCards(state),
    character = handCardsOfDeck(state, DECK.CHARACTER);
  if (!army.length || !character.length)
    return { blocked: FORCED_DISCARD_BLOCK.CARDS };
  return { army, character, ownDie, dice };
}
// Pay the cost to discard the Free Peoples card `key` as the open action, and end the walk (the walk's answer
// FORCE_ANSWER_PREFIX + key). Returns {army, character, die}, or {blocked} and changes nothing.
export function payForcedDiscard(state, key) {
  const fpCard = fpCardByKey(key);
  if (!fpCard) throw new Error("Unknown Free Peoples card " + key);
  const cost = forcedDiscardCost(state);
  if (cost.blocked) return cost;
  const criteria = discardPriority(state);
  const army = engine.applyPriority(state, cost.army, criteria).chosen,
    character = engine.applyPriority(state, cost.character, criteria).chosen;
  const why = "to force “" + fpCard.title + "” off the table";
  engine.discardCard(state, army, why);
  engine.discardCard(state, character, why);
  let die = null;
  const claimed =
    state.walk.dieIndex == null ? null : state.dice.pool[state.walk.dieIndex];
  if (state.settings.dice) {
    die = cost.ownDie ?? engine.nonPreferredFirst(state, cost.dice, 1)[0];
    if (die === claimed) spendCurrentDie(state, why);
    else {
      // Another die pays (a matching one, or any Action die when the action held a Faction die or a used one).
      engine.spendDie(state, die, why);
      releaseCurrentDie(state);
    }
  } else if (!engine.isFactionRequirement(state.walk.die))
    spendCurrentDie(state, why);
  else {
    releaseCurrentDie(state);
    engine.log(state, "Queller used an Action die — " + why + ".");
  }
  trail(state, {
    kind: state.walk.prompt.type === PROMPT.STEP ? TRAIL.STEP : TRAIL.ACTION,
    text: state.walk.prompt.text,
    answer: "force “" + fpCard.title + "” off the table",
  });
  endWalk(
    state,
    WALK_RESULT.ACTION,
    "Queller forces “" +
      fpCard.title +
      "” off the table: it discards “" +
      cardById[army].title +
      "” and “" +
      cardById[character].title +
      "”" +
      (die ? " and uses the " + die.face + " die" : "") +
      ".",
  );
  return { army, character, die };
}
