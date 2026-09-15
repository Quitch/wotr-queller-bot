// The battle form (the facts the combat-card checks need) and the die line of an action prompt.
import * as engine from "../qb.js";
import { escapeHTML, find } from "./dom.js";
import { state } from "./session.js";
import { checkboxRowHTML, numberRowHTML } from "./widgets.js";

export function battleFormHTML(prompt) {
  const battle = state.battle || {},
    figures = battle.figures || {};
  const checkbox = (id, label, checked) =>
    checkboxRowHTML("bf-" + id, label, checked);
  let html =
    '<p class="q">' +
    escapeHTML(prompt.text) +
    '</p><div class="bform tracker">';
  const nazgulLeadership = battle.nazLead || 0;
  html +=
    numberRowHTML(
      "bf-nazLead",
      "Nazgûl leadership in the battle",
      nazgulLeadership,
      'data-bs="1"',
    ) +
    '<input type="hidden" id="bf-nazLead" value="' +
    nazgulLeadership +
    '">';
  html += checkbox(
    "shadowElite",
    "A Shadow Elite unit is in the battle",
    battle.shadowElite,
  );
  html += checkbox(
    "seElite",
    "A Southrons & Easterlings Elite is in the battle",
    battle.seElite,
  );
  html += checkbox(
    "isengardStronghold",
    "Isengard unit in the battle and the defender is in a Stronghold",
    battle.isengardStronghold,
  );
  html += checkbox(
    "defInFs",
    "The defending army is in the Fellowship region",
    battle.defInFs,
  );
  html += checkbox(
    "nearMoria",
    "The defending army is within two regions of Moria",
    battle.nearMoria,
  );
  if (state.settings.wome) {
    html +=
      checkbox(
        "underSiege",
        "The Shadow army is under siege",
        battle.underSiege,
      ) +
      checkbox(
        "attackingSiege",
        "The Shadow army is attacking in a siege",
        battle.attackingSiege,
      ) +
      '<h3 class="full">Faction figures with the Shadow army</h3>' +
      checkbox("f-corsairs", "Corsairs", figures.corsairs) +
      checkbox("f-dunlendings", "Dunlendings", figures.dunlendings) +
      checkbox("f-spiders", "Spiders", figures.spiders);
  }
  return html + "</div>";
}
export function readBattleForm() {
  const checked = (id) => {
    const input = document.getElementById("bf-" + id);
    return input ? input.checked : false;
  };
  return {
    nazLead: +(find("#bf-nazLead").value || 0),
    shadowElite: checked("shadowElite"),
    seElite: checked("seElite"),
    isengardStronghold: checked("isengardStronghold"),
    defInFs: checked("defInFs"),
    nearMoria: checked("nearMoria"),
    figures: {
      corsairs: checked("f-corsairs"),
      dunlendings: checked("f-dunlendings"),
      spiders: checked("f-spiders"),
    },
    underSiege: checked("underSiege"),
    attackingSiege: checked("attackingSiege"),
  };
}
// Which die the walk's current action uses, for the action prompt's help line.
export function dieHelpText(walk) {
  if (state.settings.dice && walk.dieIndex != null)
    return (
      "Uses the " + escapeHTML(state.dice.pool[walk.dieIndex].face) + " die."
    );
  return walk.die
    ? "Uses a " + escapeHTML(engine.DIE_REQUIREMENT_NAME[walk.die]) + " die."
    : "";
}
