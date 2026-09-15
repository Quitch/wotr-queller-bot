// The flowchart modal: one tab per page, as a diagram or as text, opened on the walk's page from the game screen.
import { EDGE, FLOW, NODE, NODE_KIND } from "../../flow/index.js";
import * as engine from "../../qb.js";
import { PHASE } from "../../qb.js";
import { escapeHTML as esc, formatText as fmt } from "../../ui/dom.js";
import * as ui from "../../ui/index.js";
import { renderModal } from "../framework.js";
import { svgPage, walkMarks } from "./svg.js";

const DEFAULT_FLOW_PAGE = "C14";
let flowPage = DEFAULT_FLOW_PAGE, // the tab shown
  flowText = null; // the text version instead of the diagram; decided on first use (see textMode)
// Touch screens start with the text version, which reads at any width; anything else starts with the diagram.
function textMode() {
  if (flowText === null)
    flowText =
      typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches;
  return flowText;
}
const flowContent = () => ({
  title: "Flowcharts",
  body:
    '<div class="tabs">' +
    Object.keys(FLOW)
      .map(
        (pageKey) =>
          '<button class="btn small' +
          (pageKey === flowPage ? " on" : "") +
          '" data-fp="' +
          pageKey +
          '" aria-pressed="' +
          (pageKey === flowPage) +
          '">' +
          esc(
            FLOW[pageKey].name
              .replace("Strategy ", "")
              .replace("Move/Recruit/Play/Draw ", ""),
          ) +
          "</button>",
      )
      .join("") +
    '</div><div class="body"><p class="notice" style="margin:0 0 8px">Green: start point. Red: action. Yellow/blue: decision. Grey: jump to another page. Purple: priority list. Orange: step. The current node of the walk is outlined; visited nodes are shaded.</p><p style="margin:0 0 8px"><button class="btn small" id="flowToggle" aria-pressed="' +
    textMode() +
    '">' +
    (textMode() ? "Show the diagram" : "Show as text") +
    "</button></p>" +
    (textMode()
      ? textPage(flowPage)
      : '<div class="flowwrap">' + svgPage(flowPage) + "</div>") +
    "</div>",
  narrow: false,
});
function currentPage() {
  const state = ui.state;
  if (!state) return DEFAULT_FLOW_PAGE;
  if (state.walk && !state.walk.done && FLOW[state.walk.page])
    return state.walk.page;
  return state.phase === PHASE.P5 || state.phase === PHASE.P6
    ? engine.phase5Page(state)
    : engine.phasePage(state);
}
function textPage(pageKey) {
  const page = FLOW[pageKey];
  const { curNode, visited } = walkMarks(pageKey);
  const nodeName = (id) => {
    const node = page.nodes[id];
    return node
      ? engine.normalizeText(NODE.text(node)).replaceAll("*", "")
      : id;
  };
  let html =
    '<div class="flowtext"><p class="notice">Text version of ' +
    esc(page.name) +
    ". Each box lists where its arrows lead.</p><ol>";
  for (const id in page.nodes) {
    const node = page.nodes[id];
    const kind = NODE.kind(node);
    if (kind === NODE_KIND.NOTE && !/grp/.test(id)) continue;
    if (id === "grp") continue;
    const nodeExtra = NODE.extra(node);
    const outEdges = page.edges.filter((edge) => EDGE.from(edge) === id);
    let text =
      "<b>" + esc(ui.NODE_KIND_NAME[kind]) + ":</b> " + fmt(NODE.text(node));
    if (nodeExtra.t2)
      text += " " + ui.ringIcon() + " (ring part) — or " + fmt(nodeExtra.t2);
    if (nodeExtra.bold && !nodeExtra.t2)
      text += " " + ui.ringIcon() + " (ring condition)";
    if (nodeExtra.wome) text += " (WoME only)";
    if (nodeExtra.items)
      text +=
        (nodeExtra.any ? " any of: " : " ") +
        "<ol>" +
        nodeExtra.items.map((item) => "<li>" + fmt(item) + "</li>").join("") +
        "</ol>";
    if (outEdges.length)
      text +=
        '<div class="notice">' +
        outEdges
          .map(
            (edge) =>
              (EDGE.label(edge) ? esc(EDGE.label(edge)) + ": " : "then: ") +
              "go to “" +
              esc(nodeName(EDGE.to(edge))) +
              "”",
          )
          .join("; ") +
        "</div>";
    else if (kind === NODE_KIND.ACTION)
      text += '<div class="notice">then: stop (if not possible, rule 29)</div>';
    html +=
      '<li id="tx-' +
      id +
      '"' +
      (id === curNode
        ? ' style="outline:2px solid var(--accent);padding:4px"'
        : "") +
      ">" +
      text +
      walkMarkLabel(id, curNode, visited) +
      "</li>";
  }
  return html + "</ol></div>";
}
// The walk's mark on a box in the text view: the current step, a visited box, or nothing.
function walkMarkLabel(id, curNode, visited) {
  if (id === curNode) return " <b>(current step)</b>";
  if (visited.has(id)) return " <b>(visited)</b>";
  return "";
}
function wireFlowModal(modal, el) {
  ui.onClickEach(
    "[data-fp]",
    (button) => {
      flowPage = button.dataset.fp;
      renderModal();
    },
    el,
  );
  el.querySelector("#flowToggle").onclick = () => {
    flowText = !textMode();
    renderModal();
  };
}

// What the modal framework needs to show this modal.
export const flowViewer = {
  content: flowContent,
  wire: wireFlowModal,
  // Opened from the game screen, the viewer starts on the walk's page; the request is consumed so re-renders keep the tab chosen since.
  beforeRender(modal) {
    if (modal.arg?.current) {
      flowPage = currentPage();
      modal.arg = null;
    }
  },
};
