// The army value calculator: its inputs live in this module while the page is open.
import { escapeHTML as esc, formatText as fmt } from "../ui/dom.js";
import * as ui from "../ui/index.js";

const CALC_DEFAULTS = {
  reg: 0,
  elite: 0,
  lead: 0,
  cotw: 0,
  fort: false,
  strong: false,
  sortie: false,
};
let calc = { ...CALC_DEFAULTS };
const calcContent = () => ({
  title: "Army value calculator",
  body: calcHTML(),
  narrow: true,
});
// The army value calculator.
const CALC_MAX = { reg: 10, elite: 10, lead: 10, cotw: 5 };
// The army value rules (glossary: *value*).
const ARMY_VALUE = {
  ELITE_HITS: 2,
  MAX_COMBAT_DICE: 5,
  MAX_LEADERSHIP: 5,
  STRONGEST_UNITS: 5, // a Stronghold defender counts the hits of its five strongest units
  FORTIFICATION_BONUS: 1,
  STRONGHOLD_MULTIPLIER: 1.5,
  SORTIE_MULTIPLIER: 0.5,
};
function calcHTML() {
  const number = (key, label) =>
    ui.numberRowHTML(
      "c-" + key,
      fmt(label),
      calc[key],
      'data-cs="' + key + '"',
    );
  const checkbox = (key, label) =>
    ui.checkboxRowHTML(
      "c-" + key,
      fmt(label),
      calc[key],
      'data-c="' + key + '"',
    );
  return (
    '<div class="body"><p class="notice">' +
    fmt(
      "The *value* of an army per the glossary. Hits: 1 per Regular, " +
        ARMY_VALUE.ELITE_HITS +
        " per Elite. Combat dice: one per Army unit, maximum " +
        ARMY_VALUE.MAX_COMBAT_DICE +
        ". Leadership: maximum " +
        ARMY_VALUE.MAX_LEADERSHIP +
        " and not more than the number of Army units.",
    ) +
    '</p><div class="calc tracker">' +
    number("reg", "Regular units") +
    number("elite", "Elite units") +
    number("lead", "Leadership (Nazgûl, leaders, minions, Companions)¹") +
    number("cotw", "Captains of the West (Free Peoples only)") +
    checkbox("fort", "Defends in a Fortification or City region") +
    checkbox(
      "strong",
      "Defends in a Stronghold (×" +
        ARMY_VALUE.STRONGHOLD_MULTIPLIER +
        ", five strongest units’ hits)",
    ) +
    checkbox("sortie", "Sortie (×" + ARMY_VALUE.SORTIE_MULTIPLIER + ")") +
    '<div class="out">' +
    calcOut() +
    '</div><p class="notice" style="margin-top:10px">' +
    fmt(
      "¹ When testing whether an army is *mobile*, do not count Saruman in its leadership.",
    ) +
    "</p></div></div>"
  );
}
function calcOut() {
  const units = calc.reg + calc.elite;
  const lines = [];
  let hits = calc.reg + ARMY_VALUE.ELITE_HITS * calc.elite;
  if (calc.strong) {
    const top = Math.min(ARMY_VALUE.STRONGEST_UNITS, units);
    const eliteCounted = Math.min(top, calc.elite);
    hits = eliteCounted * ARMY_VALUE.ELITE_HITS + (top - eliteCounted);
    lines.push("Hits (five strongest units): " + hits);
  } else lines.push("Hits: " + hits);
  const dice = Math.min(ARMY_VALUE.MAX_COMBAT_DICE, units + calc.cotw);
  lines.push("Combat dice: " + dice);
  const lead = Math.min(ARMY_VALUE.MAX_LEADERSHIP, Math.min(calc.lead, units));
  lines.push("Leadership: " + lead);
  let value = hits + dice + lead + calc.cotw;
  if (calc.cotw) lines.push("Captains of the West: +" + calc.cotw);
  if (calc.fort) {
    value += ARMY_VALUE.FORTIFICATION_BONUS;
    lines.push("Fortification/City: +" + ARMY_VALUE.FORTIFICATION_BONUS);
  }
  if (calc.strong) {
    value = Math.floor(value * ARMY_VALUE.STRONGHOLD_MULTIPLIER);
    lines.push(
      "Stronghold: ×" + ARMY_VALUE.STRONGHOLD_MULTIPLIER + " rounded down",
    );
  }
  if (calc.sortie) {
    value = Math.floor(value * ARMY_VALUE.SORTIE_MULTIPLIER);
    lines.push("Sortie: ×" + ARMY_VALUE.SORTIE_MULTIPLIER + " rounded down");
  }
  return (
    '<div class="n">' +
    value +
    "</div><div>" +
    fmt("Army *value*") +
    "</div><ul>" +
    lines.map((line) => "<li>" + esc(line) + "</li>").join("") +
    "</ul>"
  );
}
function wireCalcModal(modal, el) {
  const showResult = () => (el.querySelector(".out").innerHTML = calcOut());
  el.querySelectorAll("[data-c]").forEach(
    (input) =>
      (input.oninput = () => {
        const key = input.dataset.c;
        calc[key] =
          input.type === "checkbox"
            ? input.checked
            : Math.max(0, +input.value || 0);
        showResult();
      }),
  );
  ui.onClickEach(
    "[data-cs]",
    (button) => {
      const key = button.dataset.cs;
      calc[key] = Math.max(
        0,
        Math.min(CALC_MAX[key], calc[key] + +button.dataset.d),
      );
      el.querySelector("#c-" + key + "-n").textContent = calc[key];
      showResult();
    },
    el,
  );
  el.querySelector("#calcClear").onclick = () => {
    Object.assign(calc, CALC_DEFAULTS);
    for (const key in CALC_MAX) {
      const counter = el.querySelector("#c-" + key + "-n");
      if (counter) counter.textContent = calc[key];
    }
    el.querySelectorAll("[data-c]").forEach((input) => {
      if (input.type === "checkbox") input.checked = !!calc[input.dataset.c];
      else input.value = calc[input.dataset.c];
    });
    showResult();
  };
}

// What the modal framework needs to show this modal.
export const calculator = {
  content: calcContent,
  wire: wireCalcModal,
  headerButtons:
    '<button type="button" class="btn" id="calcClear">Clear</button>',
};
