// The whole UI built without a DOM: short random games (test/play.js) with the game screen, every prompt, every card
// half, every modal's content and every flowchart page rendered through the pure HTML builders. Fails when a builder
// throws, leaves "undefined", "NaN", "[object Object]" or "null" in its output, a prompt type has no renderer, a page's
// SVG lacks a box or an arrow, or an arrow does not start and end at its boxes. Exit 1 on any failure.
import * as fakeWindow from "./load.js";
import {
  SETTING_COMBINATIONS,
  game,
  reportProblems,
  seedRandom,
  settingsFromBits,
} from "./play.js";
const engine = fakeWindow.QB,
  ui = fakeWindow.QB_UI,
  FLOW = fakeWindow.QB_FLOW,
  NODE = fakeWindow.QB_NODE,
  EDGE = fakeWindow.QB_EDGE,
  { PROMPT } = engine;
const SEED = 3;
const GAMES_PER_SETTING = 2;
const TURNS_PER_GAME = 2;
const MAX_FAILURES_SHOWN = 25;
const CONTEXT_CHARS = 60; // of output shown around a suspect word
const ON_BORDER_TOLERANCE = 0.51; // an arrow end this far outside a box still touches it
// Words a builder leaves behind when it reads a field that is not there or stringifies the wrong thing.
const SUSPECT = /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/;
let fails = 0;
let rendered = 0;
const fail = (message) => {
  fails++;
  if (fails <= MAX_FAILURES_SHOWN) console.log("FAIL", message);
};
const ok = (condition, message) => {
  if (condition) console.log("ok  ", message);
  else fail(message);
};
// A builder's output must be a non-empty string without a suspect word.
function checkHTML(html, what, tag) {
  rendered++;
  if (typeof html !== "string")
    return fail(what + " is not a string (" + tag + ")");
  const match = html.match(SUSPECT);
  if (!match) return;
  const at = html.indexOf(match[0]);
  fail(
    what +
      ' contains "' +
      match[0] +
      '" (' +
      tag +
      "): …" +
      html.slice(Math.max(0, at - CONTEXT_CHARS), at + CONTEXT_CHARS) +
      "…",
  );
}
function checkNonEmptyHTML(html, what, tag) {
  checkHTML(html, what, tag);
  if (!html) fail(what + " is empty (" + tag + ")");
}
const promptTypesSeen = new Set();
// The game screen and, when a walk is open, its prompt and the parts of it the screen does not show on its own.
function renderGame(state, tag) {
  ui.setState(state);
  try {
    checkNonEmptyHTML(fakeWindow.gameHTML(), "game screen", tag);
    const walk = state.walk;
    if (!walk) return;
    if (walk.prompt) {
      promptTypesSeen.add(walk.prompt.type);
      checkNonEmptyHTML(
        fakeWindow.promptHTML(walk),
        "prompt " + walk.prompt.type,
        tag,
      );
      checkHTML(fakeWindow.dieHelpText(walk), "die help", tag);
      if (walk.prompt.type === PROMPT.BATTLE_FORM)
        checkNonEmptyHTML(
          fakeWindow.battleFormHTML(walk.prompt),
          "battle form",
          tag,
        );
    }
    if (walk.done)
      checkNonEmptyHTML(fakeWindow.resultHTML(walk), "walk result", tag);
    checkNonEmptyHTML(fakeWindow.trailHTML(walk), "walk trail", tag);
  } catch (error) {
    fail("rendering threw (" + tag + "): " + error.stack);
  }
}
// The modals that read the game: Settings, and the flowchart viewer opened on the walk's page (its SVG marks the walk).
function renderGameModals(state, tag) {
  ui.setState(state);
  const flow = fakeWindow.MODAL_REGISTRATIONS[ui.MODAL.FLOW];
  const modal = { name: ui.MODAL.FLOW, arg: { current: true } };
  try {
    flow.beforeRender(modal);
    checkNonEmptyHTML(flow.content(modal).body, "flowchart modal", tag);
    checkNonEmptyHTML(
      fakeWindow.MODAL_REGISTRATIONS[ui.MODAL.SETTINGS].content({
        name: ui.MODAL.SETTINGS,
      }).body,
      "settings modal",
      tag,
    );
  } catch (error) {
    fail("a modal threw (" + tag + "): " + error.stack);
  }
}
// The modals that need no game (or an ask spec): built with no state at all, as on the New game screen.
const ASK_SPECS = [
  {
    title: "Plain question?",
    text: "Yes or no.",
    buttons: [
      { v: "ok", label: "Yes", primary: true },
      { v: "no", label: "No" },
    ],
  },
  {
    title: "Pick one?",
    text: "Choose.",
    input: "select",
    inputLabel: "Which",
    options: ["First", "Second"],
    buttons: [{ v: "ok", label: "Choose", primary: true }],
  },
  {
    title: "How many?",
    text: "Count.",
    input: "number",
    inputLabel: "Number",
    value: 2,
    buttons: [{ v: "ok", label: "Continue", primary: true }],
  },
];
function renderStatelessModals() {
  ui.setState(null);
  const registrations = fakeWindow.MODAL_REGISTRATIONS;
  ok(
    Object.values(ui.MODAL).every((name) => registrations[name]?.content),
    "every MODAL name has a registration with content()",
  );
  for (const name of Object.values(ui.MODAL)) {
    if (name === ui.MODAL.SETTINGS) continue; // needs a game; rendered with one above
    const args =
      name === ui.MODAL.ASK
        ? ASK_SPECS
        : name === ui.MODAL.GLOSSARY
          ? [null, "mobile"]
          : [null];
    for (const arg of args) {
      try {
        const content = registrations[name].content({ name, arg });
        ok(
          typeof content.title === "string" && content.title.length > 0,
          "modal " + name + " has a title: " + content.title,
        );
        checkNonEmptyHTML(content.body, "modal " + name, "no game");
      } catch (error) {
        fail("modal " + name + " threw with no game: " + error.stack);
      }
    }
  }
  checkNonEmptyHTML(fakeWindow.setupHTML(), "New game screen", "no game");
}
function renderEveryCard() {
  const halves = [undefined, ui.CARD_HALF.EVENT, ui.CARD_HALF.COMBAT];
  for (const card of engine.CARDS)
    for (const half of halves)
      checkNonEmptyHTML(
        ui.cardHTML(card, half),
        "card " + card.id + " " + (half || "whole"),
        card.title,
      );
  console.log("ok   every card rendered whole and as each half");
}
// An arrow end touches its box: on the border, or inside it (a draw.io anchor on an ellipse lies a little inside the
// box, where the box drawn over the arrow hides it); never outside.
function touchesBox(box, [x, y]) {
  return (
    x >= box.x - ON_BORDER_TOLERANCE &&
    x <= box.x + box.width + ON_BORDER_TOLERANCE &&
    y >= box.y - ON_BORDER_TOLERANCE &&
    y <= box.y + box.height + ON_BORDER_TOLERANCE
  );
}
const finitePoint = (point) =>
  Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
