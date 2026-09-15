// The game header: turn, phase and strategy chips, the tool buttons.
import { PHASE } from "../qb.js";
import { MODAL } from "./constants.js";
import { history, state } from "./session.js";

const PHASE_LABEL = {
  [PHASE.SETUP]: "Setup",
  [PHASE.P1]: "Phase 1",
  [PHASE.P2]: "Phase 2",
  [PHASE.P3]: "Phase 3",
  [PHASE.P4]: "Phase 4",
  [PHASE.P5]: "Phase 5",
  [PHASE.P6]: "Phase 6",
};
// The phase a walk's end point names ("Phase 5" → p5).
export const PHASE_BY_LABEL = Object.fromEntries(
  Object.entries(PHASE_LABEL).map(([phase, label]) => [label, phase]),
);
// The header's tool buttons: [modal, label, extra class]. On a narrow screen they fold into the Tools menu (modals/tools.js).
export const TOOL_BUTTONS = [
  [MODAL.SAVE, "Save / Load"],
  [MODAL.GLOSSARY, "Glossary"],
  [MODAL.FLOW, "Flowcharts"],
  [MODAL.RULES, "Rules"],
  [MODAL.CALC, "Army value"],
  [MODAL.HELP, "Help"],
  [MODAL.SETTINGS, "Settings", "ghost"],
];
export function headerHTML() {
  const phaseLabel = PHASE_LABEL[state.phase] || state.phase;
  return (
    '<header class="top"><div class="brand"><h1>Queller Bot Runner</h1><span class="sub">Shadow player</span></div>' +
    '<div class="status"><span class="chip">Turn <b>' +
    state.turn +
    "</b></span>" +
    '<span class="chip">' +
    phaseLabel +
    "</span>" +
    (state.strategy
      ? '<span class="chip strat-' +
        state.strategy +
        '">' +
        capitalize(state.strategy) +
        " strategy</span>"
      : "") +
    (state.settings.wome
      ? '<span class="chip"><abbr title="Warriors of Middle-earth">WoME</abbr></span>'
      : "") +
    "</div>" +
    '<nav class="tools" aria-label="Tools"><button class="btn" id="undoBtn" ' +
    (history.length ? "" : "disabled") +
    ' title="Undo the last action">Undo</button>' +
    TOOL_BUTTONS.map(
      ([modalName, label, extraClass]) =>
        '<button class="btn' +
        (extraClass ? " " + extraClass : "") +
        '" data-modal="' +
        modalName +
        '">' +
        label +
        "</button>",
    ).join("") +
    '<button class="btn ghost" id="newGameBtn">New game</button><button class="btn" id="toolsBtn" data-modal="' +
    MODAL.TOOLS +
    '">Tools</button></nav></header>'
  );
}
const capitalize = (text) =>
  text ? text[0].toUpperCase() + text.slice(1) : "";
