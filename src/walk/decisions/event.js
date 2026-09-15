// Decision handlers for the Event page: (state, node, facts), each answering a box from the state or asking the player.
import * as engine from "../../engine/index.js";
import { DIE_REQUIREMENT, cardById } from "../../engine/index.js";
import { DIE_REQUIREMENT_NAME } from "../jumps-table.js";
import { answerAuto, answerByPlayableCount, ask } from "./common.js";
import { decidePlayableRevealedCard } from "./phase-5.js";

// ---- Event
function decidePreferredPlayable(state, node, { cardsOn }) {
  if (cardsOn)
    return answerByPlayableCount(
      state,
      node,
      state.cards.hand
        .concat(state.cards.factionHand)
        .filter((id) => engine.cardFlags(cardById[id], state).preferred),
      "event",
      "playable *preferred* card",
    );
  ask(state, node);
}
function decideEventDie(state, node, { walk }) {
  if (walk.die)
    return answerAuto(
      state,
      node,
      walk.die === DIE_REQUIREMENT.EVENT,
      "using a " + DIE_REQUIREMENT_NAME[walk.die] + " die",
    );
  ask(state, node);
}
function decideHandUnder4(state, node, { cardsOn, handCount }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.total < 4,
      "Event cards in hand: " + handCount.total,
    );
  ask(state, node);
}
function decideFactionHandUnder3(state, node, { cardsOn, handCount }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.faction < 3,
      "Faction cards: " + handCount.faction,
    );
  ask(state, node);
}
function decideAnyPlayable(state, node, { cardsOn }) {
  if (cardsOn)
    return answerByPlayableCount(
      state,
      node,
      state.cards.hand.concat(state.cards.factionHand),
      "event",
      "playable card",
    );
  ask(state, node);
}
function decideHandAboveLimits(state, node, { cardsOn, wome, handCount }) {
  if (cardsOn)
    return answerAuto(
      state,
      node,
      handCount.total > 6 || handCount.faction > 4,
      "hand " +
        handCount.total +
        "/6" +
        (wome ? ", faction " + handCount.faction + "/4" : ""),
    );
  ask(state, node);
}
function decidePlayableCorruptionCard(state, node, { cardsOn }) {
  if (cardsOn)
    return answerByPlayableCount(
      state,
      node,
      state.cards.hand.filter(
        (id) => cardById[id].corruption || cardById[id].tile,
      ),
      "event",
      "card",
    );
  ask(state, node);
}

// The decision boxes of the Event page, keyed by page and node id.
export const EVENT_DECISIONS = {
  "EV.prefPlay": decidePreferredPlayable,
  "EV.eventDie": decideEventDie,
  "EV.less4": decideHandUnder4,
  "EV.less4b": decideHandUnder4,
  "EV.less3f": decideFactionHandUnder3,
  "EV.anyPlay": decideAnyPlayable,
  "EV.aboveFull": decideHandAboveLimits,
  "EV.revCard": decidePlayableRevealedCard("card"),
  "EV.corrCard": decidePlayableCorruptionCard,
};
