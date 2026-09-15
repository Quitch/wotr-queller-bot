// Browser smoke test: boots the built page the way the artifact host does, plays through a turn with every option on,
// exercises the tracker triggers, the table-card list, the die tap, undo and every modal, then a 360px touch screen
// (the Tools menu, no sideways scroll). axe-core runs on every screen and modal. Fails on any page error or a serious
// axe violation.
import path from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import {
  SEL,
  VIEWPORT,
  WAIT_FOR_UNCAUGHT_MS,
  MAX_PHASE5_WALKS,
  brokenAutosave,
  launchBuiltPage,
  openFromToolsMenu,
  startGameWithEverythingOn,
  readState,
  scrollsSideways,
  answerAll,
} from "./browser.js";
// The errors this script raises on purpose, and the console line the app prints when it falls back to the setup screen.
const DELIBERATE_ERROR = /smoke: deliberate|could not render the saved game/;
const BUILD_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/; // what build.js defines QB_BUILT as
const AXE_FAILING_IMPACTS = ["serious", "critical"]; // axe-core violations that fail the run
const debugFailures = [];
// axe-core over the page as it stands; a serious or critical violation fails the run.
async function axeCheck(page, what) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const failing = violations.filter((violation) =>
    AXE_FAILING_IMPACTS.includes(violation.impact),
  );
  console.log(
    "axe " + what + ":",
    violations.length ? violations.map((v) => v.id).join(", ") : "clean",
  );
  for (const violation of failing)
    debugFailures.push(
      "axe " +
        what +
        ": " +
        violation.id +
        " (" +
        violation.impact +
        ") at " +
        violation.nodes.map((node) => node.target.join(" ")).join("; "),
    );
}
const debugLog = async (page) =>
  JSON.parse(await page.inputValue(SEL.DEBUG_TEXT));
const usable = (state, status) =>
  state.dice.pool.filter((die) => die.status === status).length;

