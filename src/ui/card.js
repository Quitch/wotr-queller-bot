// A card face: its deck line, the event half, the combat half, or both.
import { DECK } from "../qb.js";
import { escapeHTML } from "./dom.js";

// The deck line above a card's title.
function cardTag(card) {
  if (card.deck === DECK.FACTION)
    return "Faction Event · " + (card.faction || "Sauron");
  if (card.deck === DECK.CALL_TO_BATTLE)
    return "Call to Battle · " + card.faction;
  return (
    (card.deck === DECK.CHARACTER ? "Character" : "Strategy") +
    " · " +
    (card.type || "") +
    " symbol"
  );
}
// Card text as paragraphs (blank lines separate them).
const paragraphsHTML = (text) =>
  escapeHTML(text || "")
    .split("\n\n")
    .map((paragraph) => "<p>" + paragraph + "</p>")
    .join("");
// The combat (bottom) half of a card; styled as the only half when the event half is not shown above it.
function combatHalfHTML(card, eventShownAbove) {
  return (
    '<div class="combat' +
    (eventShownAbove ? "" : " only") +
    '"><div class="ct"><b style="font-size:.9rem">' +
    escapeHTML(card.combatTitle) +
    '</b><span class="tag">combat</span></div>' +
    (card.combatCond
      ? '<div class="cond">' + escapeHTML(card.combatCond) + "</div>"
      : "") +
    paragraphsHTML(card.combatText) +
    "</div>"
  );
}
// Which half of a card to show: the top (event) half, the bottom (combat) half, or the whole card when omitted.
export const CARD_HALF = { EVENT: "event", COMBAT: "combat" };
export function cardHTML(card, half) {
  const tag = cardTag(card);
  const showEvent =
      half !== CARD_HALF.COMBAT || card.deck === DECK.CALL_TO_BATTLE,
    showCombat = half !== CARD_HALF.EVENT && !!card.combatTitle;
  let html =
    '<div class="card' +
    (half ? " half" : "") +
    '"><div class="ct"><b>' +
    escapeHTML(card.title) +
    '</b><span class="tag">' +
    escapeHTML(tag) +
    (card.init != null ? " · init " + escapeHTML(card.init) : "") +
    "</span></div>";
  if (showEvent) {
    if (card.cond)
      html += '<div class="cond">' + escapeHTML(card.cond) + "</div>";
    html += paragraphsHTML(card.text);
  }
  if (showCombat) html += combatHalfHTML(card, showEvent);
  if (half)
    html +=
      '<div class="tag halfnote">' +
      (half === CARD_HALF.COMBAT
        ? "Bottom (combat) half shown"
        : "Top (event) half shown") +
      "</div>";
  return html + "</div>";
}
