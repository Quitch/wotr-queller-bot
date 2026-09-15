// Regenerate src/flow/anchors.json from the draw.io flowchart: for every arrow on every page, the exit/entry anchors,
// the waypoints, whether it is an elbow, and whether its label is drawn elsewhere on the diagram. Run after a draw.io
// change: `npm run anchors [path/to/War_of_the_Ring.drawio]` (default docs/refs/flowchart.drawio); `--check` compares
// with the tracked file instead of writing it.
//
// A draw.io box is matched to a flow.js node by its page and geometry (flow.js copies x, y, width and height from the
// diagram), and an arrow to a flow.js edge by its ends and label. The file must stay in draw.io order: flow/anchors.js
// matches records by page, ends and label, so order only matters for a readable diff.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FLOW, NODE, EDGE } from "../src/flow/index.js";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src", "flow", "anchors.json");
const DEFAULT_INPUT = path.join(ROOT, "docs", "refs", "flowchart.drawio");
// The draw.io page names and the flow.js page keys.
const PAGE_KEY = {
  "Corruption 1-4": "C14",
  "Corruption 5": "C5",
  "Military 1-4": "M14",
  "Military 5": "M5",
  Character: "CH",
  Army: "AR",
  Muster: "MU",
  Event: "EV",
  Faction: "FA",
  Battle: "BA",
};

const decodeXML = (text) =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#xa;", "\n")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&");
// The attributes of an XML tag as an object.
function attributes(tag) {
  const out = {};
  for (const [, name, value] of tag.matchAll(/(?<![\w:-])([\w:-]+)="([^"]*)"/g))
    out[name] = decodeXML(value);
  return out;
}
// Remove every tag, repeating until none is left so a tag split by another tag does not survive one pass.
function stripTags(text) {
  let previous;
  do {
    previous = text;
    text = text.replace(/<[^<>]*>/g, "");
  } while (text !== previous);
  return text;
}
// A draw.io label as plain text (labels are HTML fragments).
const plainText = (html) =>
  stripTags(decodeXML(html).replace(/<br\s*\/?>/gi, " "))
    .replace(/\s+/g, " ")
    .trim();
// The style string as {key: value}.
const styleOf = (style) =>
  Object.fromEntries(
    (style || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const at = part.indexOf("=");
        return at < 0 ? [part, true] : [part.slice(0, at), part.slice(at + 1)];
      }),
  );
