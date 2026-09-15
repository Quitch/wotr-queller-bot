// ===== Debug log: action history, error capture and the exportable report =====
// Everything here lives outside the game state, so it is never saved, undone or shown to the player during play.
// The action history and errors are kept in localStorage (qb.debug) so a log can still be exported after a reload — including the
// reload that failed to render a saved game.
import * as engine from "./qb.js";
import { FLOW } from "./flow/index.js";

const FORMAT = "queller-debug/1";
const LIMITS = { actions: 300, errors: 30, walks: 8, states: 5 };
// The action history, the errors and the finished walks (restore() and reset() replace their contents in place).
export const actions = [],
  errors = [],
  walks = [];
const store = { inflight: null, preWalk: null, storage: null, pending: false };

function push(list, record, limit) {
  list.push(record);
  while (list.length > limit) list.shift();
}
function replaceAll(list, items) {
  list.splice(0, list.length, ...items);
}
// Write the log to storage now.
function flush() {
  store.pending = false;
  if (!store.storage) return;
  try {
    store.storage.set(
      JSON.stringify({
        actions: actions,
        errors: errors,
        walks: walks,
      }),
    );
  } catch {
    // Storage full or unavailable: the in-memory log still works for this page load.
  }
}
// The write is deferred to the end of the current task (an idle moment when the browser offers one), so a burst of
// actions costs one serialisation; errors, resets and the page going away (ui/boot.js) write at once.
const FLUSH_IDLE_TIMEOUT_MS = 1000;
function persist() {
  if (store.pending || !store.storage) return;
  store.pending = true;
  if (typeof requestIdleCallback === "function")
    requestIdleCallback(flush, { timeout: FLUSH_IDLE_TIMEOUT_MS });
  else setTimeout(flush, 0);
}
// storage: {get():string|null, set(string)} — localStorage in the app, anything in tests
function restore(storage) {
  store.storage = storage || null;
  store.pending = false;
  if (!storage) return;
  try {
    const parsed = JSON.parse(storage.get() || "null");
    if (parsed) {
      replaceAll(actions, (parsed.actions || []).slice(-LIMITS.actions));
      replaceAll(errors, (parsed.errors || []).slice(-LIMITS.errors));
      replaceAll(walks, (parsed.walks || []).slice(-LIMITS.walks));
    }
  } catch {
    // Storage unavailable or the saved log is corrupt: start with an empty log.
  }
}

// A one-line picture of the game after an action: enough to follow the timeline without opening the full state.
function digest(state) {
  if (!state) return null;
  const walk = state.walk,
    pool = state.dice.pool || [];
  return {
    turn: state.turn,
    phase: state.phase,
    strategy: state.strategy,
    walk: walk ? walk.page + "." + walk.node : null,
    prompt: walk?.prompt ? walk.prompt.type : null,
    done: walk ? !!walk.done : null,
    result: walk ? walk.result : null,
    trail: walk ? walk.trail.length : 0,
    dice: pool.length
      ? pool
          .map(
            (die) =>
              (die.kind === engine.DIE_KIND.FACTION ? "F:" : "") +
              (die.face || "-").replace("/", "+") +
              "/" +
              die.status[0],
          )
          .join(" ")
      : null,
    hunt: state.dice.hunt,
    hand: state.cards.hand.length,
    faction: state.cards.factionHand.length,
    table: state.cards.table.length,
    rings: state.board.rings,
    log: state.log.length,
  };
}
function safeDigest(state) {
  try {
    return digest(state);
  } catch (error) {
    return { digestFailed: String(error?.message || error) };
  }
}
function walkKey(state, walk) {
  return (
    state.turn +
    "|" +
    walk.entry.page +
    "|" +
    walk.entry.start +
    "|" +
    walk.trail.length +
    "|" +
    (walk.result || "")
  );
}
function compactTrailEntry(entry) {
  const compact = {
    kind: entry.kind,
    text: entry.text,
    page: entry.page,
    node: entry.node,
  };
  if (entry.answer != null) compact.answer = entry.answer;
  if (entry.auto) compact.auto = true;
  if (entry.why) compact.why = entry.why;
  if (entry.card) compact.card = entry.card;
  if (entry.choice) compact.choice = entry.choice;
  if (entry.steps) compact.steps = entry.steps;
  return compact;
}
function compactWalk(state, walk, note) {
  return {
    time: Date.now(),
    turn: state.turn,
    entry: walk.entry,
    page: walk.page,
    node: walk.node,
    result: walk.result,
    note: note || null,
    die: walk.die,
    mode: walk.mode,
    trail: walk.trail.map(compactTrailEntry),
  };
}
// Walks are recorded once they finish (or are abandoned), so the trail of a walk the player has moved on from is still in the log.
function recordWalk(state, walk, { abandoned } = {}) {
  const key = walkKey(state, walk);
  const last = walks.at(-1);
  if (last?.key === key) return;
  const compact = compactWalk(
    state,
    walk,
    abandoned ? "replaced or abandoned" : null,
  );
  compact.key = key;
  push(walks, compact, LIMITS.walks);
}
// The walk that was open when the action began, if the action replaced or dropped it without finishing it.
function recordAbandonedWalk(state, record) {
  const before = store.preWalk;
  if (
    before &&
    before !== state.walk &&
    !before.done &&
    record.action !== "undo" &&
    record.action !== "load"
  )
    recordWalk(state, before, { abandoned: true });
}
function recordFinishedWalk(state) {
  if (state.walk?.done) recordWalk(state, state.walk);
}

