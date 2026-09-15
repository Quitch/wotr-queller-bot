// Page load: restore the debug log and the autosave, install the page-wide listeners, render (or fall back to the New
// game screen); the error bar shown after an error.
import * as debug from "../debug.js";
import { closeModal } from "../modals/index.js";
import { openModal } from "./ask.js";
import { MODAL, STORAGE_KEY } from "./constants.js";
import { escapeHTML } from "./dom.js";
import { render } from "./render.js";
import { modal, setHistory, setState, state } from "./session.js";
import { loadJSON, storageGet, storageSet } from "./storage.js";
import {
  hideTip,
  installGlossaryListeners,
  installTooltip,
  tipEl,
} from "./tooltip.js";

// Page load: restore the debug log and the autosave, install the page-wide listeners, render (or fall back to the New game screen).
function restoreDebugLog() {
  debug.restore({
    get: () => storageGet(STORAGE_KEY.DEBUG),
    set: (text) => storageSet(STORAGE_KEY.DEBUG, text),
  });
}
// Errors nothing caught go to the debug log and raise the error bar.
function installErrorHandlers() {
  window.addEventListener("error", (event) => {
    debug.error(
      event.error || event.message,
      {
        action: "uncaught",
        src: event.filename ? String(event.filename).split("/").pop() : null,
        line: event.lineno,
        col: event.colno,
      },
      state,
    );
    showErrBar();
  });
  window.addEventListener("unhandledrejection", (event) => {
    debug.error(
      event.reason || "unhandled promise rejection",
      { action: "unhandledrejection" },
      state,
    );
    showErrBar();
  });
}
// The autosave as a game: {state, error, raw}; state is null when there is none or it cannot be parsed.
function loadAutosave() {
  const raw = storageGet(STORAGE_KEY.AUTOSAVE);
  if (!raw) return { state: null, error: null, raw };
  try {
    return { state: loadJSON(raw), error: null, raw };
  } catch (error) {
    return { state: null, error, raw };
  }
}
// Keep an autosave the app could not use under its own key, so a debug log can carry it, and record why.
function quarantineBrokenAutosave(raw, error, { action, note, state }) {
  storageSet(STORAGE_KEY.BROKEN_AUTOSAVE, raw);
  debug.error(
    error,
    { action, note: note + "; kept under " + STORAGE_KEY.BROKEN_AUTOSAVE },
    state,
  );
}
// Escape closes the tooltip first, then the open modal.
function installEscapeKey() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (tipEl && !tipEl.hidden) {
      hideTip();
      event.stopPropagation();
      return;
    }
    if (modal) closeModal();
  });
}
// Render the restored game; if that throws, keep the save for the debug log and start at the New game screen.
function renderOrFallback(raw) {
  try {
    render();
  } catch (error) {
    console.error(
      "Queller Runner: could not render the saved game — starting at the New game screen.",
      error,
    );
    quarantineBrokenAutosave(raw || "", error, {
      action: "boot-render",
      note: "the saved game could not be rendered",
      state,
    });
    setState(null);
    setHistory([]);
    render();
    showErrBar();
  }
}
export function boot() {
  restoreDebugLog();
  installErrorHandlers();
  const autosave = loadAutosave();
  setState(autosave.state);
  if (autosave.error)
    quarantineBrokenAutosave(autosave.raw, autosave.error, {
      action: "boot-load",
      note: "the autosave could not be parsed",
    });
  debug.action(
    {
      action: "pageLoad",
      autosave: !!autosave.raw,
      restored: !!state,
      broken: !!storageGet(STORAGE_KEY.BROKEN_AUTOSAVE),
    },
    state,
  );
  document.documentElement.lang = document.documentElement.lang || "en";
  installTooltip();
  installGlossaryListeners();
  installEscapeKey();
  renderOrFallback(storageGet(STORAGE_KEY.AUTOSAVE));
}
// A bar above the app after an error: the game carries on (a failed action was rolled back) and a debug log is one tap away.
export function showErrBar() {
  let bar = document.getElementById("errbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "errbar";
    bar.setAttribute("role", "alert");
    document.body.prepend(bar);
  }
  const count = debug.errors.length,
    last = debug.errors[count - 1];
  bar.innerHTML =
    '<div class="wrap"><span class="msg"><b>Something went wrong in the app</b> — ' +
    escapeHTML(last ? last.message : "an error was recorded") +
    (last?.rolledBack
      ? ". Your last action was undone; the game continues."
      : ".") +
    " Please export a debug log and send it with a description of what you were doing.</span>" +
    '<span class="eb"><button type="button" class="btn small" id="errbarLog">Export debug log</button><button type="button" class="btn small ghost" id="errbarClose" aria-label="Dismiss this message">Dismiss</button></span></div>';
  document.getElementById("errbarLog").onclick = () => openModal(MODAL.DEBUG);
  document.getElementById("errbarClose").onclick = () => bar.remove();
}
