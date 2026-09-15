// Decision handlers for the Phases 1-4 pages: (state, node, facts), each answering a box from the state or asking the player.
import * as engine from "../../engine/index.js";
import { answerAuto, answerFromTracker, ask } from "./common.js";

// ---- Phases 1-4
function decideHandOver6(state, node, { cardsOn, handCount }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.total > 6,
      "hand: " + handCount.total,
    );
  ask(state, node);
}
function decideStrategyCardsOver1(state, node, { cardsOn, handCount }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.strategy > 1,
      "Strategy cards: " + handCount.strategy,
    );
  ask(state, node);
}
function decideFactionHandOver4(state, node, { cardsOn, handCount }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.faction > 4,
      "Faction cards: " + handCount.faction,
    );
  ask(state, node);
}
function decideCorruptionBelowVP(state, node, { board }) {
  answerFromTracker(
    state,
    node,
    board.corruption < board.shadowVP,
    "Corruption " + board.corruption + " vs Shadow VP " + board.shadowVP,
  );
}
function decideVPBelowCorruption(state, node, { board }) {
  answerFromTracker(
    state,
    node,
    board.shadowVP < board.corruption,
    "Shadow VP " + board.shadowVP + " vs Corruption " + board.corruption,
  );
}
function decideFellowshipAtStart(state, node, { board }) {
  answerFromTracker(
    state,
    node,
    board.fs.atStart && board.fs.progress === 0,
    "tracker",
  );
}
function decideFellowshipInMordor(state, node, { board }) {
  answerFromTracker(state, node, board.fs.mordor, "tracker");
}
const decideProgressOver = (limit) =>
  function decideProgress(state, node, { board }) {
    answerFromTracker(
      state,
      node,
      board.fs.progress > limit,
      "Progress " + board.fs.progress,
    );
  };
function decideWinOrSevenDice(state, node, { diceOn }) {
  if (diceOn && engine.diceCount(state) === engine.BASE_ACTION_DICE)
    return answerAuto(
      state,
      node,
      true,
      "Shadow has " + engine.BASE_ACTION_DICE + " dice",
    );
  ask(
    state,
    node,
    "*Mobile* army adjacent to *target* which would win the game" +
      (diceOn ? "" : " or Shadow only has 7 dice"),
  );
}

// The decision boxes of the Phases 1-4 pages (both strategies), keyed by page and node id.
export const PHASES_1_4_DECISIONS = {
  "C14.more6": decideHandOver6,
  "M14.more6": decideHandOver6,
  "C14.strat1": decideStrategyCardsOver1,
  "C14.more4f": decideFactionHandOver4,
  "M14.more4f": decideFactionHandOver4,
  "C14.corrLow": decideCorruptionBelowVP,
  "M14.vpLow": decideVPBelowCorruption,
  "C14.fsStart": decideFellowshipAtStart,
  "M14.fsStart": decideFellowshipAtStart,
  "C14.fsMordor": decideFellowshipInMordor,
  "M14.fsMordor": decideFellowshipInMordor,
  "C14.prog4": decideProgressOver(4),
  "M14.prog5": decideProgressOver(5),
  "C14.winOr7": decideWinOrSevenDice,
};
