// ===== Modals: glossary, flowcharts (SVG), rules, calculator, save/load, settings, jump-to =====
import * as engine from "./qb.js";
import { FLOW, NODE, NODE_KIND, EDGE } from "./flow.js";
import { GLOSSARY, RULES, RULINGS, TURN } from "./ref.js";
import * as debug from "./debug.js";
// ui.js imports this module back (renderModal, closeModal, loadHTML, wireLoad). MODAL_CONTENT and MODAL_WIRERS below read MODAL
// while this module evaluates, so ui.js must have finished first: main.js imports this module before ui.js (see the note there).
import * as ui from "./ui.js";
import { escapeHTML as esc, formatText as fmt, MODAL } from "./ui.js";

const { PHASE } = engine;
const DEFAULT_FLOW_PAGE = "C14";
const ASK_NUMBER_MAX = 20;
const CALC_DEFAULTS = {
  reg: 0,
  elite: 0,
  lead: 0,
  cotw: 0,
  fort: false,
  strong: false,
  sortie: false,
};
let flowPage = DEFAULT_FLOW_PAGE,
  calc = { ...CALC_DEFAULTS };

let opener = null,
  flowText = false;
// The modal's element: a dialog box with a header (title, the calculator's Clear button, Close) and the content's body.
function buildModalElement(modal, { title, body, narrow }) {
  const el = document.createElement("div");
  el.className = "modal";
  el.id = "modal";
  const headerButtons =
    modal.name === MODAL.CALC
      ? '<button type="button" class="btn" id="calcClear">Clear</button>'
      : "";
  el.innerHTML =
    '<div class="box' +
    (narrow ? " narrow" : "") +
    '" role="dialog" aria-modal="true" aria-labelledby="mtitle"><header><h2 id="mtitle" tabindex="-1">' +
    esc(title) +
    '</h2><span class="hb">' +
    headerButtons +
    '<button class="btn x" id="mclose">Close</button></span></header>' +
    body +
    "</div>";
  return el;
}
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
    const first = focusable[0],
      last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
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
// Where focus goes when a modal opens: the glossary term it was opened for, else the title (a re-render keeps the current focus).
function focusOnOpen(modal, el, reopen) {
  if (modal.name === MODAL.GLOSSARY && modal.arg) {
    const term = el.querySelector('[data-gl="' + modal.arg + '"]');
    if (term) {
      term.scrollIntoView({ block: "start" });
      term.focus();
    }
  } else if (!reopen) ui.find("#mtitle").focus();
}
// The flowchart modal opened from the game screen starts on the walk's page; the request is consumed so re-renders keep the tab chosen since.
function selectFlowPage(modal) {
  if (modal.name === MODAL.FLOW && modal.arg?.current) {
    flowPage = currentPage();
    modal.arg = null;
  }
}
export function renderModal() {
  const modal = ui.modal;
  if (!modal) return;
  const existing = ui.find("#modal");
  const reopen = !!existing;
  if (existing) existing.remove();
  else opener = document.activeElement;
  selectFlowPage(modal);
  const content = modalContent(modal);
  const el = buildModalElement(modal, content);
  document.body.appendChild(el);
  const app = ui.find("#app");
  if (app) app.setAttribute("inert", "");
  ui.find("#mclose").onclick = closeModal;
  el.addEventListener("click", (event) => {
    if (event.target === el) closeModal();
  });
  trapTabFocus(el);
  labelBodyRegions(el, content.title);
  wireModal(modal, el);
  focusOnOpen(modal, el, reopen);
}
export function closeModal() {
  ui.setModal(null);
  const element = ui.find("#modal");
  if (element) element.remove();
  const app = ui.find("#app");
  if (app) app.removeAttribute("inert");
  if (opener?.isConnected) {
    opener.focus();
  }
  opener = null;
}

