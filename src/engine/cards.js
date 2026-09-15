// The cards by id (with their initiative stamped on), the per-game card flags and the card-list helpers.
import { CARDS } from "../cards/index.js";
import { DECK, STRATEGY } from "./constants.js";

export const cardById = {};
// Initiative as a number: "3-5" counts as 4, no initiative as 0.
function initiativeValue(card) {
  if (typeof card.init === "number") return card.init;
  return card.init === "3-5" ? 4 : 0;
}
CARDS.forEach((card) => {
  cardById[card.id] = card;
  card.initiative = initiativeValue(card);
});
// Static flags come from cards.js; only `preferred` and `factionInPlay` depend on the game state.
// The strategy's preferred card type: Character cards under corruption, any other type under military.
function preferred(card, strategy) {
  if (!card.type) return false;
  return strategy === STRATEGY.CORRUPTION
    ? card.type === "Character"
    : card.type !== "Character";
}
export function cardFlags(card, state) {
  return {
    revealed: !!card.revealed,
    tile: !!card.tile,
    corruption: !!card.corruption,
    init: card.initiative,
    preferred: preferred(card, state.strategy),
    factionInPlay: card.faction
      ? !!state.board.factions[card.faction.toLowerCase()]
      : false,
  };
}
export const FACTION_CAT = {
  sa_Faction01: "muster",
  sa_Faction02: "muster",
  sa_Faction03: "other",
  sa_Faction04: "attack",
  sa_Faction05: "attack",
  sa_Faction06: "muster",
  sa_Faction07: "muster",
  sa_Faction08: "attack",
  sa_Faction09: "attack",
  sa_Faction10: "other",
  sa_Faction11: "move",
  sa_Faction12: "move",
  sa_Faction13: "move",
  sa_Faction14: "other",
  sa_Faction15: "muster",
  sa_Faction16: "other",
  sa_Faction17: "other",
  sa_Faction18: "other",
  sa_Faction19: "other",
  sa_Faction20: "other",
};
export const MUSTER_CHOICE = {
  sa015: 1,
  sa018: 1,
  sa027: 1,
  sa028b2: 1,
  sa028: 1,
  sa033: 1,
};
export const staysOnTable = (id) => !!cardById[id].onTable;
export const handCardsOfDeck = (state, deckKey) =>
  state.cards.hand.filter((i) => cardById[i].deck === deckKey);
// Cards Queller may use as a combat card: the hand, plus table cards whose text allows it (Balrog of Moria).
export const combatCandidates = (state) =>
  state.cards.hand.concat(
    state.cards.table.filter((i) => cardById[i].tableCombat),
  );
export const callToBattleCards = (state) =>
  CARDS.filter(
    (card) =>
      card.deck === DECK.CALL_TO_BATTLE &&
      state.board.factions[card.faction.toLowerCase()],
  ).map((card) => card.id);
