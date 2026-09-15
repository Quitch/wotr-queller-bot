// The Tools menu: the header's tool buttons as a list, for narrow screens where the header hides them
// (styles/header.css). Each entry closes the menu and opens its modal; New game closes it and asks as the header button does.
import { MODAL } from "../ui/constants.js";
import * as ui from "../ui/index.js";
import { closeModal } from "./framework.js";

const toolsContent = () => ({
  title: "Tools",
  body:
    '<div class="body"><nav class="toolmenu" aria-label="Tools">' +
    ui.TOOL_BUTTONS.map(
      ([modalName, label]) =>
        '<button class="btn" data-modal="' +
        modalName +
        '">' +
        label +
        "</button>",
    ).join("") +
    '<button class="btn ghost" id="menuNewGame">New game</button></nav></div>',
  narrow: true,
});
function wireToolsModal(modal, el) {
  ui.onClickEach(
    "[data-modal]",
    (button) => {
      const name = button.dataset.modal;
      closeModal();
      ui.openModal(name, name === MODAL.FLOW ? { current: true } : undefined);
    },
    el,
  );
  el.querySelector("#menuNewGame").onclick = () => {
    closeModal();
    ui.askNewGame();
  };
}

// What the modal framework needs to show this modal.
export const tools = {
  content: toolsContent,
  wire: wireToolsModal,
};