// One mxCell as {attrs, geometry, points, ends}: its attributes, its geometry tag's attributes, its waypoints and its
// free arrow ends (an arrow end that is not attached to a box is a point).
function parseCell(cellTag, inner = "") {
  const attrs = attributes(cellTag);
  const geometryTag = /<mxGeometry\b[^>]*>/.exec(inner);
  const geometry = geometryTag ? attributes(geometryTag[0]) : {};
  const points = [];
  const pointList = /<Array as="points">([\s\S]*?)<\/Array>/.exec(inner);
  if (pointList)
    for (const [, point] of pointList[1].matchAll(/<mxPoint\b([^>]*)\/>/g)) {
      const at = attributes(point);
      points.push([Number(at.x || 0), Number(at.y || 0)]);
    }
  const ends = {};
  for (const [, point] of inner.matchAll(
    /<mxPoint\b([^>]*as="(?:source|target)Point"[^>]*)\/>/g,
  )) {
    const at = attributes(point);
    ends[at.as] = [Number(at.x || 0), Number(at.y || 0)];
  }
  return { attrs, geometry, points, ends };
}
// The pages of the file: [{name, cells: [{attrs, geometry, points, ends}]}] in document order.
function parseDiagrams(xml) {
  const pages = [];
  for (const [, tag, body] of xml.matchAll(
    /<diagram\b([^>]*)>([\s\S]*?)<\/diagram>/g,
  )) {
    const cells = [];
    for (const [, cellTag, inner] of body.matchAll(
      /<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g,
    ))
      cells.push(parseCell(cellTag, inner));
    pages.push({ name: attributes(tag).name, cells });
  }
  return pages;
}
// The boxes of a page: draw.io cell id -> flow.js node id (matched by geometry; a box inside a group has coordinates
// relative to the group, so its parents' offsets are added), and the boxes themselves for resolving free arrow ends.
function pageBoxes(page, pageKey) {
  const flowNodes = FLOW[pageKey].nodes;
  // flow.js rounds draw.io's half-pixel positions, so a box matches within a pixel on every side
  const GEOMETRY_TOLERANCE = 1;
  const flowBoxes = Object.keys(flowNodes).map((id) => ({
    id,
    box: NODE.box(flowNodes[id]),
  }));
  const nodeMatching = (box) => {
    const near = flowBoxes.filter(({ box: flowBox }) =>
      ["x", "y", "width", "height"].every(
        (side) => Math.abs(flowBox[side] - box[side]) <= GEOMETRY_TOLERANCE,
      ),
    );
    if (near.length > 1)
      throw new Error(
        `${pageKey}: nodes ${near.map((n) => n.id).join(", ")} all match a box at ${JSON.stringify(box)}`,
      );
    return near[0]?.id;
  };
  const cellsById = new Map(page.cells.map((cell) => [cell.attrs.id, cell]));
  const absolute = (cell) => {
    const g = cell.geometry;
    let x = Number(g.x || 0),
      y = Number(g.y || 0);
    for (
      let parent = cellsById.get(cell.attrs.parent);
      parent?.attrs.vertex === "1";
      parent = cellsById.get(parent.attrs.parent)
    ) {
      x += Number(parent.geometry.x || 0);
      y += Number(parent.geometry.y || 0);
    }
    return { x, y, width: Number(g.width || 0), height: Number(g.height || 0) };
  };
  const nodeIds = new Map();
  const boxes = [];
  for (const cell of page.cells) {
    if (cell.attrs.vertex !== "1") continue;
    const box = absolute(cell);
    const id = nodeMatching(box);
    if (!id) continue;
    nodeIds.set(cell.attrs.id, id);
    boxes.push({ id, box: NODE.box(flowNodes[id]) });
  }
  return { nodeIds, boxes };
}
const round3 = (value) => Math.round(value * 1000) / 1000;
// A free arrow end (a point instead of a box): the flow.js node whose box the point lies on — among several (the point
// is on a shared edge) the one whose anchor at the style's fraction is nearest — and the point as a fraction of that box.
function freeEnd(boxes, [px, py], styleFraction) {
  const TOLERANCE = 1;
  const inside = boxes.filter(
    ({ box }) =>
      px >= box.x - TOLERANCE &&
      px <= box.x + box.width + TOLERANCE &&
      py >= box.y - TOLERANCE &&
      py <= box.y + box.height + TOLERANCE,
  );
  if (!inside.length) return null;
  const distance = ({ box }) => {
    const [fx, fy] = styleFraction || [0.5, 0.5];
    return Math.hypot(
      box.x + fx * box.width - px,
      box.y + fy * box.height - py,
    );
  };
  inside.sort((a, b) => distance(a) - distance(b));
  const { id, box } = inside[0];
  return {
    id,
    fraction: [
      round3((px - box.x) / box.width),
      round3((py - box.y) / box.height),
    ],
  };
}
const fraction = (style, x, y) =>
  style[x] !== undefined && style[y] !== undefined
    ? [Number(style[x]), Number(style[y])]
    : null;
