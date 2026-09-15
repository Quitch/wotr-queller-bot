// Decision handlers for the Muster page: (state, node, facts), each answering a box from the state or asking the player.
import * as engine from "../../engine/index.js";
import { cardById } from "../../engine/index.js";
import { answerAuto, answerFromTracker, ask } from "./common.js";
import { decidePlayableMusterCard } from "./phase-5.js";

// ---- Muster
function decideMinionAvailable(state, node) {
  const minions = engine.minionsAvailable(state);
  answerFromTracker(
    state,
    node,
    minions.length > 0,
    minions.length
      ? minions[0].name + ": " + minions[0].why
      : "no minion can be mustered (tracker)",
  );
}
function decideWillOfTheWest(state, node, { trackerOn, board, walk }) {
  if (walk.fromReserve)
    return answerAuto(
      state,
      node,
      false,
      "the die set aside for the minion must be used now (Rulings)",
    );
  if (
    trackerOn &&
    (board.chars.gandalfWhite ||
      board.chars.saruman ||
      board.chars.witchKing ||
      board.chars.mouth)
  )
    return answerAuto(
      state,
      node,
      false,
      board.chars.gandalfWhite
        ? "Gandalf the White is in play"
        : "a minion is already in play",
    );
  ask(state, node);
}
function decideNationNotAtWar(state, node, { trackerOn, wome }) {
  if (!trackerOn) return ask(state, node);
  const nationNotAtWar = !engine.allShadowNationsAtWar(state);
  const noFactionInPlay = wome && !engine.shadowFactionInPlay(state);
  let why = "all at war" + (wome ? ", faction in play" : "");
  if (nationNotAtWar) why = "a Shadow nation is not at war";
  else if (noFactionInPlay) why = "no faction in play";
  answerAuto(state, node, nationNotAtWar || noFactionInPlay, why);
}
function decideFactionTopOfPriority(state, node, { walk }) {
  answerAuto(
    state,
    node,
    walk.nationChoice === "Faction",
    "priority chose " + (walk.nationChoice || "nothing"),
  );
}
function decideMusterChoiceCard(state, node, { cardsOn, walk }) {
  if (cardsOn && walk.chosen)
    return answerAuto(
      state,
      node,
      !!engine.MUSTER_CHOICE[walk.chosen],
      "card: " + cardById[walk.chosen].title,
    );
  ask(state, node);
}
function decideFewerThanSixNazgul(state, node, { board }) {
  answerFromTracker(
    state,
    node,
    board.nazgul < 6,
    board.nazgul + " Nazgûl on the map",
  );
}

// The decision boxes of the Muster page, keyed by page and node id.
export const MUSTER_DECISIONS = {
  "MU.musterCard": decidePlayableMusterCard,
  "MU.minion": decideMinionAvailable,
  "MU.wotw": decideWillOfTheWest,
  "MU.notWar": decideNationNotAtWar,
  "MU.facTop": decideFactionTopOfPriority,
  "MU.cardChoice": decideMusterChoiceCard,
  "MU.sixNaz": decideFewerThanSixNazgul,
};
