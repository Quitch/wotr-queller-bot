// Rendering the page: the New game screen or the game screen, keeping focus, open details and scroll positions
// across a re-render.
import { renderModal } from "../modals/index.js";
import { LEGAL } from "./constants.js";
import { diceHTML } from "./dice.js";
import { find, focusKey } from "./dom.js";
import { cardsHTML } from "./hand.js";
import { headerHTML } from "./header.js";
import { modal, state } from "./session.js";
import { setupHTML, wireSetup } from "./setup.js";
import { hideTip } from "./tooltip.js";
import { trackerHTML } from "./tracker.js";
import { walkHTML } from "./walkthrough.js";
import { skipLinkHTML } from "./widgets.js";
import { wire } from "./wire.js";

// The regions whose scroll position survives a re-render.
const SCROLLED = [".trail", ".log"];
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
// Each <details> with its open state and its data-key (what it is about), so a toggle survives a re-render of the same thing.
const detailsBefore = (root) =>
  [...root.querySelectorAll("details")].map((details) => ({
    open: details.open,
    key: details.dataset.key || "",
  }));
function restoreDetails(root, before) {
  root.querySelectorAll("details").forEach((details, i) => {
    const was = before[i];
    if (was && was.key === (details.dataset.key || "")) details.open = was.open;
  });
}
const scrollBefore = (root) =>
  SCROLLED.map((selector) => root.querySelector(selector)?.scrollTop || 0);
function restoreScroll(root, before) {
  SCROLLED.forEach((selector, i) => {
    const el = root.querySelector(selector);
    if (el && before[i]) el.scrollTop = before[i];
  });
}
// The latest log line goes to the live region (#live, created once by ui/boot.js) whenever it changes.
let announced = null;
function announceLastLogLine() {
  const live = find("#live");
  const last = state.log[state.log.length - 1];
  if (!live || !last || last.text === announced) return;
  announced = last.text;
  live.textContent = last.text;
}
export function render() {
  const root = find("#app");
  hideTip();
  const focus = captureFocus();
  const details = detailsBefore(root);
  const scroll = scrollBefore(root);
  if (!state) {
    root.innerHTML = setupHTML();
    wireSetup();
    return;
  }
  root.innerHTML = gameHTML();
  wire();
  restoreDetails(root, details);
  restoreScroll(root, scroll);
  announceLastLogLine();
  restoreFocus(root, focus);
  if (modal) renderModal();
}
// The game screen: header, the dice and cards panels, the walkthrough, the board tracker and the footer.
// With the full board tracker on, the dice and cards panels sit under the walkthrough in the left column; otherwise they
// share a top row (which the one-column layout moves below the walkthrough, see styles/layout.css).
// Exported for test/render.js, which builds it without a DOM.
export function gameHTML() {
  const below = state.settings.tracker;
  const panels =
    (state.settings.dice ? diceHTML() : "") +
    (state.settings.cards ? cardsHTML() : "");
  const top = below ? "" : panels;
  const trackerPanel = trackerHTML();
  const body =
    (top ? '<div class="toprow">' + top + "</div>" : "") +
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
    skipLinkHTML("Skip to the walkthrough") + headerHTML() + body + footerHTML()
  );
}
function footerHTML() {
  return (
    '<footer class="notice" aria-label="Licences and trademarks">' +
    LEGAL +
    "</footer>"
  );
}
