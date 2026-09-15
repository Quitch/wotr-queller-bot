// Decisions: the boxes the app can answer itself (or ask about with more context than the box text), by page.
import { NODE } from "../../flow/index.js";
import { BATTLE_DECISIONS } from "./battle.js";
import { answerAuto, askDecision, decisionFacts } from "./common.js";
import { DICE_PAGE_DECISIONS } from "./dice-pages.js";
import { EVENT_DECISIONS } from "./event.js";
import { FACTION_DECISIONS } from "./faction.js";
import { MUSTER_DECISIONS } from "./muster.js";
import { PHASE_5_DECISIONS } from "./phase-5.js";
import { PHASES_1_4_DECISIONS } from "./phases-1-4.js";

// The decision boxes the app can answer itself (or ask about with more context than the box text), keyed by page and node id.
// A handler is (state, node, facts) and returns PENDING when it has opened a prompt.
const DECISION_HANDLERS = {
  ...PHASES_1_4_DECISIONS,
  ...PHASE_5_DECISIONS,
  ...DICE_PAGE_DECISIONS,
  ...MUSTER_DECISIONS,
  ...EVENT_DECISIONS,
  ...FACTION_DECISIONS,
  ...BATTLE_DECISIONS,
};
export function handleDecision(state, node) {
  if (NODE.extra(node).wome && !state.settings.wome)
    return answerAuto(state, node, false, "WoME not in play");
  const handler = DECISION_HANDLERS[state.walk.page + "." + state.walk.node];
  if (handler) return handler(state, node, decisionFacts(state));
  askDecision(state, node);
}