// The content of each modal: {title, body, narrow}.
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
const rulesContent = () => ({
  title: "General rules",
  body: rulesHTML(),
  narrow: true,
});
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
    flowText +
    '">' +
    (flowText ? "Show the diagram" : "Show as text") +
    "</button></p>" +
    (flowText
      ? textPage(flowPage)
      : '<div class="flowwrap">' + svgPage(flowPage) + "</div>") +
    "</div>",
  narrow: false,
});
const calcContent = () => ({
  title: "Army value calculator",
  body: calcHTML(),
  narrow: true,
});
const saveContent = () => ({
  title: "Save and load",
  body: saveHTML(),
  narrow: true,
});
const settingsContent = () => ({
  title: "Settings",
  body: settingsHTML(),
  narrow: true,
});
const jumpContent = () => ({
  title: "Walk from another start point",
  body: jumpHTML(),
  narrow: true,
});
const helpContent = () => ({ title: "Help", body: helpHTML(), narrow: true });
const debugContent = () => ({
  title: "Debug log",
  body: debugHTML(),
  narrow: true,
});
// A question from the app (ui.ask): text, an optional select or number input, and its buttons.
function askInputHTML(spec) {
  if (spec.input === "select")
    return (
      '<p><label for="askInput">' +
      esc(spec.inputLabel) +
      '</label><br><select id="askInput" class="askctl">' +
      spec.options
        .map(
          (option, i) =>
            '<option value="' + i + '">' + esc(option) + "</option>",
        )
        .join("") +
      "</select></p>"
    );
  if (spec.input === "number")
    return (
      '<p><label for="askInput">' +
      esc(spec.inputLabel) +
      '</label><br><input id="askInput" class="askctl" type="number" min="0" max="' +
      ASK_NUMBER_MAX +
      '" value="' +
      (spec.value || 1) +
      '"></p>'
    );
  return "";
}
function askContent(modal) {
  const spec = modal.arg;
  return {
    title: spec.title,
    body:
      '<div class="body"><p class="notice" style="font-size:.95rem;color:var(--ink)">' +
      esc(spec.text) +
      "</p>" +
      askInputHTML(spec) +
      '<div class="answers" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
      spec.buttons
        .map(
          (button) =>
            '<button class="btn' +
            (button.primary ? " primary" : "") +
            '" data-ask="' +
            button.v +
            '">' +
            esc(button.label) +
            "</button>",
        )
        .join("") +
      "</div></div>",
    narrow: true,
  };
}
const MODAL_CONTENT = {
  [MODAL.GLOSSARY]: glossaryContent,
  [MODAL.RULES]: rulesContent,
  [MODAL.FLOW]: flowContent,
  [MODAL.CALC]: calcContent,
  [MODAL.SAVE]: saveContent,
  [MODAL.SETTINGS]: settingsContent,
  [MODAL.JUMP]: jumpContent,
  [MODAL.HELP]: helpContent,
  [MODAL.DEBUG]: debugContent,
  [MODAL.ASK]: askContent,
};
function modalContent(modal) {
  const content = MODAL_CONTENT[modal.name];
  return content ? content(modal) : { title: "", body: "", narrow: false };
}
// The page the flowchart viewer opens on: the walk's page, else the strategy's page for the current phase.
function currentPage() {
  const state = ui.state;
  if (!state) return DEFAULT_FLOW_PAGE;
  if (state.walk && !state.walk.done && FLOW[state.walk.page])
    return state.walk.page;
  return state.phase === PHASE.P5 || state.phase === PHASE.P6
    ? engine.phase5Page(state)
    : engine.phasePage(state);
}
function helpHTML() {
  return (
    '<div class="body"><div class="notice" style="max-width:75ch;font-size:.9rem;color:var(--ink)">' +
    "<h4>What this app does</h4><p>It plays the Shadow side using the Queller Bot. You play the Free Peoples on your physical copy of War of the Ring. The app rolls Queller’s dice, holds its cards and asks you the yes/no questions from the flowcharts; you answer from the board and carry out the action it names.</p>" +
    "<h4>A turn</h4><p>The buttons at the top of the walkthrough are the green start points of the flowcharts, in turn order: Phase 1 (dice and cards), Phase 2 (strategy check, corruption strategy only), Phase 3 (Hunt box), Phase 4 (roll), then “Phase 5” each time Queller is eligible to act. When a battle starts, use “Battle” for the first round; the button becomes “Battle (next round)” while the battle continues. “Phase 6” is the victory check; the next turn then begins at Phase 1.</p>" +
    "<h4>Answering</h4><p>Each step is coloured like the paper flowchart and named in the line above it: a decision asks a question, an action tells you what Queller does (press Done, or Not possible if the game rules prevent it), a step is something to do before continuing. Italic terms show their definition when you hover or focus them; press Enter to open the glossary at that term.</p>" +
    "<h4>The board tracker</h4><p>Keep it up to date: it answers questions about the Fellowship, minions, nations and factions for you, and decides which of Queller’s cards can be played without showing you the rest of the hand. Card checks it asks you about are remembered for the turn; press Forget if the board has changed.</p>" +
    "<h4>Mistakes</h4><p>Undo reverses your last action (up to " +
    ui.UNDO_DEPTH +
    " steps). The game is saved automatically in this browser; Save / Load keeps named copies or moves a game to another device.</p>" +
    "<h4>Reporting a bug</h4><p>If the app itself goes wrong — a step that makes no sense, a card or die handled wrongly, a button that does nothing — open Settings and press Export debug log. The log holds the game state, the last actions you took and any errors; send it with a short description of what you expected. It also shows Queller’s hidden cards, so only read it if you do not mind seeing them.</p>" +
    "<h4>Abbreviations</h4><p>WoME: Warriors of Middle-earth. VP: victory points. FP: Free Peoples.</p></div></div>"
  );
}
function rulesHTML() {
  let html =
    '<div class="body rules"><p class="notice">The flowcharts, the rulings and the Learning Guide refer to these numbers.</p>';
  for (const [section, rules] of RULES) {
    html +=
      "<h4>" +
      esc(section) +
      "</h4><ol>" +
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
    "<h4>Turn sequence</h4><ol>" +
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
    "<h4>Rulings</h4>" +
    RULINGS.map(
      ([question, answer]) =>
        '<p style="max-width:75ch"><b>' +
        esc(question) +
        "</b><br>" +
        fmt(answer) +
        "</p>",
    ).join("");
  html +=
    '<h4>Key for the flowcharts</h4><p class="notice" style="max-width:75ch">A green ellipse is a start point. A red ellipse is an action: if Queller can do it legally, do it and stop; otherwise apply rule 29. A yellow or blue rounded rectangle is a yes/no decision about the board now. A grey striped box is a jump to the start point with that name; a die in brackets means use that die. A purple box is a priority list (rules 30 and 31). An orange box is a step: do it, then continue. Bold text with the ring mark ' +
    ui.ringIcon() +
    " is an Elven Ring condition (rule 36): if it is true and Queller lacks the die the next step needs, it uses a ring. “Phase 5 – continue from where you came” means return to the grey box that sent you here and follow its arrow out.</p></div>";
  return html;
}

// The flowchart as an SVG: the boxes of a page with the arrows between them, the walk's current box outlined and its visited boxes shaded.
const SVG_COLOUR = {
  ARROW: "#333",
  LABEL_TEXT: "#333",
  HATCH: "#999",
  GROUP_STROKE: "#999",
  BACKGROUND: "#fff",
  LABEL_BACKGROUND: "#fff",
  VISITED_SHADE: "#3a332c",
  CURRENT_OUTLINE: "#8A2A22",
  RING: "#7E2419",
  RING_BACKGROUND: "#fff",
  TEXT: "#1d1a17",
  GROUP_TEXT: "#555",
};
const FLOW_GEOMETRY = {
  PAGE_MARGIN: 20, // space kept right of and below the last box
  JOG: 20, // how far an arrow steps out of a box before turning
  ON_EDGE_TOLERANCE: 0.5, // an anchor this close to a box edge is on it
  STRAIGHT_TOLERANCE: 1, // two points this close are joined by a straight line
  SIDE_INSET_X: 8, // arrows meet a box at least this far from its left/right corners
  SIDE_INSET_Y: 6, // and this far from its top/bottom corners
  LABEL_CHAR_WIDTH: 5.6, // the label background's width per character
  LABEL_PAD: 8,
};
const NODE_STYLE = {
  [NODE_KIND.START]: { fill: "#d5e8d4", stroke: "#82b366" },
  [NODE_KIND.ACTION]: { fill: "#f8cecc", stroke: "#b85450" },
  [NODE_KIND.DECISION]: { fill: "#fff2cc", stroke: "#d6b656" },
  [NODE_KIND.FOLLOW_UP]: { fill: "#dae8fc", stroke: "#6c8ebf" },
  [NODE_KIND.JUMP]: { fill: "#f5f5f5", stroke: "#666666" },
  [NODE_KIND.PRIORITY]: { fill: "#e1d5e7", stroke: "#9673a6" },
  [NODE_KIND.STEP]: { fill: "#ffe6cc", stroke: "#d79b00" },
  [NODE_KIND.NOTE]: { fill: null, stroke: null },
};
// What the walk marks on a page: its current box (when it is on this page) and the boxes its trail visited.
function walkMarks(pageKey) {
  const walk = ui.state?.walk;
  const curNode =
    walk && !walk.done && walk.page === pageKey ? walk.node : null;
  const visited = new Set();
  if (
    walk?.page === pageKey ||
    walk?.trail.some((entry) => entry.page === pageKey)
  )
    walk.trail.forEach((entry) => {
      if (entry.page === pageKey && entry.node) visited.add(entry.node);
    });
  return { curNode, visited };
}
// The extent of a page's boxes and arrow waypoints.
function pageBounds(page) {
  let maxX = 0,
    maxY = 0;
  for (const id in page.nodes) {
    const box = NODE.box(page.nodes[id]);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  for (const edge of page.edges) {
    for (const waypoint of EDGE.waypoints(edge) || []) {
      maxX = Math.max(maxX, waypoint[0]);
      maxY = Math.max(maxY, waypoint[1]);
    }
  }
  return { maxX, maxY };
}
function svgOpen(page, { maxX, maxY }) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flowchart: ' +
    esc(page.name) +
    '. Use Show as text for a readable version." viewBox="0 0 ' +
    (maxX + FLOW_GEOMETRY.PAGE_MARGIN) +
    " " +
    (maxY + FLOW_GEOMETRY.PAGE_MARGIN) +
    '" width="100%" style="font-family:Helvetica,Arial,sans-serif;font-size:11px"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' +
    SVG_COLOUR.ARROW +
    '"/></marker><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="' +
    SVG_COLOUR.HATCH +
    '" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="' +
    SVG_COLOUR.BACKGROUND +
    '"/>'
  );
}
function edgeLabelSVG(label, points) {
  const [labelX, labelY] = midpoint(points);
  const labelWidth =
    label.length * FLOW_GEOMETRY.LABEL_CHAR_WIDTH + FLOW_GEOMETRY.LABEL_PAD;
  return (
    '<rect x="' +
    (labelX - labelWidth / 2) +
    '" y="' +
    (labelY - 7) +
    '" width="' +
    labelWidth +
    '" height="13" rx="2" fill="' +
    SVG_COLOUR.LABEL_BACKGROUND +
    '"/><text x="' +
    labelX +
    '" y="' +
    (labelY + 3) +
    '" text-anchor="middle" font-size="10" fill="' +
    SVG_COLOUR.LABEL_TEXT +
    '">' +
    esc(label) +
    "</text>"
  );
}
// An arrow between two boxes: its polyline and, when it has a shown label, the label drawn at its midpoint.
function edgeSVG(page, edge) {
  const fromNode = page.nodes[EDGE.from(edge)],
    toNode = page.nodes[EDGE.to(edge)];
  if (!fromNode || !toNode) return { line: "", label: "" };
  const points = route(
    NODE.box(fromNode),
    NODE.box(toNode),
    EDGE.waypoints(edge),
    EDGE.anchors(edge),
    EDGE.isElbow(edge),
  );
  const label = EDGE.label(edge);
  return {
    line:
      '<polyline points="' +
      points.map((point) => point.join(",")).join(" ") +
      '" fill="none" stroke="' +
      SVG_COLOUR.ARROW +
      '" stroke-width="1.2" marker-end="url(#arr)"/>',
    label: label && !EDGE.hidesLabel(edge) ? edgeLabelSVG(label, points) : "",
  };
}
const isEllipse = (kind) =>
  kind === NODE_KIND.START || kind === NODE_KIND.ACTION;
