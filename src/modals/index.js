// The modals: the dialog framework plus one module per modal, registered under the MODAL names ui/ask.js opens them by.
import { MODAL } from "../ui/constants.js";
import { askDialog } from "./ask.js";
import { calculator } from "./calc.js";
import { debugLog } from "./debug.js";
import { flowViewer } from "./flow/index.js";
import { registerModals } from "./framework.js";
import { glossary } from "./glossary.js";
import { help } from "./help.js";
import { jump } from "./jump.js";
import { rules } from "./rules.js";
import { saveLoad } from "./save.js";
import { settings } from "./settings.js";

registerModals({
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
});

export { renderModal, closeModal } from "./framework.js";
export { loadHTML, wireLoad } from "./save.js";
export { svgPage } from "./flow/svg.js";