async function newGameWithEverythingOn(page) {
  await axeCheck(page, "setup screen");
  await startGameWithEverythingOn(page);
  await page.click(SEL.phase("setup"));
  await answerAll(page);
  let state = await readState(page);
  console.log("strategy:", state.strategy, "phase:", state.phase);
  await page.click(SEL.phase("p1"));
  await answerAll(page);
  state = await readState(page);
  console.log(
    "after p1: hand",
    state.cards.hand.length,
    "dice",
    state.dice.pool.length,
    "phase",
    state.phase,
  );
  if (state.strategy === "corruption") {
    await page.click(SEL.phase("p2"));
    await answerAll(page);
  }
  await page.click(SEL.phase("p3"));
  await answerAll(page);
  await page.click(SEL.phase("p4"));
  await answerAll(page);
  await axeCheck(page, "game screen");
  state = await readState(page);
  console.log(
    "after p4: hunt",
    state.dice.hunt,
    "avail",
    usable(state, "avail"),
    "phase",
    state.phase,
  );
}
// Phase 5 walks until the Phase 6 button appears (bounded).
async function playPhase5UntilPhase6(page) {
  for (let i = 0; i < MAX_PHASE5_WALKS; i++) {
    const phase5Btn = await page.$(SEL.phase("p5"));
    if (!phase5Btn) break;
    await phase5Btn.click();
    await answerAll(page);
  }
  const state = await readState(page);
  console.log(
    "phase 5 done: avail",
    usable(state, "avail"),
    "reserved",
    usable(state, "reserved"),
    "log",
    state.log.length,
  );
}
async function playBattle(page) {
  await page.click(SEL.phase("battle1"));
  await answerAll(page);
}
// Tick Saruman, put Wormtongue + Palantír on the table, untick Saruman → auto-discards; Gondor to war → ask dialog for
// Threats and Promises; the Fellowship revealed → ask dialog for Flocks of Crebain.
async function exerciseTrackerTriggers(page) {
  await page.evaluate(() => {
    const engine = window.QB;
    window.QBUI.act(() => {
      const state = window.QBUI.state;
      const onTable = [
        engine.CARD.WORMTONGUE,
        engine.CARD.PALANTIR,
        engine.CARD.THREATS_AND_PROMISES,
        engine.CARD.FLOCKS_OF_CREBAIN,
      ];
      state.board.chars.saruman = true;
      state.cards.table.push(...onTable);
      state.cards.discards.C = state.cards.discards.C.filter(
        (id) => !onTable.includes(id),
      );
    });
  });
  await page.uncheck(SEL.TRACKER_SARUMAN);
  let state = await readState(page);
  console.log(
    "after Saruman unticked: table",
    JSON.stringify(state.cards.table),
  );
  await page.selectOption(SEL.TRACKER_GONDOR, "war"); // Threats and Promises: active→war asks
  const askDialog = await page.$(SEL.MODAL);
  console.log(
    "ask dialog open:",
    !!askDialog,
    askDialog ? await page.textContent(SEL.MODAL_TITLE) : "",
  );
  if (askDialog) await page.click(SEL.ASK_OK);
  state = await readState(page);
  console.log("after answer: table", JSON.stringify(state.cards.table));
  await page.check(SEL.TRACKER_REVEALED);
  const flocksDialog = await page.$(SEL.MODAL);
  console.log(
    "Flocks ask:",
    flocksDialog ? await page.textContent(SEL.MODAL_TITLE) : "none",
  );
  if (flocksDialog) await page.click(SEL.ASK_NO);
}
// Table card details and reminder, the die tap, undo, every modal, and a walk from another start point.
async function exerciseTableCardsDiceUndoAndModals(page) {
  const detailsBtn = await page.$(SEL.TABLE_CARD_DETAILS);
  if (detailsBtn) {
    await detailsBtn.click();
    console.log(
      "details shown:",
      !!(await page.$(SEL.TABLE_CARD_SHOWN)),
      "reminder:",
      !!(await page.$(SEL.TABLE_CARD_REMINDER)),
    );
  }
  const spend = await page.$(SEL.DIE_SPEND);
  if (spend) {
    await spend.click();
    await page.click(SEL.ASK_OK);
  }
  await page.click(SEL.UNDO);
  for (const modal of [
    "glossary",
    "flow",
    "rules",
    "calc",
    "save",
    "settings",
    "help",
  ]) {
    await page.click(SEL.modal(modal));
    await axeCheck(page, modal + " modal");
    if (modal === "flow") await page.click(SEL.FLOW_TOGGLE);
    if (modal === "calc") {
      await page.click(SEL.CALC_INCREASE_REGULARS);
      await page.click(SEL.CALC_CLEAR);
    }
    await page.click(SEL.MODAL_CLOSE);
  }
  await page.click(SEL.phase("jumpto"));
  await axeCheck(page, "jump modal");
  await page.click(SEL.JUMP_GO);
  await answerAll(page);
}
// Tracker off + dice on → the minimal tracker shows Companions and Rings.
async function checkMinimalTracker(page) {
  await page.evaluate(() => {
    window.QBUI.act(() => {
      window.QBUI.state.settings.tracker = false;
    });
  });
  console.log(
    "minimal tracker rings/companions:",
    !!(await page.$(SEL.RINGS_STEPPER)),
    !!(await page.$(SEL.COMPANIONS_STEPPER)),
  );
  await page.click(SEL.RINGS_INCREASE);
  const state = await readState(page);
  console.log("rings now", state.board.rings);
}
// The debug log from Settings, with a report typed in.
async function checkDebugLogExport(page) {
  await page.click(SEL.modal("settings"));
  await page.click(SEL.DEBUG_OPEN);
  console.log("debug modal:", await page.textContent(SEL.MODAL_TITLE));
  await axeCheck(page, "debug modal");
  let log = await debugLog(page);
  console.log(
    "log format",
    log.format,
    "actions",
    log.actions.length,
    "walks",
    log.walks.length,
    "state turn",
    log.state.turn,
    "env ua",
    !!log.environment.userAgent,
    "dom prompt",
    log.dom.prompt !== undefined,
    "built",
    log.environment.built,
  );
  if (!BUILD_TIME.test(log.environment.built || ""))
    debugFailures.push("QB_BUILT was not defined into the bundle");
  await page.fill(SEL.DEBUG_REPORT, "smoke report");
  await page.dispatchEvent(SEL.DEBUG_REPORT, "change");
  log = await debugLog(page);
  console.log("report in log:", log.report);
  await page.click(SEL.DEBUG_COPY);
  console.log("copy note:", await page.textContent(SEL.DEBUG_NOTE));
  await page.click(SEL.DEBUG_DOWNLOAD);
  console.log("download note:", await page.textContent(SEL.DEBUG_NOTE));
  await page.click(SEL.MODAL_CLOSE);
}
// A failing action is rolled back and the error bar offers the log; an uncaught error is recorded too. Returns the
// action count for the reload check.
async function checkFailedActionAndUncaughtError(page) {
  const turnBefore = (await readState(page)).turn;
  await page.evaluate(() => {
    window.QBUI.act(
      () => {
        window.QBUI.state.turn = 99;
        throw new Error("smoke: deliberate action failure");
      },
      { action: "smokeFail" },
    );
  });
  const state = await readState(page);
  console.log(
    "after failing action: turn",
    state.turn,
    "(was",
    turnBefore + ")",
    "error bar",
    !!(await page.$(SEL.ERROR_BAR)),
    "text:",
    (await page.textContent(SEL.ERROR_BAR)).slice(0, 80),
  );
  if (state.turn !== turnBefore)
    debugFailures.push("failed action was not rolled back");
  await page.evaluate(() =>
    setTimeout(() => {
      throw new Error("smoke: deliberate uncaught error");
    }, 0),
  );
  await page.waitForTimeout(WAIT_FOR_UNCAUGHT_MS);
  await axeCheck(page, "error bar");
  await page.click(SEL.ERROR_BAR_LOG);
  const log = await debugLog(page);
  console.log(
    "errors in log:",
    log.errors
      .map(
        (record) =>
          record.action +
          "/" +
          record.message.slice(0, 40) +
          (record.rolledBack ? " (rolled back)" : ""),
      )
      .join("; "),
  );
  if (
    log.errors.length !== 2 ||
    !log.errors[0].rolledBack ||
    log.errors[0].during?.action !== "smokeFail" ||
    !log.errors[1].lastAction
  )
    debugFailures.push("errors not recorded as expected");
  if (!log.summary.some((line) => /2 errors recorded/.test(line)))
    debugFailures.push("summary lacks the error count");
  await page.click(SEL.MODAL_CLOSE);
  await page.click(SEL.ERROR_BAR_CLOSE);
  console.log("error bar dismissed:", !(await page.$(SEL.ERROR_BAR)));
  return log.actions.length;
}
// Reload from the autosave; the action history survives the reload and a new game clears the game.
async function checkReloadKeepsHistory(page, actionsBefore) {
  await page.reload({ waitUntil: "load" });
  const state = await readState(page);
  console.log("reloaded turn", state?.turn, "phase", state?.phase);
  await page.click(SEL.NEW_GAME);
  await page.click(SEL.ASK_OK);
  console.log("setup screen:", !!(await page.$(SEL.START)));
  await page.click(SEL.DEBUG_BUTTON);
  const log = await debugLog(page);
  const pageLoads = log.actions.filter(
    (record) => record.action === "pageLoad",
  ).length;
  console.log(
    "log from the setup screen: state",
    log.state,
    "actions",
    log.actions.length,
    "page loads",
    pageLoads,
  );
  if (log.actions.length < actionsBefore || pageLoads < 2)
    debugFailures.push("action history did not survive the reload");
  await page.click(SEL.MODAL_CLOSE);
}
// An autosave that cannot be rendered: the app falls back to the setup screen, keeps the save and offers the log.
async function checkBrokenAutosave(page) {
  await page.evaluate(
    (save) => localStorage.setItem(window.QBUI.STORAGE_KEY.AUTOSAVE, save),
    brokenAutosave(),
  );
  await page.reload({ waitUntil: "load" });
  console.log(
    "broken autosave: setup screen",
    !!(await page.$(SEL.START)),
    "notice",
    !!(await page.$(SEL.BROKEN_AUTOSAVE_NOTICE)),
    "error bar",
    !!(await page.$(SEL.ERROR_BAR)),
  );
  await page.click(SEL.DEBUG_BUTTON);
  const log = await debugLog(page);
  console.log(
    "broken save in log: turn",
    log.brokenAutosave?.turn,
    "boot error:",
    log.errors.find((record) => record.action === "boot-render")?.message,
  );
  if (
    log.brokenAutosave?.turn !== 3 ||
    !log.errors.some((record) => record.action === "boot-render")
  )
    debugFailures.push("broken autosave not captured");
  await page.click(SEL.MODAL_CLOSE);
  await page.click(SEL.START);
  console.log(
    "after Start game the broken save is cleared:",
    await page.evaluate(
      () => !localStorage.getItem(window.QBUI.STORAGE_KEY.BROKEN_AUTOSAVE),
    ),
  );
}
// The build put everything into the page: the engine and UI namespaces, the inlined stylesheet, the setup screen.
async function checkBuildEssentials(page) {
  const essentials = await page.evaluate(() => ({
    version: window.QB?.VERSION,
    ui: typeof window.QBUI?.act === "function",
    styles: window.document.querySelectorAll("style").length,
    setupScreen: !!window.document.querySelector("#start"),
  }));
  console.log("build essentials:", JSON.stringify(essentials));
  if (
    typeof essentials.version !== "number" ||
    !essentials.ui ||
    !essentials.styles ||
    !essentials.setupScreen
  )
    debugFailures.push(
      "build essentials missing: " + JSON.stringify(essentials),
    );
}
// A 360px touch screen: the Tools menu opens and reaches Settings, and nothing scrolls sideways on either screen, with
// the full or the minimal tracker, or with any modal open (the flowchart in both views). Returns the page errors.
async function checkPhoneLayout() {
  const { page, errors, close } = await launchBuiltPage({
    viewport: VIEWPORT.PHONE_SMALL,
    touch: true,
    captureErrors: true,
  });
  const wide = [];
  const check = async (what) => {
    if (await scrollsSideways(page)) wide.push(what);
  };
  await check("setup screen");
  await startGameWithEverythingOn(page);
  await page.click(SEL.phase("setup"));
  await answerAll(page);
  await check("game screen");
  await page.click(SEL.TOOLS_BUTTON);
  const menuOpen = !!(await page.$(SEL.TOOLS_MENU));
  await axeCheck(page, "tools menu");
  await page.click(SEL.menuItem("settings"));
  const title = await page.textContent(SEL.MODAL_TITLE);
  console.log("phone: Tools menu open", menuOpen, "→", title);
  if (!menuOpen || title !== "Settings")
    debugFailures.push("the Tools menu did not open or reach Settings");
  await check("settings modal");
  await page.click(SEL.MODAL_CLOSE);
  for (const modal of ["glossary", "flow", "rules", "calc", "save", "help"]) {
    await openFromToolsMenu(page, modal);
    await check(modal + " modal");
    if (modal === "flow") {
      await page.click(SEL.FLOW_TOGGLE);
      await check("flow modal, other view");
    }
    await page.click(SEL.MODAL_CLOSE);
  }
  await page.click(SEL.phase("jumpto"));
  await check("jump modal");
  await page.click(SEL.MODAL_CLOSE);
  await page.evaluate(() => {
    window.QBUI.act(() => {
      window.QBUI.state.settings.tracker = false;
    });
  });
  await check("game screen, minimal tracker");
  console.log(
    "phone: sideways scroll:",
    wide.length ? wide.join(", ") : "none",
  );
  if (wide.length)
    debugFailures.push("scrolls sideways at 360px: " + wide.join(", "));
  await close();
  return errors;
}
async function main() {
  const { page, errors, close } = await launchBuiltPage({
    captureErrors: true,
  });
  await checkBuildEssentials(page);
  await newGameWithEverythingOn(page);
  await playPhase5UntilPhase6(page);
  await playBattle(page);
  await exerciseTrackerTriggers(page);
  await exerciseTableCardsDiceUndoAndModals(page);
  await checkMinimalTracker(page);
  await checkDebugLogExport(page);
  const actionsBefore = await checkFailedActionAndUncaughtError(page);
  await checkReloadKeepsHistory(page, actionsBefore);
  await checkBrokenAutosave(page);
  await page.screenshot({
    path: path.join(import.meta.dirname, "smoke.png"),
    fullPage: true,
  });
  await close();
  errors.push(...(await checkPhoneLayout()));
  const unexpected = errors
    .filter((error) => !DELIBERATE_ERROR.test(error))
    .concat(debugFailures.map((failure) => "debug: " + failure));
  console.log(
    unexpected.length
      ? "ERRORS:\n" + unexpected.join("\n")
      : "no page errors (" +
          (errors.length - (unexpected.length - debugFailures.length)) +
          " deliberate ones ignored)",
  );
  process.exit(unexpected.length ? 1 : 0);
}
await main();
