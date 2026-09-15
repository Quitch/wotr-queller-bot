// Decision handlers for the Character and Army pages: (state, node, facts), each answering a box from the state or asking the player.
import { minionInPlay } from "../../engine/index.js";
import { answerAuto, answerFromTracker, ask } from "./common.js";
import { decideWitchKingInPlay } from "./phase-5.js";

// ---- Character
function decideNazgulInPlay(state, node, { board }) {
  const witchKing = minionInPlay(state, "witchKing");
  answerFromTracker(
    state,
    node,
    witchKing || board.nazgul > 0,
    "tracker: " +
      board.nazgul +
      " Nazgûl" +
      (witchKing ? ", Witch King in play" : ""),
  );
}
function decideNazgulOnMap(state, node, { trackerOn, board }) {
  if (trackerOn && board.nazgul === 0)
    return answerAuto(state, node, false, "no Nazgûl on the map");
  ask(state, node);
}
function decideMouthInPlay(state, node, { trackerOn }) {
  if (trackerOn && !minionInPlay(state, "mouth"))
    return answerAuto(state, node, false, "Mouth of Sauron not in play");
  ask(state, node);
}
function decideDieUsed(state, node, { walk }) {
  answerAuto(
    state,
    node,
    walk.dieUsed,
    walk.dieUsed ? "a move was made" : "nothing moved",
  );
}
// ---- Army
function decideHuntDiceForArmy(state, node, { diceOn, trackerOn, board }) {
  if (diceOn && state.dice.hunt === 0)
    return answerAuto(state, node, false, "no dice in the Hunt box");
  if (trackerOn && board.fs.mordor)
    return answerAuto(state, node, false, "Fellowship in Mordor");
  ask(state, node);
}

// The decision boxes of the Character and Army pages, keyed by page and node id.
export const DICE_PAGE_DECISIONS = {
  "CH.wkJoin": decideWitchKingInPlay,
  "CH.nazInPlay": decideNazgulInPlay,
  "CH.nazFs": decideNazgulOnMap,
  "CH.nazJoin": decideNazgulOnMap,
  "CH.mosMob": decideMouthInPlay,
  "CH.dieUsed": decideDieUsed,
  "AR.huntDice": decideHuntDiceForArmy,
};
