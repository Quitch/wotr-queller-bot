// Shared setup for the Playwright scripts: serves the built index.html the way the artifact host does (wrapped in a
// document, Google Fonts stubbed) and opens it in Chromium.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const VIEWPORT = {
  DESKTOP: { width: 1280, height: 900 },
  PHONE: { width: 400, height: 800 },
};
const WAIT_FOR_UNCAUGHT_MS = 100; // long enough for a setTimeout(0) error to reach the page's error handler
const MAX_ANSWERS = 60; // answers pressed before a walk is given up on
const MAX_PHASE5_WALKS = 20;
// The controls the scripts drive.
const SEL = {
  START: "#start",
  NEW_GAME: "#newGameBtn",
  UNDO: "#undoBtn",
  DEBUG_BUTTON: "#debugBtn",
  ANSWER_BUTTONS: ".prompt .answers .btn, .prompt #cntOk, .prompt #bfOk",
  BATTLE_FORM_OK: "#bfOk",
  BATTLE_NEAR_MORIA: "#bf-nearMoria",
  MODAL: "#modal",
  MODAL_TITLE: "#mtitle",
  MODAL_CLOSE: "#mclose",
  ASK_OK: '#modal [data-ask="ok"]',
  ASK_NO: '#modal [data-ask="no"]',
  FLOW_TOGGLE: "#flowToggle",
  CALC_INCREASE_REGULARS: '[data-cs="reg"][data-d="1"]',
  CALC_CLEAR: "#calcClear",
  JUMP_GO: "#jumpGo",
  DEBUG_OPEN: "#dbgOpen",
  DEBUG_TEXT: "#dbgTxt",
  DEBUG_REPORT: "#dbgReport",
  DEBUG_COPY: "#dbgCopy",
  DEBUG_DOWNLOAD: "#dbgDl",
  DEBUG_NOTE: "#dbgNote",
  ERROR_BAR: "#errbar",
  ERROR_BAR_LOG: "#errbarLog",
  ERROR_BAR_CLOSE: "#errbarClose",
  TRACKER_SARUMAN: "#t-chars-saruman",
  TRACKER_GONDOR: "#t-nations-gondor",
  TRACKER_REVEALED: "#t-fs-revealed",
  TABLE_CARD_DETAILS: '[data-card="show"]',
  TABLE_CARD_SHOWN: ".tablecards .card",
  TABLE_CARD_REMINDER: ".tablecards .rem",
  DIE_SPEND: "[data-spend]",
  RINGS_STEPPER: '[data-step="rings"]',
  RINGS_INCREASE: '[data-step="rings"][data-d="1"]',
  COMPANIONS_STEPPER: '[data-step="fs.companions"]',
  BROKEN_AUTOSAVE_NOTICE: '.setup [role="status"]',
  phase: (id) => '[data-phase="' + id + '"]',
  modal: (name) => '[data-modal="' + name + '"]',
  option: (id) => "#opt-" + id,
};
// An autosave the app cannot render (no dice), so a reload falls back to the New game screen.
const brokenAutosave = () =>
  JSON.stringify({
    settings: { dice: true, cards: true, tracker: true, wome: true },
    board: {},
    turn: 3,
  });

// Serve the built page and open it. Returns {page, browser, server, errors, close}; errors collects page errors and
// console errors when captureErrors is on.
async function launchBuiltPage({
  viewport = VIEWPORT.DESKTOP,
  captureErrors = false,
} = {}) {
  const html =
    '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>' +
    fs.readFileSync(
      path.join(import.meta.dirname, "..", "index.html"),
      "utf8",
    ) +
    "</body></html>";
  const server = http.createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const errors = [];
  if (captureErrors) {
    page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push("console: " + message.text());
    });
  }
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, body: "", contentType: "text/css" }),
  );
  await page.goto(url, { waitUntil: "load" });
  const close = async () => {
    await browser.close();
    server.close();
  };
  return { page, browser, server, errors, close };
}
// Start a game from the New game screen with every option on.
async function startGameWithEverythingOn(page) {
  for (const option of ["dice", "cards", "tracker", "wome"])
    await page.check(SEL.option(option));
  await page.click(SEL.START);
}
const readState = (page) => page.evaluate(() => window.QBUI.state);
// Press the first answer button until the walk ends (ticking "near Moria" on a battle form).
async function answerAll(page, max = MAX_ANSWERS) {
  for (let i = 0; i < max; i++) {
    const button = await page.$(SEL.ANSWER_BUTTONS);
    if (!button) break;
    const id = await button.getAttribute("id");
    if (id === "bfOk") await page.check(SEL.BATTLE_NEAR_MORIA).catch(() => {});
    await button.click();
  }
}

export {
  VIEWPORT,
  WAIT_FOR_UNCAUGHT_MS,
  MAX_ANSWERS,
  MAX_PHASE5_WALKS,
  SEL,
  brokenAutosave,
  launchBuiltPage,
  startGameWithEverythingOn,
  readState,
  answerAll,
};
