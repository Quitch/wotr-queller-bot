// Free Peoples table cards that stop a Shadow Army moving into or attacking certain regions until the Shadow pays to
// remove them: one Action die, one Army Event card and one Character card (A Power too Great, The Power of Tom
// Bombadil). Rule 15: when a card in play prevents a Queller action, Queller does what is necessary to remove it, and
// only when it tries that action. Rule 12: the Event page chooses discards ("Event card discard" priority). With the
// app holding Queller's cards, the walk asks after Not possible whether one of these cards blocked the action; if so,
// Queller pays when it can, and the removal is that action.
import * as engine from "../engine/index.js";
import {
  DECK,
  DIE_KIND,
  DIE_STATE,
  PHASE,
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

// Whether Not possible on `prompt` first asks if a protection card blocked it: a Phase 5 action or move outside a
// battle, holding an unspent die that is not the Muster die set aside for a minion. Never depends on the hand, so the
// question gives nothing away.
export function asksIfBlocked(state, prompt) {
  const walk = state.walk;
  return (
    state.settings.cards &&
    state.phase === PHASE.P5 &&
    walk.entry.page !== "BA" &&
    !!walk.die &&
    !walk.dieUsed &&
    !walk.fromReserve &&
    offersNotPossible(prompt) &&
    !prompt.pass
  );
}
const usableActionDie = (die) =>
  die?.kind === DIE_KIND.ACTION && die.status === DIE_STATE.AVAIL;
// The die that pays, as {die, claimed}: the action's own die, else a die matching its requirement, else any Action
// die not showing a preferred result (rule 23); null when Queller has none. With dice off: {die: null} (the player's).
function payingDie(state) {
  if (!state.settings.dice) return { die: null, claimed: false };
  const walk = state.walk;
  const claimed = walk.dieIndex == null ? null : state.dice.pool[walk.dieIndex];
  if (usableActionDie(claimed)) return { die: claimed, claimed: true };
  if (!engine.isFactionRequirement(walk.die)) {
    const matching = engine.findDie(state, walk.die);
    if (usableActionDie(matching)) return { die: matching, claimed: false };
  }
  const other = engine.nonPreferredFirst(
    state,
    engine.availableActionDice(state),
    1,
  )[0];
  return other ? { die: other, claimed: false } : null;
}
// Faction cards never count (WoME rules: a discard condition naming a deck does not apply to Faction cards).
const armyEventCards = (state) =>
  handCardsOfDeck(state, DECK.STRATEGY).filter(
    (id) => cardById[id].type === "Army",
  );
// Pay to remove the Free Peoples card `key` that blocked `prompt` (the action or move step), as Queller's action, and
// end the walk. Returns false, changing nothing, when Queller cannot pay.
export function payForcedDiscard(state, key, prompt) {
  const fpCard = fpCardByKey(key);
  if (!fpCard) throw new Error("Unknown Free Peoples card " + key);
  const paying = payingDie(state),
    armyCards = armyEventCards(state),
    characterCards = handCardsOfDeck(state, DECK.CHARACTER);
  if (!paying || !armyCards.length || !characterCards.length) return false;
  const criteria = NODE.extra(nodeByKey("EV.discPri")).items;
  const army = engine.applyPriority(state, armyCards, criteria).chosen,
    character = engine.applyPriority(state, characterCards, criteria).chosen;
  const why = "to remove “" + fpCard.title + "” from the table";
  engine.discardCard(state, army, why);
  engine.discardCard(state, character, why);
  const walk = state.walk;
  const ownDie = !state.settings.dice && !engine.isFactionRequirement(walk.die);
  if (paying.claimed || ownDie) spendCurrentDie(state, why);
  else {
    if (paying.die) engine.spendDie(state, paying.die, why);
    else engine.log(state, "Queller used an Action die — " + why + ".");
    releaseCurrentDie(state);
  }
  trail(state, {
    kind: prompt.type === PROMPT.STEP ? TRAIL.STEP : TRAIL.ACTION,
    text: prompt.text,
    answer: "blocked by “" + fpCard.title + "”: Queller removes it",
  });
  endWalk(
    state,
    WALK_RESULT.ACTION,
    "Queller removes “" +
      fpCard.title +
      "” (rule 15): it discards “" +
      cardById[army].title +
      "” and “" +
      cardById[character].title +
      "” and uses " +
      (paying.die ? "the " + paying.die.face + " die" : "an Action die") +
      ". Discard “" +
      fpCard.title +
      "” from the table.",
  );
  return true;
}
