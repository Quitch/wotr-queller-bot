// Rendering the page: the New game screen or the game screen, keeping focus and open details across a re-render.
import { renderModal } from "../modals/index.js";
import { LEGAL } from "./constants.js";
import { diceHTML } from "./dice.js";
import { find } from "./dom.js";
import { cardsHTML } from "./hand.js";
import { headerHTML } from "./header.js";
import { modal, state } from "./session.js";
import { setupHTML, wireSetup } from "./setup.js";
import { hideTip } from "./tooltip.js";
import { trackerHTML } from "./tracker.js";
import { walkHTML } from "./walkthrough.js";
import { wire } from "./wire.js";

// The attributes that identify a control across a re-render, so focus can be put back on it.
const FOCUS_ATTRIBUTES = [
  "data-phase",
  "data-ans",
  "data-card",
  "data-t",
  "data-step",
  "data-modal",
  "data-t-reset",
];
const selectorFor = (el, attr) =>
  "[" +
  attr +
  '="' +
  el.getAttribute(attr) +
  '"]' +
  (el.dataset.d === undefined ? "" : '[data-d="' + el.dataset.d + '"]') +
  (el.dataset.id === undefined ? "" : '[data-id="' + el.dataset.id + '"]');
// A selector that finds the focused control again after the page is re-rendered, or null.
function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.id) return "#" + el.id;
  const attr = FOCUS_ATTRIBUTES.find((name) => el.hasAttribute(name));
  return attr ? selectorFor(el, attr) : null;
}
const captureFocus = () => ({
  key: focusKey(document.activeElement),
  wasAnswer: document.activeElement?.dataset?.ans !== undefined,
});
// After an answer (or when a prompt opened with nothing focused) focus the prompt or result; otherwise the same control as before.
function restoreFocus(root, { key, wasAnswer }) {
  if (wasAnswer || (state.walk?.prompt && !key)) {
    const focusTarget = find(".prompt, .result");
    if (focusTarget) focusTarget.focus();
  } else if (key) {
    const el = root.querySelector(key);
    if (el) el.focus();
  }
}
const openDetailsIndexes = (root) =>
  [...root.querySelectorAll("details.more")].map((details) => details.open);
function reopenDetails(root, openBefore) {
  root.querySelectorAll("details.more").forEach((details, i) => {
    if (openBefore[i]) details.open = true;
  });
}
// The latest log line goes to the live region for screen readers while a walk is in progress.
function announceLastLogLine() {
  const live = find("#live");
  const last = state.log[state.log.length - 1];
  if (live && last && state.walk) live.textContent = last.text;
}
export function render() {
  const root = find("#app");
  hideTip();
  const focus = captureFocus();
  const openBefore = openDetailsIndexes(root);
  if (!state) {
    root.innerHTML = setupHTML();
    wireSetup();
    return;
  }
  root.innerHTML = gameHTML();
  wire();
  reopenDetails(root, openBefore);
  announceLastLogLine();
  restoreFocus(root, focus);
  if (modal) renderModal();
}
// The game screen: header, the dice and cards panels, the walkthrough, the board tracker and the footer.
// With the full board tracker on, the dice and cards panels sit under the walkthrough in the left column; otherwise they share a top row.
function gameHTML() {
  const below = state.settings.tracker;
  const panels =
    (state.settings.dice ? diceHTML() : "") +
    (state.settings.cards ? cardsHTML() : "");
  const top = below ? "" : panels;
  const trackerPanel = trackerHTML();
  const body =
    (top
      ? '<div class="toprow" aria-label="Queller’s dice and cards">' +
        top +
        "</div>"
      : "") +
    '<div class="grid' +
    (trackerPanel ? "" : " nowalk") +
    '"><main id="main" tabindex="-1" aria-label="Walkthrough">' +
    walkHTML(below ? panels : "") +
    "</main>" +
    (trackerPanel
      ? '<aside class="side" aria-label="Board tracker">' +
        trackerPanel +
        "</aside>"
      : "") +
    "</div>";
  return (
    '<a class="skip" href="#main">Skip to the walkthrough</a>' +
    headerHTML() +
    body +
    footerHTML() +
    '<div id="live" class="sr" aria-live="polite" aria-atomic="true"></div>'
  );
}
function footerHTML() {
  return (
    '<footer class="notice" aria-label="Licences and trademarks">' +
    LEGAL +
    "</footer>"
  );
}