const ellipseSVG = ({ x, y, width, height }, attrs) =>
  '<ellipse cx="' +
  (x + width / 2) +
  '" cy="' +
  (y + height / 2) +
  '" rx="' +
  width / 2 +
  '" ry="' +
  height / 2 +
  '" ' +
  attrs +
  "/>";
const rectSVG = ({ x, y, width, height }, rx, attrs) =>
  '<rect x="' +
  x +
  '" y="' +
  y +
  '" width="' +
  width +
  '" height="' +
  height +
  '" rx="' +
  rx +
  '" ' +
  attrs +
  "/>";
// A box's outline by kind: an ellipse, a hatched jump box, a dashed group frame, a square step or a rounded rectangle.
function nodeShapeSVG(kind, id, box, style) {
  const fill = style.fill || "none",
    stroke = style.stroke || "none";
  const paint = 'fill="' + fill + '" stroke="' + stroke + '"';
  if (isEllipse(kind)) return ellipseSVG(box, paint);
  if (kind === NODE_KIND.NOTE)
    return id === "grp"
      ? rectSVG(
          box,
          8,
          'fill="none" stroke="' +
            SVG_COLOUR.GROUP_STROKE +
            '" stroke-dasharray="4 3"',
        )
      : "";
  if (kind === NODE_KIND.JUMP) {
    const { x, y, width, height } = box;
    return (
      '<rect x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      width +
      '" height="' +
      height +
      '" ' +
      paint +
      '/><rect x="' +
      x +
      '" y="' +
      y +
      '" width="8" height="' +
      height +
      '" fill="url(#hatch)" stroke="' +
      stroke +
      '"/><rect x="' +
      (x + width - 8) +
      '" y="' +
      y +
      '" width="8" height="' +
      height +
      '" fill="url(#hatch)" stroke="' +
      stroke +
      '"/>'
    );
  }
  return rectSVG(box, kind === NODE_KIND.STEP ? 0 : 8, paint);
}
function visitedShadeSVG(kind, box) {
  const shade =
    'fill="' + SVG_COLOUR.VISITED_SHADE + '" fill-opacity=".22" stroke="none"';
  if (isEllipse(kind)) return ellipseSVG(box, shade);
  const rx = kind === NODE_KIND.STEP || kind === NODE_KIND.JUMP ? 0 : 8;
  return rectSVG(box, rx, shade);
}
function currentOutlineSVG({ x, y, width, height }) {
  return (
    '<rect x="' +
    (x - 5) +
    '" y="' +
    (y - 5) +
    '" width="' +
    (width + 10) +
    '" height="' +
    (height + 10) +
    '" rx="12" fill="none" stroke="' +
    SVG_COLOUR.CURRENT_OUTLINE +
    '" stroke-width="3"/>'
  );
}
// The box's text, laid out as HTML inside a foreignObject.
function nodeTextSVG(kind, id, node, { x, y, width, height }) {
  const nodeExtra = NODE.extra(node);
  const pad = kind === NODE_KIND.NOTE ? 0 : 4;
  const extraHeight = id === "ringNote" ? 14 : 0;
  return (
    '<foreignObject x="' +
    (x + pad) +
    '" y="' +
    (y + pad) +
    '" width="' +
    (width - 2 * pad) +
    '" height="' +
    (height - 2 * pad + extraHeight) +
    '"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:' +
    (nodeExtra.items || id === "grp" ? "flex-start" : "center") +
    ";justify-content:center;text-align:center;color:" +
    SVG_COLOUR.TEXT +
    ";line-height:1.15;font-size:11px;overflow:hidden;" +
    (nodeExtra.bold ? "font-weight:700;" : "") +
    '"><div style="width:100%">' +
    nodeLabel(kind, id, NODE.text(node), node) +
    "</div></div></foreignObject>"
  );
}
// The ring mark: at the top-right corner of a box with an Elven Ring condition, or beside the ring note.
function ringMarkSVG(id, { x, y, width }, bold) {
  if (id === "ringNote")
    return (
      '<g transform="translate(' +
      (x - 2) +
      "," +
      (y + 8) +
      ') scale(0.85)" style="color:' +
      SVG_COLOUR.RING +
      '"><title>Elven Ring condition (rule 36)</title>' +
      ui.RING_PATH +
      "</g>"
    );
  if (!bold) return "";
  return (
    '<g transform="translate(' +
    (x + width - 18) +
    "," +
    (y - 8) +
    ') scale(0.75)" style="color:' +
    SVG_COLOUR.RING +
    '"><title>Elven Ring condition (rule 36)</title><circle cx="12" cy="13.5" r="9.5" fill="' +
    SVG_COLOUR.RING_BACKGROUND +
    '"/>' +
    ui.RING_PATH +
    "</g>"
  );
}
function nodeSVG(id, node, { curNode, visited }) {
  const kind = NODE.kind(node),
    box = NODE.box(node);
  const isCurrent = id === curNode;
  let shape = nodeShapeSVG(kind, id, box, NODE_STYLE[kind]);
  if (visited.has(id) && !isCurrent && kind !== NODE_KIND.NOTE)
    shape += visitedShadeSVG(kind, box);
  if (isCurrent) shape += currentOutlineSVG(box);
  return (
    '<g data-node="' +
    id +
    '">' +
    shape +
    nodeTextSVG(kind, id, node, box) +
    ringMarkSVG(id, box, NODE.extra(node).bold) +
    "</g>"
  );
}
function svgPage(pageKey) {
  const page = FLOW[pageKey];
  const marks = walkMarks(pageKey);
  // edges first, so the boxes are drawn over them; the labels last, over everything
  const edges = page.edges.map((edge) => edgeSVG(page, edge));
  return (
    svgOpen(page, pageBounds(page)) +
    edges.map((edge) => edge.line).join("") +
    Object.entries(page.nodes)
      .map(([id, node]) => nodeSVG(id, node, marks))
      .join("") +
    edges.map((edge) => edge.label).join("") +
    "</svg>"
  );
}
function textPage(pageKey) {
  const page = FLOW[pageKey];
  const { curNode } = walkMarks(pageKey);
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
      (id === curNode ? " <b>(current step)</b>" : "") +
      "</li>";
  }
  return html + "</ol></div>";
}
// The HTML inside a node box: page titles, the ring note and group labels have their own styling; everything else is the node text.
function nodeLabel(kind, id, text, node) {
  if (kind === NODE_KIND.NOTE && id !== "grp" && /title/.test(id))
    return (
      '<div style="font-size:16px;font-weight:700;text-align:right">' +
      esc(text) +
      "</div>"
    );
  if (id === "ringNote")
    return (
      '<div style="font-weight:700;text-align:left;line-height:1.1;padding-left:22px">' +
      esc(text) +
      "</div>"
    );
  if (id === "grp")
    return (
      '<div style="text-align:left;padding:5px 8px;color:' +
      SVG_COLOUR.GROUP_TEXT +
      '">' +
      esc(text) +
      "</div>"
    );
  return nodeInner(node);
}
function nodeInner(node) {
  const text = NODE.text(node),
    nodeExtra = NODE.extra(node);
  let html = esc(text)
    .replace(ui.MARKUP_TERM, "<i>$1</i>")
    .replaceAll("\n", "<br>");
  if (nodeExtra?.t2)
    html =
      "<b>" +
      html +
      "</b> or " +
      esc(nodeExtra.t2).replace(ui.MARKUP_TERM, "<i>$1</i>");
  if (nodeExtra?.items)
    html =
      '<div style="text-align:left;width:100%"><b style="display:block;text-align:center">' +
      html +
      "</b><" +
      (nodeExtra.any ? "ul" : "ol") +
      ' style="margin:2px 0 0;padding-left:18px">' +
      nodeExtra.items
        .map(
          (item) =>
            "<li>" + esc(item).replace(ui.MARKUP_TERM, "<i>$1</i>") + "</li>",
        )
        .join("") +
      "</" +
      (nodeExtra.any ? "ul" : "ol") +
      "></div>";
  return html;
}
// The point halfway along a polyline, for its label.
function midpoint(points) {
  let total = 0;
  const segmentLengths = [];
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
    );
    segmentLengths.push(length);
    total += length;
  }
  let remaining = total / 2;
  for (let i = 1; i < points.length; i++) {
    if (remaining <= segmentLengths[i - 1]) {
      const fraction = segmentLengths[i - 1]
        ? remaining / segmentLengths[i - 1]
        : 0;
      return [
        points[i - 1][0] + (points[i][0] - points[i - 1][0]) * fraction,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * fraction,
      ];
    }
    remaining -= segmentLengths[i - 1];
  }
  return points[points.length - 1];
}

