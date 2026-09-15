// The glossary modal: every term and its definition; opened on a term from a tooltip.
import { GLOSSARY } from "../ref/glossary.js";
import { escapeHTML as esc, formatText as fmt } from "../ui/dom.js";

const glossaryContent = () => ({
  title: "Glossary of terms",
  body:
    '<div class="body"><p class="notice">Words in italics on the flowcharts are defined here. Hover a term anywhere in the app for its definition; click it to open this list.</p><dl class="gl">' +
    Object.keys(GLOSSARY)
      .map(
        (term) =>
          '<dt data-gl="' +
          term +
          '" tabindex="-1">' +
          esc(term) +
          "</dt><dd>" +
          fmt(GLOSSARY[term]) +
          "</dd>",
      )
      .join("") +
    "</dl></div>",
  narrow: true,
});

// What the modal framework needs to show this modal.
export const glossary = {
  content: glossaryContent,
  // The term the modal was opened for gets focus (a re-render keeps whatever is focused).
  focusOnOpen(modal, el) {
    if (!modal.arg) return false;
    const term = el.querySelector('[data-gl="' + modal.arg + '"]');
    if (term) {
      term.scrollIntoView({ block: "start" });
      term.focus();
    }
    return true;
  },
};
