// Free Peoples table cards the Shadow may force off the table by using one Action die and discarding one Army Event card
// and one Character card from the hand (A Power too Great, The Power of Tom Bombadil). Neither the Queller flowcharts
// nor the rules say when; the player presses the control when a Queller army is blocked by the card.
import * as engine from "../engine/index.js";
import { DECK, DIE_KIND, STRATEGY, cardById } from "../engine/index.js";
import { NODE } from "../flow/index.js";
import { nodeByKey } from "./priority.js";

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
// Why the cost cannot be paid, checked in this order so that only CARDS depends on the hand. CARDS stays vague on
// purpose: the player must not learn what Queller holds. WALK: a walk is waiting for an answer and may hold a die or
// a card, so the player finishes it first (Not possible, when the army is blocked).
export const FORCED_DISCARD_BLOCK = {
  WALK: "walk",
  DIE: "die",
  CARDS: "cards",
};

// The strategy's Phases 1–4 discard priority: the order Queller gives up cards in.
function discardPriority(state) {
  return NODE.extra(
    nodeByKey(state.strategy === STRATEGY.MILITARY ? "M14.disc" : "C14.disc18"),
  ).items;
}
// Faction cards never count (WoME rules: a discard condition naming a deck does not apply to Faction cards).
const armyEventCards = (state) =>
  state.cards.hand.filter(
    (id) => cardById[id].deck === DECK.STRATEGY && cardById[id].type === "Army",
  );
const characterCards = (state) =>
  state.cards.hand.filter((id) => cardById[id].deck === DECK.CHARACTER);
const actionDice = (state) =>
  engine.availableDice(state).filter((die) => die.kind === DIE_KIND.ACTION);

// What Queller would pay now: {army, character, die} (die only with dice on), or {blocked: FORCED_DISCARD_BLOCK.*}.
export function forcedDiscardCost(state) {
  if (state.walk && !state.walk.done)
    return { blocked: FORCED_DISCARD_BLOCK.WALK };
  const dice = state.settings.dice ? actionDice(state) : [];
  if (state.settings.dice && !dice.length)
    return { blocked: FORCED_DISCARD_BLOCK.DIE };
  const army = armyEventCards(state),
    character = characterCards(state);
  if (!army.length || !character.length)
    return { blocked: FORCED_DISCARD_BLOCK.CARDS };
  return { army, character, dice };
}
// Pay the cost to discard the Free Peoples card `key`. Returns the cost paid, or {blocked} and changes nothing.
export function payForcedDiscard(state, key) {
  const fpCard = FP_PROTECTION_CARDS.find((c) => c.key === key);
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
  if (cost.dice.length) {
    die = engine.nonPreferredFirst(state, cost.dice, 1)[0];
    engine.spendDie(state, die, why);
  }
  engine.log(
    state,
    "Forced “" +
      fpCard.title +
      "” off the table: discarded “" +
      cardById[army].title +
      "” and “" +
      cardById[character].title +
      "”" +
      (die ? " and used the " + die.face + " die" : "") +
      ".",
  );
  return { army, character, die };
}
