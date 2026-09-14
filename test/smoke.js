// Browser smoke test: boots the built page the way the artifact host does, plays through a turn with every option on,
// exercises the tracker triggers, the table-card list, the die tap, undo and every modal. Fails on any page error.
const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
(async () => {
  const html =
    '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>' +
    fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8") +
    "</body></html>";
  const server = http.createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push("console: " + message.text());
  });
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, body: "", contentType: "text/css" }),
  );
  await page.goto(url, { waitUntil: "load" });
  const readState = () => page.evaluate(() => window.QBUI.state);
  const click = async (selector) => {
    await page.click(selector);
  };
  const answerAll = async (max) => {
    // press the first answer button until the walk ends
    for (let i = 0; i < (max || 60); i++) {
      const button = await page.$(
        ".prompt .answers .btn, .prompt #cntOk, .prompt #bfOk",
      );
      if (!button) break;
      const id = await button.getAttribute("id");
      if (id === "bfOk") {
        await page.check("#bf-nearMoria").catch(() => {});
      }
      await button.click();
    }
  };
  // 1. new game with everything on
  for (const option of ["dice", "cards", "tracker", "wome"])
    await page.check("#opt-" + option);
  await click("#start");
  await click('[data-phase="setup"]');
  await answerAll();
  let state = await readState();
  console.log("strategy:", state.strategy, "phase:", state.phase);
  await click('[data-phase="p1"]');
  await answerAll();
  state = await readState();
  console.log(
    "after p1: hand",
    state.cards.hand.length,
    "dice",
    state.dice.pool.length,
    "phase",
    state.phase,
  );
  if (state.strategy === "corruption") {
    await click('[data-phase="p2"]');
    await answerAll();
  }
  await click('[data-phase="p3"]');
  await answerAll();
  await click('[data-phase="p4"]');
  await answerAll();
  state = await readState();
  console.log(
    "after p4: hunt",
    state.dice.hunt,
    "avail",
    state.dice.pool.filter((die) => die.st === "avail").length,
    "phase",
    state.phase,
  );
  // 2. Phase 5 walks until Phase 6 appears (bounded)
  for (let i = 0; i < 20; i++) {
    const phase5Btn = await page.$('[data-phase="p5"]');
    if (!phase5Btn) break;
    await phase5Btn.click();
    await answerAll();
  }
  state = await readState();
  console.log(
    "phase 5 done: avail",
    state.dice.pool.filter((die) => die.st === "avail").length,
    "reserved",
    state.dice.pool.filter((die) => die.st === "reserved").length,
    "log",
    state.log.length,
  );
  // 3. battle with the form
  await click('[data-phase="battle1"]');
  await answerAll();
  // 4. tracker: tick Saruman, put Wormtongue + Palantír on the table, untick Saruman → auto-discards; Rohan active → ask dialog for Threats and Promises
  await page.evaluate(() => {
    window.QBUI.act(() => {
      const state = window.QBUI.state;
      state.board.chars.saruman = true;
      state.cards.table.push("sa051", "sa045", "sa050", "sa009");
      state.cards.discards.C = state.cards.discards.C.filter(
        (id) => !["sa051", "sa045", "sa009"].includes(id),
      );
    });
  });
  await page.uncheck("#t-chars-saruman");
  state = await readState();
  console.log(
    "after Saruman unticked: table",
    JSON.stringify(state.cards.table),
  );
  await page.selectOption("#t-nations-gondor", "war"); // Threats and Promises: active→war asks
  const askDialog = await page.$("#modal");
  console.log(
    "ask dialog open:",
    !!askDialog,
    askDialog ? await page.textContent("#mtitle") : "",
  );
  if (askDialog) await page.click('#modal [data-ask="ok"]');
  state = await readState();
  console.log("after answer: table", JSON.stringify(state.cards.table));
  await page.check("#t-fs-revealed");
  const flocksDialog = await page.$("#modal");
  console.log(
    "Flocks ask:",
    flocksDialog ? await page.textContent("#mtitle") : "none",
  );
  if (flocksDialog) await page.click('#modal [data-ask="no"]');
  // 5. table card details + reminder, die tap, undo, minimal tracker fields via settings
  const detailsBtn = await page.$('[data-card="show"]');
  if (detailsBtn) {
    await detailsBtn.click();
    console.log(
      "details shown:",
      !!(await page.$(".tablecards .card")),
      "reminder:",
      !!(await page.$(".tablecards .rem")),
    );
  }
  const spend = await page.$("[data-spend]");
  if (spend) {
    await spend.click();
    await page.click('#modal [data-ask="ok"]');
  }
  await click("#undoBtn");
  for (const modal of [
    "glossary",
    "flow",
    "rules",
    "calc",
    "save",
    "settings",
    "help",
  ]) {
    await click('[data-modal="' + modal + '"]');
    if (modal === "flow") {
      await page.click("#flowToggle");
    }
    if (modal === "calc") {
      await page.click('[data-cs="reg"][data-d="1"]');
      await page.click("#calcClear");
    }
    await click("#mclose");
  }
  await click('[data-phase="jumpto"]');
  await click("#jumpGo");
  await answerAll();
  // 6. tracker off + dice on → minimal tracker shows Companions and Rings
  await page.evaluate(() => {
    window.QBUI.act(() => {
      window.QBUI.state.settings.tracker = false;
    });
  });
  console.log(
    "minimal tracker rings/companions:",
    !!(await page.$('[data-step="rings"]')),
    !!(await page.$('[data-step="fs.companions"]')),
  );
  await page.click('[data-step="rings"][data-d="1"]');
  state = await readState();
  console.log("rings now", state.board.rings);
  // 7. debug log: from Settings, with a report; a failing action is rolled back and the error bar offers the log; an uncaught error too
  await click('[data-modal="settings"]');
  await click("#dbgOpen");
  console.log("debug modal:", await page.textContent("#mtitle"));
  let log = JSON.parse(await page.inputValue("#dbgTxt"));
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
  );
  await page.fill("#dbgReport", "smoke report");
  await page.dispatchEvent("#dbgReport", "change");
  log = JSON.parse(await page.inputValue("#dbgTxt"));
  console.log("report in log:", log.report);
  await click("#dbgCopy");
  console.log("copy note:", await page.textContent("#dbgNote"));
  await click("#dbgDl");
  console.log("download note:", await page.textContent("#dbgNote"));
  await click("#mclose");
  const turnBefore = (await readState()).turn;
  const debugFailures = [];
  await page.evaluate(() => {
    window.QBUI.act(
      () => {
        window.QBUI.state.turn = 99;
        throw new Error("smoke: deliberate action failure");
      },
      { a: "smokeFail" },
    );
  });
  state = await readState();
  console.log(
    "after failing action: turn",
    state.turn,
    "(was",
    turnBefore + ")",
    "error bar",
    !!(await page.$("#errbar")),
    "text:",
    (await page.textContent("#errbar")).slice(0, 80),
  );
  if (state.turn !== turnBefore)
    debugFailures.push("failed action was not rolled back");
  await page.evaluate(() =>
    setTimeout(() => {
      throw new Error("smoke: deliberate uncaught error");
    }, 0),
  );
  await page.waitForTimeout(100);
  await click("#errbarLog");
  log = JSON.parse(await page.inputValue("#dbgTxt"));
  console.log(
    "errors in log:",
    log.errors
      .map(
        (record) =>
          record.a +
          "/" +
          record.message.slice(0, 40) +
          (record.rolledBack ? " (rolled back)" : ""),
      )
      .join("; "),
  );
  if (
    log.errors.length !== 2 ||
    !log.errors[0].rolledBack ||
    log.errors[0].during?.a !== "smokeFail" ||
    !log.errors[1].lastAction
  )
    debugFailures.push("errors not recorded as expected");
  if (!log.summary.some((line) => /2 errors recorded/.test(line)))
    debugFailures.push("summary lacks the error count");
  await click("#mclose");
  await click("#errbarClose");
  console.log("error bar dismissed:", !(await page.$("#errbar")));
  const actionsBefore = log.actions.length;
  // 8. reload from autosave; the action history survives the reload
  await page.reload({ waitUntil: "load" });
  state = await readState();
  console.log("reloaded turn", state?.turn, "phase", state?.phase);
  await page.click("#newGameBtn");
  await page.click('#modal [data-ask="ok"]');
  console.log("setup screen:", !!(await page.$("#start")));
  await click("#debugBtn");
  log = JSON.parse(await page.inputValue("#dbgTxt"));
  console.log(
    "log from the setup screen: state",
    log.state,
    "actions",
    log.actions.length,
    "page loads",
    log.actions.filter((record) => record.a === "pageLoad").length,
  );
  if (
    log.actions.length < actionsBefore ||
    log.actions.filter((record) => record.a === "pageLoad").length < 2
  )
    debugFailures.push("action history did not survive the reload");
  await click("#mclose");
  // 9. an autosave that cannot be rendered: the app falls back to the setup screen, keeps the save and offers the log
  await page.evaluate(() =>
    localStorage.setItem(
      "qb.autosave",
      JSON.stringify({
        settings: { dice: true, cards: true, tracker: true, wome: true },
        board: {},
        turn: 3,
      }),
    ),
  );
  await page.reload({ waitUntil: "load" });
  console.log(
    "broken autosave: setup screen",
    !!(await page.$("#start")),
    "notice",
    !!(await page.$('.setup [role="status"]')),
    "error bar",
    !!(await page.$("#errbar")),
  );
  await click("#debugBtn");
  log = JSON.parse(await page.inputValue("#dbgTxt"));
  console.log(
    "broken save in log: turn",
    log.brokenAutosave?.turn,
    "boot error:",
    log.errors.find((record) => record.a === "boot-render")?.message,
  );
  if (
    log.brokenAutosave?.turn !== 3 ||
    !log.errors.some((record) => record.a === "boot-render")
  )
    debugFailures.push("broken autosave not captured");
  await click("#mclose");
  await page.click("#start");
  console.log(
    "after Start game the broken save is cleared:",
    await page.evaluate(() => !localStorage.getItem("qb.autosave.broken")),
  );
  await page.screenshot({
    path: path.join(__dirname, "smoke.png"),
    fullPage: true,
  });
  for (const failure of debugFailures) errors.push("debug: " + failure);
  await browser.close();
  server.close();
  const unexpected = errors.filter(
    (error) => !/smoke: deliberate|could not render the saved game/.test(error),
  );
  console.log(
    unexpected.length
      ? "ERRORS:\n" + unexpected.join("\n")
      : "no page errors (" +
          (errors.length - unexpected.length) +
          " deliberate ones ignored)",
  );
  errors.length = 0;
  errors.push(...unexpected);
  process.exit(errors.length ? 1 : 0);
})();
