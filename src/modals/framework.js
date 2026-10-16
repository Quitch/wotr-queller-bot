// The modal dialog: one element at a time, its focus handling, and the registry of modals. A modal registers
// {content(modal) -> {title, body, narrow}, wire?(modal, el), headerButtons?, beforeRender?(modal), focusOnOpen?(modal, el)}.
import { escapeHTML as esc, focusKey } from "../ui/dom.js";
import * as ui from "../ui/index.js";
import { modalRegistrations } from "./index.js";

let modals = null; // the registry, built on first use: index.js is still evaluating when a modal loads first
const OPEN_CLASS = "modalOpen"; // on <html> while a modal is open: the page behind it does not scroll
// The element to give focus back to when the modal closes, and its focus key, which finds it again when a re-render
// of the page has replaced it.
let opener = null;
let openerKey = null;
let shownModal = null; // the ui.modal last rendered: a different one is a new modal, not a re-render
const registry = () => (modals ??= modalRegistrations());
const specOf = (modal) => registry()[modal.name] || {};
// The modal's element: a dialog box with a header (title, the modal's own buttons, Close) and the content's body.
function buildModalElement(modal, { title, body, narrow }) {
  const el = document.createElement("div");
  el.className = "modal";
  el.id = "modal";
  el.innerHTML =
    '<div class="box' +
    (narrow ? " narrow" : "") +
    '" role="dialog" aria-modal="true" aria-labelledby="mtitle"><header><h2 id="mtitle" tabindex="-1">' +
    esc(title) +
    '</h2><span class="hb">' +
    (specOf(modal).headerButtons || "") +
    '<button class="btn x" id="mclose">Close</button></span></header>' +
    body +
    "</div>";
  return el;
}
const precedes = (a, b) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
// Tab and Shift+Tab stay inside the modal while it is open.
function trapTabFocus(el) {
  el.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [
      ...el.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (candidate) => !candidate.disabled && candidate.offsetParent !== null,
    );
    if (!focusable.length) return;
    const active = document.activeElement,
      first = focusable[0],
      last = focusable.at(-1);
    // Focus on an element outside the list (the title, a glossary entry) wraps when nothing lies beyond it that way.
    const index = focusable.indexOf(active);
    const before =
      index === -1
        ? focusable.filter((c) => precedes(c, active)).length
        : index;
    const atStart = before === 0,
      atEnd = index === -1 ? before === focusable.length : active === last;
    if (event.shiftKey && atStart) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && atEnd) {
      first.focus();
      event.preventDefault();
    }
  });
}
// The scrollable body of a modal is a focusable landmark for keyboard and screen-reader users.
function labelBodyRegions(el, title) {
  el.querySelectorAll(".body").forEach((region) => {
    region.setAttribute("tabindex", "0");
    region.setAttribute("role", "region");
    region.setAttribute("aria-label", title + " content");
  });
}
// Where focus goes when a modal opens: where the modal's hook puts it, else the title. When a modal re-renders itself
// (a tab, a toggle, a saved slot), focus goes back to the control that had it, found again by its focus key.
function focusAfterRender(modal, el, previousKey) {
  const previous = previousKey && el.querySelector(previousKey);
  if (previous) {
    previous.focus();
    return;
  }
  if (specOf(modal).focusOnOpen?.(modal, el)) return;
  if (!previousKey) ui.find("#mtitle").focus();
}
function modalContent(modal) {
  const spec = specOf(modal);
  return spec.content
    ? spec.content(modal)
    : { title: "", body: "", narrow: false };
}
export function renderModal() {
  const modal = ui.modal;
  if (!modal) return;
  const existing = ui.find("#modal");
  let previousKey = null;
  if (existing) {
    if (modal === shownModal && existing.contains(document.activeElement))
      previousKey = focusKey(document.activeElement) || "#mtitle";
    existing.remove();
  } else {
    opener = document.activeElement;
    openerKey = focusKey(opener);
  }
  shownModal = modal;
  specOf(modal).beforeRender?.(modal);
  const content = modalContent(modal);
  const el = buildModalElement(modal, content);
  document.body.appendChild(el);
  document.documentElement.classList.add(OPEN_CLASS);
  const app = ui.find("#app");
  if (app) app.setAttribute("inert", "");
  ui.find("#mclose").onclick = closeModal;
  el.addEventListener("click", (event) => {
    if (event.target === el) closeModal();
  });
  trapTabFocus(el);
  labelBodyRegions(el, content.title);
  specOf(modal).wire?.(modal, el);
  focusAfterRender(modal, el, previousKey);
}
export function closeModal() {
  ui.setModal(null);
  const element = ui.find("#modal");
  if (element) element.remove();
  document.documentElement.classList.remove(OPEN_CLASS);
  const app = ui.find("#app");
  if (app) app.removeAttribute("inert");
  const target = opener?.isConnected ? opener : openerKey && ui.find(openerKey);
  if (target) target.focus();
  opener = null;
  openerKey = null;
  shownModal = null;
}
