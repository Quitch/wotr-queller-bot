// A flowchart page as an SVG: the boxes with the arrows between them, the walk's current box outlined and its visited
// boxes shaded.
import { EDGE, FLOW, NODE, NODE_KIND } from "../../flow/index.js";
import { escapeHTML as esc } from "../../ui/dom.js";
import * as ui from "../../ui/index.js";
import { FLOW_GEOMETRY, route } from "./route.js";

// The flowchart as an SVG: the boxes of a page with the arrows between them, the walk's current box outlined and its visited boxes shaded.
// The diagram is always drawn on white; test/contrast.js checks every stroke against it at 3:1.
export const SVG_COLOUR = {
  ARROW: "#333",
  LABEL_TEXT: "#333",
  HATCH: "#8a8a8a",
  GROUP_STROKE: "#8a8a8a",
  BACKGROUND: "#fff",
  LABEL_BACKGROUND: "#fff",
  VISITED_SHADE: "#3a332c",
  CURRENT_OUTLINE: "#8A2A22",
  RING: "#7E2419",
  RING_BACKGROUND: "#fff",
  TEXT: "#1d1a17",
  GROUP_TEXT: "#555",
};
// The draw.io fills with darker strokes (the light-theme --n*s tokens in styles/tokens.css match).
export const NODE_STYLE = {
  [NODE_KIND.START]: { fill: "#d5e8d4", stroke: "#568a3c" },
  [NODE_KIND.ACTION]: { fill: "#f8cecc", stroke: "#b85450" },
  [NODE_KIND.DECISION]: { fill: "#fff2cc", stroke: "#9c7f1f" },
  [NODE_KIND.FOLLOW_UP]: { fill: "#dae8fc", stroke: "#5478ad" },
  [NODE_KIND.JUMP]: { fill: "#f5f5f5", stroke: "#666666" },
  [NODE_KIND.PRIORITY]: { fill: "#e1d5e7", stroke: "#9673a6" },
  [NODE_KIND.STEP]: { fill: "#ffe6cc", stroke: "#a97600" },
  [NODE_KIND.NOTE]: { fill: null, stroke: null },
};
const SVG_CACHE_SIZE = 10; // rendered pages kept, by page and walk marks
// What the walk marks on a page: its current box (when it is on this page) and the boxes its trail visited.
export function walkMarks(pageKey) {
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
function buildSVGPage(page, marks) {
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
// A page's SVG depends only on the page and the walk's marks on it, so the last few are kept: a tab or a toggle
// re-renders the modal without laying the page out again.
const svgCache = new Map();
export function svgPage(pageKey) {
  const page = FLOW[pageKey];
  const marks = walkMarks(pageKey);
  const key =
    pageKey +
    "|" +
    (marks.curNode || "") +
    "|" +
    [...marks.visited].sort((a, b) => a.localeCompare(b)).join(",");
  let svg = svgCache.get(key);
  if (svg === undefined) {
    svg = buildSVGPage(page, marks);
    svgCache.set(key, svg);
    if (svgCache.size > SVG_CACHE_SIZE)
      svgCache.delete(svgCache.keys().next().value);
  }
  return svg;
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
