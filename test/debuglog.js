// Debug log module (src/debug.js) without a DOM: action history, walk trails, error capture, persistence, the built log. Exit 1 on any failure.
const W = require("./load.js")();
const Q = W.QB,
  DBG = W.QB_DEBUG;
let fails = 0;
const ok = (c, m) => {
  if (!c) {
    fails++;
    console.log("FAIL", m);
  } else console.log("ok  ", m);
};
const mem = { v: null };
const storage = {
  get: () => mem.v,
  set: (s) => {
    mem.v = s;
  },
};
DBG.restore(storage);
DBG.reset();
// The answer that moves a prompt on: No to every question, the minimum or first option otherwise.
const ANSWERS = {
  count: (p) => p.min,
  choice: (p) => p.options[0].value,
  roll: (p) => p.options[0],
  priority: () => "ok",
};
function defaultAnswer(p) {
  if (["yesno", "situ", "confirm", "diecheck", "ring"].includes(p.type))
    return false;
  const f = ANSWERS[p.type];
  return f ? f(p) : "done";
}
function drive(S) {
  let g = 0;
  while (S.walk && !S.walk.done && g++ < 80) {
    const p = S.walk.prompt;
    const value = defaultAnswer(p);
    DBG.begin(
      {
        a: "answer",
        prompt: p.type,
        page: S.walk.page,
        node: S.walk.node,
        value,
      },
      S,
    );
    Q.answer(S, value);
    DBG.end(S);
  }
}

// a short game with everything on, every action bracketed like ui.js act() does
const S = Q.newState({ dice: true, cards: true, tracker: true, wome: true });
ok(
  S.appVersion === Q.VERSION && S.createdVersion === Q.VERSION,
  "new state stamped with the app version " + Q.VERSION,
);
DBG.action({ a: "pageLoad", autosave: false }, null);
DBG.begin({ a: "phase", id: "setup" }, S);
Q.startPhase(S, "setup");
DBG.end(S);
drive(S);
for (const ph of ["p1", "p3", "p4", "p5"]) {
  DBG.begin({ a: "phase", id: ph }, S);
  Q.startPhase(S, ph);
  DBG.end(S);
  drive(S);
}
const acts = DBG.actions;
ok(
  acts.length > 5 && acts[0].a === "pageLoad" && acts[1].a === "phase",
  "actions recorded in order (" + acts.length + ")",
);
ok(
  acts.every((e) => typeof e.t === "number") &&
    acts
      .slice(1)
      .every((e) => e.before && e.after && typeof e.after.turn === "number"),
  "every action carries a time and before/after digests",
);
const last = acts[acts.length - 1];
ok(
  last.after.dice &&
    /\//.test(last.after.dice) &&
    typeof last.after.hand === "number",
  "digest summarises dice and hand: " + last.after.dice,
);
ok(
  DBG.walks.length >= 4 &&
    DBG.walks.every(
      (w) => w.trail.length > 0 && w.entry && w.result !== undefined,
    ),
  "finished walks kept with their trails (" + DBG.walks.length + ")",
);
ok(
  DBG.walks.every((w) => !w.trail.some((t) => Object.keys(t).length > 12)),
  "walk trails stored compactly",
);
// the same finished walk is not recorded twice
const n0 = DBG.walks.length;
DBG.action({ a: "modal", name: "rules" }, S);
ok(
  DBG.walks.length === n0,
  "a finished walk is recorded once, not on every later action",
);
// abandoning a walk mid-way keeps its trail
DBG.begin({ a: "phase", id: "p5" }, S);
Q.startPhase(S, "p5");
DBG.end(S);
if (S.walk && !S.walk.done) {
  DBG.begin({ a: "phase", id: "abandon" }, S);
  S.walk = null;
  DBG.end(S);
  ok(
    DBG.walks[DBG.walks.length - 1].note === "replaced or abandoned",
    "an abandoned walk is kept with a note",
  );
}
// persistence round trip
const saved = mem.v;
ok(
  saved && JSON.parse(saved).actions.length === DBG.actions.length,
  "history persisted to storage on every action",
);
DBG.reset();
ok(DBG.actions.length === 0, "reset clears the history");
DBG.restore(storage);
ok(DBG.actions.length === 0, "reset also cleared the stored copy");
mem.v = saved;
DBG.restore(storage);
ok(
  DBG.actions.length === JSON.parse(saved).actions.length &&
    DBG.walks.length === JSON.parse(saved).walks.length,
  "history restored from storage after a reload",
);
mem.v = "{not json";
DBG.restore(storage);
ok(true, "a corrupt stored history is ignored");
mem.v = saved;
DBG.restore(storage);
// errors: during an action, and uncaught between actions
DBG.begin({ a: "answer", prompt: "yesno", value: true }, S);
const err = DBG.error(
  new TypeError("Cannot read properties of undefined (reading 'face')"),
  { rolledBack: true },
  S,
);
ok(
  err.message.startsWith("Cannot read") &&
    err.name === "TypeError" &&
    err.stack &&
    err.during?.a === "answer" &&
    err.state &&
    err.state.turn === S.turn,
  "an error during an action records the action, the stack and a state digest",
);
const err2 = DBG.error("Script error.", { a: "uncaught", line: 12 }, S);
ok(
  err2.message === "Script error." && err2.lastAction && !err2.during,
  "an uncaught error between actions points at the last action",
);
ok(
  DBG.error({ message: "x" }, {}, { dice: undefined }).state.digestFailed,
  "a broken state cannot stop an error being recorded",
);
// ring-buffer limits
for (let i = 0; i < DBG.LIMITS.actions + 50; i++)
  DBG.action({ a: "modal", name: "x" + i }, S);
