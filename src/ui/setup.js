// The New game screen: the four options and the Start, Load and debug buttons.
import * as debug from "../debug.js";
import { loadHTML, wireLoad } from "../modals/index.js";
import * as engine from "../qb.js";
import { commit } from "./actions.js";
import { openModal } from "./ask.js";
import { LEGAL, MODAL, STORAGE_KEY } from "./constants.js";
import { find, formatText, onClickEach, parseJSONOr } from "./dom.js";
import { setHistory, setState, state } from "./session.js";
import { storageGet, storageSet } from "./storage.js";
import { skipLinkHTML } from "./widgets.js";

export function setupHTML() {
  const settings = {
    dice: false,
    cards: false,
    tracker: false,
    wome: false,
    ...parseJSONOr(storageGet(STORAGE_KEY.OPTIONS) || "{}", {}),
  };
  return (
    skipLinkHTML("Skip to the New game options") +
    '<header class="top"><div class="brand"><h1>Queller Bot Runner</h1><span class="sub">Shadow player · War of the Ring 2nd Ed.</span></div>' +
    '<nav class="tools" aria-label="Tools"><button class="btn" data-modal="' +
    MODAL.HELP +
    '">Help</button></nav></header>' +
    '<main id="main" tabindex="-1" class="setup"><h2 style="font-size:1.3rem;margin-bottom:6px">New game</h2><p class="notice">Choose which parts of the bot the app should run for you. Each part works on its own — turn off anything you would rather keep on the table.</p>' +
    optionHTML("dice", {
      title: "Roll and track Queller’s dice",
      description:
        "Rolls the Shadow Action dice (and the Faction die) and keeps the Hunt box.",
      whenOn:
        "the walkthrough takes or skips options by the dice Queller actually has.",
      whenOff:
        "you roll for Queller, and the walkthrough asks which dice are available.",
      checked: settings.dice,
    }) +
    optionHTML("cards", {
      title: "Draw and hold Queller’s cards",
      description:
        "Shuffles the Character, Strategy and Faction Event decks, draws, and discards by the priority lists.",
      whenOn:
        "you only see how many cards Queller holds — a card is shown when a flowchart needs to know whether it is *playable*, or when it is played.",
      whenOff:
        "you hold Queller’s cards yourself, and the walkthrough asks about them.",
      checked: settings.cards,
    }) +
    optionHTML("tracker", {
      title: "Track board state in the app",
      description: "A trade-off. The app always walks the flowcharts.",
      whenOn:
        "you keep a board tracker up to date (Fellowship, characters, Political Track, nations, factions) and the app answers every board question from it.",
      whenOff:
        "no tracker to maintain, but every question about the board is put to you.",
      checked: settings.tracker,
    }) +
    '<h3 style="margin-top:18px">Expansions</h3>' +
    optionHTML("wome", {
      title: "Warriors of Middle-earth",
      description:
        "Adds the Faction Event deck, Call to Battle cards, the Faction die and the “– WoME –” decisions.",
      whenOn:
        "the “– WoME –” decisions are asked and the faction cards and die are in play.",
      whenOff: "those decisions are answered No and skipped.",
      checked: settings.wome,
    }) +
    '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button class="btn primary" id="start">Start game</button><button class="btn" id="loadBtn">Load a saved game</button><button class="btn ghost" id="debugBtn">Export debug log</button></div>' +
    (storageGet(STORAGE_KEY.BROKEN_AUTOSAVE)
      ? '<p class="notice" role="status" style="margin-top:12px;color:var(--bad)">An earlier game could not be shown after the page reloaded, so the app started here. That game is kept in the debug log — please export it and send it with a description of what happened. Starting a new game clears it.</p>'
      : "") +
    '<div id="loadArea" hidden style="margin-top:14px"></div>' +
    "</main>" +
    '<footer class="notice setup" aria-label="Licences and trademarks">' +
    LEGAL +
    "</footer>"
  );
}
// One New-game option: a checkbox with its title, description and what happens when it is on or off.
function optionHTML(id, { title, description, whenOn, whenOff, checked }) {
  return (
    '<label class="opt"><input type="checkbox" id="opt-' +
    id +
    '" ' +
    (checked ? "checked" : "") +
    "><div><b>" +
    title +
    "</b><span>" +
    formatText(description) +
    '<span class="oo"><b>On:</b> ' +
    formatText(whenOn) +
    '</span><span class="oo"><b>Off:</b> ' +
    formatText(whenOff) +
    "</span></span></div></label>"
  );
}
export function wireSetup() {
  find("#start").onclick = () => {
    const settings = {};
    ["dice", "cards", "tracker", "wome"].forEach(
      (key) => (settings[key] = find("#opt-" + key).checked),
    );
    storageSet(STORAGE_KEY.OPTIONS, JSON.stringify(settings));
    storageSet(STORAGE_KEY.BROKEN_AUTOSAVE, "");
    debug.begin({ action: "newGame", settings }, null);
    setState(engine.newState(settings));
    setHistory([]);
    engine.log(state, "New game. Roll for Queller’s starting strategy.");
    debug.finishAction(state);
    commit();
  };
  find("#loadBtn").onclick = () => {
    const area = find("#loadArea");
    area.hidden = false;
    area.innerHTML = loadHTML();
    wireLoad(area);
  };
  find("#debugBtn").onclick = () => openModal(MODAL.DEBUG);
  onClickEach("[data-modal]", (button) => openModal(button.dataset.modal));
}
