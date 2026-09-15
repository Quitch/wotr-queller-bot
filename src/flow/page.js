// One flowchart page as [key, {name, nodes, edges}]: nodes are {id: [kind, x, y, width, height, text, extra]} and edges
// [from, to, label, waypoints, anchors, style, hideLabel]; the slots are named here and read through the accessors in index.js.
export const page = (name, key, nodes, edges) => [key, { name, nodes, edges }];
export const NODE_SLOT = {
  KIND: 0,
  X: 1,
  Y: 2,
  WIDTH: 3,
  HEIGHT: 4,
  TEXT: 5,
  EXTRA: 6,
};
export const EDGE_SLOT = {
  FROM: 0,
  TO: 1,
  LABEL: 2,
  WAYPOINTS: 3,
  ANCHORS: 4,
  STYLE: 5,
  HIDE_LABEL: 6,
};