ok(
  DBG.actions.length === DBG.LIMITS.actions &&
    DBG.actions[DBG.actions.length - 1].name ===
      "x" + (DBG.LIMITS.actions + 49),
  "action history capped at " + DBG.LIMITS.actions + ", newest kept",
);
// the built log
const history = [
  JSON.stringify(S),
  JSON.stringify(S),
  JSON.stringify(S),
  JSON.stringify(S),
  JSON.stringify(S),
  JSON.stringify(S),
  JSON.stringify(S),
];
const txt = DBG.text({
  S,
  history,
  report: "the walk went wrong",
  env: { built: "test", userAgent: "node" },
  dom: { prompt: "x" },
  storage: { "qb.autosave": 100 },
  brokenAutosave: '{"settings":{},"board":{}}',
  opts: { dice: true },
});
let L = null;
try {
  L = JSON.parse(txt);
} catch (e) {}
ok(!!L, "the log is valid JSON (" + txt.length + " bytes)");
if (L) {
  ok(
    L.format === DBG.FORMAT &&
      L.app.version === Q.VERSION &&
      L.app.built === "test" &&
      /^\d{4}-/.test(L.exported),
    "format, version, build and export time present",
  );
  ok(
    L.report === "the walk went wrong" &&
      Array.isArray(L.summary) &&
      L.summary.some((s) => /Turn 1/.test(s)) &&
      L.summary.some((s) => /errors? recorded/.test(s)),
    "report and summary lines present: " + L.summary.join(" | "),
  );
  ok(
    L.state &&
      L.state.turn === S.turn &&
      L.state.log.length === S.log.length &&
      L.state.cards.hand.length === S.cards.hand.length,
    "full game state included (hand, log, dice)",
  );
  ok(
    L.previousStates.length === DBG.LIMITS.states &&
      L.undoDepth === history.length,
    "last " + DBG.LIMITS.states + " undo snapshots and the undo depth included",
  );
  ok(
    L.errors.length === 3 && L.errors[0].when && L.errors[0].during,
    "errors included with ISO times",
  );
  ok(
    L.actions.length === DBG.LIMITS.actions && L.actions[0].when,
    "actions included with ISO times",
  );
  ok(
    L.walks.length > 0 && !("key" in L.walks[0]) && L.walks[0].trail.length,
    "recent walk trails included",
  );
  ok(L.brokenAutosave?.settings, "the broken autosave is included, parsed");
  ok(
    L.environment.userAgent === "node" &&
      L.dom.prompt === "x" &&
      L.storage["qb.autosave"] === 100 &&
      L.options.dice === true,
    "environment, DOM snapshot, storage overview and options included",
  );
  ok(
    L.data.pages === 10 &&
      L.data.cards === Q.CARDS.length &&
      L.data.nodes > 100,
    "flowchart and card data counts included",
  );
}
const txt2 = DBG.text({ S: null, history: [] });
const L2 = JSON.parse(txt2);
ok(
  L2.state === null && L2.summary.some((s) => /No game/.test(s)),
  "a log can be built with no game in progress",
);
ok(
  /^queller-debug-turn1-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.json$/.test(
    DBG.fileName(S),
  ) && /^queller-debug-\d{4}/.test(DBG.fileName(null)),
  "file names: " + DBG.fileName(S),
);
// size: a long game stays exportable
const S3 = Q.newState({ dice: true, cards: true, tracker: true, wome: true });
S3.strategy = "corruption";
S3.phase = "p1";
for (let t = 0; t < 8; t++) {
  for (const ph of ["p1", "p3", "p4", "p5", "p5", "p5"]) {
    Q.startPhase(S3, ph);
    drive(S3);
  }
  Q.nextTurn(S3);
}
const big = DBG.text({
  S: S3,
  history: new Array(60).fill(JSON.stringify(S3)),
});
ok(
  big.length < 600000,
  "an 8-turn game with a full undo history exports under 600 KB (" +
    Math.round(big.length / 1024) +
    " KB)",
);
console.log(fails ? fails + " failure(s)" : "all debug-log checks passed");
process.exit(fails ? 1 : 0);
