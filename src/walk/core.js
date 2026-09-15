// The walk itself: creating it at a start point, its trail, moving along arrows, ending it and opening a prompt.
import * as engine from "../engine/index.js";
import { TRAIL } from "../engine/index.js";
import { EDGE, FLOW } from "../flow/index.js";
import { edgeFor, findStart, normalizeText } from "./graph.js";

// The parts of a walk (state.walk is the flat union of them).
// Where the walk is: its page and node, the start point it began at, the pages it will return to, its record and its prompt.
const walkPosition = (page, nodeId, startName, options) => ({
  page,
  node: nodeId,
  entry: { page, start: startName },
  stack: [],
  trail: [],
  prompt: null,
  done: false,
  result: null,
  mode: options.mode || null,
  battleRound: options.battleRound || null,
});
// The die the walk holds (dieIndex: its index in the pool), the player's die answers when dice are not rolled
// (dieAns, pendingDie), and the Muster die brought back from "set aside for a minion" (fromReserve, reservedDieIndex).
const walkDieState = (options) => ({
  die: options.die || null,
  dieIndex: options.dieIndex != null ? options.dieIndex : null,
  dieAns: {},
  dieUsed: false,
  pendingDie: null,
  fromReserve: false,
  reservedDieIndex: null,
});
// Elven Ring state (rules 36-38): a ring condition was met; the ring question was put to the player.
const walkRingState = () => ({ ringArmed: false, ringAsked: false });
// Card candidates and the priority-list result.
const walkCardState = () => ({
  cands: null,
  chosen: null,
  steps: null,
  ctb: null,
  discards: null,
});
// Results of the Muster and Faction priority lists.
const walkChoiceState = () => ({
  nationChoice: null,
  factionChoice: null,
  minionPick: null,
});
// Multi-part decisions (sub: which part) and answers to board questions asked once per node.
const walkDecisionState = () => ({ sub: 0, parts: {} });
// Create the walk at a start point without stepping it; returns false when the start point does not exist.
export function beginWalk(state, page, startName, options = {}) {
  const id = findStart(page, startName);
  if (!id) {
    engine.log(
      state,
      "No start point “" + startName + "” on " + FLOW[page].name,
    );
    return false;
  }
  state.walk = {
    ...walkPosition(page, id, startName, options),
    ...walkDieState(options),
    ...walkRingState(),
    ...walkCardState(),
    ...walkChoiceState(),
    ...walkDecisionState(),
  };
  trail(state, { kind: TRAIL.START, text: startName, page });
  engine.log(
    state,
    "Walk: " +
      FLOW[page].name +
      " from “" +
      normalizeText(startName) +
      "”" +
      (options.mode === "ringAny" ? " (looking for a ring use, rule 37)" : "") +
      ".",
  );
  return true;
}
export function trail(state, entry) {
  entry.page = entry.page || state.walk.page;
  entry.node = entry.node || state.walk.node;
  state.walk.trail.push(entry);
}
export function cur(state) {
  return FLOW[state.walk.page].nodes[state.walk.node];
}
export function goto(state, page, id) {
  state.walk.page = page;
  state.walk.node = id;
}
export function follow(state, label) {
  const walk = state.walk;
  const edge = edgeFor(walk.page, walk.node, label);
  if (!edge) return false;
  goto(state, walk.page, EDGE.to(edge));
  return true;
}
export function endWalk(state, result, message) {
  const walk = state.walk;
  walk.done = true;
  walk.result = result;
  walk.prompt = null;
  trail(state, { kind: TRAIL.END, text: message || result });
  if (message) engine.log(state, message);
}
export function setPrompt(state, prompt) {
  state.walk.prompt = prompt;
}
