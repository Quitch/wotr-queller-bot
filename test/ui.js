// Unit tests for the UI's pure logic (src/ui/, no DOM): the text helpers and glossary markup, the tracker's board
// paths, tracker values, the storage wrappers and save loading, the row widgets, the phase tables, the trail and
// result renderers, the card faces and the transfer helpers. Exit 1 on any failure.
import * as fakeWindow from "./load.js";
const engine = fakeWindow.QB,
  ui = fakeWindow.QB_UI,
  { PHASE, TRAIL, WALK_RESULT, DECK, FP_STANCE, MINION_STATUS } = engine;
const TERM_BUTTON = (key, label) =>
  '<button type="button" class="term" data-term="' +
  key +
  '" aria-describedby="tip">' +
  label +
  "</button>";
let fails = 0;
const ok = (condition, message) => {
  if (!condition) {
    fails++;
    console.log("FAIL", message);
  } else console.log("ok  ", message);
};
const throwsUnknownField = (path) => {
  try {
    fakeWindow.boardValue(path);
    return false;
  } catch (error) {
    return /Unknown board field/.test(error.message);
  }
};
const throwsOn = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

function checkTextHelpers() {
  const { formatText, escapeHTML, stripMarkup, parseJSONOr } = ui;
  ok(
    escapeHTML('<a href="x">&</a>') ===
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;" && escapeHTML(5) === "5",
    "escapeHTML escapes & < > and quotes, and takes a number",
  );
  ok(
    formatText(null) === "" && formatText(undefined) === "",
    "formatText of nothing is empty",
  );
  ok(
    formatText("a *mobile* army") ===
      "a " + TERM_BUTTON("mobile", "mobile") + " army",
    "an exact glossary term becomes a term button",
  );
  ok(
    formatText("*Mobile*") === TERM_BUTTON("mobile", "Mobile"),
    "the lookup ignores case; the label keeps it",
  );
  ok(
    formatText("*Stacking  limit*") ===
      TERM_BUTTON("stacking limit", "Stacking  limit"),
    "a term's inner spacing is normalised for the lookup",
  );
  ok(
    formatText("*threatened*") === TERM_BUTTON("threat", "threatened"),
    "an alias resolves to its term",
  );
  ok(
    formatText("*garrisons*") === TERM_BUTTON("garrison", "garrisons"),
    "a plural falls back to the singular term",
  );
  ok(
    formatText("*no such term*") === "<i>no such term</i>",
    "an unknown marker becomes italics",
  );
  ok(formatText("a\nb") === "a<br>b", "a newline becomes <br>");
  ok(
    formatText("<b>*mobile*</b>") ===
      "&lt;b&gt;" + TERM_BUTTON("mobile", "mobile") + "&lt;/b&gt;",
    "HTML in the text is escaped before the markup is added",
  );
  ok(
    stripMarkup("*a* b *c*") === "a b c" && stripMarkup(null) === "",
    "stripMarkup drops the asterisks",
  );
  ok(
    parseJSONOr("{bad", 7) === 7 &&
      parseJSONOr("", "x") === "x" &&
      parseJSONOr(undefined, "x") === "x" &&
      parseJSONOr('{"a":1}', null).a === 1,
    "parseJSONOr falls back on missing or corrupt JSON",
  );
}
// The tracker reads and writes the board through dotted paths that can only name fields the board already has.
function checkBoardPaths() {
  const state = engine.newState({});
  ui.setState(state);
  state.board.fs.progress = 4;
  ok(
    fakeWindow.boardValue("fs.progress") === 4 &&
      fakeWindow.boardValue("rings") === 0 &&
      fakeWindow.boardValue("nations.gondor") === FP_STANCE.PASSIVE &&
      fakeWindow.boardValue("chars.saruman") === MINION_STATUS.AVAILABLE,
    "dotted paths read the board",
  );
  ok(
    [
      "__proto__.x",
      "constructor.prototype",
      "fs.__proto__",
      "fs.constructor",
      "toString",
      "nope",
      "fs.nope",
      "fs.progress.x",
    ].every(throwsUnknownField),
    "prototype, missing and over-long paths are refused",
  );
  ok(
    Object.entries(fakeWindow.STEP_LIMITS).every(
      ([path, [min, max]]) =>
        typeof fakeWindow.boardValue(path) === "number" && min < max,
    ) && fakeWindow.DEFAULT_STEP_LIMIT[0] < fakeWindow.DEFAULT_STEP_LIMIT[1],
    "every step limit names a numeric board field with min below max",
  );
  ok(
    fakeWindow.trackerValue({
      type: "checkbox",
      checked: true,
      dataset: {},
    }) === true &&
      fakeWindow.trackerValue({
        type: "select-one",
        value: "3",
        dataset: { num: "1" },
      }) === 3 &&
      fakeWindow.trackerValue({ value: "war", dataset: {} }) === "war",
    "trackerValue: a checkbox gives a boolean, a numeric field a number, the rest text",
  );
}
// storageGet/storageSet never throw, whatever localStorage does; loadJSON accepts only a save and migrates it.
function checkStorage() {
  ok(
    ui.storageGet("qb.x") === null &&
      !throwsOn(() => ui.storageSet("qb.x", "1")),
    "without any localStorage a read gives null and a write is a no-op",
  );
  globalThis.localStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
  };
  ok(
    ui.storageGet("qb.x") === null &&
      !throwsOn(() => ui.storageSet("qb.x", "1")),
    "a throwing localStorage reads as null and swallows the write",
  );
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
  };
  ui.storageSet("qb.x", "2");
  ok(ui.storageGet("qb.x") === "2", "a working localStorage round-trips");
  delete globalThis.localStorage;
  ok(
    ["{not json", "null", '{"settings":{}}', '{"board":{}}', "[]"].every(
      (text) => throwsOn(() => ui.loadJSON(text)),
    ),
    "loadJSON rejects what is not a Queller save",
  );
  const save = JSON.parse(JSON.stringify(engine.newState({ wome: false })));
  delete save.settings.tracker;
  save.settings.walk = false;
  delete save.board.rings;
  const loaded = ui.loadJSON(JSON.stringify(save));
  ok(
    loaded.settings.tracker === false &&
      !("walk" in loaded.settings) &&
      loaded.board.rings === 0 &&
      loaded.turn === 1,
    "loadJSON migrates an older save",
  );
}
function checkWidgets() {
  const checkbox = ui.checkboxRowHTML("t-x", "Label", true, 'data-t="x"');
  ok(
    checkbox.includes('id="t-x"') &&
      checkbox.includes('data-t="x"') &&
      / checked>/.test(checkbox) &&
      !/checked/.test(ui.checkboxRowHTML("t-y", "Label", false)),
    "checkboxRowHTML: id, extra attributes and the checked state",
  );
  const number = ui.numberRowHTML("n", 'Army *value* "x"', 3, 'data-step="v"');
  ok(
    number.includes('aria-label="Decrease Army value &quot;x&quot;"') &&
      number.includes('aria-label="Increase Army value &quot;x&quot;"') &&
      number.includes('id="n-n"') &&
      number.includes(">3<") &&
      (number.match(/data-step="v"/g) || []).length === 2,
    "numberRowHTML: the button labels are stripped of markup and escaped; both buttons carry the attributes",
  );
}
function checkPhaseTables() {
  const phases = Object.values(PHASE),
    actions = Object.values(fakeWindow.PHASE_ACTION);
  ok(
    phases.every((phase) =>
      Object.values(fakeWindow.PHASE_BY_LABEL).includes(phase),
    ),
    "PHASE_BY_LABEL names every phase",
  );
  ok(
    new Set(phases.concat(actions)).size === phases.length + actions.length,
    "the walkthrough's button ids (phases and actions) do not collide",
  );
}
function checkTrailAndResult() {
  ui.setState(engine.newState({}));
  const walk = {
    trail: Object.values(TRAIL)
      .map((kind) => ({ kind, text: "t-" + kind }))
      .concat([
        {
          kind: TRAIL.QUESTION,
          text: "auto question",
          auto: true,
          answer: "Yes",
          why: "from the *tracker*",
          ring: true,
        },
        {
          kind: TRAIL.PRIORITY,
          text: "pick",
          card: "sa002",
          choice: "Saruman",
        },
        { kind: TRAIL.JUMP, text: "jump", die: "Muster" },
      ]),
  };
  const html = fakeWindow.trailHTML(walk);
  ok(
    Object.values(TRAIL).every((kind) => html.includes('class="t-' + kind)),
    "every trail kind renders with its class",
  );
  ok(
    html.includes(">Auto<") &&
      html.includes("ring-ico") &&
      html.includes("A New Power Is Rising") &&
      html.includes("→ Saruman") &&
      html.includes("(Muster die)") &&
      html.includes("— from the <i>tracker</i>"),
    "auto answers, ring marks, reasons, chosen cards, choices and dice are shown",
  );
  ok(!/undefined|NaN/.test(html), "the trail has no undefined or NaN");
  const results = Object.values(WALK_RESULT).concat(
    engine.phaseResult("Phase 5"),
    "",
  );
  ok(
    results.every((result) => {
      const out = fakeWindow.resultHTML({
        result,
        trail: [{ text: "last *step*" }],
      });
      return (
        out.includes('class="result"') &&
        !/undefined|NaN/.test(out) &&
        (result === "" || /class="big">[^<]/.test(out))
      );
    }),
    "every walk result renders its headline",
  );
}
function checkCardFaces() {
  const twoHalves = engine.CARDS.find(
    (card) => card.combatTitle && card.deck === DECK.CHARACTER,
  );
  const whole = ui.cardHTML(twoHalves);
  const event = ui.cardHTML(twoHalves, ui.CARD_HALF.EVENT);
  const combat = ui.cardHTML(twoHalves, ui.CARD_HALF.COMBAT);
  ok(
    whole.includes('class="combat"') &&
      !whole.includes("half") &&
      event.includes("Top (event) half shown") &&
      !event.includes('class="combat') &&
      combat.includes('class="combat only"') &&
      combat.includes("Bottom (combat) half shown"),
    "a two-half card shows both halves, or one with a note",
  );
  const callToBattle = engine.CARDS.find(
    (card) => card.deck === DECK.CALL_TO_BATTLE,
  );
  ok(
    ui
      .cardHTML(callToBattle, ui.CARD_HALF.COMBAT)
      .includes("Call to Battle · " + callToBattle.faction) &&
      ui.cardHTML(callToBattle, ui.CARD_HALF.COMBAT).includes("<p>"),
    "a Call to Battle card shows its text even when the combat half is asked for",
  );
}
// A stand-in for a focused element: an id, attributes and a dataset.
const fakeElement = ({ id = "", attrs = {}, dataset = {} } = {}) => ({
  id,
  dataset,
  hasAttribute: (name) => name in attrs,
  getAttribute: (name) => attrs[name],
});
// The focus key finds a control again after a re-render: by id, else by the first identifying attribute plus its
// data-d / data-id qualifiers; nothing for the body or an anonymous element.
function checkFocusKeys() {
  const { focusKey } = ui;
  const body = {};
  body.ownerDocument = { body };
  ok(
    focusKey(null) === null && focusKey(body) === null,
    "no focus key for nothing or the body",
  );
  ok(
    focusKey(fakeElement({ id: "undoBtn" })) === "#undoBtn",
    "an id is the focus key",
  );
  ok(
    focusKey(
      fakeElement({ attrs: { "data-ans": "yes" }, dataset: { ans: "yes" } }),
    ) === '[data-ans="yes"]',
    "an answer button is found again by its data-ans",
  );
  ok(
    focusKey(
      fakeElement({
        attrs: { "data-step": "rings" },
        dataset: { step: "rings", d: "1" },
      }),
    ) === '[data-step="rings"][data-d="1"]' &&
      focusKey(
        fakeElement({
          attrs: { "data-card": "show" },
          dataset: { card: "show", id: "sa009" },
        }),
      ) === '[data-card="show"][data-id="sa009"]',
    "stepper and table-card buttons keep their data-d and data-id qualifiers",
  );
  ok(
    focusKey(
      fakeElement({ attrs: { "data-fp": "C14" }, dataset: { fp: "C14" } }),
    ) === '[data-fp="C14"]' &&
      focusKey(
        fakeElement({ attrs: { "data-save": "1" }, dataset: { save: "1" } }),
      ) === '[data-save="1"]',
    "modal controls (flow tabs, save slots) have focus keys too",
  );
  ok(
    focusKey(fakeElement({ attrs: { class: "x" } })) === null,
    "an element with no id and no identifying attribute has no key",
  );
}
// The render bookkeeping: <details> open states survive a re-render of the same thing (by data-key) and scroll
// positions of the trail and log are put back, run over stand-in roots.
function checkRenderBookkeeping() {
  const details = (open, key) => ({ open, dataset: key ? { key } : {} });
  const root = (list, scrolled = {}) => ({
    querySelectorAll: () => list,
    querySelector: (selector) => scrolled[selector] || null,
  });
  const before = fakeWindow.detailsBefore(
    root([details(false, "C14|Phase 5|1"), details(true, "")]),
  );
  ok(
    before.length === 2 &&
      before[0].open === false &&
      before[0].key === "C14|Phase 5|1" &&
      before[1].key === "",
    "detailsBefore records each open state and key",
  );
  const same = details(true, "C14|Phase 5|1"),
    unkeyed = details(false, "");
  fakeWindow.restoreDetails(root([same, unkeyed]), before);
  ok(
    same.open === false && unkeyed.open === true,
    "restoreDetails puts back the player's choice for the same keys",
  );
  const ended = details(false, "C14|Phase 5|1|done");
  fakeWindow.restoreDetails(root([ended]), before);
  ok(
    ended.open === false,
    "a details with a new key (the walk ended) keeps its default",
  );
  fakeWindow.restoreDetails(root([details(true, "x")]), []);
  const trail = { scrollTop: 120 },
    log = { scrollTop: 0 };
  const scroll = fakeWindow.scrollBefore(
    root([], { ".trail": trail, ".log": log }),
  );
  ok(
    scroll[0] === 120 && scroll[1] === 0,
    "scrollBefore reads the trail's position and 0 for a missing log",
  );
  const trailAfter = { scrollTop: 0 },
    logAfter = { scrollTop: 0 };
  fakeWindow.restoreScroll(
    root([], { ".trail": trailAfter, ".log": logAfter }),
    scroll,
  );
  ok(
    trailAfter.scrollTop === 120 && logAfter.scrollTop === 0,
    "restoreScroll puts the trail back and leaves an unscrolled log alone",
  );
  fakeWindow.restoreScroll(root([]), scroll);
}
// Saving into a slot writes the game with its turn and time under qb.slots (a fake localStorage as in checkStorage).
function checkSlotSave() {
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
  };
  ok(fakeWindow.slots().length === 0, "no slots before any save");
  const state = engine.newState({ dice: true });
  state.turn = 4;
  ui.setState(state);
  fakeWindow.saveToSlot(1);
  const slotList = fakeWindow.slots();
  ok(
    slotList.length === 2 &&
      slotList[0] == null &&
      slotList[1].turn === 4 &&
      typeof slotList[1].when === "string" &&
      JSON.parse(slotList[1].data).turn === 4,
    "saveToSlot fills the chosen slot with the turn, the time and the game",
  );
  fakeWindow.saveToSlot(1);
  ok(
    fakeWindow.slots().length === 2 && fakeWindow.slots()[1].turn === 4,
    "saving again overwrites the same slot",
  );
  ui.setState(null);
  delete globalThis.localStorage;
}
// The transfer helpers with a stubbed host, document and navigator: the viewer's refusals stop the download, any
// other host refusal falls through to the Blob link, and the share sheet's outcomes reach the note.
async function checkTransfer() {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const setNavigator = (value) =>
    Object.defineProperty(globalThis, "navigator", {
      value,
      configurable: true,
    });
  const clicks = [];
  globalThis.document = {
    createElement: () => ({
      click() {
        clicks.push(this.download);
      },
    }),
  };
  const host = (save) => {
    globalThis.window = { claude: { use: async () => ({ save }) } };
  };
  const download = async () => {
    const noteEl = { textContent: "" };
    const outcome = await fakeWindow.downloadText({
      fileName: "log.json",
      data: "{}",
      noteEl,
      fallbackLabel: "Copy",
    });
    return { outcome, note: noteEl.textContent };
  };
  const refuse = (code) => () => Promise.reject({ code, message: "m" });

  host(async () => ({ status: "saved" }));
  let result = await download();
  ok(
    result.outcome === "saved" &&
      result.note === "File saved." &&
      !clicks.length,
    "a host save needs no link",
  );
  host(refuse("declined"));
  result = await download();
  ok(
    result.outcome === "declined" &&
      result.note === "Download cancelled." &&
      !clicks.length,
    "a declined host save stops without a link",
  );
  host(refuse("rate_limited"));
  result = await download();
  ok(
    result.outcome === "busy" &&
      /already open/.test(result.note) &&
      !clicks.length,
    "a rate-limited host save stops without a link",
  );
  for (const code of [
    "unavailable",
    "not_granted",
    "too_large",
    "odd_new_code",
  ]) {
    clicks.length = 0;
    host(refuse(code));
    result = await download();
    ok(
      result.outcome === "link" &&
        clicks[0] === "log.json" &&
        result.note.includes("(" + code + ")") &&
        result.note.endsWith("use Copy."),
      "a host refusal of " + code + " falls through to the Blob link",
    );
  }
  clicks.length = 0;
  globalThis.window = {
    claude: {
      use: async () => {
        throw new Error("no host");
      },
    },
  };
  result = await download();
  ok(
    result.outcome === "link" &&
      clicks.length === 1 &&
      result.note === "If nothing downloaded, use Copy.",
    "a throwing use() counts as no host",
  );
  globalThis.document = {
    createElement: () => {
      throw new Error("blocked");
    },
  };
  result = await download();
  ok(
    result.outcome === "blocked" && /not available here/.test(result.note),
    "a blocked link points at the fallback",
  );

  // The share sheet through wireShare, with a fake button; canShare(types) accepts the listed MIME types only.
  const share = async (
    shareImpl,
    types = ["application/json", "text/plain"],
  ) => {
    setNavigator({
      canShare: (data) => types.includes(data.files[0].type),
      share: shareImpl,
    });
    const button = {};
    const noteEl = { textContent: "" };
    let outcome;
    const settled = new Promise((resolve) => {
      fakeWindow.wireShare(button, {
        fileName: () => "log.json",
        data: () => "{}",
        noteEl,
        fallbackLabel: "Copy",
        done: (value) => resolve((outcome = value)),
      });
    });
    if (!button.hidden) {
      button.onclick();
      await settled;
    }
    return { outcome, note: noteEl.textContent, hidden: button.hidden };
  };
  let shared;
  const keep = async (data) => {
    shared = data.files[0];
  };
  result = await share(keep);
  ok(
    !result.hidden &&
      result.outcome === "shared" &&
      shared.name === "log.json" &&
      shared.type === "application/json" &&
      (await shared.text()) === "{}" &&
      result.note === "Shared log.json.",
    "share hands the sheet the JSON file",
  );
  result = await share(keep, ["text/plain"]);
  ok(
    result.outcome === "shared" &&
      shared.name === "log.txt" &&
      shared.type === "text/plain" &&
      (await shared.text()) === "{}" &&
      result.note === "Shared log.txt.",
    "a share list without JSON gets the same text as a .txt file",
  );
  result = await share(keep, []);
  ok(result.hidden, "the Share button is hidden where no file can be shared");
  const named = (name) => async () => {
    const error = new Error(name);
    error.name = name;
    throw error;
  };
  result = await share(named("AbortError"));
  ok(
    result.outcome === "cancelled" && result.note === "Share cancelled.",
    "a dismissed share sheet says so",
  );
  result = await share(named("NotAllowedError"));
  ok(
    result.outcome === "NotAllowedError" && result.note.endsWith("use Copy."),
    "a refused share points at the fallback",
  );
  for (const navigatorValue of [
    {},
    {
      canShare: () => {
        throw new Error("x");
      },
    },
  ]) {
    setNavigator(navigatorValue);
    const button = {};
    fakeWindow.wireShare(button, {
      fileName: () => "log.json",
      data: () => "{}",
      noteEl: {},
      fallbackLabel: "Copy",
    });
    ok(button.hidden, "no canShare, or a throwing one, hides the Share button");
  }

  Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  delete globalThis.window;
  delete globalThis.document;
}
// The Debug log and Save windows' transfer buttons wired onto fake elements: no DOM, so the debug log cannot be
// built and the text box holds the build error, which is still a log to export.
async function checkTransferWiring() {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  const shared = [];
  Object.defineProperty(globalThis, "navigator", {
    value: {
      canShare: (data) => data.files[0].type === "text/plain",
      share: async (data) => {
        shared.push(data.files[0].name);
      },
    },
    configurable: true,
  });
  const clicks = [];
  globalThis.document = {
    createElement: () => ({
      click() {
        clicks.push(this.download);
      },
    }),
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const store = {};
  globalThis.localStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => delete store[key],
  };
  const fakeEl = (ids) => {
    const nodes = Object.fromEntries(ids.map((id) => [id, { id }]));
    return {
      nodes,
      querySelector: (selector) => nodes[selector.slice(1)],
      querySelectorAll: () => [],
    };
  };
  const state = engine.newState({ dice: true });
  state.turn = 3;
  ui.setState(state);
  fakeWindow.QB_DEBUG.reset();

  const debugEl = fakeEl([
    "dbgTxt",
    "dbgReport",
    "dbgNote",
    "dbgShare",
    "dbgDl",
    "dbgCopy",
  ]);
  fakeWindow.MODAL_REGISTRATIONS.debug.wire(null, debugEl);
  const { dbgShare, dbgDl, dbgNote, dbgTxt } = debugEl.nodes;
  ok(
    dbgShare.hidden === false && /could not be built/.test(dbgTxt.value),
    "the Debug log window shows Share where a file can be shared",
  );
  dbgDl.onclick();
  await settle();
  ok(
    clicks.at(-1).startsWith("queller-debug-turn3-") &&
      dbgNote.textContent ===
        "If nothing downloaded, use Share debug log file or Copy debug log.",
    "Download debug log names Share and Copy as the fallback",
  );
  dbgShare.onclick();
  await settle();
  ok(
    /^queller-debug-turn3-.*\.txt$/.test(shared.at(-1)) &&
      dbgNote.textContent === "Shared " + shared.at(-1) + ".",
    "Share debug log file shares the log",
  );
  const exports = fakeWindow.QB_DEBUG.build()
    .actions.filter((entry) => /^debugExport/.test(entry.action))
    .map(
      (entry) => entry.action + ":" + entry.how + ":" + (entry.outcome ?? ""),
    );
  ok(
    exports.join(" ") ===
      "debugExport:download: debugExportResult:download:link debugExport:share: debugExportResult:share:shared",
    "each export records its click and then its outcome",
  );

  const saveEl = fakeEl(["shareBtn", "dlBtn", "copyBtn", "dlNote"]);
  fakeWindow.MODAL_REGISTRATIONS.save.wire(null, saveEl);
  const { shareBtn, dlBtn, dlNote } = saveEl.nodes;
  ok(shareBtn.hidden === false, "the Save window shows Share too");
  dlBtn.onclick();
  await settle();
  ok(
    clicks.at(-1) === "queller-turn3.json" &&
      dlNote.textContent ===
        "If nothing downloaded, use Share save file or Copy save code.",
    "Download save file names Share and Copy as the fallback",
  );
  shareBtn.onclick();
  await settle();
  ok(
    shared.at(-1) === "queller-turn3.txt" &&
      dlNote.textContent === "Shared queller-turn3.txt.",
    "Share save file shares the game",
  );

  Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  fakeWindow.QB_DEBUG.reset();
  delete globalThis.document;
  delete globalThis.localStorage;
  ui.setState(null);
}
async function main() {
  checkTextHelpers();
  checkBoardPaths();
  checkStorage();
  checkFocusKeys();
  checkRenderBookkeeping();
  checkSlotSave();
  checkWidgets();
  checkPhaseTables();
  checkTrailAndResult();
  checkCardFaces();
  await checkTransfer();
  await checkTransferWiring();
  console.log(fails ? fails + " failure(s)" : "all UI checks passed");
  process.exit(fails ? 1 : 0);
}
main();
