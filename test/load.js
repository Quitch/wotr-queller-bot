// The engine, the walker, the flowchart data, the cards, the reference text, the debug log and the UI's pure HTML
// builders (no DOM) under the names the tests use: the one place the tests reach into src/.
export * as QB from "../src/qb.js";
export {
  FLOW as QB_FLOW,
  NODE as QB_NODE,
  NODE_KIND as QB_NODE_KIND,
  EDGE as QB_EDGE,
} from "../src/flow/index.js";
export { CARDS as QB_CARDS } from "../src/cards/index.js";
export * as QB_DEBUG from "../src/debug.js";
export { GLOSSARY, GLOSSARY_ALIASES } from "../src/ref/glossary.js";
export { RULES } from "../src/ref/rules.js";
export { RULINGS } from "../src/ref/rulings.js";
export { TURN } from "../src/ref/turn.js";
export * as QB_UI from "../src/ui/index.js";
// The panels and tables the render and unit tests build or check without a DOM.
export { gameHTML } from "../src/ui/render.js";
export { PROMPT_RENDERERS, promptHTML } from "../src/ui/prompts.js";
export { battleFormHTML, dieHelpText } from "../src/ui/battle-form.js";
export { setupHTML } from "../src/ui/setup.js";
export { resultHTML, trailHTML } from "../src/ui/trail.js";
export { PHASE_BY_LABEL } from "../src/ui/header.js";
export { PHASE_ACTION } from "../src/ui/walkthrough.js";
export {
  DEFAULT_STEP_LIMIT,
  STEP_LIMITS,
  boardValue,
} from "../src/ui/tracker.js";
export { trackerValue } from "../src/ui/handlers.js";
export { MODAL_REGISTRATIONS, svgPage } from "../src/modals/index.js";
export { route } from "../src/modals/flow/route.js";
export { NODE_STYLE, SVG_COLOUR } from "../src/modals/flow/svg.js";
