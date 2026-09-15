// Small DOM and text helpers: querying, click wiring, HTML escaping, glossary markup, tolerant JSON.
import { GLOSSARY, GLOSSARY_ALIASES } from "../ref/glossary.js";

export const find = (selector) => document.querySelector(selector);
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
