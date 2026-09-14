// Screenshots of the main states for a visual check.
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
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, body: "", contentType: "text/css" }),
  );
  await page.goto(url);
  for (const option of ["dice", "cards", "tracker", "wome"])
    await page.check("#opt-" + option);
  await page.click("#start");
  await page.evaluate(() => {
    window.QBUI.act(() => {
      const state = window.QBUI.state,
        engine = window.QB;
      state.strategy = "corruption";
      state.phase = "p5";
      state.board.chars.saruman = true;
      state.cards.table.push("sa009", "sa001b2", "sa051");
      state.cards.discards.C = [];
      engine.recoverDice(state);
      engine.assignHunt(state, 2);
      engine.rollRemaining(state);
    });
  });
  await page.screenshot({
    path: path.join(__dirname, "shot-full.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    window.QBUI.act(() => {
      window.QBUI.state.settings.tracker = false;
    });
  });
  await page.screenshot({
    path: path.join(__dirname, "shot-minimal.png"),
    fullPage: true,
  });
  // debug log: the error bar after a failed action, the modal (light and dark), the setup screen after a broken autosave
  await page.evaluate(() => {
    window.QBUI.act(
      () => {
        throw new Error("example failure while answering");
      },
      { a: "answer" },
    );
  });
  await page.screenshot({
    path: path.join(__dirname, "shot-errbar.png"),
    clip: { x: 0, y: 0, width: 1280, height: 260 },
  });
  await page.click("#errbarLog");
  await page.screenshot({ path: path.join(__dirname, "shot-debug.png") });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(__dirname, "shot-debug-dark.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 400, height: 800 });
  await page.screenshot({ path: path.join(__dirname, "shot-debug-phone.png") });
  await page.click("#mclose");
  await page.screenshot({
    path: path.join(__dirname, "shot-errbar-phone.png"),
    clip: { x: 0, y: 0, width: 400, height: 300 },
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() =>
    localStorage.setItem("qb.autosave", '{"settings":{},"board":{}}'),
  );
  await page.reload();
  await page.screenshot({
    path: path.join(__dirname, "shot-broken.png"),
    fullPage: true,
  });
  await browser.close();
  server.close();
})();