// Every arrow of every page routes to a finite polyline that starts on its source box and ends on its target box.
function checkRoutes() {
  let edges = 0;
  for (const pageKey in FLOW) {
    const page = FLOW[pageKey];
    for (const edge of page.edges) {
      const from = page.nodes[EDGE.from(edge)],
        to = page.nodes[EDGE.to(edge)];
      const name = pageKey + " " + EDGE.from(edge) + "→" + EDGE.to(edge);
      if (!from || !to) {
        fail("arrow between missing boxes: " + name);
        continue;
      }
      edges++;
      const fromBox = NODE.box(from),
        toBox = NODE.box(to);
      const points = fakeWindow.route(
        fromBox,
        toBox,
        EDGE.waypoints(edge),
        EDGE.anchors(edge),
        EDGE.isElbow(edge),
      );
      if (points.length < 2 || !points.every(finitePoint)) {
        fail("arrow " + name + " routes to " + JSON.stringify(points));
        continue;
      }
      if (!touchesBox(fromBox, points[0]))
        fail(
          "arrow " +
            name +
            " starts away from its box at " +
            points[0] +
            " (box " +
            JSON.stringify(fromBox) +
            ")",
        );
      if (!touchesBox(toBox, points.at(-1)))
        fail(
          "arrow " +
            name +
            " ends away from its box at " +
            points.at(-1) +
            " (box " +
            JSON.stringify(toBox) +
            ")",
        );
    }
  }
  console.log("ok   " + edges + " arrows routed between their boxes");
}
// Every page's SVG holds a group per box and a polyline per arrow.
function checkPageSVGs() {
  ui.setState(null);
  for (const pageKey in FLOW) {
    const page = FLOW[pageKey];
    const svg = fakeWindow.svgPage(pageKey);
    checkNonEmptyHTML(svg, "SVG of " + pageKey, page.name);
    const missing = Object.keys(page.nodes).filter(
      (id) => !svg.includes('data-node="' + id + '"'),
    );
    const polylines = (svg.match(/<polyline /g) || []).length;
    ok(
      !missing.length && polylines === page.edges.length,
      "SVG of " +
        pageKey +
        ": " +
        Object.keys(page.nodes).length +
        " boxes, " +
        polylines +
        "/" +
        page.edges.length +
        " arrows" +
        (missing.length ? "; missing " + missing.join(", ") : ""),
    );
  }
}
function checkPromptTypesRendered() {
  const rendererFor = fakeWindow.PROMPT_RENDERERS;
  const unrendered = [...promptTypesSeen].filter((type) => !rendererFor[type]);
  ok(
    !unrendered.length,
    "every prompt type raised has a renderer" +
      (unrendered.length ? ": missing " + unrendered.join(", ") : ""),
  );
  const unseen = Object.values(PROMPT).filter(
    (type) => !promptTypesSeen.has(type),
  );
  ok(
    !unseen.length,
    "every prompt type was raised and rendered in the games" +
      (unseen.length ? "; never seen: " + unseen.join(", ") : ""),
  );
}
function playGames() {
  seedRandom(SEED);
  const hooks = { onPrompt: renderGame, afterPhase: renderGameModals };
  let gameNumber = 0;
  for (let bits = 0; bits < SETTING_COMBINATIONS; bits++) {
    const settings = settingsFromBits(bits);
    for (let i = 0; i < GAMES_PER_SETTING; i++) {
      const state = game(settings, gameNumber++, hooks, TURNS_PER_GAME);
      renderGame(state, "final " + JSON.stringify(settings));
    }
  }
  console.log(
    "ok   " + gameNumber + " games played, " + rendered + " renders checked",
  );
  if (!reportProblems()) fail("the games hit problems (above)");
}
function main() {
  playGames();
  checkPromptTypesRendered();
  renderStatelessModals();
  renderEveryCard();
  checkPageSVGs();
  checkRoutes();
  console.log(fails ? fails + " failure(s)" : "all render checks passed");
  process.exit(fails ? 1 : 0);
}
main();
