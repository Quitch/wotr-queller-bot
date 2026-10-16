// Decision handlers for the Character and Army pages: (state, node, facts), each answering a box from the state or asking the player.
import { DIE_REQUIREMENT, FACE, minionInPlay } from "../../engine/index.js";
import {
  answerAuto,
  answerFromTracker,
  answerIfOtherDie,
  ask,
} from "./common.js";
import { forExposedMove } from "../jumps-table.js";
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
      (witchKing ? ", Witch-king in play" : ""),
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
    return answerAuto(state, node, false, "no dice in the Hunt Box");
  if (trackerOn && board.fs.mordor)
    return answerAuto(state, node, false, "Fellowship in Mordor");
  ask(state, node);
}

// "Using an Army/Muster die": the die the Army page was entered with.
function decideArmyMusterDie(state, node, { walk, diceOn }) {
  if (answerIfOtherDie(state, node, DIE_REQUIREMENT.ARMY)) return;
  if (walk.armyMoves)
    return answerAuto(state, node, false, "the die has made an Army move");
  if (diceOn && walk.dieIndex != null) {
    const face = state.dice.pool[walk.dieIndex].face;
    return answerAuto(state, node, face === FACE.ARMY_MUSTER, face + " die");
  }
  ask(state, node);
}

// "Threat exists": a Character die brought for rule 11 makes only the move towards exposed, so the threat moves are
// not for it.
function decideThreatExists(state, node, { walk }) {
  if (forExposedMove(walk))
    return answerAuto(
      state,
      node,
      false,
      "the Character die makes only the move towards *exposed* (rule 11)",
    );
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
  "AR.threatEx": decideThreatExists,
  "AR.huntDice": decideHuntDiceForArmy,
  "AR.amDie": decideArmyMusterDie,
};
