// The walk itself: creating it at a start point, its trail, moving along arrows, ending it and opening a prompt.
import * as engine from "../engine/index.js";
import { TRAIL } from "../engine/index.js";
import { EDGE, FLOW, NODE, NODE_KIND } from "../flow/index.js";
import { edgeFor, findStart, normalizeText } from "./graph.js";
import { DIE_REQUIREMENT_NAME, dieWithArticle } from "./jumps-table.js";
import { PENDING, PROMPT, WALK_RESULT } from "./prompt.js";
import { ringBoxState, ringDieSpent, settleRing } from "./rings.js";

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
  // the die held is a Muster die acting as an Army die with Messenger of the Dark Tower (rule 30); with dice off, the
  // player's answer to the Messenger question (null until asked)
  dieViaMessenger: false,
  messengerAns: null,
  // an Army die on the Army page (rule 9): the start point it entered at, and the moves it has made (0 or 1)
  armyStart: null,
  armyMoves: 0,
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
// With dice on, a walk started with a die but no pool index (the Jump modal) holds a matching die from the pool, or none.
function dieOptions(state, options) {
  if (!state.settings.dice || !options.die || options.dieIndex != null)
    return options;
  const die = engine.findDie(state, options.die);
  if (die) return { ...options, dieIndex: state.dice.pool.indexOf(die) };
  engine.log(
    state,
    "Queller has no " +
      DIE_REQUIREMENT_NAME[options.die] +
      " die available: the walk uses no die.",
  );
  return { ...options, die: null };
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
    ...walkDieState(dieOptions(state, options)),
    ...walkRingState(),
    ...walkCardState(),
    ...walkChoiceState(),
    ...walkDecisionState(),
  };
  if (page === "AR") state.walk.armyStart = startName;
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
// The Muster die brought back from "set aside for a minion" is still unspent: with dice off, the walk still holds it.
function reservedDieUnspent(state) {
  const walk = state.walk;
  if (!state.settings.dice) return walk.die != null;
  return (
    walk.reservedDieIndex != null &&
    state.dice.pool[walk.reservedDieIndex].status === engine.DIE_STATE.AVAIL
  );
}
export function doReturn(state) {
  const walk = state.walk;
  if (walk.page === "AR" && walk.armyMoves === 1) {
    spendCurrentDie(state, "one Army move; no second move was possible");
    endWalk(
      state,
      WALK_RESULT.ACTION,
      "No second Army move is possible: the Army die is used (rule 9).",
    );
    return;
  }
  if (!walk.stack.length) {
    // A die brought back from "set aside for a minion" that found no action is spent, not set aside again (rule 34: it cannot be used for anything else).
    if (walk.fromReserve && reservedDieUnspent(state)) {
      const why = "set aside for a minion, no action possible";
      if (state.settings.dice)
        engine.spendDie(state, state.dice.pool[walk.reservedDieIndex], why);
      else spendCurrentDie(state, why);
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
  walk.dieViaMessenger = !!frame.dieViaMessenger;
  walk.dieUsed = frame.dieUsed;
  // the page returned from may have set that very die aside for a minion (rule 34)
  if (heldDieGone(state)) releaseCurrentDie(state);
  settleRing(state);
  walk.cands = null;
  walk.chosen = null;
  trail(state, {
    kind: TRAIL.BACK,
    text: normalizeText(NODE.text(cur(state))),
  });
  exitJump(state);
}
export function spendCurrentDie(state, why) {
  const walk = state.walk;
  if (!walk?.die) return;
  ringDieSpent(state);
  if (walk.dieViaMessenger) {
    state.messengerUsedThisTurn = true;
    engine.log(
      state,
      "Messenger of the Dark Tower used: a Muster die acted as an Army die (rule 30).",
    );
  }
  if (state.settings.dice && walk.dieIndex != null) {
    engine.spendDie(state, state.dice.pool[walk.dieIndex], why);
  } else
    engine.log(
      state,
      "Queller used " +
        dieWithArticle(walk.die) +
        " die" +
        (why ? " — " + why : "") +
        ".",
    );
  releaseCurrentDie(state);
}
// With dice on, the pool die the walk holds is no longer available (spent or set aside).
export function heldDieGone(state) {
  const walk = state.walk;
  return (
    state.settings.dice &&
    walk.dieIndex != null &&
    state.dice.pool[walk.dieIndex]?.status !== engine.DIE_STATE.AVAIL
  );
}
// The walk no longer holds a die (spent, or given up unspent).
export function releaseCurrentDie(state) {
  state.walk.die = null;
  state.walk.dieIndex = null;
  state.walk.dieViaMessenger = false;
}
