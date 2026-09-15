// Glossary tooltips: the #tip element, showing a term's definition on hover or focus, opening the glossary on click.
import { GLOSSARY } from "../ref/glossary.js";
import { openModal } from "./ask.js";
import { MODAL, TOOLTIP } from "./constants.js";
import { MARKUP_TERM, escapeHTML } from "./dom.js";

export function installTooltip() {
  tipEl = document.createElement("div");
  tipEl.id = "tip";
  tipEl.hidden = true;
  tipEl.setAttribute("role", "tooltip");
  tipEl.addEventListener("mouseleave", hideTip);
  document.body.appendChild(tipEl);
}
// Glossary terms show their definition on hover or focus and open the glossary on click.
export function installGlossaryListeners() {
  const termOf = (event) => event.target.closest(".term");
  document.body.addEventListener("mouseover", (event) => {
    const term = termOf(event);
    if (term) showTip(term);
  });
  document.body.addEventListener("mouseout", (event) => {
    const term = termOf(event);
    if (term && !event.relatedTarget?.closest?.("#tip")) hideTip();
  });
  document.body.addEventListener("focusin", (event) => {
    const term = termOf(event);
    if (term) showTip(term);
  });
  document.body.addEventListener("focusout", (event) => {
    if (termOf(event)) hideTip();
  });
  document.body.addEventListener("click", (event) => {
    const term = termOf(event);
    if (term) {
      hideTip();
      openModal(MODAL.GLOSSARY, term.dataset.term);
    }
  });
}
let tipEl = null;
function showTip(term) {
  const key = term.dataset.term;
  if (!GLOSSARY[key]) return;
  tipEl.innerHTML =
    "<b>" +
    escapeHTML(key) +
    "</b>" +
    escapeHTML(GLOSSARY[key]).replace(MARKUP_TERM, "<i>$1</i>");
  const rect = term.getBoundingClientRect();
  const width = Math.min(
    TOOLTIP.MAX_WIDTH,
    window.innerWidth - 2 * TOOLTIP.VIEWPORT_MARGIN,
  );
  tipEl.style.maxWidth = width + "px";
  let x = Math.min(
      rect.left,
      window.innerWidth - width - TOOLTIP.VIEWPORT_MARGIN,
    ),
    y = rect.bottom + TOOLTIP.GAP;
  tipEl.style.left = Math.max(TOOLTIP.EDGE_MARGIN, x) + "px";
  tipEl.style.top = y + "px";
  tipEl.hidden = false;
  const height = tipEl.offsetHeight;
  if (y + height > window.innerHeight - TOOLTIP.EDGE_MARGIN)
    tipEl.style.top =
      Math.max(TOOLTIP.EDGE_MARGIN, rect.top - height - TOOLTIP.GAP) + "px";
}
// Hide the tooltip; true when it was showing.
export function hideTip() {
  if (!tipEl || tipEl.hidden) return false;
  tipEl.hidden = true;
  return true;
}
