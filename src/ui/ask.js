// Opening a modal, asking the player a question in one, and the New game confirmation.
import * as debug from "../debug.js";
import { renderModal } from "../modals/index.js";
import { MODAL, STORAGE_KEY } from "./constants.js";
import { render } from "./render.js";
import { setHistory, setModal, setState, state } from "./session.js";
import { storageSet } from "./storage.js";

export function openModal(name, arg) {
  setModal({ name, arg });
  if (name !== MODAL.ASK) debug.action({ action: "modal", name }, state);
  renderModal();
}
export function ask(spec) {
  openModal(MODAL.ASK, spec);
}
export function askNewGame() {
  ask({
    title: "Start a new game?",
    text: "The current game is replaced and its autosave is cleared. Named save slots are kept.",
    buttons: [
      { v: "ok", label: "Start a new game", primary: true },
      { v: "no", label: "Cancel" },
    ],
    onPick: (choice) => {
      if (choice !== "ok") return;
      debug.begin({ action: "newGameScreen" }, state);
      setHistory([]);
      setState(null);
      setModal(null);
      storageSet(STORAGE_KEY.AUTOSAVE, "");
      debug.finishAction(null);
      render();
    },
  });
}
