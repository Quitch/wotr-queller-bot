// Decision handlers for the Phase 5 pages: (state, node, facts), each answering a box from the state or asking the player.
import * as engine from "../../engine/index.js";
import { TRAIL, cardById } from "../../engine/index.js";
import { NODE } from "../../flow/index.js";
import { trail } from "../core.js";
import { PENDING } from "../prompt.js";
import {
  answerAuto,
  answerByPlayableCount,
  ask,
  askDecision,
  boardFactYesNo,
  characterHand,
  recordDecision,
  strategyHand,
} from "./common.js";

// ---- Phase 5
// Character cards in hand while the Fellowship is on the Mordor track or revealed.
function decideCharacterCardsWithFellowshipOut(
  state,
  node,
  { trackerOn, cardsOn, board, handCount },
) {
  if (!trackerOn && !cardsOn) return ask(state, node);
  const onMordorOrRevealed = boardFactYesNo(
    state,
    "mordor",
    "Is the Fellowship on the Mordor track or revealed?",
    board.fs.mordor || board.fs.revealed,
  );
  if (onMordorOrRevealed === PENDING) return PENDING;
  if (!onMordorOrRevealed)
    return answerAuto(
      state,
      node,
      false,
      "Fellowship not on the Mordor track or revealed",
    );
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.character > 0,
      "Character cards: " + handCount.character,
    );
  ask(
    state,
    node,
    "Character cards > 0? (the Fellowship is on the Mordor track or revealed)",
  );
}
export function decideWitchKingInPlay(state, node, { trackerOn }) {
  if (trackerOn && !engine.minionInPlay(state, "witchKing"))
    return answerAuto(state, node, false, "Witch King not in play");
  ask(state, node);
}
// Two-part decision: bold part, a minion can be mustered; plain part, Muster 2 can still advance a nation or recruit a faction.
function decideMinionOrMuster2(state, node, { trackerOn, walk, wome }) {
  if (!trackerOn) return askDecision(state, node);
  if (walk.sub === 0) {
    const minions = engine.minionsAvailable(state);
    if (minions.length)
      return recordDecision(state, {
        text: NODE.text(node),
        ringCondition: true,
        answer: true,
        auto: true,
        why: minions[0].name + ": " + minions[0].why,
      });
    trail(state, {
      kind: TRAIL.QUESTION,
      text: NODE.text(node),
      answer: "No",
      auto: true,
      why: "no minion can be mustered (tracker)",
    });
    walk.sub = 1;
  }
  const seNotAtWar = !engine.shadowNationAtWar(state, "se"),
    noFactionInPlay = wome && !engine.shadowFactionInPlay(state);
  let why = "S&E at war" + (wome ? ", a faction is in play" : "");
  if (seNotAtWar) why = "Southrons & Easterlings not at war";
  else if (noFactionInPlay) why = "no faction recruited";
  recordDecision(state, {
    text: NODE.extra(node).t2,
    ringCondition: false,
    answer: seNotAtWar || noFactionInPlay,
    auto: true,
    why,
  });
}
function decideMordorWin(state, node, { trackerOn, board, walk }) {
  if (walk.sub === 0) {
    if (trackerOn && board.fs.mordor)
      return recordDecision(state, {
        text: NODE.text(node),
        ringCondition: true,
        answer: true,
        auto: true,
        why: "Fellowship on the Mordor track",
      });
    return ask(state, node, "*Target* would win the game", {
      sub: 1,
      bold: true,
    });
  }
  ask(state, node, NODE.extra(node).t2, { sub: 2 });
}
function decidePlayableCharacterCard(state, node, { cardsOn }) {
  if (cardsOn)
    return answerByPlayableCount(
      state,
      node,
      characterHand(state),
      "event",
      "playable Character card",
    );
  ask(state, node);
}
function decideAllFactionsInPlay(state, node, { factionsKnown }) {
  if (factionsKnown)
    return answerAuto(
      state,
      node,
      engine.allShadowFactionsInPlay(state),
      "tracker",
    );
  ask(state, node);
}
export const decidePlayableRevealedCard = (noun) =>
  function decideRevealedCard(state, node, { cardsOn }) {
    if (cardsOn)
      return answerByPlayableCount(
        state,
        node,
        characterHand(state).filter((id) => cardById[id].revealed),
        "event",
        noun,
      );
    ask(state, node);
  };
export function decidePlayableMusterCard(state, node, { cardsOn }) {
  if (cardsOn)
    return answerByPlayableCount(
      state,
      node,
      strategyHand(state).filter((id) => cardById[id].type === "Muster"),
      "event",
      "playable Muster card",
    );
  ask(state, node);
}
export const askAnyOf = (state, node) =>
  ask(state, node, null, { items: NODE.extra(node).items, any: true });
function decideAnyConditionOrMordor(state, node, { trackerOn, board }) {
  if (trackerOn && board.fs.mordor)
    return answerAuto(state, node, true, "Fellowship is in Mordor");
  askAnyOf(state, node);
}

// The decision boxes of the Phase 5 pages (both strategies), keyed by page and node id.
export const PHASE_5_DECISIONS = {
  "C5.charMordor": decideCharacterCardsWithFellowshipOut,
  "M5.charMordor": decideCharacterCardsWithFellowshipOut,
  "C5.wkNotMob": decideWitchKingInPlay,
  "M5.wkNotMob": decideWitchKingInPlay,
  "C5.minion": decideMinionOrMuster2,
  "M5.minion": decideMinionOrMuster2,
  "C5.mordorWin": decideMordorWin,
  "C5.playChar": decidePlayableCharacterCard,
  "C5.allFac": decideAllFactionsInPlay,
  "M5.revCard": decidePlayableRevealedCard(
    "playable “Fellowship revealed” card",
  ),
  "M5.playMuster": decidePlayableMusterCard,
  "M5.anyCond": decideAnyConditionOrMordor,
};
