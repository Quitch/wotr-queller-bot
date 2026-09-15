// The walker's public surface (window.QB together with the engine).
export {
  PROMPT,
  YES_NO_PROMPTS,
  WALK_RESULT,
  phaseResult,
  phaseFromResult,
  STRATEGY_ROLL,
} from "./prompt.js";
export {
  CARD_CRITERIA_NODES,
  jumpSpec,
  DIE_REQUIREMENT_NAME,
} from "./jumps-table.js";
export { startWalk, run } from "./run.js";
export { answer } from "./answers.js";
export {
  startPhase,
  startBattle,
  nextTurn,
  phase5Page,
  phasePage,
} from "./phases.js";
export { normalizeText, findStart } from "./graph.js";
