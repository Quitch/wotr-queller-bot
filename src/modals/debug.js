// The debug log modal: the environment, a DOM snapshot and the storage overview go into the log with the game state.
import * as debug from "../debug.js";
import { MODAL } from "../ui/constants.js";
import * as ui from "../ui/index.js";
import { copyText, downloadText } from "./transfer.js";

const debugContent = () => ({
  title: "Debug log",
  body: debugHTML(),
  narrow: true,
});
// The debug log modal.
function environment() {
  const mediaMatches = (query) => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return null;
    }
  };
  let storage = "ok";
  try {
    localStorage.setItem(ui.STORAGE_KEY.PROBE, "1");
    localStorage.removeItem(ui.STORAGE_KEY.PROBE);
  } catch (error) {
    storage = "unavailable: " + (error.message || error);
  }
  return {
    built: typeof QB_BUILT === "undefined" ? null : QB_BUILT, // defined by build.js
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    touchPoints: navigator.maxTouchPoints,
    viewport: [window.innerWidth, window.innerHeight],
    screen: [screen.width, screen.height],
    dpr: window.devicePixelRatio,
    theme: document.documentElement.dataset.theme || "system",
    prefersDark: mediaMatches("(prefers-color-scheme: dark)"),
    coarsePointer: mediaMatches("(pointer: coarse)"),
    reducedMotion: mediaMatches("(prefers-reduced-motion: reduce)"),
    online: navigator.onLine,
    storage,
    timeZone: Intl.DateTimeFormat().resolvedOptions()?.timeZone,
    utcOffsetMin: -new Date().getTimezoneOffset(),
    visibility: document.visibilityState,
    uptimeMs: Math.round(performance.now()),
    url: location.origin + location.pathname,
  };
}
function storageOverview() {
  const overview = {};
  for (const key of Object.values(ui.STORAGE_KEY)) {
    const value = ui.storageGet(key);
    overview[key] = value == null ? null : value.length;
  }
  return overview;
}
function domSnapshot() {
  const textOf = (selector) => {
    const el = document.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 600) : null;
  };
  const modal = ui.modal;
  let modalName = null;
  if (modal)
    modalName =
      modal.name +
      (modal.name === MODAL.ASK && modal.arg ? ": " + modal.arg.title : "");
  const activeEl = document.activeElement;
  let active = null;
  if (activeEl && activeEl !== document.body) {
    const label = activeEl.textContent
      ? " “" + activeEl.textContent.trim().slice(0, 40) + "”"
      : "";
    active =
      activeEl.tagName.toLowerCase() +
      (activeEl.id ? "#" + activeEl.id : "") +
      label;
  }
  return {
    rendered: !!document.getElementById("app")?.children.length,
    prompt: textOf(".prompt"),
    result: textOf(".result"),
    phaseButtons: [...document.querySelectorAll("[data-phase]")].map(
      (button) => button.dataset.phase,
    ),
    modal: modalName,
    errorBar: !!document.getElementById("errbar"),
    activeElement: active,
  };
}
function debugText() {
  return debug.text({
    state: ui.state,
    history: ui.history,
    report: ui.find("#dbgReport")?.value || "",
    env: environment(),
    dom: domSnapshot(),
    storage: storageOverview(),
    brokenAutosave: ui.storageGet(ui.STORAGE_KEY.BROKEN_AUTOSAVE) || null,
    opts: ui.parseJSONOr(ui.storageGet(ui.STORAGE_KEY.OPTIONS) || "null", null),
  });
}
function debugHTML() {
  return (
    '<div class="body"><p class="notice" style="color:var(--ink)">The debug log describes this browser, the game as it stands, the last ' +
    debug.LIMITS.actions +
    " actions, the trails of recent walks and any errors the app recorded, so that a problem can be traced from a report. It contains no personal details, but it does show Queller’s hidden cards — only read it if you do not mind seeing them.</p>" +
    '<p style="margin-top:12px"><label for="dbgReport"><b>What went wrong?</b> <span class="notice" style="display:inline">(optional — saved into the log: what you did, what you expected, what happened)</span></label><textarea id="dbgReport" style="min-height:80px" placeholder="For example: after answering Yes to “Witch King in play” the walk jumped to the Army page instead of Character 2."></textarea></p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn primary" id="dbgDl">Download debug log</button><button type="button" class="btn" id="dbgCopy">Copy debug log</button></div><div id="dbgNote" class="notice" role="status" aria-live="polite" style="margin-top:6px"></div>' +
    '<p style="margin-top:12px"><label for="dbgTxt" class="notice">The log (select all and copy if the buttons do not work)</label><textarea id="dbgTxt" readonly spellcheck="false" style="min-height:200px"></textarea></p></div>'
  );
}
function wireDebug(modal, el) {
  const textarea = el.querySelector("#dbgTxt");
  if (!textarea) return;
  const refresh = () => {
    try {
      textarea.value = debugText();
    } catch (error) {
      textarea.value =
        "The debug log could not be built: " +
        (error.stack || error.message || error);
      debug.error(error, { action: "debugBuild" }, ui.state);
    }
    return textarea.value;
  };
  refresh();
  el.querySelector("#dbgReport").onchange = refresh;
  el.querySelector("#dbgDl").onclick = () => {
    const data = refresh();
    debug.action(
      { action: "debugExport", how: "download", bytes: data.length },
      ui.state,
    );
    downloadText({
      fileName: debug.fileName(ui.state),
      data,
      noteEl: el.querySelector("#dbgNote"),
      fallbackLabel: "Copy debug log",
    });
  };
  el.querySelector("#dbgCopy").onclick = () => {
    const data = refresh();
    debug.action(
      { action: "debugExport", how: "copy", bytes: data.length },
      ui.state,
    );
    copyText({
      data,
      noteEl: el.querySelector("#dbgNote"),
      label: "Debug log",
      textarea,
    });
  };
}

// What the modal framework needs to show this modal.
export const debugLog = {
  content: debugContent,
  wire: wireDebug,
};
