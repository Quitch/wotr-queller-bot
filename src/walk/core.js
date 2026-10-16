// The walk itself: creating it at a start point, its trail, moving along arrows, ending it and opening a prompt.
import * as engine from "../engine/index.js";
import { TRAIL } from "../engine/index.js";
import { EDGE, FLOW, NODE, NODE_KIND } from "../flow/index.js";
import { edgeFor, findStart, normalizeText } from "./graph.js";
import { PENDING, PROMPT, WALK_RESULT } from "./prompt.js";
import { ringBoxState, settleRing } from "./rings.js";

// The parts of a walk (state.walk is the flat union of them).
// Where the walk is: its page and node, the start point it began at, the pages it will return to, its record and its prompt.
const walkPosition = (page, nodeId, startName, options) => ({
  flowRev: engine.FLOW_REV,
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
// Elven Ring state (rules 43-46, walk/rings.js): the dice a bold box lets a ring create, the box a limited use needs or
// the question that picks the die (and its answer), whether the ring question was put to the player, and a ring use
// waiting for its die to be spent.
const walkRingState = () => ({
  ...ringBoxState(),
  ringAsked: false,
  ringPending: null,
});
// Card candidates and the priority-list result.
const walkCardState = () => ({
  cands: null,
  chosen: null,
  steps: null,
  ctb: null,
  discards: null,
  // the answer to the round's first "Shadow Army attacking", for the second one
  attacking: null,
});
// Results of the Muster and Faction priority lists.
const walkChoiceState = () => ({
  nationChoice: null,
  factionChoice: null,
  minionPick: null,
});
// Multi-part decisions (sub: which part) and answers to board questions asked once per node.
const walkDecisionState = () => ({ sub: 0, parts: {} });
// Drop the walk in progress: a ring it used for a die it never spent comes back (rule 43).
export function abandonWalk(state) {
  if (state.walk && !state.walk.done) settleRing(state, true);
  state.walk = null;
}
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
  abandonWalk(state);
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
      (options.mode === "ringAny"
        ? " (looking for an Elven Ring use, rule 44)"
        : "") +
      ".",
  );
  return true;
}
export function trail(state, entry) {
  entry.page = entry.page || state.walk.page;
  entry.node = entry.node || state.walk.node;
  state.walk.trail.push(entry);
}
// A board question asked once per node: the answer recorded under `part`, or PENDING while it is open.
export function askBoardQuestion(state, part, question) {
  const walk = state.walk;
  if (part in walk.parts) return walk.parts[part];
  setPrompt(state, {
    type: PROMPT.YES_NO,
    text: question,
    part,
    node: walk.node,
    page: walk.page,
    kind: NODE_KIND.FOLLOW_UP,
    board: true,
  });
  return PENDING;
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
  settleRing(state, true);
  walk.done = true;
  walk.result = result;
  walk.prompt = null;
  trail(state, { kind: TRAIL.END, text: message || result });
  if (message) engine.log(state, message);
}
export function setPrompt(state, prompt) {
  state.walk.prompt = prompt;
}
export function exitJump(state) {
  // follow the arrow out of the current grey box; if none, return further
  if (!follow(state, null)) doReturn(state);
}
export function doReturn(state) {
  const walk = state.walk;
  if (!walk.stack.length) {
    // A die brought back from "set aside for a minion" that found no action is spent, not set aside again (rule 34: it cannot be used for anything else).
    if (
      walk.fromReserve &&
      state.settings.dice &&
      walk.reservedDieIndex != null &&
      state.dice.pool[walk.reservedDieIndex].status === engine.DIE_STATE.AVAIL
    ) {
      engine.spendDie(
        state,
        state.dice.pool[walk.reservedDieIndex],
        "set aside for a minion, no action possible",
      );
      endWalk(
        state,
        WALK_RESULT.ACTION,
        "Queller sets aside the Muster die it had kept for a minion — no action was possible with it.",
      );
      return;
    }
    endWalk(
      state,
      WALK_RESULT.NO_ACTION,
      walk.page === "BA"
        ? "Nothing further from the Battle page this round."
        : "Queller has no action from this walk.",
    );
    return;
  }
  const frame = walk.stack.pop();
  goto(state, frame.page, frame.node);
  walk.die = frame.die;
  walk.dieIndex = frame.dieIndex;
  walk.dieUsed = frame.dieUsed;
  settleRing(state);
  walk.cands = null;
  walk.chosen = null;
  trail(state, {
    kind: TRAIL.BACK,
    text: normalizeText(NODE.text(cur(state))),
  });
  exitJump(state);
}