// begin/finishAction bracket a state-changing action (ui/actions.js act()); action() records something that changed no game state.
function begin(info, state) {
  store.inflight = { time: Date.now(), ...(info || { action: "act" }) };
  store.preWalk = state ? state.walk : null;
  if (state) store.inflight.before = safeDigest(state);
}
function finishAction(state) {
  const record = store.inflight || { time: Date.now(), action: "act" };
  store.inflight = null;
  if (state) {
    record.after = safeDigest(state);
    recordAbandonedWalk(state, record);
    recordFinishedWalk(state);
  }
  store.preWalk = null;
  push(actions, record, LIMITS.actions);
  persist();
  return record;
}
function action(info, state) {
  begin(info, state);
  return finishAction(state);
}
function error(thrown, info, state) {
  const record = { time: Date.now(), ...info };
  if (thrown && typeof thrown === "object") {
    record.message = String(thrown.message || thrown);
    record.name = thrown.name;
    if (thrown.stack)
      record.stack = String(thrown.stack).split("\n").slice(0, 12).join("\n");
  } else record.message = String(thrown);
  if (store.inflight && !record.during) record.during = store.inflight;
  else if (!record.during && actions.length) record.lastAction = actions.at(-1);
  if (state) record.state = safeDigest(state);
  push(errors, record, LIMITS.errors);
  store.inflight = null;
  flush();
  return record;
}

const iso = (time) => {
  try {
    return new Date(time).toISOString();
  } catch {
    return String(time);
  }
};
const withTimes = (list) =>
  list.map((record) => ({ when: iso(record.time), ...record }));
// The turn, phase, strategy and settings of a game in one line.
function settingsLine(state) {
  const onOff = (flag) => (flag ? "on" : "off");
  return (
    "Turn " +
    state.turn +
    ", " +
    state.phase +
    (state.strategy ? ", " + state.strategy + " strategy" : "") +
    "; settings: dice " +
    onOff(state.settings.dice) +
    ", cards " +
    onOff(state.settings.cards) +
    ", tracker " +
    onOff(state.settings.tracker) +
    ", WoME " +
    onOff(state.settings.wome)
  );
}
// Where a walk started, where it is now and how it stands.
function walkLine(walk) {
  if (!walk) return "No walk in progress";
  const pageName = FLOW[walk.entry.page]
    ? FLOW[walk.entry.page].name
    : walk.entry.page;
  return (
    "Walk: " +
    pageName +
    " from “" +
    engine.normalizeText(walk.entry.start) +
    "”, now at " +
    walk.page +
    "." +
    walk.node +
    (walk.prompt ? ", prompt " + walk.prompt.type : "") +
    (walk.done ? ", finished (" + walk.result + ")" : "") +
    ", " +
    walk.trail.length +
    " trail entries"
  );
}
// How many errors were recorded and the latest one's message.
function errorsLine(errors) {
  if (!errors.length) return "No errors recorded";
  return (
    errors.length +
    " error" +
    (errors.length === 1 ? "" : "s") +
    " recorded; latest: " +
    errors.at(-1).message
  );
}
function summary(state, env, errors) {
  const game = state
    ? [settingsLine(state), walkLine(state.walk)]
    : ["No game in progress (New game screen)"];
  return [
    "Queller Bot Runner version " +
      engine.VERSION +
      (env?.built ? " (built " + env.built + ")" : ""),
    ...game,
    errorsLine(errors),
    actions.length + " actions in the history",
  ];
}
// The undo snapshots (JSON strings), newest first, parsed.
function parseHistory(history) {
  return history
    .slice(-LIMITS.states)
    .reverse()
    .map((json) => {
      try {
        return JSON.parse(json);
      } catch (parseError) {
        return { unparseable: String(parseError) };
      }
    });
}
function parseBrokenAutosave(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (parseError) {
    return {
      unparseable: String(parseError),
      head: String(raw).slice(0, 400),
    };
  }
}
function flowDataCounts() {
  const pages = Object.values(FLOW);
  return {
    pages: pages.length,
    nodes: pages.reduce(
      (total, page) => total + Object.keys(page.nodes).length,
      0,
    ),
    edges: pages.reduce((total, page) => total + page.edges.length, 0),
    cards: engine.CARDS.length,
  };
}
// Build the log from the game state, the undo history (JSON snapshots), the player's report and what the page knows about itself.
function build({
  state = null,
  history = [],
  report = "",
  env = null,
  dom = null,
  storage = null,
  brokenAutosave = null,
  opts = null,
} = {}) {
  const timedErrors = withTimes(errors);
  return {
    format: FORMAT,
    app: { version: engine.VERSION, built: env?.built || null },
    exported: iso(Date.now()),
    report,
    summary: summary(state, env, timedErrors),
    environment: env,
    dom,
    storage,
    options: opts,
    errors: timedErrors,
    actions: withTimes(actions),
    walks: withTimes(walks).map(({ key, ...walk }) => walk),
    state,
    previousStates: parseHistory(history),
    undoDepth: history.length,
    brokenAutosave: parseBrokenAutosave(brokenAutosave),
    data: flowDataCounts(),
  };
}
function text(context) {
  return JSON.stringify(build(context), null, 1);
}
function fileName(state) {
  return (
    "queller-debug" +
    (state ? "-turn" + state.turn : "") +
    "-" +
    iso(Date.now()).replace(/[:.]/g, "-").slice(0, 19) +
    ".json"
  );
}
function reset() {
  replaceAll(actions, []);
  replaceAll(errors, []);
  replaceAll(walks, []);
  store.inflight = null;
  flush();
}

export {
  FORMAT,
  LIMITS,
  restore,
  flush,
  begin,
  finishAction,
  action,
  error,
  digest,
  build,
  text,
  fileName,
  reset,
};
