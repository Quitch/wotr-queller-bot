// Reading the flowchart data: box text, the arrows out of a box, and start points by name.
import { EDGE, FLOW, NODE, NODE_KIND } from "../flow/index.js";

export function normalizeText(text) {
  return text.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim();
}
function outEdges(page, id) {
  return FLOW[page].edges.filter((edge) => EDGE.from(edge) === id);
}
export function edgeFor(page, id, label) {
  const edges = outEdges(page, id);
  let edge = edges.find((candidate) => EDGE.label(candidate) === label);
  if (!edge) edge = edges.find((candidate) => EDGE.label(candidate) == null);
  return edge;
}
export function findStart(page, name) {
  const nodes = FLOW[page].nodes;
  for (const id in nodes) {
    if (
      NODE.kind(nodes[id]) === NODE_KIND.START &&
      normalizeText(NODE.text(nodes[id])) === normalizeText(name)
    )
      return id;
  }
  return null;
}
