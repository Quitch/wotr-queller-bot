// A question from the app (ui.ask): text, an optional select or number input, and its buttons.
import * as debug from "../debug.js";
import { escapeHTML as esc } from "../ui/dom.js";
import * as ui from "../ui/index.js";
import { closeModal } from "./framework.js";

const ASK_NUMBER_MAX = 20;
function askInputHTML(spec) {
  if (spec.input === "select")
    return (
      '<p><label for="askInput">' +
      esc(spec.inputLabel) +
      '</label><br><select id="askInput" class="askctl">' +
      spec.options
        .map(
          (option, i) =>
            '<option value="' + i + '">' + esc(option) + "</option>",
        )
        .join("") +
      "</select></p>"
    );
  if (spec.input === "number")
    return (
      '<p><label for="askInput">' +
      esc(spec.inputLabel) +
      '</label><br><input id="askInput" class="askctl" type="number" min="0" max="' +
      ASK_NUMBER_MAX +
      '" value="' +
      (spec.value || 1) +
      '"></p>'
    );
  return "";
}
function askContent(modal) {
  const spec = modal.arg;
  return {
    title: spec.title,
    body:
      '<div class="body"><p class="notice" style="font-size:.95rem;color:var(--ink)">' +
      esc(spec.text) +
      "</p>" +
      askInputHTML(spec) +
      '<div class="answers" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
      spec.buttons
        .map(
          (button) =>
            '<button class="btn' +
            (button.primary ? " primary" : "") +
            '" data-ask="' +
            button.v +
            '">' +
            esc(button.label) +
            "</button>",
        )
        .join("") +
      "</div></div>",
    narrow: true,
  };
}
function wireAskModal(modal, el) {
  ui.onClickEach(
    "[data-ask]",
    (button) => {
      const spec = modal.arg;
      const input = ui.find("#askInput");
      const inputValue = input ? input.value : undefined;
      debug.action(
        {
          action: "ask",
          title: spec.title,
          pick: button.dataset.ask,
          input: inputValue,
        },
        ui.state,
      );
      closeModal();
      if (spec.onPick) spec.onPick(button.dataset.ask, inputValue);
    },
    el,
  );
}

// What the modal framework needs to show this modal.
export const askDialog = {
  content: askContent,
  wire: wireAskModal,
};
