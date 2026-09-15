// The board tracker (full or minimal), reading and changing the board, and the table cards a change may trigger.
import * as engine from "../qb.js";
import { FP_STANCE, cardById } from "../qb.js";
import { act } from "./actions.js";
import { ask } from "./ask.js";
import { escapeHTML } from "./dom.js";
import { state } from "./session.js";
import { checkboxRowHTML, numberRowHTML } from "./widgets.js";

// The board tracker.
// Tracker rows: a checkbox, a number stepper and a Free Peoples nation selector, keyed by the tracker path (e.g. "fs.progress").
const trackerId = (path) => "t-" + path.replaceAll(".", "-");
const trackerCheckbox = (path, label) =>
  checkboxRowHTML(
    trackerId(path),
    label,
    boardValue(path),
    'data-t="' + path + '"',
  );
const trackerNumber = (path, label) =>
  numberRowHTML(
    trackerId(path),
    label,
    boardValue(path),
    'data-step="' + path + '"',
  );
const trackerSelect = (path, label) =>
  '<div class="row"><label for="' +
  trackerId(path) +
  '">' +
  label +
  '</label><select id="' +
  trackerId(path) +
  '" data-t="' +
  path +
  '">' +
  [
    [FP_STANCE.PASSIVE, "Passive"],
    [FP_STANCE.ACTIVE, "Active"],
    [FP_STANCE.WAR, "At war"],
  ]
    .map(
      ([stance, label]) =>
        '<option value="' +
        stance +
        '"' +
        (boardValue(path) === stance ? " selected" : "") +
        ">" +
        label +
        "</option>",
    )
    .join("") +
  "</select></div>";
// A Shadow nation's steps above At War on the Political Track.
const shadowNationSelect = (path, label, max) => {
  let options = "";
  for (let steps = 0; steps <= max; steps++)
    options +=
      '<option value="' +
      steps +
      '"' +
      ((boardValue(path) ?? 0) === steps ? " selected" : "") +
      ">" +
      engine.politicalTrackLabel(steps) +
      "</option>";
  return (
    '<div class="row"><label for="' +
    trackerId(path) +
    '">' +
    label +
    '</label><select id="' +
    trackerId(path) +
    '" data-t="' +
    path +
    '" data-num="1">' +
    options +
    "</select></div>"
  );
};
// The situational card checks answered this turn, with a button to forget them (and the playability cache).
function situationalBlockHTML() {
  const answeredKeys = Object.keys(state.situational);
  return (
    '<h3>Card checks answered this turn</h3><div class="situ">' +
    (answeredKeys.length
      ? answeredKeys
          .map(
            (key) =>
              '<div class="row"><span>' +
              escapeHTML(engine.SITUATIONAL_QUESTIONS[key]) +
              "</span><b>" +
              (state.situational[key] ? "Yes" : "No") +
              "</b></div>",
          )
          .join("")
      : '<div class="row"><span>None yet</span></div>') +
    (answeredKeys.length || Object.keys(state.playable).length
      ? '<div class="row"><span></span><button class="btn small" data-t-reset="1">Forget</button></div>'
      : "") +
    "</div>"
  );
}
const minionsSectionHTML = (heading) =>
  "<h3>" +
  heading +
  "</h3>" +
  trackerCheckbox("chars.saruman", "Saruman") +
  trackerCheckbox("chars.witchKing", "Witch King") +
  trackerCheckbox("chars.mouth", "Mouth of Sauron");
const shadowFactionsHTML = () =>
  trackerCheckbox("factions.corsairs", "Corsairs") +
  trackerCheckbox("factions.dunlendings", "Dunlendings") +
  trackerCheckbox("factions.spiders", "Spiders");
// Without the full tracker, only the facts the dice pool and card priorities need are tracked.
function minimalFactionsSectionHTML() {
  const uses = [
    state.settings.cards ? "card priorities" : "",
    state.settings.dice ? "Faction die" : "",
  ].filter(Boolean);
  return (
    "<h3>Shadow factions in play (" +
    uses.join(", ") +
    ")</h3>" +
    shadowFactionsHTML()
  );
}
const huntSectionHTML = () =>
  "<h3>Hunt box and Elven Rings</h3>" +
  trackerNumber("fs.companions", "Companions in the Fellowship") +
  trackerNumber("rings", "Elven Rings held by the Shadow");
function minimalTrackerHTML() {
  let html = "";
  if (state.settings.dice)
    html += minionsSectionHTML("Minions in play (sizes the dice pool)");
  if ((state.settings.cards || state.settings.dice) && state.settings.wome)
    html += minimalFactionsSectionHTML();
  if (state.settings.dice) html += huntSectionHTML();
  if (state.settings.cards) html += situationalBlockHTML();
  if (!html) return "";
  return (
    '<section class="panel" aria-labelledby="h-track"><h2 class="ph" id="h-track">Board tracker <span class="r">minimal</span></h2>' +
    trackerNoticeHTML() +
    '<div class="tracker">' +
    html +
    "</div></section>"
  );
}
// With cards tracked, a tracker change can open a question about a card on the table: say so before it happens (WCAG 3.2.2).
const trackerNoticeHTML = () =>
  state.settings.cards
    ? '<p class="notice" style="margin:0 0 8px">A change here may ask whether a card on the table is discarded.</p>'
    : "";
