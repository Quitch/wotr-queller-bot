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
const SEED = 2;
const GAMES_PER_SETTING = 2;
const TURNS_PER_GAME = 3;
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
// After Not possible on a Phase 5 action with the app holding Queller's cards, the walk asks whether a Free Peoples
// card blocked it. The question is the same whatever Queller holds, so it never gives away the hand.
function afterNotPossible(hand, settings) {
  const state = engine.newState(settings);
  state.strategy = engine.STRATEGY.MILITARY;
  state.phase = engine.PHASE.P5;
  state.cards.hand = hand;
  state.cards.factionHand = [];
  state.dice.pool = ["Army", "Army", "Character", "Muster"].map((face) => ({
    kind: engine.DIE_KIND.ACTION,
    face,
    status: engine.DIE_STATE.AVAIL,
  }));
  engine.startPhase(state, engine.PHASE.P5);
  for (let guard = 0; guard < 60; guard++) {
    const prompt = state.walk.prompt;
    if (state.walk.done || prompt.type === PROMPT.ACTION) break;
    engine.answer(state, engine.YES_NO_PROMPTS.includes(prompt.type) || "done");
  }
  engine.answer(state, "no");
  ui.setState(state);
  return state.walk.prompt ? fakeWindow.promptHTML(state.walk) : "";
}
function checkBlockedQuestionHidesHand() {
  const settings = { dice: true, cards: true, tracker: true, wome: false };
  const canPay = afterNotPossible(["sa013", "sa008"], settings),
    cannotPay = afterNotPossible(["sa002"], settings);
  ok(
    canPay.includes('data-ans="powerTooGreat"') &&
      canPay.includes('data-ans="bombadil"') &&
      canPay.includes('data-ans="no"'),
    "Not possible asks whether A Power too Great or Tom Bombadil blocked the action",
  );
  ok(canPay === cannotPay, "the question is identical whatever Queller holds");
  ok(
    !afterNotPossible(["sa013", "sa008"], {
      ...settings,
      cards: false,
    }).includes('data-ans="powerTooGreat"'),
    "no question when the player holds Queller's cards",
  );
}
// A condition list the player answers (here MU.notWar without the tracker) is a bulleted list under its header,
// with no question mark after the header's colon; WoME items are left out without WoME.
function checkConditionListPrompt() {
  const state = engine.newState({
    dice: false,
    cards: false,
    tracker: false,
    wome: false,
  });
  state.phase = engine.PHASE.P5;
  engine.startWalk(state, "MU", "Muster 2", {
    die: engine.DIE_REQUIREMENT.MUSTER,
  });
  for (let guard = 0; guard < 10 && state.walk.node !== "notWar"; guard++)
    engine.answer(state, false);
  ui.setState(state);
  const html = fakeWindow.promptHTML(state.walk);
  ok(
    state.walk.node === "notWar" &&
      html.includes("ANY condition true:</p><ul><li>") &&
      !html.includes("No faction is in play"),
    "a condition list is asked as a bulleted list, without a question mark after the colon or the WoME item",
  );
}
// A situational card question (Dreadful Spells asks whether a Shadow Army with Nazgûl is next to a Free Peoples
// Army): the random games reach one only now and then, so one is raised and rendered here.
function checkSituationalPrompt() {
  const state = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: false,
  });
  state.strategy = engine.STRATEGY.CORRUPTION;
  state.phase = engine.PHASE.P5;
  state.cards.hand = ["sa008"];
  state.cards.factionHand = [];
  engine.startWalk(state, "EV", "Event", {
    die: engine.DIE_REQUIREMENT.EVENT,
  });
  renderGame(state, "situational card question");
  ok(
    state.walk.prompt?.type === PROMPT.SITUATIONAL,
    "a situational card question is raised and rendered",
  );
}
// The Army die's first move (rule 9) offers one Army, two Armies or an attack; the second move is a plain Done under an
// eyebrow that says which move it is. The random games stop at the first action, so both are raised here.
function checkArmyMovePrompts() {
  const state = engine.newState({
    dice: true,
    cards: false,
    tracker: false,
    wome: false,
  });
  state.phase = engine.PHASE.P5;
  state.strategy = engine.STRATEGY.MILITARY;
  state.dice.pool = [
    { kind: engine.DIE_KIND.ACTION, face: "Army", status: "avail" },
  ];
  engine.startWalk(state, "AR", "Army 4", {
    die: engine.DIE_REQUIREMENT.ARMY,
    dieIndex: 0,
  });
  const toMoveAttack = () => {
    for (
      let guard = 0;
      guard < 20 && state.walk.prompt?.text !== "Move/Attack";
      guard++
    )
      engine.answer(
        state,
        state.walk.prompt.type === engine.PROMPT.YES_NO ? true : "done",
      );
    ui.setState(state);
    return fakeWindow.promptHTML(state.walk);
  };
  const first = toMoveAttack();
  engine.answer(state, "done");
  const second = toMoveAttack();
  const buttons = (html) =>
    [
      ...html.matchAll(
        /<button class="btn [a-z]+" data-ans="[a-zA-Z]+">([^<]+)</g,
      ),
    ].map(([, name]) => name);
  ok(
    buttons(first).join() ===
      "Moved one Army,Moved two Armies,Attacked,Not possible (rule 36)" &&
      buttons(second).join() === "Done,Not possible (rule 36)" &&
      second.includes("second Army move"),
    "the first Army move offers one Army, two Armies or an attack; the second is a plain Done (" +
      buttons(first).join() +
      " | " +
      buttons(second).join() +
      ")",
  );
}
function main() {
  playGames();
  checkArmyMovePrompts();
  checkSituationalPrompt();
  checkConditionListPrompt();
  checkBlockedQuestionHidesHand();
  checkPromptTypesRendered();
  renderStatelessModals();
  renderEveryCard();
  checkPageSVGs();
  checkRoutes();
  console.log(fails ? fails + " failure(s)" : "all render checks passed");
  process.exit(fails ? 1 : 0);
}
main();
