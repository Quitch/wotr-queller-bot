// A finished walk's result, the walk trail and the game log.
import { TRAIL, WALK_RESULT, cardById, phaseFromResult } from "../qb.js";
import { LOG_ROWS_SHOWN } from "./constants.js";
import { ringIcon } from "./dice.js";
import { escapeHTML, formatText, stripMarkup } from "./dom.js";
import { state } from "./session.js";

// What a finished walk shows: the big line and the smaller one under it, by the walk's result.
const lastTrailText = (walk) =>
  escapeHTML(walk.trail[walk.trail.length - 1].text);
const RESULT_TEXT = {
  [WALK_RESULT.ACTION]: (walk) => ({
    big:
      "Queller acts: " +
      escapeHTML(stripMarkup(walk.trail[walk.trail.length - 1].text)),
    small:
      "Do this on the board, then take your own action. When Queller is next eligible to act, walk again.",
  }),
  [WALK_RESULT.PASS]: () => ({ big: "Queller passes." }),
  [WALK_RESULT.NO_ACTION]: (walk) => ({
    big: "Queller has no usable action.",
    small: lastTrailText(walk),
  }),
  [WALK_RESULT.STRATEGY]: (walk) => ({ big: lastTrailText(walk) }),
  [WALK_RESULT.BATTLE_NEXT]: () => ({
    big: "Combat continues.",
    small: "After both sides resolve this round, walk “Battle: next round”.",
  }),
  [WALK_RESULT.END]: () => ({ big: "End of the walk." }),
};
export function resultHTML(walk) {
  const result = walk.result || "";
  const describe =
    RESULT_TEXT[result] ||
    (phaseFromResult(result)
      ? (ended) => ({ big: lastTrailText(ended) })
      : () => ({}));
  const { big = "", small = "" } = describe(walk);
  return (
    '<div class="result" tabindex="-1"><div class="big">' +
    big +
    "</div>" +
    (small
      ? '<div style="font-size:.88rem;margin-top:4px">' + small + "</div>"
      : "") +
    "</div>"
  );
}
const TRAIL_LABEL = {
  [TRAIL.START]: "Start",
  [TRAIL.QUESTION]: "Ask",
  [TRAIL.SKIP]: "Skipped",
  [TRAIL.JUMP]: "Go to",
  [TRAIL.RETURN]: "Return",
  [TRAIL.BACK]: "Back at",
  [TRAIL.ACTION]: "Action",
  [TRAIL.STEP]: "Step",
  [TRAIL.PRIORITY]: "Priority",
  [TRAIL.NOTE]: "Note",
  [TRAIL.REVEAL]: "Card",
  [TRAIL.RING]: "Ring",
  [TRAIL.END]: "End",
};
function trailEntryHTML(entry) {
  const kind = entry.kind;
  let label = TRAIL_LABEL[kind] || kind;
  if (kind === TRAIL.QUESTION && entry.auto) label = "Auto";
  let text = (entry.ring ? ringIcon() + " " : "") + formatText(entry.text);
  if (entry.die)
    text += ' <span class="why">(' + escapeHTML(entry.die) + " die)</span>";
  if (entry.why)
    text += ' <span class="why">— ' + formatText(entry.why) + "</span>";
  if (kind === TRAIL.PRIORITY && entry.card)
    text +=
      ' <span class="why">→ ' +
      escapeHTML(cardById[entry.card].title) +
      "</span>";
  if (kind === TRAIL.PRIORITY && entry.choice)
    text += ' <span class="why">→ ' + escapeHTML(entry.choice) + "</span>";
  return (
    '<li class="t-' +
    kind +
    (entry.auto ? " auto" : "") +
    '"><span class="k">' +
    label +
    '</span><span class="txt">' +
    text +
    "</span>" +
    (entry.answer
      ? '<span class="a">' + escapeHTML(entry.answer) + "</span>"
      : "") +
    "</li>"
  );
}
export function trailHTML(walk) {
  return (
    '<ul class="trail" role="list" tabindex="0" aria-label="Walk trail">' +
    walk.trail.map(trailEntryHTML).join("") +
    "</ul>"
  );
}
export function logHTML() {
  const items = state.log.slice(-LOG_ROWS_SHOWN).reverse();
  return (
    '<div class="panel" style="margin-top:14px"><h2 class="ph">Log <span class="r">' +
    state.log.length +
    ' entries</span></h2><ul class="log" role="list" tabindex="0" aria-label="Game log">' +
    items
      .map(
        (entry) =>
          '<li class="' +
          (entry.card ? "c" : "") +
          '">T' +
          entry.turn +
          " · " +
          escapeHTML(entry.text) +
          "</li>",
      )
      .join("") +
    "</ul></div>"
  );
}
