// The modals: the dialog framework plus one module per modal, registered under the MODAL names ui/ask.js opens them by.
import { MODAL } from "../ui/constants.js";
import { askDialog } from "./ask.js";
import { calculator } from "./calc.js";
import { debugLog } from "./debug.js";
import { flowViewer } from "./flow/index.js";
import { glossary } from "./glossary.js";
import { help } from "./help.js";
import { jump } from "./jump.js";
import { rules } from "./rules.js";
import { saveLoad } from "./save.js";
import { settings } from "./settings.js";
import { tools } from "./tools.js";

// The registrations by modal name (test/render.js builds every modal's content from them). A function, so nothing
// imported across the ui/ and modals/ cycle is read while this module evaluates.
export const modalRegistrations = () => ({
  [MODAL.GLOSSARY]: glossary,
  [MODAL.RULES]: rules,
  [MODAL.FLOW]: flowViewer,
  [MODAL.CALC]: calculator,
  [MODAL.SAVE]: saveLoad,
  [MODAL.SETTINGS]: settings,
  [MODAL.JUMP]: jump,
  [MODAL.HELP]: help,
  [MODAL.DEBUG]: debugLog,
  [MODAL.ASK]: askDialog,
  [MODAL.TOOLS]: tools,
});

export { renderModal, closeModal } from "./framework.js";
export { openLoadArea } from "./save.js";
export { svgPage } from "./flow/svg.js";
