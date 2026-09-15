// Screenshots of the main states for a visual check (test/shot-*.png).
import path from "node:path";
import {
  VIEWPORT,
  SEL,
  brokenAutosave,
  launchBuiltPage,
  startGameWithEverythingOn,
} from "./browser.js";
const SHOT_PREFIX = "shot-";
const shotPath = (name) =>
  path.join(import.meta.dirname, SHOT_PREFIX + name + ".png");
// The parts of the page the partial screenshots show.
const CLIP = {
  ERROR_BAR: { x: 0, y: 0, width: VIEWPORT.DESKTOP.width, height: 260 },
  ERROR_BAR_PHONE: { x: 0, y: 0, width: VIEWPORT.PHONE.width, height: 300 },
};

// A Phase 5 game with rolled dice, a minion and three cards on the table.
async function startShowcaseGame(page) {
  await startGameWithEverythingOn(page);
  await page.evaluate(() => {
    const engine = window.QB;
    window.QBUI.act(() => {
      const state = window.QBUI.state;
      state.strategy = engine.STRATEGY.CORRUPTION;
      state.phase = engine.PHASE.P5;
      state.board.chars.saruman = true;
      state.cards.table.push(
        engine.CARD.FLOCKS_OF_CREBAIN,
        engine.CARD.BALROG,
        engine.CARD.WORMTONGUE,
      );
      state.cards.discards.C = [];
      engine.recoverDice(state);
      engine.assignHunt(state, 2);
      engine.rollRemaining(state);
    });
  });
}
// The flowchart viewer: a visual oracle for the arrow routing.
async function shootFlowchart(page) {
  await page.click(SEL.modal("flow"));
  await page.screenshot({ path: shotPath("flow"), fullPage: true });
  await page.click(SEL.MODAL_CLOSE);
}
// The game with the full board tracker, then with the minimal one.
async function shootTrackerLayouts(page) {
  await page.screenshot({ path: shotPath("full"), fullPage: true });
  await shootFlowchart(page);
  await page.evaluate(() => {
    window.QBUI.act(() => {
      window.QBUI.state.settings.tracker = false;
    });
  });
  await page.screenshot({ path: shotPath("minimal"), fullPage: true });
}
// The error bar after a failed action and the debug log modal (light, dark, phone), then the phone-width error bar.
async function shootErrorBarAndDebugLog(page) {
  await page.evaluate(() => {
    window.QBUI.act(
      () => {
        throw new Error("example failure while answering");
      },
      { action: "answer" },
    );
  });
  await page.screenshot({ path: shotPath("errbar"), clip: CLIP.ERROR_BAR });
  await page.click(SEL.ERROR_BAR_LOG);
  await page.screenshot({ path: shotPath("debug") });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: shotPath("debug-dark") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize(VIEWPORT.PHONE);
  await page.screenshot({ path: shotPath("debug-phone") });
  await page.click(SEL.MODAL_CLOSE);
  await page.screenshot({
    path: shotPath("errbar-phone"),
    clip: CLIP.ERROR_BAR_PHONE,
  });
  await page.setViewportSize(VIEWPORT.DESKTOP);
}
// The setup screen after an autosave that cannot be rendered.
async function shootBrokenAutosave(page) {
  await page.evaluate(
    (save) => localStorage.setItem(window.QBUI.STORAGE_KEY.AUTOSAVE, save),
    brokenAutosave(),
  );
  await page.reload();
  await page.screenshot({ path: shotPath("broken"), fullPage: true });
}
async function main() {
  const { page, close } = await launchBuiltPage();
  await startShowcaseGame(page);
  await shootTrackerLayouts(page);
  await shootErrorBarAndDebugLog(page);
  await shootBrokenAutosave(page);
  await close();
}
await main();
