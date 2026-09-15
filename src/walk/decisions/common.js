// What every decision handler builds on: recording an answer, asking the player, board facts and playable-card counts.
import * as engine from "../../engine/index.js";
import { DECK, TRAIL } from "../../engine/index.js";
import { NODE, NODE_KIND } from "../../flow/index.js";
import { endWalk, follow, setPrompt, trail } from "../core.js";
import { evalPlayable } from "../playable.js";
import { PENDING, PROMPT, WALK_RESULT } from "../prompt.js";

// Board consequences of a decision the player answered (the tracker keeps up with what the flowchart just established).
const DECIDE_HOOKS = {
  "CH.musteredWK": (state, answer) => {
    if (answer && !state.board.chars.witchKing) {
      state.board.chars.witchKing = true;
      state.playable = {};
      engine.log(
        state,
        "Witch King is now in play (tracker updated; his die joins the pool next turn).",
      );
    }
  },
};
// Record a decision (`text` as shown; `ringCondition` when the question is an Elven Ring condition) and follow its Yes/No arrow.
export function recordDecision(
  state,
  { text: question, ringCondition, answer, auto: automatic, why },
) {
  const walk = state.walk;
  trail(state, {
    kind: TRAIL.QUESTION,
    text: question,
    answer: answer ? "Yes" : "No",
    auto: !!automatic,
    why,
    ring: !!ringCondition,
  });
  if (answer && ringCondition && !state.ringUsedThisTurn) walk.ringArmed = true;
  const hook = DECIDE_HOOKS[walk.page + "." + walk.node];
  if (hook) hook(state, answer);
  walk.sub = 0;
  walk.parts = {};
  if (!follow(state, answer ? "Yes" : "No")) {
    endWalk(
      state,
      WALK_RESULT.NO_ACTION,
      "The flowchart has no arrow for that answer.",
    );
  }
}
export function ask(state, node, question, promptExtra) {
  setPrompt(state, {
    type: PROMPT.YES_NO,
    text: question || NODE.text(node),
    node: state.walk.node,
    page: state.walk.page,
    kind: NODE.kind(node),
    ...promptExtra,
  });
}
// A yes/no board fact: from the tracker when it is on, otherwise asked of the player once per node (answers live in walk.parts). Returns PENDING while the question is open.
export function boardFactYesNo(state, factKey, question, trackerValue) {
  if (state.settings.tracker) return trackerValue;
  const walk = state.walk,
    partKey = walk.page + "." + walk.node + "." + factKey;
  if (partKey in walk.parts) return walk.parts[partKey];
  setPrompt(state, {
    type: PROMPT.YES_NO,
    text: question,
    part: partKey,
    node: walk.node,
    page: walk.page,
    kind: NODE_KIND.FOLLOW_UP,
    board: true,
  });
  return PENDING;
}
// Record an automatic answer to the current decision box and follow its arrow.
export function answerAuto(state, node, answer, why) {
  recordDecision(state, {
    text: NODE.text(node),
    ringCondition: NODE.extra(node).bold,
    answer,
    auto: true,
    why,
  });
}
// Answer from the tracker when it is on, otherwise put the question to the player.
export function answerFromTracker(state, node, answer, why) {
  if (state.settings.tracker) answerAuto(state, node, answer, why);
  else ask(state, node);
}
// Evaluate which of `ids` are playable (asking the player as needed), keep them as this walk's candidates and answer "any playable?".
export function answerByPlayableCount(state, node, ids, context, noun) {
  const playable = evalPlayable(state, ids, context);
  if (playable === PENDING) return PENDING;
  state.walk.cands = playable;
  answerAuto(
    state,
    node,
    playable.length > 0,
    playable.length + " " + noun + (playable.length === 1 ? "" : "s"),
  );
}
// The facts a decision handler may need, gathered once per decision.
export function decisionFacts(state) {
  const cardsOn = state.settings.cards,
    trackerOn = state.settings.tracker;
  return {
    trackerOn,
    cardsOn,
    diceOn: state.settings.dice,
    wome: state.settings.wome,
    factionsKnown: trackerOn || (cardsOn && state.settings.wome),
    board: state.board,
    walk: state.walk,
    handCount: engine.handCounts(state),
  };
}
export const characterHand = (state) =>
  engine.handCardsOfDeck(state, DECK.CHARACTER);
export const strategyHand = (state) =>
  engine.handCardsOfDeck(state, DECK.STRATEGY);
// A decision the app cannot answer: a two-part question asks the bold (ring) part first, then the plain part.
export function askDecision(state, node) {
  const nodeExtra = NODE.extra(node),
    walk = state.walk;
  if (nodeExtra.t2 && !nodeExtra.any) {
    if (walk.sub === 0)
      return ask(state, node, NODE.text(node), { sub: 1, bold: true });
    return ask(state, node, nodeExtra.t2, { sub: 2 });
  }
  ask(
    state,
    node,
    null,
    nodeExtra.any ? { items: nodeExtra.items, any: true } : null,
  );
}
