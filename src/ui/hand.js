// The cards panel: the hand as card backs, the deck counts and the cards on the table.
import * as engine from "../qb.js";
import { DECK, cardById } from "../qb.js";
import { cardHTML } from "./card.js";
import { escapeHTML } from "./dom.js";
import { shownCard, state } from "./session.js";

// The cards panel: the hand as card backs, the deck counts and the cards on the table.
function handHTML(cards, handCount) {
  const deckLabel = (id) =>
    cardById[id].deck === DECK.CHARACTER ? "Character" : "Strategy";
  return (
    '<div class="hand"><ul role="list" aria-label="Cards in hand: ' +
    handCount.character +
    " Character, " +
    handCount.strategy +
    " Strategy" +
    (state.settings.wome ? ", " + handCount.faction + " Faction Event" : "") +
    '">' +
    cards.hand
      .map(
        (id) =>
          '<li class="back' +
          (cardById[id].deck === DECK.STRATEGY ? " s" : "") +
          '" title="' +
          deckLabel(id) +
          ' card"><span aria-hidden="true">' +
          (cardById[id].deck === DECK.CHARACTER ? "C" : "S") +
          '</span><span class="sr">' +
          deckLabel(id) +
          " card</span></li>",
      )
      .join("") +
    cards.factionHand
      .map(
        () =>
          '<li class="back f" title="Faction Event card"><span aria-hidden="true">F</span><span class="sr">Faction Event card</span></li>',
      )
      .join("") +
    "</ul></div>"
  );
}
function deckCountsHTML(cards) {
  const deckCount = (name, deckKey) =>
    "<span>" +
    name +
    ' deck</span><span class="v">' +
    cards.decks[deckKey].length +
    " / " +
    cards.discards[deckKey].length +
    " discarded</span>";
  return (
    '<div class="kv">' +
    deckCount("Character", DECK.CHARACTER) +
    deckCount("Strategy", DECK.STRATEGY) +
    (state.settings.wome ? deckCount("Faction", DECK.FACTION) : "") +
    "</div>"
  );
}
// One card on the table: its title, Details/Hide and Discard buttons, its reminder, and the card itself when shown.
function tableCardHTML(id) {
  const open = shownCard === id,
    card = cardById[id];
  return (
    '<div class="tc"><b>' +
    escapeHTML(card.title) +
    '</b><button class="btn small" data-card="' +
    (open ? "hide" : "show") +
    '" data-id="' +
    id +
    '" aria-expanded="' +
    open +
    '">' +
    (open ? "Hide" : "Details") +
    '</button><button class="btn small" data-card="discard" data-id="' +
    id +
    '">Discard</button>' +
    (card.reminder
      ? '<div class="notice rem">' + escapeHTML(card.reminder) + "</div>"
      : "") +
    "</div>" +
    (open ? cardHTML(card) : "")
  );
}
function tableCardsHTML(cards) {
  const tableCards = cards.table.concat(cards.factionTable);
  return (
    '<div class="more tablecards"><div class="mlbl">On the table</div>' +
    (tableCards.length
      ? tableCards.map(tableCardHTML).join("")
      : '<div class="notice">No cards in play. Cards Queller plays “on the table” are listed here until discarded.</div>') +
    "</div>"
  );
}
export function cardsHTML() {
  const cards = state.cards,
    handCount = engine.handCounts(state);
  return (
    '<section class="panel" aria-labelledby="h-cards"><h2 class="ph" id="h-cards">Queller’s cards <span class="r">' +
    handCount.total +
    " in hand" +
    (state.settings.wome ? " · " + handCount.faction + " faction" : "") +
    "</span></h2>" +
    handHTML(cards, handCount) +
    deckCountsHTML(cards) +
    tableCardsHTML(cards) +
    "</section>"
  );
}
