// Touch-sized rows shared by the board tracker, the battle form and the army value calculator, and the skip link both
// screens start with.
import { escapeHTML, stripMarkup } from "./dom.js";

// The skip link to the main landmark (#main), the first thing on both screens.
export const skipLinkHTML = (label) =>
  '<a class="skip" href="#main">' + label + "</a>";
// Touch-sized tracker rows shared by the board tracker, the battle form and the army value calculator.
// attrs: extra attributes for the control (data-* hooks); id: the control's id (label target / aria-labelledby)
export function checkboxRowHTML(id, label, checked, attrs) {
  return (
    '<label class="row chk"><span><span class="lt">' +
    label +
    '</span></span><input type="checkbox" id="' +
    id +
    '" ' +
    (attrs || "") +
    (checked ? " checked" : "") +
    "></label>"
  );
}
export function numberRowHTML(id, label, value, attrs = "") {
  return (
    '<div class="row"><span id="' +
    id +
    '-l">' +
    label +
    '</span><span class="stepper" role="group" aria-labelledby="' +
    id +
    '-l"><button type="button" ' +
    attrs +
    ' data-d="-1" aria-label="Decrease ' +
    escapeHTML(stripMarkup(label)) +
    '">−</button><span class="n" id="' +
    id +
    '-n" aria-live="polite">' +
    value +
    '</span><button type="button" ' +
    attrs +
    ' data-d="1" aria-label="Increase ' +
    escapeHTML(stripMarkup(label)) +
    '">+</button></span></div>'
  );
}
