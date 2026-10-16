// The save modal: three named slots in this browser, download or copy a save, and the Load area (also on the New
// game screen).
import * as debug from "../debug.js";
import { MODAL } from "../ui/constants.js";
import { escapeHTML as esc } from "../ui/dom.js";
import * as ui from "../ui/index.js";
import { closeModal, renderModal } from "./framework.js";
import { copyText, downloadText, wireShare } from "./transfer.js";

const saveContent = () => ({
  title: "Save and load",
  body: saveHTML(),
  narrow: true,
});
// Save and load.
export function slots() {
  const slotList = ui.parseJSONOr(ui.storageGet(ui.STORAGE_KEY.SLOTS), []);
  return Array.isArray(slotList) ? slotList : [];
}
function saveHTML() {
  const slotList = slots();
  let html =
    '<div class="body"><p class="notice">The game is saved automatically in this browser after every action. Named saves are also kept in this browser. To move a game to another device, download it or copy the code.</p>';
  html +=
    "<h3>Named saves</h3>" +
    [0, 1, 2]
      .map((i) => {
        const slot = slotList[i];
        return (
          '<div class="slot"><span class="t">Slot ' +
          (i + 1) +
          (slot
            ? ": turn " + esc(slot.turn) + ", " + esc(slot.when)
            : ": empty") +
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
    '<h3>Transfer</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="dlBtn">Download save file</button><button type="button" class="btn" id="shareBtn" hidden>Share save file</button><button class="btn" id="copyBtn">Copy save code</button></div><div id="dlNote" class="notice" role="status" aria-live="polite"></div>';
  html += "<h3>Load</h3>" + loadHTML() + "</div>";
  return html;
}
function loadHTML() {
  return '<p class="notice" style="margin:0 0 6px">Paste a save code, or choose a save file.</p><label for="loadTxt" class="notice">Save code</label><textarea id="loadTxt" placeholder="Paste the save code here"></textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center"><button class="btn" id="loadTxtBtn">Load from code</button><label class="btn filebtn">Save file <input type="file" id="loadFile" accept=".json,.txt,application/json,text/plain"></label></div><div id="loadErr" class="notice" role="alert" style="color:var(--bad)"></div>';
}
// The New game screen's Load area, opened (its Load a saved game button, and after a load that failed there).
export function openLoadArea() {
  const area = ui.find("#loadArea");
  if (!area) return null;
  area.hidden = false;
  area.innerHTML = loadHTML();
  wireLoad(area);
  return area;
}
// Replace the game with a parsed save. A save that cannot be drawn throws (ui.commit builds the page before the
// autosave): the game in progress, its Undo steps and its battle form draft come back, are saved and drawn again (in
// case only wiring the page failed after the autosave was written), and so does the Load area it was loaded from: the
// save modal, or the New game screen's, so the reason has somewhere to show.
function replaceGame(save, title) {
  const previous = {
    state: ui.state,
    history: ui.history,
    battleDraft: ui.battleDraft,
  };
  debug.begin(
    { action: "load", title, turn: save.turn, version: save.appVersion },
    ui.state,
  );
  ui.setHistory([]);
  ui.setState(save);
  closeModal();
  try {
    ui.commit();
  } catch (error) {
    ui.restoreState(previous.state);
    ui.setHistory(previous.history);
    ui.setBattleDraft(previous.battleDraft);
    debug.error(error, { action: "loadFailed", rolledBack: true }, save);
    ui.storageSet(
      ui.STORAGE_KEY.AUTOSAVE,
      previous.state ? JSON.stringify(previous.state) : "",
    );
    ui.render();
    if (previous.state) ui.openModal(MODAL.SAVE);
    else openLoadArea()?.querySelector("#loadTxt")?.focus();
    throw error;
  }
  debug.finishAction(save);
}
function showLoadError(text) {
  const errorEl = ui.find("#loadErr");
  if (errorEl) errorEl.textContent = text;
}
// A save refused by loadJSON (not JSON, or migrate's checks: "not a Queller save (field)"), and one that loaded but
// could not be drawn.
const refusedText = (error) =>
  error.message.startsWith("not a Queller save")
    ? "That is " + error.message + "."
    : "That is not a Queller save: " + error.message;
const notDrawnText = (error) =>
  "That save loaded but could not be shown, so it was not used: " +
  error.message;
// Parse a save and load it; what goes wrong is said in the Load area.
function loadText(text, title) {
  let save;
  try {
    save = ui.loadJSON(text);
  } catch (error) {
    showLoadError(refusedText(error));
    return;
  }
  try {
    loadGame(save, title);
  } catch (error) {
    showLoadError(notDrawnText(error));
  }
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
      if (choice !== "ok") {
        ui.openModal(MODAL.SAVE);
        return;
      }
      try {
        replaceGame(save, title);
      } catch (error) {
        showLoadError(notDrawnText(error));
      }
    },
  });
}
function loadGame(save, title) {
  if (ui.state) confirmReplace(save, title);
  else replaceGame(save, title);
}
// Write the game into a slot; false when the browser would not store it (slots and saveToSlot are exported for the
// tests).
export function saveToSlot(index) {
  debug.action({ action: "saveSlot", slot: index }, ui.state);
  const slotList = slots();
  slotList[index] = {
    turn: ui.state.turn,
    when: new Date().toLocaleString(),
    data: JSON.stringify(ui.state),
  };
  if (ui.storageSet(ui.STORAGE_KEY.SLOTS, JSON.stringify(slotList)))
    return true;
  ui.showStorageNotice();
  return false;
}
// After the save modal is drawn again: say so when the slot was not stored.
function reportSlotSave(saved, index) {
  const note = ui.find("#dlNote");
  if (!saved && note)
    note.textContent =
      "Slot " +
      (index + 1) +
      " was not saved: this browser’s storage is full or blocked.";
}
// Ask before overwriting an occupied slot (there is no undo for it); either answer returns to the save modal.
function confirmOverwrite(index, slot) {
  ui.ask({
    title: "Overwrite slot " + (index + 1) + "?",
    text:
      "Slot " +
      (index + 1) +
      " holds a save from turn " +
      slot.turn +
      " (" +
      slot.when +
      "). It will be replaced by the current game and cannot be recovered.",
    buttons: [
      { v: "ok", label: "Overwrite", primary: true },
      { v: "no", label: "Cancel" },
    ],
    onPick: (choice) => {
      const saved = choice !== "ok" || saveToSlot(index);
      ui.openModal(MODAL.SAVE);
      reportSlotSave(saved, index);
    },
  });
}
function wireLoad(root) {
  const doLoad = (text) => loadText(text, "Load this save?");
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
      const index = +button.dataset.save;
      const slot = slots()[index];
      if (slot) confirmOverwrite(index, slot);
      else {
        const saved = saveToSlot(index);
        renderModal();
        reportSlotSave(saved, index);
      }
    },
    el,
  );
  ui.onClickEach(
    "[data-load]",
    (button) => {
      const slot = slots()[+button.dataset.load];
      if (slot)
        loadText(slot.data, "Load slot " + (+button.dataset.load + 1) + "?");
    },
    el,
  );
  const saveFileName = () => "queller-turn" + ui.state.turn + ".json";
  const shareButton = el.querySelector("#shareBtn");
  wireShare(shareButton, {
    fileName: saveFileName,
    data: () => JSON.stringify(ui.state),
    noteEl: el.querySelector("#dlNote"),
    fallbackLabel: "Copy save code",
  });
  el.querySelector("#dlBtn").onclick = () =>
    void downloadText({
      fileName: saveFileName(),
      data: JSON.stringify(ui.state),
      noteEl: el.querySelector("#dlNote"),
      fallbackLabel: shareButton.hidden
        ? "Copy save code"
        : "Share save file or Copy save code",
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
