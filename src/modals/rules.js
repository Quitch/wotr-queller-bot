// The rules modal: the numbered rules, the turn sequence, the rulings and the key to the flowcharts.
import { RULES } from "../ref/rules.js";
import { RULINGS } from "../ref/rulings.js";
import { TURN } from "../ref/turn.js";
import { escapeHTML as esc, formatText as fmt } from "../ui/dom.js";
import * as ui from "../ui/index.js";

const rulesContent = () => ({
  title: "General rules",
  body: rulesHTML(),
  narrow: true,
});
function rulesHTML() {
  let html =
    '<div class="body rules"><p class="notice">The flowcharts, the rulings and the Learning Guide refer to these numbers.</p>';
  for (const [section, rules] of RULES) {
    html +=
      "<h3>" +
      esc(section) +
      '</h3><ol role="list">' +
      rules
        .map(
          ([number, text]) =>
            '<li><span class="n">' +
            number +
            "</span><span>" +
            fmt(text) +
            "</span></li>",
        )
        .join("") +
      "</ol>";
  }
  html +=
    '<h3>Turn sequence</h3><ol role="list">' +
    TURN.map(
      ([phase, text]) =>
        '<li><span class="n"></span><span><b>' +
        esc(phase) +
        ".</b> " +
        fmt(text) +
        "</span></li>",
    ).join("") +
    "</ol>";
  html +=
    "<h3>Rulings</h3>" +
    RULINGS.map(
      ([question, answer]) =>
        '<p style="max-width:75ch"><b>' +
        esc(question) +
        "</b><br>" +
        fmt(answer) +
        "</p>",
    ).join("");
  html +=
    '<h3>Key for the flowcharts</h3><p class="notice" style="max-width:75ch">A green ellipse is a start point. A red ellipse is an action: if Queller can do it legally, do it and stop; otherwise apply rule 29. A yellow or blue rounded rectangle is a yes/no decision about the board now. A grey striped box is a jump to the start point with that name; a die in brackets means use that die. A purple box is a priority list (rules 30 and 31). An orange box is a step: do it, then continue. Bold text with the ring mark ' +
    ui.ringIcon() +
    " is an Elven Ring condition (rule 36): if it is true and Queller lacks the die the next step needs, it uses a ring. “Phase 5 – continue from where you came” means return to the grey box that sent you here and follow its arrow out.</p></div>";
  return html;
}

// What the modal framework needs to show this modal.
export const rules = {
  content: rulesContent,
};
