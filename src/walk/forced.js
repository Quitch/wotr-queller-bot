// Free Peoples table cards that stop a Shadow Army moving into or attacking certain regions until the Shadow pays to
// remove them: one Action die, one Army Event card and one Character card (A Power too Great, The Power of Tom
// Bombadil). Rule 19: when a card in play prevents a Queller action, Queller does what is necessary to remove it, and
// only when it tries that action. Rule 16: the Event page chooses discards ("Event card discard" priority). With the
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
import { endWalk, releaseCurrentDie, spendCurrentDie, trail } from "./core.js";
import { eventDiscardPriority } from "./priority.js";
import { PROMPT, WALK_RESULT } from "./prompt.js";

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
    !prompt.pass
  );
}
const usableActionDie = (die) =>
  die?.kind === DIE_KIND.ACTION && die.status === DIE_STATE.AVAIL;
// The trail kind for the action or move step a protection card blocked.
export const blockedTrailKind = (prompt) =>
  prompt.type === PROMPT.STEP ? TRAIL.STEP : TRAIL.ACTION;
// An unused Action die matching the requirement `req`, in the order of its faces (a Faction die never matches).
function matchingActionDie(state, req) {
  const dice = engine.availableActionDice(state);
  for (const face of engine.DIE_REQUIREMENT_FACES[req] || [req]) {
    const die = dice.find((candidate) => candidate.face === face);
    if (die) return die;
  }
  return null;
}
// The die that pays, as {die, claimed}: the action's own die, else an Action die matching its requirement, else any
// Action die not showing a preferred result (rule 29); null when Queller has none. claimed: the walk's own die pays,
// so spending it releases the walk's die. With dice off the player's die pays: {die: null}, claimed unless the action
// held a Faction die.
function payingDie(state) {
  const walk = state.walk,
    factionAction = engine.isFactionRequirement(walk.die);
  if (!state.settings.dice) return { die: null, claimed: !factionAction };
  const claimed = walk.dieIndex == null ? null : state.dice.pool[walk.dieIndex];
  if (usableActionDie(claimed)) return { die: claimed, claimed: true };
  const matching = factionAction ? null : matchingActionDie(state, walk.die);
  if (matching) return { die: matching, claimed: false };
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
  const criteria = eventDiscardPriority();
  const army = engine.applyPriority(state, armyCards, criteria).chosen,
    character = engine.applyPriority(state, characterCards, criteria).chosen;
  const why = "to remove “" + fpCard.title + "” from the table";
  engine.discardCard(state, army, why);
  engine.discardCard(state, character, why);
  if (paying.claimed) spendCurrentDie(state, why);
  else {
    if (paying.die) engine.spendDie(state, paying.die, why);
    else engine.log(state, "Queller used an Action die — " + why + ".");
    releaseCurrentDie(state);
  }
  trail(state, {
    kind: blockedTrailKind(prompt),
    text: prompt.text,
    answer: "blocked by “" + fpCard.title + "”: Queller removes it",
  });
  endWalk(
    state,
    WALK_RESULT.ACTION,
    "Queller removes “" +
      fpCard.title +
      "” (rule 19): it discards “" +
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