// The ends of an arrow as flow.js node ids and anchor fractions: {from, to, ex, en}. An end attached to a box is
// looked up by the box's cell id; a free end is resolved by the point it sits on.
function arrowEnds(cell, nodeIds, boxes) {
  const style = styleOf(cell.attrs.style);
  let ex = fraction(style, "exitX", "exitY"),
    en = fraction(style, "entryX", "entryY");
  let from = nodeIds.get(cell.attrs.source),
    to = nodeIds.get(cell.attrs.target);
  if (!cell.attrs.source && cell.ends.sourcePoint) {
    const end = freeEnd(boxes, cell.ends.sourcePoint, ex);
    if (end) ({ id: from, fraction: ex } = end);
  }
  if (!cell.attrs.target && cell.ends.targetPoint) {
    const end = freeEnd(boxes, cell.ends.targetPoint, en);
    if (end) ({ id: to, fraction: en } = end);
  }
  return { from, to, ex, en };
}
// The arrow's label and whether it is drawn: {label, nolabel}. When flow.js labels the arrow but the diagram does not,
// the label is not drawn (an arrow with an empty value attribute is a label that was cleared, and is drawn).
function arrowLabel(cell, candidates) {
  const drawn = plainText(cell.attrs.value || "") || null;
  if (drawn || candidates.length !== 1 || !EDGE.label(candidates[0]))
    return { label: drawn, nolabel: false };
  return {
    label: EDGE.label(candidates[0]),
    nolabel: !("value" in cell.attrs),
  };
}
// One record per arrow on a page, in document order.
function pageRecords(page, pageKey) {
  const { nodeIds, boxes } = pageBoxes(page, pageKey);
  const flowEdges = FLOW[pageKey].edges;
  const records = [];
  for (const cell of page.cells) {
    if (cell.attrs.edge !== "1") continue;
    const style = styleOf(cell.attrs.style);
    const { from, to, ex, en } = arrowEnds(cell, nodeIds, boxes);
    if (!from || !to) {
      console.warn(
        `${pageKey}: arrow ${cell.attrs.id} joins boxes flow.js does not have (${cell.attrs.source || JSON.stringify(cell.ends.sourcePoint)} -> ${cell.attrs.target || JSON.stringify(cell.ends.targetPoint)})`,
      );
      continue;
    }
    const candidates = flowEdges.filter(
      (edge) => EDGE.from(edge) === from && EDGE.to(edge) === to,
    );
    const { label, nolabel } = arrowLabel(cell, candidates);
    if (!candidates.some((edge) => (EDGE.label(edge) || null) === label))
      console.warn(
        `${pageKey}: no flow.js edge ${from} -> ${to} labelled ${JSON.stringify(label)}`,
      );
    const an = ex || en ? {} : null;
    if (ex) an.ex = ex;
    if (en) an.en = en;
    records.push({
      p: pageKey,
      f: from,
      t: to,
      l: label,
      wp: cell.points.length ? cell.points : null,
      an,
      elbow: style.edgeStyle === "elbowEdgeStyle",
      nolabel,
    });
  }
  return records;
}
// List the records that are new, changed or gone between the tracked file and the regenerated ones.
function reportDifferences(current, records) {
  const key = (r) => `${r.p} ${r.f}->${r.t} ${r.l}`;
  const have = new Map(current.map((r) => [key(r), r]));
  for (const r of records) {
    const old = have.get(key(r));
    if (!old) console.log("new:", JSON.stringify(r));
    else if (JSON.stringify(old) !== JSON.stringify(r))
      console.log("changed:", JSON.stringify(old), "->", JSON.stringify(r));
    have.delete(key(r));
  }
  for (const r of have.values()) console.log("gone:", JSON.stringify(r));
}
// --check: true when the tracked file already holds these records, otherwise list the differences.
function checkUpToDate(records) {
  const current = JSON.parse(readFileSync(OUT, "utf8"));
  const same = JSON.stringify(current) === JSON.stringify(records);
  console.log(
    records.length +
      " records; " +
      (same ? "anchors.json is up to date" : "anchors.json differs"),
  );
  if (!same) reportDifferences(current, records);
  return same;
}
function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const input = args.find((arg) => !arg.startsWith("--")) || DEFAULT_INPUT;
  const pages = parseDiagrams(readFileSync(input, "utf8"));
  const records = [];
  for (const page of pages) {
    const pageKey = PAGE_KEY[page.name];
    if (!pageKey) throw new Error("unknown draw.io page: " + page.name);
    records.push(...pageRecords(page, pageKey));
  }
  if (check) {
    if (!checkUpToDate(records)) process.exit(1);
    return;
  }
  writeFileSync(OUT, JSON.stringify(records) + "\n", "utf8");
  console.log(
    "wrote " + records.length + " records to " + path.relative(ROOT, OUT),
  );
}
main();
