// The game header: turn, phase and strategy chips, the tool buttons.
import { PHASE_LABEL, strategyName } from "../qb.js";
import { MODAL } from "./constants.js";
import { escapeHTML } from "./dom.js";
import { history, state } from "./session.js";

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
  const phaseLabel = PHASE_LABEL[state.phase] || escapeHTML(state.phase);
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
        strategyName(state.strategy) +
        " strategy</span>"
      : "") +
    (state.settings.wome
      ? '<span class="chip"><abbr title="Warriors of Middle-earth">WoME</abbr></span>'
      : "") +
    "</div>" +
    '<nav class="tools gameTools" aria-label="Tools"><button class="btn" id="undoBtn" ' +
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