// Arrow routing. Boxes are {x, y, width, height}; points and waypoints are [x, y].
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// A point along a box's top or bottom edge, kept off the corners.
const alongTop = (box, px) =>
  clamp(
    px,
    box.x + FLOW_GEOMETRY.SIDE_INSET_X,
    box.x + box.width - FLOW_GEOMETRY.SIDE_INSET_X,
  );
// A point along a box's left or right edge, kept off the corners.
const alongSide = (box, py) =>
  clamp(
    py,
    box.y + FLOW_GEOMETRY.SIDE_INSET_Y,
    box.y + box.height - FLOW_GEOMETRY.SIDE_INSET_Y,
  );
// The point on a box's edge nearest to (px, py): on the top or bottom edge when the point is more above/below than beside it.
function anchor(box, px, py) {
  const { x, y, width, height } = box;
  const dx = px - (x + width / 2),
    dy = py - (y + height / 2);
  if (Math.abs(dy) * width > Math.abs(dx) * height)
    return [alongTop(box, px), dy > 0 ? y + height : y];
  return [dx > 0 ? x + width : x, alongSide(box, py)];
}
// anchor towards a draw.io waypoint: leave from the side the point lies beyond (horizontal when it is outside the box's x-range), like draw.io's orthogonal router
function waypointAnchor(box, px, py) {
  const { x, y, width, height } = box;
  const outX = px < x || px > x + width,
    outY = py < y || py > y + height;
  if (outX)
    return [
      px < x ? x : x + width,
      py >= y + FLOW_GEOMETRY.SIDE_INSET_Y &&
      py <= y + height - FLOW_GEOMETRY.SIDE_INSET_Y
        ? py
        : y + height / 2,
    ];
  if (outY)
    return [
      px >= x + FLOW_GEOMETRY.SIDE_INSET_X &&
      px <= x + width - FLOW_GEOMETRY.SIDE_INSET_X
        ? px
        : x + width / 2,
      py < y ? y : y + height,
    ];
  return anchor(box, px, py);
}
const onTopOrBottomEdge = (box, point) =>
  Math.abs(point[1] - box.y) < FLOW_GEOMETRY.ON_EDGE_TOLERANCE ||
  Math.abs(point[1] - box.y - box.height) < FLOW_GEOMETRY.ON_EDGE_TOLERANCE; // an anchor there means a vertical exit/entry
// Two points that differ in both x and y need a bend between them.
const needsBend = (from, to) =>
  Math.abs(to[0] - from[0]) > FLOW_GEOMETRY.STRAIGHT_TOLERANCE &&
  Math.abs(to[1] - from[1]) > FLOW_GEOMETRY.STRAIGHT_TOLERANCE;
// A point on a box from a draw.io anchor (fractions of the width and height).
const anchorAt = (box, anchorFraction) => [
  box.x + box.width * anchorFraction[0],
  box.y + box.height * anchorFraction[1],
];
// The point the edge heads for at one end: the first/last waypoint, else the other box's explicit anchor, else its centre.
function towards(waypoint, anchorFraction, box, centre) {
  if (waypoint) return waypoint;
  return anchorFraction ? anchorAt(box, anchorFraction) : centre;
}
// Where the edge meets a box: its explicit anchor when draw.io gives one, else the nearest point facing towardPoint (a waypoint or the other end).
function edgeEnd(box, anchorFraction, hasWaypoints, towardPoint) {
  if (anchorFraction) return anchorAt(box, anchorFraction);
  return hasWaypoints
    ? waypointAnchor(box, towardPoint[0], towardPoint[1])
    : anchor(box, towardPoint[0], towardPoint[1]);
}
// Which way an edge leaves a box: -1 from the top (vertical) or left edge, +1 from the bottom or right.
function exitDirection(box, point, vertical) {
  const nearStart = vertical
    ? Math.abs(point[1] - box.y) < FLOW_GEOMETRY.ON_EDGE_TOLERANCE
    : Math.abs(point[0] - box.x) < FLOW_GEOMETRY.ON_EDGE_TOLERANCE;
  return nearStart ? -1 : 1;
}
// A box's position and size fields along each axis.
const AXIS_FIELDS = {
  x: { position: "x", size: "width" },
  y: { position: "y", size: "height" },
};
// A lane for a detour between two boxes along one axis: midway through the gap between them when there is one,
// otherwise just outside both boxes on the side the edge is heading (towardsStart = towards 0).
function lane(fromBox, toBox, axis, towardsStart, jog) {
  const { position, size } = AXIS_FIELDS[axis];
  if (towardsStart) {
    if (toBox[position] + toBox[size] <= fromBox[position])
      return (toBox[position] + toBox[size] + fromBox[position]) / 2;
    return Math.min(fromBox[position], toBox[position]) - jog;
  }
  if (fromBox[position] + fromBox[size] <= toBox[position])
    return (fromBox[position] + fromBox[size] + toBox[position]) / 2;
  return (
    Math.max(fromBox[position] + fromBox[size], toBox[position] + toBox[size]) +
    jog
  );
}
function boxCentre(box) {
  return [box.x + box.width / 2, box.y + box.height / 2];
}
// Both ends leave their boxes the same way (both right, or both down): step out past the farther one and across.
function sameSideDetour(previous, end, exitDir, vertical, jog) {
  if (vertical) {
    const outY =
      exitDir > 0
        ? Math.max(previous[1], end[1]) + jog
        : Math.min(previous[1], end[1]) - jog;
    return [
      [previous[0], outY],
      [end[0], outY],
    ];
  }
  const outX =
    exitDir > 0
      ? Math.max(previous[0], end[0]) + jog
      : Math.min(previous[0], end[0]) - jog;
  return [
    [outX, previous[1]],
    [outX, end[1]],
  ];
}
// The ends face away from each other: step out of each box and run along a lane between (or beside) them.
function oppositeSideDetour(
  fromBox,
  toBox,
  previous,
  end,
  exitDir,
  vertical,
  jog,
) {
  if (vertical) {
    const outY = previous[1] + jog * exitDir,
      inY = end[1] - jog * exitDir;
    const laneX = lane(fromBox, toBox, "x", end[0] < previous[0], jog);
    return [
      [previous[0], outY],
      [laneX, outY],
      [laneX, inY],
      [end[0], inY],
    ];
  }
  const outX = previous[0] + jog * exitDir,
    inX = end[0] - jog * exitDir;
  const laneY = lane(fromBox, toBox, "y", end[1] < previous[1], jog);
  return [
    [outX, previous[1]],
    [outX, laneY],
    [inX, laneY],
    [inX, end[1]],
  ];
}
// Both ends on the same axis: a Z through the midpoint.
function midpointBend(previous, end, vertical) {
  if (vertical) {
    const midY = (previous[1] + end[1]) / 2;
    return [
      [previous[0], midY],
      [end[0], midY],
    ];
  }
  const midX = (previous[0] + end[0]) / 2;
  return [
    [midX, previous[1]],
    [midX, end[1]],
  ];
}
// One end vertical, the other horizontal: a single corner.
const cornerBend = (previous, end, exitVertical) =>
  exitVertical ? [previous[0], end[1]] : [end[0], previous[1]];
