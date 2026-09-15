// Arrow routing for the flowchart SVGs: the polyline of an arrow from one box to another, using whatever draw.io
// recorded for it (explicit anchors, waypoints, an elbow) or the boxes' relative positions.

export const FLOW_GEOMETRY = {
  PAGE_MARGIN: 20, // space kept right of and below the last box
  JOG: 20, // how far an arrow steps out of a box before turning
  ON_EDGE_TOLERANCE: 0.5, // an anchor this close to a box edge is on it
  STRAIGHT_TOLERANCE: 1, // two points this close are joined by a straight line
  SIDE_INSET_X: 8, // arrows meet a box at least this far from its left/right corners
  SIDE_INSET_Y: 6, // and this far from its top/bottom corners
  LABEL_CHAR_WIDTH: 5.6, // the label background's width per character
  LABEL_PAD: 8,
};
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
export function route(fromBox, toBox, waypoints, anchors, elbow) {
  if (elbow && waypoints?.length && anchors?.ex && anchors.en)
    return routeElbow(fromBox, toBox, waypoints, anchors);
  if (anchors && (anchors.ex || anchors.en))
    return routeWithAnchors(fromBox, toBox, waypoints, anchors);
  if (waypoints?.length) return routeWithWaypoints(fromBox, toBox, waypoints);
  return routeGeometric(fromBox, toBox);
}
