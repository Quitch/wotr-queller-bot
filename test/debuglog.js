// Debug log module (src/debug.js) without a DOM: action history, walk trails, error capture, persistence, the built log. Exit 1 on any failure.
import * as fakeWindow from "./load.js";
const engine = fakeWindow.QB,
  debug = fakeWindow.QB_DEBUG,
  { PROMPT, PHASE, STRATEGY } = engine;
const OVERFLOW = 50; // actions recorded beyond the ring buffer's limit
const UNDO_SNAPSHOTS = 7; // an undo history longer than the snapshots a log keeps
const FULL_UNDO_HISTORY = 60; // ui/constants.js UNDO_DEPTH
const MAX_EXPORT_BYTES = 600 * 1024;
const LONG_GAME_TURNS = 8;
let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.log("FAIL", message);
  } else console.log("ok  ", message);
};
// A localStorage stand-in.
const stored = { text: null };
const storage = {
  get: () => stored.text,
  set: (text) => {
    stored.text = text;
  },
};
// The answer that moves a prompt on: No to every question, the first option otherwise.
const ANSWERS = {
  [PROMPT.CHOICE]: (prompt) => prompt.options[0].value,
  [PROMPT.ROLL]: (prompt) => prompt.options[0],
  [PROMPT.PRIORITY]: () => "ok",
};
function defaultAnswer(prompt) {
  if (engine.YES_NO_PROMPTS.includes(prompt.type)) return false;
  const answerFor = ANSWERS[prompt.type];
  return answerFor ? answerFor(prompt) : "done";
}
// Answer every prompt of the open walk, each answer bracketed like ui/actions.js act() does.
function drive(state) {
  let guard = 0;
  while (state.walk && !state.walk.done && guard++ < 80) {
    const prompt = state.walk.prompt;
    const value = defaultAnswer(prompt);
    debug.begin(
      {
        action: "answer",
        prompt: prompt.type,
        page: state.walk.page,
        node: state.walk.node,
        value,
      },
      state,
    );
    engine.answer(state, value);
    debug.finishAction(state);
  }
}
function startPhaseAsAction(state, phase) {
  debug.begin({ action: "phase", id: phase }, state);
  engine.startPhase(state, phase);
  debug.finishAction(state);
}
// A short game with everything on, every action recorded.
function playShortGame() {
  const state = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  ok(
    state.appVersion === engine.VERSION &&
      state.createdVersion === engine.VERSION,
    "new state stamped with the app version " + engine.VERSION,
  );
  debug.action({ action: "pageLoad", autosave: false }, null);
  for (const phase of [PHASE.SETUP, PHASE.P1, PHASE.P3, PHASE.P4, PHASE.P5]) {
    startPhaseAsAction(state, phase);
    drive(state);
  }
  return state;
}
function checkActionHistory() {
  const actions = debug.actions;
  ok(
    actions.length > 5 &&
      actions[0].action === "pageLoad" &&
      actions[1].action === "phase",
    "actions recorded in order (" + actions.length + ")",
  );
  ok(
    actions.every((record) => typeof record.time === "number") &&
      actions
        .slice(1)
        .every(
          (record) =>
            record.before &&
            record.after &&
            typeof record.after.turn === "number",
        ),
    "every action carries a time and before/after digests",
  );
  const last = actions.at(-1);
  ok(
    last.after.dice &&
      /\//.test(last.after.dice) &&
      typeof last.after.hand === "number",
    "digest summarises dice and hand: " + last.after.dice,
  );
}
function checkWalkRecords(state) {
  ok(
    debug.walks.length >= 4 &&
      debug.walks.every(
        (walk) =>
          walk.trail.length > 0 && walk.entry && walk.result !== undefined,
      ),
    "finished walks kept with their trails (" + debug.walks.length + ")",
  );
  ok(
    debug.walks.every(
      (walk) => !walk.trail.some((entry) => Object.keys(entry).length > 12),
    ),
    "walk trails stored compactly",
  );
  const walksBefore = debug.walks.length;
  debug.action({ action: "modal", name: "rules" }, state);
  ok(
    debug.walks.length === walksBefore,
    "a finished walk is recorded once, not on every later action",
  );
}
// Abandoning a walk mid-way keeps its trail.
function checkAbandonedWalk(state) {
  startPhaseAsAction(state, PHASE.P5);
  ok(
    state.walk && !state.walk.done && state.walk.prompt,
    "a Phase 5 walk opens a prompt to abandon",
  );
  debug.begin({ action: "phase", id: "abandon" }, state);
  state.walk = null;
  debug.finishAction(state);
  ok(
    debug.walks.at(-1).note === "replaced or abandoned",
    "an abandoned walk is kept with a note",
  );
}
function checkPersistence() {
  const saved = stored.text;
  ok(
    saved && JSON.parse(saved).actions.length === debug.actions.length,
    "history persisted to storage on every action",
  );
  debug.reset();
  ok(debug.actions.length === 0, "reset clears the history");
  debug.restore(storage);
  ok(debug.actions.length === 0, "reset also cleared the stored copy");
  stored.text = saved;
  debug.restore(storage);
  const restored = JSON.parse(saved);
  ok(
    debug.actions.length === restored.actions.length &&
      debug.walks.length === restored.walks.length,
    "history restored from storage after a reload",
  );
  stored.text = "{not json";
  debug.restore(storage);
  ok(
    debug.actions.length === restored.actions.length &&
      debug.walks.length === restored.walks.length,
    "the previous log survives a corrupt stored history",
  );
  stored.text = saved;
  debug.restore(storage);
}
// Errors during an action, uncaught between actions, and with a state that cannot be digested.
function checkErrors(state) {
  debug.begin({ action: "answer", prompt: PROMPT.YES_NO, value: true }, state);
  const err = debug.error(
    new TypeError("Cannot read properties of undefined (reading 'face')"),
    { rolledBack: true },
    state,
  );
  ok(
    err.message.startsWith("Cannot read") &&
      err.name === "TypeError" &&
      err.stack &&
      err.during?.action === "answer" &&
      err.state &&
      err.state.turn === state.turn,
    "an error during an action records the action, the stack and a state digest",
  );
  const err2 = debug.error(
    "Script error.",
    { action: "uncaught", line: 12 },
    state,
  );
  ok(
    err2.message === "Script error." && err2.lastAction && !err2.during,
    "an uncaught error between actions points at the last action",
  );
  ok(
    debug.error({ message: "x" }, {}, { dice: undefined }).state.digestFailed,
    "a broken state cannot stop an error being recorded",
  );
}
function checkRingBuffer(state) {
  const limit = debug.LIMITS.actions;
  for (let i = 0; i < limit + OVERFLOW; i++)
    debug.action({ action: "modal", name: "x" + i }, state);
  ok(
    debug.actions.length === limit &&
      debug.actions.at(-1).name === "x" + (limit + OVERFLOW - 1),
    "action history capped at " + limit + ", newest kept",
  );
}
function checkBuiltLog(state) {
  const history = new Array(UNDO_SNAPSHOTS).fill(JSON.stringify(state));
  const logText = debug.text({
    state,
    history,
    report: "the walk went wrong",
    env: { built: "test", userAgent: "node" },
    dom: { prompt: "x" },
    storage: { "qb.autosave": 100 },
    brokenAutosave: '{"settings":{},"board":{}}',
    opts: { dice: true },
  });
  let log;
  try {
    log = JSON.parse(logText);
  } catch {
    log = null;
  }
  ok(!!log, "the log is valid JSON (" + logText.length + " bytes)");
  if (!log) return;
  ok(
    log.format === debug.FORMAT &&
      log.app.version === engine.VERSION &&
      log.app.built === "test" &&
      /^\d{4}-/.test(log.exported),
    "format, version, build and export time present",
  );
  ok(
    log.report === "the walk went wrong" &&
      Array.isArray(log.summary) &&
      log.summary.some((line) => /Turn 1/.test(line)) &&
      log.summary.some((line) => /errors? recorded/.test(line)),
    "report and summary lines present: " + log.summary.join(" | "),
  );
  ok(
    log.state &&
      log.state.turn === state.turn &&
      log.state.log.length === state.log.length &&
      log.state.cards.hand.length === state.cards.hand.length,
    "full game state included (hand, log, dice)",
  );
  ok(
    log.previousStates.length === debug.LIMITS.states &&
      log.undoDepth === history.length,
    "last " +
      debug.LIMITS.states +
      " undo snapshots and the undo depth included",
  );
  ok(
    log.errors.length === 3 && log.errors[0].when && log.errors[0].during,
    "errors included with ISO times",
  );
  ok(
    log.actions.length === debug.LIMITS.actions && log.actions[0].when,
    "actions included with ISO times",
  );
  ok(
    log.walks.length > 0 &&
      !("key" in log.walks[0]) &&
      log.walks[0].trail.length,
    "recent walk trails included",
  );
  ok(log.brokenAutosave?.settings, "the broken autosave is included, parsed");
  ok(
    log.environment.userAgent === "node" &&
      log.dom.prompt === "x" &&
      log.storage["qb.autosave"] === 100 &&
      log.options.dice === true,
    "environment, DOM snapshot, storage overview and options included",
  );
  ok(
    log.data.pages === 10 &&
      log.data.cards === engine.CARDS.length &&
      log.data.nodes > 100,
    "flowchart and card data counts included",
  );
}
function checkEmptyLog() {
  const emptyLog = JSON.parse(debug.text({ state: null, history: [] }));
  ok(
    emptyLog.state === null &&
      emptyLog.summary.some((line) => /No game/.test(line)),
    "a log can be built with no game in progress",
  );
}
function checkFileNames(state) {
  ok(
    /^queller-debug-turn1-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.json$/.test(
      debug.fileName(state),
    ) && /^queller-debug-\d{4}/.test(debug.fileName(null)),
    "file names: " + debug.fileName(state),
  );
}
// A long game with a full undo history stays exportable.
function checkExportSize() {
  const longGameState = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  longGameState.strategy = STRATEGY.CORRUPTION;
  longGameState.phase = PHASE.P1;
  for (let turn = 0; turn < LONG_GAME_TURNS; turn++) {
    for (const phase of [
      PHASE.P1,
      PHASE.P3,
      PHASE.P4,
      PHASE.P5,
      PHASE.P5,
      PHASE.P5,
    ]) {
      engine.startPhase(longGameState, phase);
      drive(longGameState);
    }
    engine.nextTurn(longGameState);
  }
  const longGameText = debug.text({
    state: longGameState,
    history: new Array(FULL_UNDO_HISTORY).fill(JSON.stringify(longGameState)),
  });
  ok(
    longGameText.length < MAX_EXPORT_BYTES,
    "an " +
      LONG_GAME_TURNS +
      "-turn game with a full undo history exports under " +
      Math.round(MAX_EXPORT_BYTES / 1024) +
      " KB (" +
      Math.round(longGameText.length / 1024) +
      " KB)",
  );
}
function main() {
  debug.restore(storage);
  debug.reset();
  const state = playShortGame();
  checkActionHistory();
  checkWalkRecords(state);
  checkAbandonedWalk(state);
  checkPersistence();
  checkErrors(state);
  checkRingBuffer(state);
  checkBuiltLog(state);
  checkEmptyLog();
  checkFileNames(state);
  checkExportSize();
  console.log(fails ? fails + " failure(s)" : "all debug-log checks passed");
  process.exit(fails ? 1 : 0);
}
main();
