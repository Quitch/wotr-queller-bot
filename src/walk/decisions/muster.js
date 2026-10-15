// Decision handlers for the Muster page: (state, node, facts), each answering a box from the state or asking the player.
import * as engine from "../../engine/index.js";
import { MINIONS, MINION_STATUS, cardById } from "../../engine/index.js";
import { answerAuto, answerFromTracker, ask, askDecision } from "./common.js";
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
      "the die set aside for the minion must be used now (rule 34)",
    );
  if (!trackerOn) return askDecision(state, node);
  // "No minion has been recruited": one in play, or one recruited and eliminated since, both answer No.
  if (board.chars.gandalfWhite)
    return answerAuto(state, node, false, "Gandalf the White is in play");
  const anyMinion = (status) =>
    MINIONS.some((key) => board.chars[key] === status);
  if (anyMinion(MINION_STATUS.IN_PLAY))
    return answerAuto(state, node, false, "a minion is already in play");
  if (anyMinion(MINION_STATUS.ELIMINATED))
    return answerAuto(
      state,
      node,
      false,
      "a minion was recruited (eliminated since)",
    );
  ask(state, node, "Free Peoples have a Will of the West die");
}
function decideNationNotAtWar(state, node, { trackerOn, wome }) {
  if (!trackerOn) return askDecision(state, node);
  const nationNotAtWar = !engine.allShadowNationsAtWar(state);
  const noFactionInPlay = wome && !engine.shadowFactionInPlay(state);
  let why = "all At War" + (wome ? ", faction in play" : "");
  if (nationNotAtWar) why = "a Shadow Nation is not At War";
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

// "Holding a *playable* Muster card": entered from the Army page's "Muster 3", Queller holds an Army/Muster die,
// which cannot play an Event card (rule 1).
function decideMusterCardToPlay(state, node, facts) {
  const frame = facts.walk.stack.at(-1);
  if (frame && frame.page + "." + frame.node === "AR.jMuster3")
    return answerAuto(
      state,
      node,
      false,
      "an Army/Muster die cannot play an Event card",
    );
  decidePlayableMusterCard(state, node, facts);
}

// The decision boxes of the Muster page, keyed by page and node id.
export const MUSTER_DECISIONS = {
  "MU.musterCard": decideMusterCardToPlay,
  "MU.minion": decideMinionAvailable,
  "MU.wotw": decideWillOfTheWest,
  "MU.notWar": decideNationNotAtWar,
  "MU.facTop": decideFactionTopOfPriority,
  "MU.cardChoice": decideMusterChoiceCard,
  "MU.sixNaz": decideFewerThanSixNazgul,
};
