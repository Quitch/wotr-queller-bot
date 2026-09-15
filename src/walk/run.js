// The main loop: step the walk from box to box until it opens a prompt or ends.
import { NODE, NODE_KIND } from "../flow/index.js";
import { handleAction } from "./actions.js";
import { beginWalk, cur, endWalk, follow } from "./core.js";
import { handleDecision } from "./decisions/index.js";
import { normalizeText } from "./graph.js";
import { handleJump } from "./jumps.js";
import { handlePriority } from "./priority.js";
import { WALK_RESULT, phaseResult } from "./prompt.js";
import { handleStep } from "./steps.js";

// --- main loop ---
const RUN_GUARD = 300;
// A start box: the walk's own start point is passed through; any other start point reached is where the walk ends (the next phase).
function atStart(state, walk, node) {
  const first = walk.trail[0];
  if (first.page === walk.page && first.node === walk.node) follow(state, null);
  else
    endWalk(
      state,
      phaseResult(normalizeText(NODE.text(node))),
      "Reached “" + normalizeText(NODE.text(node)) + "”.",
    );
}
// The handler for each box kind (see flow.js); notes are passed through.
const STEP = {
  [NODE_KIND.START]: atStart,
  [NODE_KIND.NOTE]: (state) => follow(state, null),
  [NODE_KIND.DECISION]: (state, walk, node) => handleDecision(state, node),
  [NODE_KIND.FOLLOW_UP]: (state, walk, node) => handleDecision(state, node),
  [NODE_KIND.JUMP]: (state, walk, node) => handleJump(state, node),
  [NODE_KIND.ACTION]: (state, walk, node) => handleAction(state, node),
  [NODE_KIND.STEP]: (state, walk, node) => handleStep(state, node),
  [NODE_KIND.PRIORITY]: (state, walk, node) => handlePriority(state, node),
};
export function run(state) {
  let guard = 0;
  while (state.walk && !state.walk.done && !state.walk.prompt) {
    if (guard++ >= RUN_GUARD) {
      endWalk(
        state,
        WALK_RESULT.NO_ACTION,
        "The walk did not finish (more than " +
          RUN_GUARD +
          " steps) — walk again.",
      );
      break;
    }
    const walk = state.walk,
      node = cur(state),
      boxKind = NODE.kind(node);
    if (!STEP[boxKind]) {
      endWalk(
        state,
        WALK_RESULT.NO_ACTION,
        "Unknown box kind “" + boxKind + "”.",
      );
      break;
    }
    STEP[boxKind](state, walk, node);
  }
}
export function startWalk(state, page, startName, options) {
  if (beginWalk(state, page, startName, options)) run(state);
}
