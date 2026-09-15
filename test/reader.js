// The real screen-reader check: NVDA, driven through Guidepup, hears the game log line the live region carries after an
// answer. Windows only, a headed browser in an unlocked interactive session, never in CI; skips (exit 0) with a message
// when it cannot run. Setup, once: `npx @guidepup/setup setup` then `npx @guidepup/setup install` (see docs/testing.md).
import {
  MAX_ANSWERS,
  SEL,
  launchBuiltPage,
  nextAnswerOrPhaseButton,
  readState,
  startGameAtSetupPrompt,
} from "./browser.js";

const SPEECH_TIMEOUT_MS = 5000; // how long the speech log is polled for the line
const POLL_MS = 250;
const SETUP_HINT =
  "run `npx @guidepup/setup setup` then `npx @guidepup/setup install` once";
const normalise = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/ +/g, " ")
    .trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function skip(message) {
  console.log("reader: skipped: " + message);
  process.exit(0);
}
// What the walk shows: changes when an activation reached the app.
const signature = async (page) => {
  const state = await readState(page);
  return JSON.stringify([state.walk?.prompt, state.log.length]);
};
// Activate the focused button through NVDA; if the app saw nothing, press Enter through Playwright instead.
async function activate(page, nvda) {
  const before = await signature(page);
  await nvda.act();
  if ((await signature(page)) !== before) return;
  console.log("note: nvda.act() did not reach the app; pressing Enter");
  await page.keyboard.press("Enter");
}
// Focus the next button (an answer, else the next phase) and activate it until the game log grows. Returns whether it did.
async function answerUntilLogGrows(page, nvda) {
  const before = (await readState(page)).log.length;
  for (let i = 0; i < MAX_ANSWERS; i++) {
    const button = await nextAnswerOrPhaseButton(page);
    if (!button) return false;
    if ((await button.getAttribute("id")) === "bfOk")
      await page.check(SEL.BATTLE_NEAR_MORIA).catch(() => {});
    await button.focus();
    await activate(page, nvda);
    if ((await readState(page)).log.length > before) return true;
  }
  return false;
}
async function main() {
  if (process.platform !== "win32") skip("NVDA runs on Windows only");
  let nvda;
  try {
    ({ nvda } = await import("@guidepup/guidepup"));
  } catch (error) {
    skip("@guidepup/guidepup could not be imported (" + error.message + ")");
  }
  if (!nvda.detect()) skip("NVDA is not supported on this platform");
  let started = false;
  try {
    await nvda.start({ capture: true });
    started = true;
  } catch (error) {
    skip(
      "NVDA could not be started; " + SETUP_HINT + " (" + error.message + ")",
    );
  }
  let session = null;
  let failed;
  try {
    session = await launchBuiltPage({
      headless: false,
      args: ["--force-renderer-accessibility"],
      captureErrors: true,
    });
    const { page, errors } = session;
    await page.bringToFront();
    await startGameAtSetupPrompt(page);
    await nvda.clearSpokenPhraseLog();
    const grown = await answerUntilLogGrows(page, nvda);
    const last = (await readState(page)).log.at(-1)?.text || "";
    const want = normalise(last);
    let heard = [];
    let found = false;
    const deadline = Date.now() + SPEECH_TIMEOUT_MS;
    while (grown && !found && Date.now() < deadline) {
      heard = await nvda.spokenPhraseLog();
      found = normalise(heard.join(" ")).includes(want);
      if (!found) await sleep(POLL_MS);
    }
    console.log("last log line:", JSON.stringify(last));
    console.log("NVDA spoke:", JSON.stringify(heard));
    if (!grown) console.log("FAIL no answer added a log line");
    else if (!found) console.log("FAIL NVDA did not speak the log line");
    else console.log("ok   NVDA spoke the log line");
    if (errors.length) console.log("page errors:\n" + errors.join("\n"));
    failed = !grown || !found || errors.length > 0;
  } finally {
    if (started)
      await nvda
        .stop()
        .catch((error) => console.log("nvda.stop failed:", error.message));
    if (session) await session.close();
  }
  process.exit(failed ? 1 : 0);
}
await main();
