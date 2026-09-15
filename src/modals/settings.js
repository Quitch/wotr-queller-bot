// The settings modal: the options that can change mid-game, the debug log button and the About text.
import * as engine from "../qb.js";
import { MODAL } from "../ui/constants.js";
import * as ui from "../ui/index.js";
import { renderModal } from "./framework.js";

const settingsContent = () => ({
  title: "Settings",
  body: settingsHTML(),
  narrow: true,
});
function settingsHTML() {
  const settings = ui.state.settings;
  const checkbox = (key, label, description, disabled) =>
    '<label class="opt' +
    (disabled ? " dis" : "") +
    '"><input type="checkbox" data-set="' +
    key +
    '" ' +
    (settings[key] ? "checked" : "") +
    (disabled ? ' disabled aria-disabled="true"' : "") +
    "><div><b>" +
    label +
    "</b>" +
    (description ? "<span>" + description + "</span>" : "") +
    "</div></label>";
  return (
    '<div class="body setup" style="margin:0"><p class="notice">Changes apply from the next walk.</p>' +
    checkbox("dice", "Roll and track Queller’s dice", "") +
    checkbox(
      "cards",
      "Draw and hold Queller’s cards",
      "Chosen when the game is set up; it cannot be changed mid-game.",
      true,
    ) +
    checkbox("tracker", "Track board state in the app", "") +
    checkbox(
      "wome",
      "Warriors of Middle-earth",
      "Chosen when the game is set up; it cannot be changed mid-game.",
      true,
    ) +
    '<h3 style="margin-top:18px">Report a problem</h3><p class="notice">If the app does something wrong, export a debug log and send it with a description of what happened. The log records the game, the last actions and any errors.</p><p style="margin-top:8px"><button type="button" class="btn" id="dbgOpen">Export debug log</button></p><h3 style="margin-top:18px">About</h3><p class="notice">Queller Bot Runner version ' +
    engine.VERSION +
    ".</p>" +
    ui.LEGAL +
    "</div>"
  );
}
// A setting changed mid-game: the decks are rebuilt when WoME changes (or cards come on before any were dealt), and the
// Faction die leaves the pool when WoME goes off.
function applySetting(key, checked) {
  const state = ui.state;
  state.settings[key] = checked;
  if (
    key === "wome" ||
    (key === "cards" &&
      checked &&
      !state.cards.decks.C.length &&
      !state.cards.hand.length)
  ) {
    engine.buildDecks(state);
    engine.log(state, "Decks rebuilt.");
  }
  if (key === "wome" && !checked) state.dice.factionDie = false;
}
function wireSettingsModal(modal, el) {
  el.querySelector("#dbgOpen").onclick = () => ui.openModal(MODAL.DEBUG);
  el.querySelectorAll("[data-set]").forEach(
    (input) =>
      (input.onchange = () =>
        ui.act(
          () => {
            applySetting(input.dataset.set, input.checked);
            renderModal();
          },
          { action: "setting", key: input.dataset.set, value: input.checked },
        )),
  );
}

// What the modal framework needs to show this modal.
export const settings = {
  content: settingsContent,
  wire: wireSettingsModal,
};
