// Free Peoples table cards the Shadow may force off the table by using one Action die and discarding one Army Event card
// and one Character card from the hand (A Power too Great, The Power of Tom Bombadil). Neither the Queller flowcharts
// nor the rules say when; the player presses the control when a Queller army is blocked by the card.
import * as engine from "../engine/index.js";
import { DECK, DIE_KIND, STRATEGY, cardById } from "../engine/index.js";
import { FLOW, NODE } from "../flow/index.js";

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
// Why the cost cannot be paid. CARDS stays vague on purpose: the player must not learn what Queller holds.
export const FORCED_DISCARD_BLOCK = { CARDS: "cards", DIE: "die" };

// The strategy's Phases 1–4 discard priority: the order Queller gives up cards in.
function discardPriority(state) {
  const [page, node] =
    state.strategy === STRATEGY.MILITARY
      ? ["M14", "disc"] // "M14.disc"
      : ["C14", "disc18"]; // "C14.disc18"
  return NODE.extra(FLOW[page].nodes[node]).items;
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
  const army = armyEventCards(state),
    character = characterCards(state);
  if (!army.length || !character.length)
    return { blocked: FORCED_DISCARD_BLOCK.CARDS };
  const dice = state.settings.dice ? actionDice(state) : [];
  if (state.settings.dice && !dice.length)
    return { blocked: FORCED_DISCARD_BLOCK.DIE };
  return { army, character, dice };
}
// Pay the cost to discard the Free Peoples card `key`. Returns the cost paid, or {blocked} and changes nothing.
export function payForcedDiscard(state, key) {
  const fpCard = FP_PROTECTION_CARDS.find((c) => c.key === key);
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
