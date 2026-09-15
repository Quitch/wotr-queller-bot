// The save modal: three named slots in this browser, download or copy a save, and the Load area (also on the New
// game screen).
import * as debug from "../debug.js";
import { MODAL } from "../ui/constants.js";
import { escapeHTML as esc } from "../ui/dom.js";
import * as ui from "../ui/index.js";
import { closeModal, renderModal } from "./framework.js";
import { copyText, downloadText } from "./transfer.js";

const saveContent = () => ({
  title: "Save and load",
  body: saveHTML(),
  narrow: true,
});
// Save and load.
const slots = () =>
  ui.parseJSONOr(ui.storageGet(ui.STORAGE_KEY.SLOTS) || "[]", []);
function saveHTML() {
  const slotList = slots();
  let html =
    '<div class="body"><p class="notice">The game is saved automatically in this browser after every action. Named saves are also kept in this browser. To move a game to another device, download it or copy the code.</p>';
  html +=
    "<h4>Named saves</h4>" +
    [0, 1, 2]
      .map((i) => {
        const slot = slotList[i];
        return (
          '<div class="slot"><span class="t">Slot ' +
          (i + 1) +
          (slot ? ": turn " + slot.turn + ", " + esc(slot.when) : ": empty") +
          '</span><button class="btn small" data-save="' +
          i +
          '">Save here</button>' +
          (slot
            ? '<button class="btn small" data-load="' + i + '">Load</button>'
            : "") +
          "</div>"
        );
      })
      .join("");
  html +=
    '<h4>Transfer</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="dlBtn">Download save file</button><button class="btn" id="copyBtn">Copy save code</button></div><div id="dlNote" class="notice"></div>';
  html += "<h4>Load</h4>" + loadHTML() + "</div>";
  return html;
}
export function loadHTML() {
  return '<p class="notice" style="margin:0 0 6px">Paste a save code, or choose a save file.</p><label for="loadTxt" class="notice">Save code</label><textarea id="loadTxt" placeholder="Paste the save code here"></textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center"><button class="btn" id="loadTxtBtn">Load from code</button><label class="notice">Save file <input type="file" id="loadFile" accept=".json,application/json"></label></div><div id="loadErr" class="notice" role="alert" style="color:var(--bad)"></div>';
}
// Replace the game with a parsed save.
function replaceGame(save, title) {
  debug.begin(
    { action: "load", title, turn: save.turn, version: save.appVersion },
    ui.state,
  );
  ui.setHistory([]);
  ui.setState(save);
  debug.finishAction(save);
  closeModal();
  ui.commit();
}
// Ask before replacing a game in progress; No returns to the save modal.
function confirmReplace(save, title) {
  ui.ask({
    title,
    text: "The game in progress will be replaced.",
    buttons: [
      { v: "ok", label: "Load", primary: true },
      { v: "no", label: "Cancel" },
    ],
    onPick: (choice) => {
      if (choice === "ok") replaceGame(save, title);
      else ui.openModal(MODAL.SAVE);
    },
  });
}
function loadGame(save, title) {
  if (ui.state) confirmReplace(save, title);
  else replaceGame(save, title);
}
export function wireLoad(root) {
  const doLoad = (text) => {
    try {
      loadGame(ui.loadJSON(text), "Load this save?");
    } catch (error) {
      const errorEl = root.querySelector("#loadErr");
      if (errorEl)
        errorEl.textContent = "That is not a Queller save: " + error.message;
    }
  };
  const loadBtn = root.querySelector("#loadTxtBtn");
  if (loadBtn)
    loadBtn.onclick = () => doLoad(root.querySelector("#loadTxt").value.trim());
  const fileInput = root.querySelector("#loadFile");
  if (fileInput)
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;
      file.text().then(doLoad);
    };
}
function wireSaveModal(modal, el) {
  ui.onClickEach(
    "[data-save]",
    (button) => {
      debug.action(
        { action: "saveSlot", slot: +button.dataset.save },
        ui.state,
      );
      const slotList = slots();
      slotList[+button.dataset.save] = {
        turn: ui.state.turn,
        when: new Date().toLocaleString(),
        data: JSON.stringify(ui.state),
      };
      ui.storageSet(ui.STORAGE_KEY.SLOTS, JSON.stringify(slotList));
      renderModal();
    },
    el,
  );
  ui.onClickEach(
    "[data-load]",
    (button) => {
      const slot = slots()[+button.dataset.load];
      if (slot)
        loadGame(
          ui.loadJSON(slot.data),
          "Load slot " + (+button.dataset.load + 1) + "?",
        );
    },
    el,
  );
  el.querySelector("#dlBtn").onclick = () =>
    downloadText({
      fileName: "queller-turn" + ui.state.turn + ".json",
      data: JSON.stringify(ui.state),
      noteEl: el.querySelector("#dlNote"),
      fallbackLabel: "Copy save code",
    });
  el.querySelector("#copyBtn").onclick = () =>
    copyText({
      data: JSON.stringify(ui.state),
      noteEl: el.querySelector("#dlNote"),
      label: "Save code",
      textarea: el.querySelector("#loadTxt"),
    });
  wireLoad(el);
}

// What the modal framework needs to show this modal.
export const saveLoad = {
  content: saveContent,
  wire: wireSaveModal,
};
