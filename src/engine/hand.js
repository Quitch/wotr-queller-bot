// The hand and the table: drawing, hand counts, discarding and playing a card.
import { cardById, handCardsOfDeck, staysOnTable } from "./cards.js";
import { DECK } from "./constants.js";
import { log } from "./log.js";
import { shuffle } from "./random.js";

export function drawCard(state, deckKey) {
  const deck = state.cards.decks[deckKey];
  if (!deck.length) {
    const discards = state.cards.discards[deckKey];
    if (!discards.length) {
      log(state, "The " + deckName(deckKey) + " deck is empty.");
      return null;
    }
    state.cards.decks[deckKey] = shuffle(discards);
    state.cards.discards[deckKey] = [];
    log(
      state,
      "Reshuffled the " + deckName(deckKey) + " discards into a new deck.",
    );
  }
  const id = state.cards.decks[deckKey].shift();
  if (deckKey === DECK.FACTION) state.cards.factionHand.push(id);
  else state.cards.hand.push(id);
  log(
    state,
    "Drew a " +
      deckName(deckKey) +
      " card (" +
      (deckKey === DECK.FACTION
        ? state.cards.factionHand.length
        : state.cards.hand.length) +
      " in hand).",
  );
  return id;
}
export function deckName(deckKey) {
  if (deckKey === DECK.CHARACTER) return "Character";
  return deckKey === DECK.STRATEGY ? "Strategy" : "Faction Event";
}
export function handCounts(state) {
  return {
    character: handCardsOfDeck(state, DECK.CHARACTER).length,
    strategy: handCardsOfDeck(state, DECK.STRATEGY).length,
    total: state.cards.hand.length,
    faction: state.cards.factionHand.length,
  };
}
function removeFromLists(state, id) {
  for (const list of [
    state.cards.hand,
    state.cards.factionHand,
    state.cards.table,
    state.cards.factionTable,
  ]) {
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      return true;
    }
  }
  return false;
}
export function discardCard(state, id, why) {
  const card = cardById[id];
  removeFromLists(state, id);
  state.cards.discards[card.deck].push(id);
  log(
    state,
    "Discarded “" + card.title + "”" + (why ? " — " + why : "") + ".",
    {
      card: id,
    },
  );
}
export function playCard(state, id, play) {
  const card = cardById[id];
  const combat = !!play?.combat;
  removeFromLists(state, id);
  const onTable = staysOnTable(id) && !combat;
  if (onTable) {
    (card.deck === DECK.FACTION
      ? state.cards.factionTable
      : state.cards.table
    ).push(id);
  } else if (card.deck !== DECK.CALL_TO_BATTLE)
    state.cards.discards[card.deck].push(id);
  delete state.playable[(combat ? "B:" : "") + id];
  log(
    state,
    (combat ? "Combat card: " : "Played: ") +
      "“" +
      card.title +
      "”" +
      (onTable ? " (stays on the table)" : "") +
      ".",
    { card: id, combat },
  );
  return card;
}
