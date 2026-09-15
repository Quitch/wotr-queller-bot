// The dice panel: the Hunt box, the pool, the legend, the summary line and the Hunt-roll advice.
import * as engine from "../qb.js";
import { CARD, DIE_KIND, DIE_STATE } from "../qb.js";
import { escapeHTML } from "./dom.js";
import { state } from "./session.js";

// The dice panel.
const FACE_ICON = {
  Muster: "crown",
  "Army/Muster": "crownbanner",
  Army: "banner",
  Character: "sword",
  Event: "palantir",
  Eye: "eye",
  Recruit: "figure",
  "Play/Draw": "card",
  "Recruit/Play": "figurecard",
  "Recruit/Draw": "figuredraw",
  Wild: "wild",
};
export const RING_PATH =
  '<circle cx="12" cy="13.5" r="7" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M8.6 4.6L12 1.4l3.4 3.2-3.4 3.2z" fill="currentColor"/>';
export function ringIcon(label) {
  return (
    '<svg class="ring-ico" viewBox="0 0 24 24" role="img" aria-label="' +
    escapeHTML(label || "Elven Ring condition") +
    '"><title>' +
    escapeHTML(label || "Elven Ring condition (rule 36)") +
    "</title>" +
    RING_PATH +
    "</svg>"
  );
}
const SPRITE =
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
  '<symbol id="f-sword" viewBox="0 0 24 24"><path d="M4 20l9.5-9.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12.2 7.8L18 2h4v4l-5.8 5.8" fill="currentColor"/><path d="M8.5 12.5l3 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="4" cy="20" r="1.8" fill="currentColor"/></symbol>' +
  '<symbol id="f-banner" viewBox="0 0 24 24"><path d="M6 3v18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7.5 4h12l-3 4.5 3 4.5h-12z" fill="currentColor"/></symbol>' +
  '<symbol id="f-crown" viewBox="0 0 24 24"><path d="M3 19V7l5 5 4-8 4 8 5-5v12z" fill="currentColor"/></symbol>' +
  '<symbol id="f-crownbanner" viewBox="0 0 24 24"><path d="M2 11V3l3.5 3.2L8 2l2.5 4.2L14 3v8z" fill="currentColor"/><path d="M13 12v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14.2 12.6h8l-2 3.2 2 3.2h-8z" fill="currentColor"/></symbol>' +
  '<symbol id="f-palantir" viewBox="0 0 24 24"><circle cx="12" cy="10.5" r="7.5" fill="currentColor"/><circle cx="9.3" cy="7.8" r="2" fill="var(--surface2)" opacity=".85"/><path d="M5 21c0-1.8 3.1-3 7-3s7 1.2 7 3z" fill="currentColor"/></symbol>' +
  '<symbol id="f-eye" viewBox="0 0 24 24"><path d="M1.5 12C4.5 6.5 8 4.5 12 4.5s7.5 2 10.5 7.5C19.5 17.5 16 19.5 12 19.5S4.5 17.5 1.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="4.2" ry="4.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="1.1" ry="3.4" fill="var(--accent)"/></symbol>' +
  '<symbol id="f-figure" viewBox="0 0 24 24"><circle cx="12" cy="6" r="3.4" fill="currentColor"/><path d="M5 22c0-5 2.5-8.5 7-8.5s7 3.5 7 8.5z" fill="currentColor"/></symbol>' +
  '<symbol id="f-card" viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="7" width="6" height="7" fill="currentColor"/></symbol>' +
  '<symbol id="f-figurecard" viewBox="0 0 24 24"><circle cx="7.5" cy="6.5" r="2.8" fill="currentColor"/><path d="M1.5 21c0-4 2-7.5 6-7.5s6 3.5 6 7.5z" fill="currentColor"/><rect x="14" y="4" width="8.5" height="13" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="16.2" y="7" width="4" height="5" fill="currentColor"/></symbol>' +
  '<symbol id="f-figuredraw" viewBox="0 0 24 24"><circle cx="7.5" cy="6.5" r="2.8" fill="currentColor"/><path d="M1.5 21c0-4 2-7.5 6-7.5s6 3.5 6 7.5z" fill="currentColor"/><rect x="14" y="3" width="8.5" height="11" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M18.25 15v6M15.5 18.5l2.75 2.8 2.75-2.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
  '<symbol id="f-wild" viewBox="0 0 24 24"><path d="M12 2l2.6 6.4 6.9.5-5.3 4.5 1.7 6.7L12 16.4 6.1 20.1l1.7-6.7L2.5 8.9l6.9-.5z" fill="currentColor"/></symbol>' +
  "</defs></svg>";