// The bend between the last point reached and the entry point, chosen by how the two ends leave their boxes.
function bendPoints(
  fromBox,
  toBox,
  start,
  previous,
  end,
  { exitVertical, entryVertical, hasWaypoints },
) {
  const jog = FLOW_GEOMETRY.JOG;
  const sameAxis = exitVertical === entryVertical;
  if (sameAxis && !hasWaypoints) {
    const exitDir = exitDirection(fromBox, start, exitVertical),
      entryDir = exitDirection(toBox, end, entryVertical);
    if (exitDir === entryDir)
      return sameSideDetour(previous, end, exitDir, exitVertical, jog);
    const axis = exitVertical ? 1 : 0;
    if ((end[axis] - previous[axis]) * exitDir < 0)
      return oppositeSideDetour(
        fromBox,
        toBox,
        previous,
        end,
        exitDir,
        exitVertical,
        jog,
      );
  }
  if (sameAxis) return midpointBend(previous, end, exitVertical);
  return [cornerBend(previous, end, exitVertical)];
}
// draw.io elbowEdgeStyle: one elbow positioned by the first waypoint.
function routeElbow(fromBox, toBox, waypoints, anchors) {
  const start = anchorAt(fromBox, anchors.ex),
    end = anchorAt(toBox, anchors.en);
  const exitVertical = anchors.ex[1] === 0 || anchors.ex[1] === 1;
  return exitVertical
    ? [start, [start[0], waypoints[0][1]], [end[0], waypoints[0][1]], end]
    : [start, [waypoints[0][0], start[1]], [waypoints[0][0], end[1]], end];
}
// Explicit draw.io exit/entry anchors (fractions of the box); a missing side falls back to the nearest-point heuristic.
function routeWithAnchors(fromBox, toBox, waypoints, anchors) {
  const fromCentre = boxCentre(fromBox),
    toCentre = boxCentre(toBox);
  const hasWaypoints = !!waypoints?.length;
  const first = towards(waypoints?.[0], anchors.en, toBox, toCentre),
    last = towards(waypoints?.at(-1), anchors.ex, fromBox, fromCentre);
  const start = edgeEnd(fromBox, anchors.ex, hasWaypoints, first);
  const end = edgeEnd(toBox, anchors.en, hasWaypoints, last);
  const exitVertical = onTopOrBottomEdge(fromBox, start),
    entryVertical = onTopOrBottomEdge(toBox, end);
  const points = [start];
  let previous = start;
  for (const waypoint of waypoints || []) {
    if (needsBend(previous, waypoint))
      points.push(
        exitVertical ? [previous[0], waypoint[1]] : [waypoint[0], previous[1]],
      );
    points.push(waypoint);
    previous = waypoint;
  }
  if (needsBend(previous, end))
    points.push(
      ...bendPoints(fromBox, toBox, start, previous, end, {
        exitVertical,
        entryVertical,
        hasWaypoints,
      }),
    );
  points.push(end);
  return points;
}
// draw.io waypoints without anchors: leave and enter facing the nearest waypoint, bending horizontally first.
function routeWithWaypoints(fromBox, toBox, waypoints) {
  const start = waypointAnchor(fromBox, waypoints[0][0], waypoints[0][1]);
  const end = waypointAnchor(
    toBox,
    waypoints[waypoints.length - 1][0],
    waypoints[waypoints.length - 1][1],
  );
  const points = [start];
  let previous = start;
  for (const waypoint of waypoints) {
    if (needsBend(previous, waypoint)) points.push([waypoint[0], previous[1]]);
    points.push(waypoint);
    previous = waypoint;
  }
  if (needsBend(previous, end)) points.push([previous[0], end[1]]);
  points.push(end);
  return points;
}
// A straight or Z-shaped line between two points, bending at the midpoint of the given axis (0 = x, 1 = y).
function zigzag(start, finish, axis) {
  const other = 1 - axis;
  if (Math.abs(start[other] - finish[other]) < FLOW_GEOMETRY.STRAIGHT_TOLERANCE)
    return [start, finish];
  const mid = (start[axis] + finish[axis]) / 2;
  const bend = (point) => (axis === 1 ? [point[0], mid] : [mid, point[1]]);
  return [start, bend(start), bend(finish), finish];
}
// Boxes one above the other: leave from the facing top or bottom edge, aimed at the other box's centre.
function verticalRoute(fromBox, toBox, fromCentre, toCentre, downward) {
  const start = [
      alongTop(fromBox, toCentre[0]),
      downward ? fromBox.y + fromBox.height : fromBox.y,
    ],
    finish = [
      alongTop(toBox, fromCentre[0]),
      downward ? toBox.y : toBox.y + toBox.height,
    ];
  return zigzag(start, finish, 1);
}
// Boxes side by side: leave from the facing left or right edge, aimed at the other box's centre.
function horizontalRoute(fromBox, toBox, fromCentre, toCentre, rightward) {
  const start = [
      rightward ? fromBox.x + fromBox.width : fromBox.x,
      alongSide(fromBox, toCentre[1]),
    ],
    finish = [
      rightward ? toBox.x : toBox.x + toBox.width,
      alongSide(toBox, fromCentre[1]),
    ];
  return zigzag(start, finish, 0);
}
// No anchors and no waypoints: route by where the boxes lie relative to each other.
function routeGeometric(fromBox, toBox) {
  const fromCentre = boxCentre(fromBox),
    toCentre = boxCentre(toBox);
  const below = toCentre[1] > fromBox.y + fromBox.height,
    above = toCentre[1] + toBox.height / 2 < fromBox.y,
    right = toCentre[0] > fromBox.x + fromBox.width,
    left = toCentre[0] + toBox.width / 2 < fromBox.x;
  const moreVertical =
    Math.abs(toCentre[0] - fromCentre[0]) <
    Math.abs(toCentre[1] - fromCentre[1]);
  if ((below && !(right || left)) || (below && moreVertical))
    return verticalRoute(fromBox, toBox, fromCentre, toCentre, true);
  if (above && moreVertical)
    return verticalRoute(fromBox, toBox, fromCentre, toCentre, false);
  return horizontalRoute(fromBox, toBox, fromCentre, toCentre, right);
}
// The polyline of an arrow from one box to another, using whatever draw.io recorded for it.
function route(fromBox, toBox, waypoints, anchors, elbow) {
  if (elbow && waypoints?.length && anchors?.ex && anchors.en)
    return routeElbow(fromBox, toBox, waypoints, anchors);
  if (anchors && (anchors.ex || anchors.en))
    return routeWithAnchors(fromBox, toBox, waypoints, anchors);
  if (waypoints?.length) return routeWithWaypoints(fromBox, toBox, waypoints);
  return routeGeometric(fromBox, toBox);
}

