// Small DOM and text helpers: querying, click wiring, focus keys, HTML escaping, glossary markup, tolerant JSON.
import { GLOSSARY, GLOSSARY_ALIASES } from "../ref/glossary.js";

export const find = (selector) => document.querySelector(selector);
// The attributes that identify a control across a re-render (of the page or of a modal), so focus can be put back on it.
const FOCUS_ATTRIBUTES = [
  "data-phase",
  "data-ans",
  "data-card",
  "data-t",
  "data-step",
  "data-modal",
  "data-t-reset",
  "data-fp",
  "data-save",
  "data-load",
  "data-set",
  "data-ask",
];
const selectorFor = (el, attr) =>
  "[" +
  attr +
  '="' +
  el.getAttribute(attr) +
  '"]' +
  (el.dataset.d === undefined ? "" : '[data-d="' + el.dataset.d + '"]') +
  (el.dataset.id === undefined ? "" : '[data-id="' + el.dataset.id + '"]');
// A selector that finds the focused control again after a re-render, or null.
export function focusKey(el) {
  if (!el || el === el.ownerDocument?.body) return null;
  if (el.id) return "#" + el.id;
  const attr = FOCUS_ATTRIBUTES.find((name) => el.hasAttribute(name));
  return attr ? selectorFor(el, attr) : null;
}
// Attach one click handler to every element a selector matches (within root, default the whole document).
export function onClickEach(selector, handler, root = document) {
  root
    .querySelectorAll(selector)
    .forEach((el) => (el.onclick = () => handler(el)));
}
const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
export const escapeHTML = (text) =>
  String(text).replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]);
// *term* in card and flowchart text: a glossary term (or plain italics).
export const MARKUP_TERM = /\*([^*]+)\*/g;
function termKey(term) {
  term = term.toLowerCase().replace(/\s+/g, " ").trim();
  if (GLOSSARY[term]) return term;
  if (GLOSSARY_ALIASES[term]) return GLOSSARY_ALIASES[term];
  const singular = term.replace(/s$/, "");
  if (GLOSSARY[singular]) return singular;
  return null;
}
// Card and flowchart text as HTML: *term* becomes a glossary button (or italics when the glossary has no entry), newlines become <br>.
export function formatText(text) {
  if (text == null) return "";
  return escapeHTML(text)
    .replace(MARKUP_TERM, (match, term) => {
      const key = termKey(term);
      return key
        ? '<button type="button" class="term" data-term="' +
            key +
            '" aria-describedby="tip">' +
            term +
            "</button>"
        : "<i>" + term + "</i>";
    })
    .replaceAll("\n", "<br>");
}
export function stripMarkup(text) {
  return String(text || "").replaceAll("*", "");
}
// JSON.parse that returns `fallback` for missing or corrupt text.
export function parseJSONOr(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
