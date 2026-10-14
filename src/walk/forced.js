// Free Peoples table cards the Shadow may force off the table by using one Action die and discarding one Army Event card
// and one Character card from the hand (A Power too Great, The Power of Tom Bombadil). Neither the Queller flowcharts
// nor the rules say when. The player uses it from a Phase 5 action that the card blocks, in place of Not possible: the
// forced discard becomes that action, paid with the action's own die.
import * as engine from "../engine/index.js";
import {
  DECK,
  DIE_KIND,
  PHASE,
  STRATEGY,
  TRAIL,
  cardById,
  handCardsOfDeck,
} from "../engine/index.js";
import { NODE } from "../flow/index.js";
import { spendCurrentDie } from "./actions.js";
import { endWalk, trail } from "./core.js";
import { nodeByKey } from "./priority.js";
import { WALK_RESULT, offersNotPossible } from "./prompt.js";

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
function blockableAction(state) {
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
// The action's own die when it is an Action die (a Faction die cannot pay).
function walkActionDie(state) {
  const index = state.walk.dieIndex;
  const die = index == null ? null : state.dice.pool[index];
  return die?.kind === DIE_KIND.ACTION ? die : null;
}
// The strategy's Phases 1–4 discard priority: the order Queller gives up cards in.
function discardPriority(state) {
  return NODE.extra(
    nodeByKey(state.strategy === STRATEGY.MILITARY ? "M14.disc" : "C14.disc18"),
  ).items;
}
// Faction cards never count (WoME rules: a discard condition naming a deck does not apply to Faction cards).
const armyEventCards = (state) =>
  handCardsOfDeck(state, DECK.STRATEGY).filter(
    (id) => cardById[id].type === "Army",
  );

// What Queller would pay now: {army, character, dice} (the dice it may use; none with dice off), or {blocked}.
export function forcedDiscardCost(state) {
  if (!blockableAction(state))
    return { blocked: FORCED_DISCARD_BLOCK.NO_ACTION };
  let dice = [];
  if (state.settings.dice) {
    const own = walkActionDie(state);
    dice = own ? [own] : engine.availableActionDice(state);
    if (!dice.length) return { blocked: FORCED_DISCARD_BLOCK.DIE };
  }
  const army = armyEventCards(state),
    character = handCardsOfDeck(state, DECK.CHARACTER);
  if (!army.length || !character.length)
    return { blocked: FORCED_DISCARD_BLOCK.CARDS };
  return { army, character, dice };
}
// Pay the cost to discard the Free Peoples card `key` as the open action, and end the walk. Returns {army, character,
// die}, or {blocked} and changes nothing.
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
  if (state.settings.dice) {
    // When the action holds a Faction die, another Action die pays and the Faction die stays free.
    die = engine.nonPreferredFirst(state, cost.dice, 1)[0];
    spendCurrentDie(state, why, die === walkActionDie(state) ? null : die);
  } else if (state.walk.die && !engine.isFactionRequirement(state.walk.die))
    spendCurrentDie(state, why);
  else state.walk.die = null; // the player sets aside an Action die (the dialog says so)
  trail(state, {
    kind: TRAIL.ACTION,
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
