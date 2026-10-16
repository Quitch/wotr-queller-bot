// The hand and the table: drawing, hand counts, discarding and playing a card.
import { cardById, handCardsOfDeck, staysOnTable } from "./cards.js";
import { DECK } from "./constants.js";
import { log } from "./log.js";
import { shuffle } from "./random.js";

// The WoME rules reshuffle an empty Faction Event deck from its discards at once. Returns whether it did.
function reshuffleEmptyFactionDeck(state) {
  const cards = state.cards;
  if (cards.decks[DECK.FACTION].length || !cards.discards[DECK.FACTION].length)
    return false;
  cards.decks[DECK.FACTION] = shuffle(cards.discards[DECK.FACTION]);
  cards.discards[DECK.FACTION] = [];
  log(
    state,
    "Reshuffled the " + deckName(DECK.FACTION) + " discards into a new deck.",
  );
  return true;
}
// Draw the top card of a deck. An empty Faction Event deck is rebuilt from its discards (WoME rules), after the draw
// that empties it and, for a deck that ran out while its discard pile was empty, before the next draw; an empty
// Character or Strategy deck gives nothing (rule 25). Returns the card, or null.
export function drawCard(state, deckKey) {
  if (
    !state.cards.decks[deckKey].length &&
    !(deckKey === DECK.FACTION && reshuffleEmptyFactionDeck(state))
  ) {
    log(state, "The " + deckName(deckKey) + " deck is empty.");
    return null;
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
  if (deckKey === DECK.FACTION) reshuffleEmptyFactionDeck(state);
  return id;
}
// The Event deck to draw from when `named` is Character or Strategy: `named`, or the other one when it is empty
// (rule 25); null when both are empty.
export function eventDeckToDraw(state, named) {
  const other = named === DECK.CHARACTER ? DECK.STRATEGY : DECK.CHARACTER;
  if (state.cards.decks[named].length) return named;
  return state.cards.decks[other].length ? other : null;
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