// The army value calculator.
const CALC_MAX = { reg: 10, elite: 10, lead: 10, cotw: 5 };
// The army value rules (glossary: *value*).
const ARMY_VALUE = {
  ELITE_HITS: 2,
  MAX_COMBAT_DICE: 5,
  MAX_LEADERSHIP: 5,
  STRONGEST_UNITS: 5, // a Stronghold defender counts the hits of its five strongest units
  FORTIFICATION_BONUS: 1,
  STRONGHOLD_MULTIPLIER: 1.5,
  SORTIE_MULTIPLIER: 0.5,
};
function calcHTML() {
  const number = (key, label) =>
    ui.numberRowHTML(
      "c-" + key,
      fmt(label),
      calc[key],
      'data-cs="' + key + '"',
    );
  const checkbox = (key, label) =>
    ui.checkboxRowHTML(
      "c-" + key,
      fmt(label),
      calc[key],
      'data-c="' + key + '"',
    );
  return (
    '<div class="body"><p class="notice">' +
    fmt(
      "The *value* of an army per the glossary. Hits: 1 per Regular, " +
        ARMY_VALUE.ELITE_HITS +
        " per Elite. Combat dice: one per Army unit, maximum " +
        ARMY_VALUE.MAX_COMBAT_DICE +
        ". Leadership: maximum " +
        ARMY_VALUE.MAX_LEADERSHIP +
        " and not more than the number of Army units.",
    ) +
    '</p><div class="calc tracker">' +
    number("reg", "Regular units") +
    number("elite", "Elite units") +
    number("lead", "Leadership (Nazgûl, leaders, minions, Companions)¹") +
    number("cotw", "Captains of the West (Free Peoples only)") +
    checkbox("fort", "Defends in a Fortification or City region") +
    checkbox(
      "strong",
      "Defends in a Stronghold (×" +
        ARMY_VALUE.STRONGHOLD_MULTIPLIER +
        ", five strongest units’ hits)",
    ) +
    checkbox("sortie", "Sortie (×" + ARMY_VALUE.SORTIE_MULTIPLIER + ")") +
    '<div class="out">' +
    calcOut() +
    '</div><p class="notice" style="margin-top:10px">' +
    fmt(
      "¹ When testing whether an army is *mobile*, do not count Saruman in its leadership.",
    ) +
    "</p></div></div>"
  );
}
function calcOut() {
  const units = calc.reg + calc.elite;
  const lines = [];
  let hits = calc.reg + ARMY_VALUE.ELITE_HITS * calc.elite;
  if (calc.strong) {
    const top = Math.min(ARMY_VALUE.STRONGEST_UNITS, units);
    const eliteCounted = Math.min(top, calc.elite);
    hits = eliteCounted * ARMY_VALUE.ELITE_HITS + (top - eliteCounted);
    lines.push("Hits (five strongest units): " + hits);
  } else lines.push("Hits: " + hits);
  const dice = Math.min(ARMY_VALUE.MAX_COMBAT_DICE, units + calc.cotw);
  lines.push("Combat dice: " + dice);
  const lead = Math.min(ARMY_VALUE.MAX_LEADERSHIP, Math.min(calc.lead, units));
  lines.push("Leadership: " + lead);
  let value = hits + dice + lead + calc.cotw;
  if (calc.cotw) lines.push("Captains of the West: +" + calc.cotw);
  if (calc.fort) {
    value += ARMY_VALUE.FORTIFICATION_BONUS;
    lines.push("Fortification/City: +" + ARMY_VALUE.FORTIFICATION_BONUS);
  }
  if (calc.strong) {
    value = Math.floor(value * ARMY_VALUE.STRONGHOLD_MULTIPLIER);
    lines.push(
      "Stronghold: ×" + ARMY_VALUE.STRONGHOLD_MULTIPLIER + " rounded down",
    );
  }
  if (calc.sortie) {
    value = Math.floor(value * ARMY_VALUE.SORTIE_MULTIPLIER);
    lines.push("Sortie: ×" + ARMY_VALUE.SORTIE_MULTIPLIER + " rounded down");
  }
  return (
    '<div class="n">' +
    value +
    "</div><div>" +
    fmt("Army *value*") +
    "</div><ul>" +
    lines.map((line) => "<li>" + esc(line) + "</li>").join("") +
    "</ul>"
  );
}

// Transfer helpers (save file, debug log).
// The artifact host offers a downloads capability; a plain <a download> may be inert for viewers, so the copy button (and the text box) is the fallback.
async function downloadText({ fileName, data, noteEl, fallbackLabel }) {
  try {
    const downloads = window.claude?.use
      ? await window.claude.use("downloads")
      : null;
    if (downloads) {
      await downloads.save({ filename: fileName, data });
      noteEl.textContent = "Saved " + fileName + ".";
      return;
    }
  } catch (error) {
    noteEl.textContent =
      "Download not completed: " + (error.message || error.code || "cancelled");
    return;
  }
  try {
    const link = document.createElement("a");
    link.href =
      "data:application/json;charset=utf-8," + encodeURIComponent(data);
    link.download = fileName;
    link.click();
    noteEl.textContent = "If nothing downloaded, use " + fallbackLabel + ".";
  } catch {
    // The browser blocked the download; the note points the user at the alternative.
    noteEl.textContent =
      "Downloads are not available here — use " + fallbackLabel + ".";
  }
}
async function copyText({ data, noteEl, label, textarea }) {
  try {
    await navigator.clipboard.writeText(data);
    noteEl.textContent = label + " copied to the clipboard.";
  } catch {
    // Clipboard access was refused; select the text so the user can copy it by hand.
    if (textarea) {
      textarea.value = data;
      textarea.focus();
      textarea.select();
    }
    noteEl.textContent = "Copy the text from the box below.";
  }
}

