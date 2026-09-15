// Decision handlers for the Faction page: (state, node, facts), each answering a box from the state or asking the player.
import { CARD, DIE_REQUIREMENT } from "../../engine/index.js";
import { DIE_REQUIREMENT_NAME } from "../jumps-table.js";
import { answerAuto, answerByPlayableCount, ask } from "./common.js";

// ---- Faction
function decidePlayableFactionCard(state, node, { cardsOn }) {
  if (cardsOn)
    return answerByPlayableCount(
      state,
      node,
      state.cards.factionHand,
      "event",
      "playable Faction Event card",
    );
  ask(state, node);
}
function decideBlackSailsInPlay(state, node, { cardsOn, board }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      state.cards.factionTable.includes(CARD.BLACK_SAILS) &&
        board.factions.corsairs,
      "table",
    );
  ask(state, node);
}
function decideFactionPlayDie(state, node, { walk }) {
  if (walk.die)
    return answerAuto(
      state,
      node,
      walk.die === DIE_REQUIREMENT.FACTION_PLAY,
      "using " + DIE_REQUIREMENT_NAME[walk.die],
    );
  ask(state, node);
}
function decideFactionHandAboveLimit(state, node, { cardsOn, handCount }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.faction > 4,
      "faction hand " + handCount.faction + "/4",
    );
  ask(state, node);
}
function decideFactionEligible(state, node, { cardsOn, trackerOn, walk }) {
  if (walk.factionChoice)
    return ask(
      state,
      node,
      "Are the " + walk.factionChoice + " eligible to be brought into play?",
    );
  if (cardsOn || trackerOn)
    return answerAuto(state, node, false, "every faction is already in play");
  ask(state, node);
}

// The decision boxes of the Faction page, keyed by page and node id.
export const FACTION_DECISIONS = {
  "FA.playable": decidePlayableFactionCard,
  "FA.blackSails": decideBlackSailsInPlay,
  "FA.playDie": decideFactionPlayDie,
  "FA.aboveFull": decideFactionHandAboveLimit,
  "FA.eligible": decideFactionEligible,
};
