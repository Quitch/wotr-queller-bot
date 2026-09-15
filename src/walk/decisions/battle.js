// Decision handlers for the Battle page: (state, node, facts), each answering a box from the state or asking the player.
import * as engine from "../../engine/index.js";
import { DECK, STRATEGY, cardById } from "../../engine/index.js";
import { evalPlayable } from "../playable.js";
import { PENDING } from "../prompt.js";
import { answerAuto, answerByPlayableCount, ask } from "./common.js";
import { askAnyOf } from "./phase-5.js";

// ---- Battle
function decideUsableCharacterCombatCard(state, node, { cardsOn }) {
  if (cardsOn)
    return answerByPlayableCount(
      state,
      node,
      engine
        .combatCandidates(state)
        .filter((id) => cardById[id].deck === DECK.CHARACTER),
      "combat",
      "usable Character card",
    );
  ask(state, node);
}
function decideWitchKingFirstRound(state, node, { trackerOn, board, walk }) {
  if (walk.battleRound !== 1)
    return answerAuto(state, node, false, "not the first round");
  if (trackerOn && !board.chars.witchKing)
    return answerAuto(state, node, false, "Witch King not in play");
  ask(state, node, "Army includes the Witch King (this is the first round)");
}
function decideHandOver4(state, node, { cardsOn, handCount }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.total > 4,
      "Event cards in hand: " + handCount.total,
    );
  ask(state, node);
}
function decideCallToBattleUsable(state, node, { cardsOn, wome, walk }) {
  if (!wome) return answerAuto(state, node, false, "WoME not in play");
  if (!cardsOn) return ask(state, node);
  const usable = evalPlayable(state, engine.callToBattleCards(state), "combat");
  if (usable === PENDING) return PENDING;
  walk.ctb = usable;
  answerAuto(
    state,
    node,
    usable.length > 0,
    usable.length +
      " usable Call to Battle card" +
      (usable.length === 1 ? "" : "s"),
  );
}
function decideFirstRound(state, node, { walk }) {
  answerAuto(state, node, walk.battleRound === 1, "round " + walk.battleRound);
}
function decideFieldBattleOrMilitary(state, node, { trackerOn, board }) {
  if (state.strategy === STRATEGY.MILITARY)
    return answerAuto(state, node, true, "military strategy");
  if (trackerOn && board.fs.mordor)
    return answerAuto(state, node, true, "Fellowship on the Mordor track");
  ask(
    state,
    node,
    "Field battle? (not military strategy; Fellowship not on the Mordor track)",
  );
}
function decideAggressiveContinue(state, node, { trackerOn, board }) {
  if (trackerOn && board.fs.mordor)
    return answerAuto(state, node, true, "Fellowship on the Mordor track");
  ask(state, node);
}

// The decision boxes of the Battle page, keyed by page and node id.
export const BATTLE_DECISIONS = {
  "BA.playChar": decideUsableCharacterCombatCard,
  "BA.wkFirst": decideWitchKingFirstRound,
  "BA.more4": decideHandOver4,
  "BA.ctb": decideCallToBattleUsable,
  "BA.round1": decideFirstRound,
  "BA.fieldOrMil": decideFieldBattleOrMilitary,
  "BA.aggrCont": decideAggressiveContinue,
  "BA.anyCond": askAnyOf,
};