// The debug log modal.
function environment() {
  const mediaMatches = (query) => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return null;
    }
  };
  let storage = "ok";
  try {
    localStorage.setItem(ui.STORAGE_KEY.PROBE, "1");
    localStorage.removeItem(ui.STORAGE_KEY.PROBE);
  } catch (error) {
    storage = "unavailable: " + (error.message || error);
  }
  return {
    built: typeof QB_BUILT === "undefined" ? null : QB_BUILT, // defined by build.js
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    touchPoints: navigator.maxTouchPoints,
    viewport: [window.innerWidth, window.innerHeight],
    screen: [screen.width, screen.height],
    dpr: window.devicePixelRatio,
    theme: document.documentElement.dataset.theme || "system",
    prefersDark: mediaMatches("(prefers-color-scheme: dark)"),
    coarsePointer: mediaMatches("(pointer: coarse)"),
    reducedMotion: mediaMatches("(prefers-reduced-motion: reduce)"),
    online: navigator.onLine,
    storage,
    timeZone: Intl.DateTimeFormat().resolvedOptions()?.timeZone,
    utcOffsetMin: -new Date().getTimezoneOffset(),
    visibility: document.visibilityState,
    uptimeMs: Math.round(performance.now()),
    url: location.origin + location.pathname,
  };
}
function storageOverview() {
  const overview = {};
  for (const key of Object.values(ui.STORAGE_KEY)) {
    const value = ui.storageGet(key);
    overview[key] = value == null ? null : value.length;
  }
  return overview;
}
function domSnapshot() {
  const textOf = (selector) => {
    const el = document.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 600) : null;
  };
  const modal = ui.modal;
  let modalName = null;
  if (modal)
    modalName =
      modal.name +
      (modal.name === MODAL.ASK && modal.arg ? ": " + modal.arg.title : "");
  const activeEl = document.activeElement;
  let active = null;
  if (activeEl && activeEl !== document.body) {
    const label = activeEl.textContent
      ? " “" + activeEl.textContent.trim().slice(0, 40) + "”"
      : "";
    active =
      activeEl.tagName.toLowerCase() +
      (activeEl.id ? "#" + activeEl.id : "") +
      label;
  }
  return {
    rendered: !!document.getElementById("app")?.children.length,
    prompt: textOf(".prompt"),
    result: textOf(".result"),
    phaseButtons: [...document.querySelectorAll("[data-phase]")].map(
      (button) => button.dataset.phase,
    ),
    modal: modalName,
    errorBar: !!document.getElementById("errbar"),
    activeElement: active,
  };
}
function debugText() {
  return debug.text({
    state: ui.state,
    history: ui.history,
    report: ui.find("#dbgReport")?.value || "",
    env: environment(),
    dom: domSnapshot(),
    storage: storageOverview(),
    brokenAutosave: ui.storageGet(ui.STORAGE_KEY.BROKEN_AUTOSAVE) || null,
    opts: ui.parseJSONOr(ui.storageGet(ui.STORAGE_KEY.OPTIONS) || "null", null),
  });
}
function debugHTML() {
  return (
    '<div class="body"><p class="notice" style="color:var(--ink)">The debug log describes this browser, the game as it stands, the last ' +
    debug.LIMITS.actions +
    " actions, the trails of recent walks and any errors the app recorded, so that a problem can be traced from a report. It contains no personal details, but it does show Queller’s hidden cards — only read it if you do not mind seeing them.</p>" +
    '<p style="margin-top:12px"><label for="dbgReport"><b>What went wrong?</b> <span class="notice" style="display:inline">(optional — saved into the log: what you did, what you expected, what happened)</span></label><textarea id="dbgReport" style="min-height:80px" placeholder="For example: after answering Yes to “Witch King in play” the walk jumped to the Army page instead of Character 2."></textarea></p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn primary" id="dbgDl">Download debug log</button><button type="button" class="btn" id="dbgCopy">Copy debug log</button></div><div id="dbgNote" class="notice" role="status" aria-live="polite" style="margin-top:6px"></div>' +
    '<p style="margin-top:12px"><label for="dbgTxt" class="notice">The log (select all and copy if the buttons do not work)</label><textarea id="dbgTxt" readonly spellcheck="false" style="min-height:200px"></textarea></p></div>'
  );
}
function wireDebug(modal, el) {
  const textarea = el.querySelector("#dbgTxt");
  if (!textarea) return;
  const refresh = () => {
    try {
      textarea.value = debugText();
    } catch (error) {
      textarea.value =
        "The debug log could not be built: " +
        (error.stack || error.message || error);
      debug.error(error, { action: "debugBuild" }, ui.state);
    }
    return textarea.value;
  };
  refresh();
  el.querySelector("#dbgReport").onchange = refresh;
  el.querySelector("#dbgDl").onclick = () => {
    const data = refresh();
    debug.action(
      { action: "debugExport", how: "download", bytes: data.length },
      ui.state,
    );
    downloadText({
      fileName: debug.fileName(ui.state),
      data,
      noteEl: el.querySelector("#dbgNote"),
      fallbackLabel: "Copy debug log",
    });
  };
  el.querySelector("#dbgCopy").onclick = () => {
    const data = refresh();
    debug.action(
      { action: "debugExport", how: "copy", bytes: data.length },
      ui.state,
    );
    copyText({
      data,
      noteEl: el.querySelector("#dbgNote"),
      label: "Debug log",
      textarea,
    });
  };
}

// Save and load.
const slots = () =>
  ui.parseJSONOr(ui.storageGet(ui.STORAGE_KEY.SLOTS) || "[]", []);
function saveHTML() {
  const slotList = slots();
  let html =
    '<div class="body"><p class="notice">The game is saved automatically in this browser after every action. Named saves are also kept in this browser. To move a game to another device, download it or copy the code.</p>';
  html +=
    "<h4>Named saves</h4>" +
    [0, 1, 2]
      .map((i) => {
        const slot = slotList[i];
        return (
          '<div class="slot"><span class="t">Slot ' +
          (i + 1) +
          (slot ? ": turn " + slot.turn + ", " + esc(slot.when) : ": empty") +
          '</span><button class="btn small" data-save="' +
          i +
          '">Save here</button>' +
          (slot
            ? '<button class="btn small" data-load="' + i + '">Load</button>'
            : "") +
          "</div>"
        );
      })
      .join("");
  html +=
    '<h4>Transfer</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="dlBtn">Download save file</button><button class="btn" id="copyBtn">Copy save code</button></div><div id="dlNote" class="notice"></div>';
  html += "<h4>Load</h4>" + loadHTML() + "</div>";
  return html;
}
export function loadHTML() {
  return '<p class="notice" style="margin:0 0 6px">Paste a save code, or choose a save file.</p><label for="loadTxt" class="notice">Save code</label><textarea id="loadTxt" placeholder="Paste the save code here"></textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center"><button class="btn" id="loadTxtBtn">Load from code</button><label class="notice">Save file <input type="file" id="loadFile" accept=".json,application/json"></label></div><div id="loadErr" class="notice" role="alert" style="color:var(--bad)"></div>';
}
// Replace the game with a parsed save.
function replaceGame(save, title) {
  debug.begin(
    { action: "load", title, turn: save.turn, version: save.appVersion },
    ui.state,
  );
  ui.setHistory([]);
  ui.setState(save);
  debug.finishAction(save);
  closeModal();
  ui.commit();
}
// Ask before replacing a game in progress; No returns to the save modal.
function confirmReplace(save, title) {
  ui.ask({
    title,
    text: "The game in progress will be replaced.",
    buttons: [
      { v: "ok", label: "Load", primary: true },
      { v: "no", label: "Cancel" },
    ],
    onPick: (choice) => {
      if (choice === "ok") replaceGame(save, title);
      else ui.openModal(MODAL.SAVE);
    },
  });
}
function loadGame(save, title) {
  if (ui.state) confirmReplace(save, title);
  else replaceGame(save, title);
}
export function wireLoad(root) {
  const doLoad = (text) => {
    try {
      loadGame(ui.loadJSON(text), "Load this save?");
    } catch (error) {
      const errorEl = root.querySelector("#loadErr");
      if (errorEl)
        errorEl.textContent = "That is not a Queller save: " + error.message;
    }
  };
  const loadBtn = root.querySelector("#loadTxtBtn");
  if (loadBtn)
    loadBtn.onclick = () => doLoad(root.querySelector("#loadTxt").value.trim());
  const fileInput = root.querySelector("#loadFile");
  if (fileInput)
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;
      file.text().then(doLoad);
    };
}