const scoreSectionHTML = () =>
  "<h3>Score</h3>" +
  trackerNumber("shadowVP", "Shadow victory points") +
  trackerNumber("corruption", "Corruption") +
  trackerNumber("rings", "Elven Rings held by the Shadow");
const fellowshipSectionHTML = () =>
  "<h3>Fellowship</h3>" +
  trackerNumber("fs.progress", "Progress counter") +
  trackerNumber("fs.companions", "Companions in the Fellowship") +
  trackerCheckbox("fs.revealed", "Revealed") +
  trackerCheckbox("fs.mordor", "On the Mordor track") +
  trackerCheckbox("fs.atStart", "Figure in Rivendell") +
  trackerCheckbox(
    "fs.inFPSettlement",
    "Figure in a Free Peoples settlement region",
  ) +
  trackerCheckbox("fs.inStrongholdOrSea", "Figure in a Stronghold or at sea") +
  trackerCheckbox("fs.guideGollum", "Gollum is the Guide");
const charactersSectionHTML = () =>
  "<h3>Characters in play</h3>" +
  trackerCheckbox("chars.saruman", "Saruman") +
  trackerCheckbox("chars.witchKing", "Witch King") +
  trackerCheckbox("chars.mouth", "Mouth of Sauron") +
  trackerNumber("nazgul", "Nazgûl on the map") +
  trackerCheckbox("chars.gandalfWhite", "Gandalf the White") +
  trackerCheckbox("chars.aragorn", "Aragorn, Heir to Isildur");
const shadowNationsSectionHTML = () =>
  "<h3>Shadow nations (Political Track)</h3>" +
  shadowNationSelect("nations.sauron", "Sauron", 3) +
  shadowNationSelect("nations.isengard", "Isengard", 3) +
  shadowNationSelect("nations.se", "Southrons & Easterlings", 3);
const fpNationsSectionHTML = () =>
  "<h3>Free Peoples nations</h3>" +
  trackerSelect("nations.gondor", "Gondor") +
  trackerSelect("nations.rohan", "Rohan") +
  trackerSelect("nations.north", "North") +
  trackerSelect("nations.dwarves", "Dwarves") +
  trackerSelect("nations.elves", "Elves");
const factionsSectionHTML = () =>
  "<h3>Factions in play</h3>" +
  shadowFactionsHTML() +
  trackerCheckbox("factions.ents", "Ents") +
  trackerCheckbox("factions.eagles", "Eagles") +
  trackerCheckbox("factions.deadmen", "Dead Men");
export function trackerHTML() {
  if (!state.settings.tracker) return minimalTrackerHTML();
  return (
    '<section class="panel" aria-labelledby="h-track"><h2 class="ph" id="h-track">Board tracker <span class="r">answers what it can</span></h2>' +
    trackerNoticeHTML() +
    '<div class="tracker">' +
    scoreSectionHTML() +
    fellowshipSectionHTML() +
    charactersSectionHTML() +
    shadowNationsSectionHTML() +
    fpNationsSectionHTML() +
    (state.settings.wome ? factionsSectionHTML() : "") +
    situationalBlockHTML() +
    "</div></section>"
  );
}
// dotted paths into state.board ("fs.progress"): each step must be a field the board already has, so a path can
// neither reach a prototype nor add a field
function boardSlot(path) {
  const keys = path.split(".");
  const key = keys.pop();
  let object = state.board;
  for (const step of keys) {
    if (!Object.hasOwn(object, step))
      throw new Error("Unknown board field: " + path);
    object = object[step];
  }
  if (!Object.hasOwn(object, key))
    throw new Error("Unknown board field: " + path);
  return { object, key };
}
export function boardValue(path) {
  const { object, key } = boardSlot(path);
  return object[key];
}
function setBoardValue(path, value) {
  const { object, key } = boardSlot(path);
  object[key] = value;
}
export const STEP_LIMITS = {
  shadowVP: [0, 10],
  corruption: [0, 12],
  rings: [0, 3],
  "fs.progress": [0, 12],
  "fs.companions": [0, 7],
  nazgul: [0, 8],
};
export const DEFAULT_STEP_LIMIT = [0, 99];
// A tracker change: apply it and forget the cached card checks it may affect; returns the table cards whose discard
// condition the app cannot judge itself (the questions to ask).
function applyTrackerChange(path, value) {
  let asks = [];
  const from = boardValue(path);
  act(
    () => {
      setBoardValue(path, value);
      if (/^(nations|chars|fs|factions)\./.test(path) || path === "rings")
        state.playable = {};
      asks = engine.tableTriggers(state, { key: path, from, to: value });
    },
    { action: "tracker", key: path, from, to: value },
  );
  return asks;
}
// Ask about each table card the change may have triggered, one dialog after another.
function askAboutTriggeredCards(asks) {
  const askNextTriggeredCard = () => {
    const pending = asks.shift();
    if (!pending) return;
    ask({
      title: "Discard “" + cardById[pending.card].title + "”?",
      text: pending.q,
      buttons: [
        { v: "ok", label: "Discard it", primary: true },
        { v: "no", label: "Keep it" },
      ],
      onPick: (choice) => {
        if (choice === "ok")
          act(
            () =>
              engine.discardCard(
                state,
                pending.card,
                "its discard condition was met",
              ),
            { action: "tableTrigger", card: pending.card },
          );
        askNextTriggeredCard();
      },
    });
  };
  askNextTriggeredCard();
}
export function trackerChange(path, value) {
  askAboutTriggeredCards(applyTrackerChange(path, value));
}
