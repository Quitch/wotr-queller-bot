// The rules modal: the numbered rules, the turn sequence and the key to the flowcharts.
import { RULES } from "../ref/rules.js";
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
    '<div class="body rules"><p class="notice">The flowcharts and the Learning Guide refer to these numbers.</p>';
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
    '<h3>Key for the flowcharts</h3><p class="notice" style="max-width:75ch">A green ellipse is a start point. A red ellipse is an action: if Queller can do it legally, do it and stop; otherwise apply rule 36. A yellow or blue rounded rectangle is a yes/no decision about the board now; under “ANY condition true” it is Yes when at least one listed condition is true, under “ALL conditions true” only when every one is. A grey striped box is a jump to the start point with that name, usually on another flowchart; a die in brackets means use that die. A purple box is a priority list (rules 37 and 38). An orange box is a step: do it, then continue. “– WoME –” marks a box or a listed condition for Warriors of Middle-earth only: without it, answer such a decision No, ignore such a condition and skip such a grey box. Bold text with the ring mark ' +
    ui.ringIcon() +
    " is an Elven Ring condition (rule 43): if it is true and Queller lacks the die that rule 46 names for it, it uses an Elven Ring. “Phase 5 – continue from where you came” means return to the grey box that sent you here (on the Phase 5 flowchart or on another die page) and follow its arrow out.</p></div>";
  return html;
}

// What the modal framework needs to show this modal.
export const rules = {
  content: rulesContent,
};