// Settings.
function settingsHTML() {
  const settings = ui.state.settings;
  const checkbox = (key, label, description, disabled) =>
    '<label class="opt' +
    (disabled ? " dis" : "") +
    '"><input type="checkbox" data-set="' +
    key +
    '" ' +
    (settings[key] ? "checked" : "") +
    (disabled ? ' disabled aria-disabled="true"' : "") +
    "><div><b>" +
    label +
    "</b>" +
    (description ? "<span>" + description + "</span>" : "") +
    "</div></label>";
  return (
    '<div class="body setup" style="margin:0"><p class="notice">Changes apply from the next walk.</p>' +
    checkbox("dice", "Roll and track Queller’s dice", "") +
    checkbox(
      "cards",
      "Draw and hold Queller’s cards",
      "Chosen when the game is set up; it cannot be changed mid-game.",
      true,
    ) +
    checkbox("tracker", "Track board state in the app", "") +
    checkbox(
      "wome",
      "Warriors of Middle-earth",
      "Chosen when the game is set up; it cannot be changed mid-game.",
      true,
    ) +
    '<h4 style="margin-top:18px">Report a problem</h4><p class="notice">If the app does something wrong, export a debug log and send it with a description of what happened. The log records the game, the last actions and any errors.</p><p style="margin-top:8px"><button type="button" class="btn" id="dbgOpen">Export debug log</button></p><h4 style="margin-top:18px">About</h4><p class="notice">Queller Bot Runner version ' +
    engine.VERSION +
    ".</p>" +
    ui.LEGAL +
    "</div>"
  );
}
// A setting changed mid-game: the decks are rebuilt when WoME changes (or cards come on before any were dealt), and the
// Faction die leaves the pool when WoME goes off.
function applySetting(key, checked) {
  const state = ui.state;
  state.settings[key] = checked;
  if (
    key === "wome" ||
    (key === "cards" &&
      checked &&
      !state.cards.decks.C.length &&
      !state.cards.hand.length)
  ) {
    engine.buildDecks(state);
    engine.log(state, "Decks rebuilt.");
  }
  if (key === "wome" && !checked) state.dice.factionDie = false;
}
function jumpHTML() {
  let html =
    '<div class="body"><p class="notice">Walk a page from any green start point — for example when a card tells Queller to make a choice (rule 12), to place Nazgûl, or to choose a discard. The walk uses no die unless you pick one.</p><div style="display:grid;gap:8px;grid-template-columns:1fr auto;align-items:center"><select id="jumpSel" aria-label="Start point">';
  for (const pageKey in FLOW) {
    for (const id in FLOW[pageKey].nodes) {
      const node = FLOW[pageKey].nodes[id];
      if (NODE.kind(node) === NODE_KIND.START)
        html +=
          '<option value="' +
          pageKey +
          "|" +
          id +
          '">' +
          esc(FLOW[pageKey].name) +
          " — " +
          esc(engine.normalizeText(NODE.text(node))) +
          "</option>";
    }
  }
  html +=
    '</select><select id="jumpDie" aria-label="Die to use"><option value="">No die</option>' +
    Object.keys(engine.DIE_REQUIREMENT_NAME)
      .map(
        (requirement) =>
          '<option value="' +
          requirement +
          '">' +
          esc(engine.DIE_REQUIREMENT_NAME[requirement]) +
          " die</option>",
      )
      .join("") +
    '</select></div><div style="margin-top:12px"><button class="btn primary" id="jumpGo">Walk</button></div></div>';
  return html;
}

// Wiring: one function per modal, run after its element is in the page.
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
    flowText = !flowText;
    renderModal();
    ui.find("#flowToggle").focus();
  };
}
function wireCalcModal(modal, el) {
  const showResult = () => (el.querySelector(".out").innerHTML = calcOut());
  el.querySelectorAll("[data-c]").forEach(
    (input) =>
      (input.oninput = () => {
        const key = input.dataset.c;
        calc[key] =
          input.type === "checkbox"
            ? input.checked
            : Math.max(0, +input.value || 0);
        showResult();
      }),
  );
  ui.onClickEach(
    "[data-cs]",
    (button) => {
      const key = button.dataset.cs;
      calc[key] = Math.max(
        0,
        Math.min(CALC_MAX[key], calc[key] + +button.dataset.d),
      );
      el.querySelector("#c-" + key + "-n").textContent = calc[key];
      showResult();
    },
    el,
  );
  el.querySelector("#calcClear").onclick = () => {
    Object.assign(calc, CALC_DEFAULTS);
    for (const key in CALC_MAX) {
      const counter = el.querySelector("#c-" + key + "-n");
      if (counter) counter.textContent = calc[key];
    }
    el.querySelectorAll("[data-c]").forEach((input) => {
      if (input.type === "checkbox") input.checked = !!calc[input.dataset.c];
      else input.value = calc[input.dataset.c];
    });
    showResult();
  };
}
function wireSaveModal(modal, el) {
  ui.onClickEach(
    "[data-save]",
    (button) => {
      debug.action(
        { action: "saveSlot", slot: +button.dataset.save },
        ui.state,
      );
      const slotList = slots();
      slotList[+button.dataset.save] = {
        turn: ui.state.turn,
        when: new Date().toLocaleString(),
        data: JSON.stringify(ui.state),
      };
      ui.storageSet(ui.STORAGE_KEY.SLOTS, JSON.stringify(slotList));
      renderModal();
    },
    el,
  );
  ui.onClickEach(
    "[data-load]",
    (button) => {
      const slot = slots()[+button.dataset.load];
      if (slot)
        loadGame(
          ui.loadJSON(slot.data),
          "Load slot " + (+button.dataset.load + 1) + "?",
        );
    },
    el,
  );
  el.querySelector("#dlBtn").onclick = () =>
    downloadText({
      fileName: "queller-turn" + ui.state.turn + ".json",
      data: JSON.stringify(ui.state),
      noteEl: el.querySelector("#dlNote"),
      fallbackLabel: "Copy save code",
    });
  el.querySelector("#copyBtn").onclick = () =>
    copyText({
      data: JSON.stringify(ui.state),
      noteEl: el.querySelector("#dlNote"),
      label: "Save code",
      textarea: el.querySelector("#loadTxt"),
    });
  wireLoad(el);
}
function wireSettingsModal(modal, el) {
  el.querySelector("#dbgOpen").onclick = () => ui.openModal(MODAL.DEBUG);
  el.querySelectorAll("[data-set]").forEach(
    (input) =>
      (input.onchange = () =>
        ui.act(
          () => {
            applySetting(input.dataset.set, input.checked);
            renderModal();
          },
          { action: "setting", key: input.dataset.set, value: input.checked },
        )),
  );
}
function wireAskModal(modal, el) {
  ui.onClickEach(
    "[data-ask]",
    (button) => {
      const spec = modal.arg;
      const input = ui.find("#askInput");
      const inputValue = input ? input.value : undefined;
      debug.action(
        {
          action: "ask",
          title: spec.title,
          pick: button.dataset.ask,
          input: inputValue,
        },
        ui.state,
      );
      closeModal();
      if (spec.onPick) spec.onPick(button.dataset.ask, inputValue);
    },
    el,
  );
}
function wireJumpModal(modal, el) {
  el.querySelector("#jumpGo").onclick = () => {
    const [pageKey, id] = el.querySelector("#jumpSel").value.split("|");
    const die = el.querySelector("#jumpDie").value || null;
    ui.act(
      () => {
        ui.state.walk = null;
        engine.startWalk(
          ui.state,
          pageKey,
          NODE.text(FLOW[pageKey].nodes[id]),
          { die },
        );
        closeModal();
      },
      { action: "jump", page: pageKey, start: id, die },
    );
  };
}
const MODAL_WIRERS = {
  [MODAL.FLOW]: wireFlowModal,
  [MODAL.CALC]: wireCalcModal,
  [MODAL.SAVE]: wireSaveModal,
  [MODAL.SETTINGS]: wireSettingsModal,
  [MODAL.ASK]: wireAskModal,
  [MODAL.JUMP]: wireJumpModal,
  [MODAL.DEBUG]: wireDebug,
};
function wireModal(modal, el) {
  const wire = MODAL_WIRERS[modal.name];
  if (wire) wire(modal, el);
}
export { svgPage };
