// Debug log module (src/debug.js) without a DOM: action history, walk trails, error capture, persistence, the built log. Exit 1 on any failure.
const fakeWindow = require("./load.js")();
const engine = fakeWindow.QB,
  debug = fakeWindow.QB_DEBUG;
let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.log("FAIL", message);
  } else console.log("ok  ", message);
};
const stored = { text: null };
const storage = {
  get: () => stored.text,
  set: (text) => {
    stored.text = text;
  },
};
debug.restore(storage);
debug.reset();
// The answer that moves a prompt on: No to every question, the minimum or first option otherwise.
const ANSWERS = {
  [engine.PROMPT.COUNT]: (prompt) => prompt.min,
  [engine.PROMPT.CHOICE]: (prompt) => prompt.options[0].value,
  [engine.PROMPT.ROLL]: (prompt) => prompt.options[0],
  [engine.PROMPT.PRIORITY]: () => "ok",
};
function defaultAnswer(prompt) {
  if (engine.YES_NO_PROMPTS.includes(prompt.type)) return false;
  const answerFor = ANSWERS[prompt.type];
  return answerFor ? answerFor(prompt) : "done";
}
function drive(state) {
  let guard = 0;
  while (state.walk && !state.walk.done && guard++ < 80) {
    const prompt = state.walk.prompt;
    const value = defaultAnswer(prompt);
    debug.begin(
      {
        a: "answer",
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

// a short game with everything on, every action bracketed like ui.js act() does
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
debug.action({ a: "pageLoad", autosave: false }, null);
debug.begin({ a: "phase", id: engine.PHASE.SETUP }, state);
engine.startPhase(state, engine.PHASE.SETUP);
debug.finishAction(state);
drive(state);
for (const phase of [
  engine.PHASE.P1,
  engine.PHASE.P3,
  engine.PHASE.P4,
  engine.PHASE.P5,
]) {
  debug.begin({ a: "phase", id: phase }, state);
  engine.startPhase(state, phase);
  debug.finishAction(state);
  drive(state);
}
const actions = debug.actions;
ok(
  actions.length > 5 && actions[0].a === "pageLoad" && actions[1].a === "phase",
  "actions recorded in order (" + actions.length + ")",
);
ok(
  actions.every((record) => typeof record.t === "number") &&
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
const last = actions[actions.length - 1];
ok(
  last.after.dice &&
    /\//.test(last.after.dice) &&
    typeof last.after.hand === "number",
  "digest summarises dice and hand: " + last.after.dice,
);
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
// the same finished walk is not recorded twice
const walksBefore = debug.walks.length;
debug.action({ a: "modal", name: "rules" }, state);
ok(
  debug.walks.length === walksBefore,
  "a finished walk is recorded once, not on every later action",
);
// abandoning a walk mid-way keeps its trail
debug.begin({ a: "phase", id: engine.PHASE.P5 }, state);
engine.startPhase(state, engine.PHASE.P5);
debug.finishAction(state);
if (state.walk && !state.walk.done) {
  debug.begin({ a: "phase", id: "abandon" }, state);
  state.walk = null;
  debug.finishAction(state);
  ok(
    debug.walks[debug.walks.length - 1].note === "replaced or abandoned",
    "an abandoned walk is kept with a note",
  );
}
// persistence round trip
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
ok(
  debug.actions.length === JSON.parse(saved).actions.length &&
    debug.walks.length === JSON.parse(saved).walks.length,
  "history restored from storage after a reload",
);
stored.text = "{not json";
debug.restore(storage);
ok(true, "a corrupt stored history is ignored");
stored.text = saved;
debug.restore(storage);
// errors: during an action, and uncaught between actions
debug.begin({ a: "answer", prompt: "yesno", value: true }, state);
const err = debug.error(
  new TypeError("Cannot read properties of undefined (reading 'face')"),
  { rolledBack: true },
  state,
);
ok(
  err.message.startsWith("Cannot read") &&
    err.name === "TypeError" &&
    err.stack &&
    err.during?.a === "answer" &&
    err.state &&
    err.state.turn === state.turn,
  "an error during an action records the action, the stack and a state digest",
);
const err2 = debug.error("Script error.", { a: "uncaught", line: 12 }, state);
ok(
  err2.message === "Script error." && err2.lastAction && !err2.during,
  "an uncaught error between actions points at the last action",
);
ok(
  debug.error({ message: "x" }, {}, { dice: undefined }).state.digestFailed,
  "a broken state cannot stop an error being recorded",
);
// ring-buffer limits
for (let i = 0; i < debug.LIMITS.actions + 50; i++)
  debug.action({ a: "modal", name: "x" + i }, state);
ok(
  debug.actions.length === debug.LIMITS.actions &&
    debug.actions[debug.actions.length - 1].name ===
      "x" + (debug.LIMITS.actions + 49),
  "action history capped at " + debug.LIMITS.actions + ", newest kept",
);
// the built log
const history = [
  JSON.stringify(state),
  JSON.stringify(state),
  JSON.stringify(state),
  JSON.stringify(state),
  JSON.stringify(state),
  JSON.stringify(state),
  JSON.stringify(state),
];
const logText = debug.text({
  state: state,
  history,
  report: "the walk went wrong",
  env: { built: "test", userAgent: "node" },
  dom: { prompt: "x" },
  storage: { "qb.autosave": 100 },
  brokenAutosave: '{"settings":{},"board":{}}',
  opts: { dice: true },
});
let log = null;
try {
  log = JSON.parse(logText);
} catch {}
ok(!!log, "the log is valid JSON (" + logText.length + " bytes)");
if (log) {
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
const emptyLogText = debug.text({ state: null, history: [] });
const emptyLog = JSON.parse(emptyLogText);
ok(
  emptyLog.state === null &&
    emptyLog.summary.some((line) => /No game/.test(line)),
  "a log can be built with no game in progress",
);
ok(
  /^queller-debug-turn1-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.json$/.test(
    debug.fileName(state),
  ) && /^queller-debug-\d{4}/.test(debug.fileName(null)),
  "file names: " + debug.fileName(state),
);
// size: a long game stays exportable
const longGameState = engine.newState({
  dice: true,
  cards: true,
  tracker: true,
  wome: true,
});
longGameState.strategy = engine.STRATEGY.CORRUPTION;
longGameState.phase = engine.PHASE.P1;
for (let turn = 0; turn < 8; turn++) {
  for (const phase of [
    engine.PHASE.P1,
    engine.PHASE.P3,
    engine.PHASE.P4,
    engine.PHASE.P5,
    engine.PHASE.P5,
    engine.PHASE.P5,
  ]) {
    engine.startPhase(longGameState, phase);
    drive(longGameState);
  }
  engine.nextTurn(longGameState);
}
const longGameText = debug.text({
  state: longGameState,
  history: new Array(60).fill(JSON.stringify(longGameState)),
});
ok(
  longGameText.length < 600000,
  "an 8-turn game with a full undo history exports under 600 KB (" +
    Math.round(longGameText.length / 1024) +
    " KB)",
);
console.log(fails ? fails + " failure(s)" : "all debug-log checks passed");
process.exit(fails ? 1 : 0);
