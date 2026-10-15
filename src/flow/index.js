// Queller Bot flowcharts — transcribed from War_of_the_Ring.drawio (10 pages).
// Node kinds: S start (green ellipse), A action (red ellipse), D decision (yellow), d follow-up decision (blue),
// J jump (grey box), P priority list (purple), T step (orange), N note/title.
// Node: [kind, x, y, width, height, text, extra]. extra: {items: [...], any: true / all: true (the items are a condition
//   list: ANY or ALL of them; the text is the list's header), plainHeader: true (the header is not bold), bold: true (the
//   whole box is an Elven Ring condition), wome: true (WoME only), die: "Army" (the die an action box uses), help: "..."
//   (a line of help under an action), name: "..." (a jump box's start point when it differs from its text)}. An item is
//   its text, or {text, bold: true (an Elven Ring condition), wome: true (WoME only)}; read items through NODE.items.
// Edge: [from, to, label, waypoints, anchors {ex, en}, style ("elbow"), hideLabel]; slots 3-6 are filled from
//   anchors.json (generated from the draw.io file by scripts/sync-anchors.js: exact exit/entry anchors and waypoints per edge).
//   A decision edge with no label is the answer the other edge lacks.
// Read nodes and edges through NODE / EDGE rather than by slot number. FLOW holds the pages by key, in flowchart order.
import anchors from "./anchors.json" with { type: "json" };
import { applyAnchors } from "./anchors.js";
import { NODE_SLOT, EDGE_SLOT } from "./page.js";
import C14 from "./pages/corruption-phases-1-4.js";
import M14 from "./pages/military-phases-1-4.js";
import C5 from "./pages/corruption-phase-5.js";
import M5 from "./pages/military-phase-5.js";
import CH from "./pages/character.js";
import AR from "./pages/army.js";
import MU from "./pages/muster.js";
import EV from "./pages/event.js";
import FA from "./pages/faction.js";
import BA from "./pages/battle.js";

export { NODE_SLOT, EDGE_SLOT };
export const NODE_KIND = {
  START: "S",
  ACTION: "A",
  DECISION: "D",
  FOLLOW_UP: "d",
  JUMP: "J",
  PRIORITY: "P",
  STEP: "T",
  NOTE: "N",
};
export const NODE = {
  kind: (node) => node[NODE_SLOT.KIND],
  text: (node) => node[NODE_SLOT.TEXT],
  extra: (node) => node[NODE_SLOT.EXTRA] || {},
  items: (node) =>
    (NODE.extra(node).items || []).map((item) =>
      typeof item === "string" ? { text: item } : item,
    ),
  // the box, or one of its items, is an Elven Ring condition
  isRing: (node) =>
    !!NODE.extra(node).bold || NODE.items(node).some((item) => item.bold),
  box: (node) => ({
    x: node[NODE_SLOT.X],
    y: node[NODE_SLOT.Y],
    width: node[NODE_SLOT.WIDTH],
    height: node[NODE_SLOT.HEIGHT],
  }),
};
export const EDGE = {
  from: (edge) => edge[EDGE_SLOT.FROM],
  to: (edge) => edge[EDGE_SLOT.TO],
  label: (edge) => edge[EDGE_SLOT.LABEL],
  waypoints: (edge) => edge[EDGE_SLOT.WAYPOINTS],
  anchors: (edge) => edge[EDGE_SLOT.ANCHORS],
  isElbow: (edge) => edge[EDGE_SLOT.STYLE] === "elbow",
  hidesLabel: (edge) => !!edge[EDGE_SLOT.HIDE_LABEL],
};
export const FLOW = Object.fromEntries([
  C14,
  M14,
  C5,
  M5,
  CH,
  AR,
  MU,
  EV,
  FA,
  BA,
]);
applyAnchors(FLOW, anchors);