function faceIcon(face) {
  const id = FACE_ICON[face];
  return id
    ? '<svg class="ico" aria-hidden="true"><use href="#f-' + id + '"/></svg>'
    : "";
}
const DIE_STATUS_TEXT = {
  [DIE_STATE.POOL]: "not yet rolled",
  [DIE_STATE.HUNT]: "in the Hunt box",
  [DIE_STATE.AVAIL]: "available — tap to mark it used",
  [DIE_STATE.USED]: "used",
  [DIE_STATE.RESERVED]: "set aside for a minion",
};
// One die in the pool; an available die is a button that marks it used (index = its position in the pool).
function dieHTML(die, index) {
  const dieStatus = DIE_STATUS_TEXT[die.status];
  const cls =
    "die k-" +
    die.kind +
    " st-" +
    die.status +
    (die.face ? " f-" + die.face.replace("/", "-") : "");
  const inner =
    (die.face
      ? faceIcon(die.face)
      : '<span class="blank" aria-hidden="true"></span>') +
    '<span class="sr">' +
    (die.kind === DIE_KIND.FACTION ? "Faction die" : "Action die") +
    (die.face ? " showing " + escapeHTML(die.face) : "") +
    ", " +
    dieStatus +
    "</span>";
  const title = escapeHTML(die.face || "not rolled") + " · " + dieStatus;
  return die.status === DIE_STATE.AVAIL
    ? '<li><button type="button" class="' +
        cls +
        '" data-spend="' +
        index +
        '" title="' +
        title +
        '">' +
        inner +
        "</button></li>"
    : '<li class="' + cls + '" title="' + title + '">' + inner + "</li>";
}
// The Hunt box and the rest of the pool, with a hint when a die can be marked used.
function dicePoolHTML(dice, available) {
  if (!dice.pool.length)
    return '<div class="notice">Dice are recovered in Phase 1.</div>';
  const indexedDice = dice.pool.map((die, index) => [die, index]);
  const huntDice = indexedDice.filter(([die]) => die.status === DIE_STATE.HUNT),
    otherDice = indexedDice.filter(([die]) => die.status !== DIE_STATE.HUNT);
  return (
    '<div class="dicewrap"><div class="huntbox"><span class="hlbl">Hunt box</span><ul class="dice" role="list" aria-label="Dice in the Hunt box">' +
    (huntDice.length
      ? huntDice.map(([die, index]) => dieHTML(die, index)).join("")
      : '<li class="die empty" aria-hidden="true"></li>') +
    '</ul></div><ul class="dice" role="list" aria-label="Dice">' +
    otherDice.map(([die, index]) => dieHTML(die, index)).join("") +
    "</ul></div>" +
    (available.length
      ? '<div class="notice" style="margin-top:8px">Tap an available die to mark it used (a card effect, for example).</div>'
      : "")
  );
}
const faceLegendHTML = (faces) =>
  faces
    .map((face) => "<span>" + faceIcon(face) + escapeHTML(face) + "</span>")
    .join("");
function diceLegendHTML(dice) {
  return (
    '<div class="legend" aria-label="Die faces">' +
    faceLegendHTML([
      "Character",
      "Army",
      "Muster",
      "Army/Muster",
      "Event",
      "Eye",
    ]) +
    (dice.factionDie && state.settings.wome
      ? faceLegendHTML([
          "Recruit",
          "Play/Draw",
          "Recruit/Play",
          "Recruit/Draw",
          "Wild",
        ])
      : "") +
    "</div>"
  );
}
function diceSummaryHTML(available) {
  return (
    '<div class="dicerow"><span>Available: <b>' +
    available.length +
    "</b></span>" +
    (state.minionReserved ? "<span>1 set aside for a minion</span>" : "") +
    (engine.ringsKnown(state)
      ? "<span>Rings held: <b>" + state.board.rings + "</b></span>"
      : "") +
    "</div>"
  );
}
// Table cards that matter at a Hunt roll, and what to do with them.
const HUNT_ROLL_ADVICE = {
  [CARD.FLOCKS_OF_CREBAIN]:
    "Flocks of Crebain on the table — discard it before the roll for +1 to every Hunt die",
  [CARD.BALROG]:
    "Balrog of Moria on the table — discard it for an extra Hunt tile when the Fellowship moves into, out of or through Moria while declared or revealed",
};
function huntRollAdviceHTML() {
  const huntCards = state.cards.table.filter((id) => HUNT_ROLL_ADVICE[id]);
  if (!huntCards.length) return "";
  return (
    '<div class="notice" style="margin-top:8px">At a Hunt roll: ' +
    huntCards.map((id) => HUNT_ROLL_ADVICE[id]).join("; ") +
    ".</div>"
  );
}
export function diceHTML() {
  const dice = state.dice,
    available = engine.availableDice(state);
  return (
    '<section class="panel" aria-labelledby="h-dice"><h2 class="ph" id="h-dice">Queller’s dice <span class="r">' +
    engine.diceCount(state) +
    " action dice" +
    (dice.factionDie && state.settings.wome ? " + Faction die" : "") +
    "</span></h2>" +
    SPRITE +
    dicePoolHTML(dice, available) +
    diceLegendHTML(dice) +
    diceSummaryHTML(available) +
    huntRollAdviceHTML() +
    "</section>"
  );
}
