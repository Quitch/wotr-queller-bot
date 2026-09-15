// The accessibility checks the mobile / WCAG 2.2 audit left manual, automated as far as Chromium on a PC allows: the
// live region before and after a keyboard answer, a keyboard pass through the flowchart modal (focus order, tab
// activation, the Tab trap, Escape), dark-scheme native controls, scroll chaining out of the scrolling regions and the
// modals, and on a 360px touch screen the tap pipeline, a double-tap zoom probe and the modals' scroll containment.
// docs/testing.md records what these checks cannot cover. Fails on any FAIL line or page error.
import {
  MAX_ANSWERS,
  SEL,
  VIEWPORT,
  answerAll,
  launchBuiltPage,
  nextAnswerOrPhaseButton,
  openFromToolsMenu,
  readState,
  startGameAtSetupPrompt,
} from "./browser.js";

const SETTLE_MS = 500; // long enough for a wheel scroll to land (smooth scrolling included)
const ZOOM_SETTLE_MS = 400; // long enough for a double-tap zoom animation to change the visual viewport
const LOG_PAD_LINES = 40; // log lines added so the game log overflows its box (220px)
const WHEEL_PX = 300;
const PAGE_SCROLL_PX = 120; // how far the page is scrolled before a modal opens over it
const SHORT_VIEWPORT = { width: 1280, height: 500 }; // fallback when the game screen fits the desktop viewport
const TAP_INTERVAL_S = [0, 0.04, 0.12, 0.16]; // touch start/end/start/end of a double tap: 40ms taps, 80ms apart
const TRAIL_FORCED_HEIGHT = "60px"; // a max-height that makes even a short walk trail overflow
const failures = [];
function check(ok, what) {
  console.log((ok ? "ok   " : "FAIL ") + what);
  if (!ok) failures.push(what);
  return ok;
}
const uniq = (values) => [...new Set(values)].join("/") || "none";
// The focused element, described.
const focused = (page) =>
  page.evaluate(() => {
    const el = window.document.activeElement;
    if (!el) return null;
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      fp: el.dataset?.fp ?? null,
      modalName: el.dataset?.modal ?? null,
      inModal: !!el.closest("#modal"),
      role: el.getAttribute("role"),
      pressed: el.getAttribute("aria-pressed"),
    };
  });
// The computed value of one property on every element a selector matches.
const computed = (page, selector, property) =>
  page.evaluate(
    ([selector, property]) =>
      [...window.document.querySelectorAll(selector)].map((el) =>
        window.getComputedStyle(el).getPropertyValue(property),
      ),
    [selector, property],
  );
// Every match has the expected computed value; with atLeastOne, no match is a failure.
async function checkComputed(
  page,
  selector,
  property,
  expected,
  { atLeastOne = true, what = "" } = {},
) {
  const values = await computed(page, selector, property);
  check(
    (values.length > 0 || !atLeastOne) &&
      values.every((value) => value === expected),
    (what ? what + ": " : "") +
      property +
      " " +
      expected +
      " on " +
      selector +
      " (" +
      values.length +
      " elements: " +
      uniq(values) +
      ")",
  );
}
// The live region as it stands; marks the element the first time so a later call can tell it is the same one.
const liveRegion = (page) =>
  page.evaluate(() => {
    const all = window.document.querySelectorAll("#live");
    const el = all[0];
    if (!el) return { count: 0 };
    const same = el.__a11y === true;
    el.__a11y = true;
    const style = window.getComputedStyle(el);
    return {
      count: all.length,
      same,
      text: el.textContent,
      live: el.getAttribute("aria-live"),
      atomic: el.getAttribute("aria-atomic"),
      display: style.display,
      visibility: style.visibility,
      inert: !!el.closest("[inert]"),
    };
  });
function checkLiveRegionAttributes(live, what) {
  check(live.count === 1, what + ": exactly one #live (" + live.count + ")");
  check(
    live.live === "polite" && live.atomic === "true",
    what + ": aria-live polite, aria-atomic true",
  );
  check(
    live.display !== "none" && live.visibility !== "hidden",
    what +
      ": not hidden from assistive technology (display " +
      live.display +
      ", visibility " +
      live.visibility +
      ")",
  );
  check(!live.inert, what + ": not inside an inert subtree");
}
// 1. The live region exists, empty, on the setup screen.
async function checkLiveRegionOnSetupScreen(page) {
  const live = await liveRegion(page);
  checkLiveRegionAttributes(live, "setup screen live region");
  check(
    live.text === "",
    "setup screen live region: empty before the first log line (" +
      JSON.stringify(live.text) +
      ")",
  );
}
// The last focusable element of the modal, by the same query the Tab trap uses.
const focusLastInModal = (page) =>
  page.evaluate(() => {
    const focusable = [
      ...window.document.querySelectorAll(
        '#modal button,#modal [href],#modal input,#modal select,#modal textarea,#modal [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (candidate) => !candidate.disabled && candidate.offsetParent !== null,
    );
    const last = focusable.at(-1);
    last.focus();
    return last.id || last.dataset.fp || last.tagName.toLowerCase();
  });
const svgLabel = (page) =>
  page.$eval("#modal svg", (el) => el.getAttribute("aria-label"));
const pressedTabs = (page) =>
  page.$$eval(SEL.FLOW_TAB_ON, (els) => els.map((el) => el.dataset.fp));
// A tab activated by a key: focus lands back on it, it alone is pressed, the diagram changed.
async function activateTab(page, key, keyName) {
  const before = await svgLabel(page);
  await page.focus(SEL.flowTab(key));
  await page.keyboard.press(keyName);
  const f = await focused(page);
  check(
    f?.fp === key,
    keyName +
      " on tab " +
      key +
      ": focus back on it (" +
      JSON.stringify(f) +
      ")",
  );
  const pressed = await pressedTabs(page);
  check(
    pressed.length === 1 && pressed[0] === key,
    keyName +
      " on tab " +
      key +
      ": aria-pressed on it alone (" +
      uniq(pressed) +
      ")",
  );
  const after = await svgLabel(page);
  check(
    after !== before,
    keyName + " on tab " + key + ": diagram changed (" + after + ")",
  );
}
// The diagram/text toggle by a key: focus stays, aria-pressed flips, the view changes.
async function toggleFlowView(page, keyName) {
  const before = await page.$eval(SEL.FLOW_TOGGLE, (el) =>
    el.getAttribute("aria-pressed"),
  );
  await page.focus(SEL.FLOW_TOGGLE);
  await page.keyboard.press(keyName);
  const f = await focused(page);
  const pressed = f?.pressed;
  const text = !!(await page.$("#modal .flowtext"));
  const diagram = !!(await page.$(SEL.FLOW_WRAP));
  check(
    f?.id === "flowToggle" && pressed !== before,
    keyName +
      " on the toggle: focus stays and aria-pressed flips (" +
      before +
      " → " +
      pressed +
      ")",
  );
  check(
    (pressed === "true") === text && (pressed === "true") !== diagram,
    keyName +
      " on the toggle: text view " +
      text +
      ", diagram " +
      diagram +
      " match aria-pressed " +
      pressed,
  );
}
// 3. The flowchart modal by keyboard: open, focus order, tab activation, the toggle, the Tab trap, Escape.
async function checkFlowModalKeyboard(page) {
  await page.focus(SEL.modal("flow"));
  await page.keyboard.press("Enter");
  await page.waitForSelector(SEL.MODAL);
  let f = await focused(page);
  check(
    f?.id === "mtitle",
    "flow modal opened by Enter: focus on the title (" +
      JSON.stringify(f) +
      ")",
  );
  await page.keyboard.press("Tab");
  f = await focused(page);
  check(f?.id === "mclose", "Tab: Close (" + JSON.stringify(f) + ")");
  const tabs = await page.$$eval(SEL.FLOW_TAB, (els) =>
    els.map((el) => el.dataset.fp),
  );
  check(tabs.length >= 2, "flow modal has tabs (" + tabs.length + ")");
  for (const key of tabs) {
    await page.keyboard.press("Tab");
    f = await focused(page);
    check(f?.fp === key, "Tab: tab " + key + " (" + JSON.stringify(f) + ")");
  }
  await page.keyboard.press("Tab");
  f = await focused(page);
  check(
    f?.role === "region",
    "Tab: the body region (" + JSON.stringify(f) + ")",
  );
  await page.keyboard.press("Tab");
  f = await focused(page);
  check(
    f?.id === "flowToggle",
    "Tab: the diagram/text toggle (" + JSON.stringify(f) + ")",
  );
  const current = (await pressedTabs(page))[0];
  const others = tabs.filter((key) => key !== current);
  await activateTab(page, others[0], "Enter");
  await activateTab(page, others[1] || others[0], "Space");
  await toggleFlowView(page, "Enter");
  await toggleFlowView(page, "Space");
  const last = await focusLastInModal(page);
  await page.keyboard.press("Tab");
  f = await focused(page);
  check(
    f?.id === "mclose",
    "Tab from the last focusable (" +
      last +
      ") wraps to Close (" +
      JSON.stringify(f) +
      ")",
  );
  await page.keyboard.press("Shift+Tab");
  f = await focused(page);
  check(
    (f?.id || f?.fp) === last,
    "Shift+Tab from Close wraps to " + last + " (" + JSON.stringify(f) + ")",
  );
  await page.keyboard.press("Escape");
  const after = await page.evaluate(() => ({
    modal: !!window.document.querySelector("#modal"),
    open: window.document.documentElement.classList.contains("modalOpen"),
    inert: window.document.querySelector("#app")?.hasAttribute("inert"),
  }));
  f = await focused(page);
  check(
    !after.modal && !after.open && !after.inert,
    "Escape: modal gone, page scrollable and not inert (" +
      JSON.stringify(after) +
      ")",
  );
  check(
    f?.modalName === "flow" && !f.inModal,
    "Escape: focus back on the Flowcharts button (" + JSON.stringify(f) + ")",
  );
}
// Focus the next button and press Enter until the game log grows. Returns whether it did.
async function answerByKeyboardUntilLogGrows(page) {
  const before = (await readState(page)).log.length;
  for (let i = 0; i < MAX_ANSWERS; i++) {
    const button = await nextAnswerOrPhaseButton(page);
    if (!button) return false;
    if ((await button.getAttribute("id")) === "bfOk")
      await page.check(SEL.BATTLE_NEAR_MORIA).catch(() => {});
    await button.focus();
    await page.keyboard.press("Enter");
    if ((await readState(page)).log.length > before) return true;
  }
  return false;
}
// 4. After a keyboard answer the live region holds the last log line, and it is still the one element from boot.
async function checkLiveRegionAfterKeyboardAnswer(page) {
  check(
    await answerByKeyboardUntilLogGrows(page),
    "an answer by keyboard added a log line",
  );
  const last = (await readState(page)).log.at(-1)?.text;
  const live = await liveRegion(page);
  checkLiveRegionAttributes(live, "live region after the answer");
  check(
    live.same,
    "live region after the answer: the element created at boot (not rebuilt)",
  );
  check(
    !!last && live.text === last,
    "live region holds the last log line: " + JSON.stringify(live.text),
  );
  const snapshot = await page.locator(SEL.LIVE_REGION).ariaSnapshot();
  if (snapshot.trim())
    check(
      snapshot.includes(last),
      "aria snapshot of the live region carries the line: " +
        JSON.stringify(snapshot.trim()),
    );
  else
    console.log(
      "note: the aria snapshot of the role-less live region is empty; checked its text only",
    );
}
// 5. Native controls follow the colour scheme: the media query alone, and data-theme overriding it either way.
async function checkDarkNativeControls(page) {
  const schemes = () =>
    page.evaluate(() => {
      const scheme = (el) =>
        window.getComputedStyle(el).getPropertyValue("color-scheme");
      const doc = window.document;
      return {
        html: scheme(doc.documentElement),
        selects: [...doc.querySelectorAll("select")].map(scheme),
        checkboxes: [...doc.querySelectorAll('input[type="checkbox"]')].map(
          scheme,
        ),
      };
    });
  const expect = async (what, value) => {
    const s = await schemes();
    check(
      s.selects.length > 0 && s.checkboxes.length > 0,
      what + ": the tracker has selects and checkboxes",
    );
    check(
      s.html === value &&
        s.selects.every((v) => v === value) &&
        s.checkboxes.every((v) => v === value),
      what +
        ": color-scheme " +
        value +
        " (html " +
        s.html +
        ", selects " +
        uniq(s.selects) +
        ", checkboxes " +
        uniq(s.checkboxes) +
        ")",
    );
  };
  const setTheme = (theme) =>
    page.evaluate((theme) => {
      const root = window.document.documentElement;
      if (theme) root.setAttribute("data-theme", theme);
      else root.removeAttribute("data-theme");
    }, theme);
  try {
    await page.emulateMedia({ colorScheme: "dark" });
    await expect("dark media, no data-theme", "dark");
    await setTheme("light");
    await expect("dark media, data-theme=light", "light");
    await page.emulateMedia({ colorScheme: "light" });
    await setTheme("dark");
    await expect("light media, data-theme=dark", "dark");
  } finally {
    await setTheme(null);
    await page.emulateMedia({ colorScheme: "light" });
    await expect("light media, no data-theme (cleanup)", "light");
  }
  console.log(
    "note: the open select popup is drawn by the browser and cannot be captured; the computed color-scheme is the guard",
  );
}
// Wheel at the end of a scrolled region: the page behind must not move. Returns false when the region does not overflow.
async function checkWheelStaysInRegion(page, selector, what) {
  const overflows = await page.$eval(
    selector,
    (el) => el.scrollHeight > el.clientHeight + 1,
  );
  if (!overflows) {
    console.log("note: " + what + " does not overflow; wheel check skipped");
    return false;
  }
  await page.hover(selector);
  const room = await page.evaluate(() => ({
    y: window.scrollY,
    down:
      window.document.documentElement.scrollHeight -
      window.innerHeight -
      window.scrollY,
  }));
  const down = room.down > 1; // wheel in the direction the page still has room to scroll
  await page.$eval(
    selector,
    (el, down) => {
      el.scrollTop = down ? el.scrollHeight : 0;
    },
    down,
  );
  await page.mouse.wheel(0, down ? WHEEL_PX : -WHEEL_PX);
  await page.waitForTimeout(SETTLE_MS);
  const after = await page.evaluate(() => window.scrollY);
  check(
    after === room.y,
    what +
      ": wheel " +
      (down ? "down" : "up") +
      " at its end leaves the page at scrollY " +
      room.y +
      " (now " +
      after +
      ")",
  );
  return true;
}
const scrollY = (page) => page.evaluate(() => window.scrollY);
const scrollPageTo = (page, y) =>
  page.evaluate((y) => window.scrollTo(0, y), y);
// A header tool button clicked through the DOM, so the page is not scrolled to bring it into view first.
const clickHeaderButton = (page, name) =>
  page.evaluate(
    (selector) => window.document.querySelector(selector).click(),
    SEL.modal(name),
  );
// 6. Scroll chaining on the desktop: the game log, the walk trail and a modal's body keep the page still.
async function checkScrollChainingDesktop(page) {
  await page.evaluate((lines) => {
    window.QBUI.act(
      () => {
        for (let i = 1; i <= lines; i++)
          window.QB.log(window.QBUI.state, "a11y padding line " + i);
      },
      { action: "a11yPadLog" },
    );
  }, LOG_PAD_LINES);
  const pageScrolls = () =>
    page.evaluate(
      () =>
        window.document.documentElement.scrollHeight > window.innerHeight + 1,
    );
  if (!(await pageScrolls())) {
    await page.setViewportSize(SHORT_VIEWPORT);
    console.log("note: viewport shortened so the page scrolls");
  }
  check(await pageScrolls(), "the game screen is taller than the viewport");
  await scrollPageTo(page, 0);
  await page.hover(SEL.PAGE_TITLE);
  await page.mouse.wheel(0, WHEEL_PX);
  await page.waitForTimeout(SETTLE_MS);
  const control = await scrollY(page);
  if (
    !check(
      control > 0,
      "control: wheel over the page title scrolls the page (scrollY " +
        control +
        ")",
    )
  )
    return;
  await scrollPageTo(page, 0);
  await checkWheelStaysInRegion(page, SEL.LOG, "game log");
  // The trail of a short walk fits its box; a smaller max-height makes it overflow (its scroll containment is the point)
  const trailForced = await page.evaluate((height) => {
    const doc = window.document;
    doc.querySelector("details[data-key]").open = true;
    const trail = doc.querySelector(".trail");
    if (trail.scrollHeight <= trail.clientHeight + 1) {
      trail.style.maxHeight = height;
      return true;
    }
    return false;
  }, TRAIL_FORCED_HEIGHT);
  if (trailForced)
    console.log(
      "note: walk trail shortened to " +
        TRAIL_FORCED_HEIGHT +
        " so it overflows",
    );
  await checkWheelStaysInRegion(page, SEL.TRAIL, "walk trail");
  await scrollPageTo(page, PAGE_SCROLL_PX);
  const before = await scrollY(page);
  await clickHeaderButton(page, "glossary");
  await page.waitForSelector(SEL.MODAL_BODY);
  const opened = await page.evaluate(() => ({
    open: window.document.documentElement.classList.contains("modalOpen"),
    overflow: window.getComputedStyle(window.document.documentElement).overflow,
    y: window.scrollY,
  }));
  check(
    opened.open && opened.overflow === "hidden" && opened.y === before,
    "glossary open: html.modalOpen, overflow hidden, page still at scrollY " +
      before +
      " (" +
      JSON.stringify(opened) +
      ")",
  );
  await page.hover(SEL.MODAL_BODY);
  await page.$eval(SEL.MODAL_BODY, (el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.mouse.wheel(0, WHEEL_PX);
  await page.waitForTimeout(SETTLE_MS);
  const after = await scrollY(page);
  check(
    after === before,
    "wheel at the end of the glossary body leaves the page at scrollY " +
      before +
      " (now " +
      after +
      ")",
  );
  await checkComputed(page, SEL.MODAL_BODY, "overscroll-behavior-y", "contain");
  await checkComputed(page, SEL.TRAIL, "overscroll-behavior-y", "contain");
  await checkComputed(page, SEL.LOG, "overscroll-behavior-y", "contain");
  await page.click(SEL.MODAL_CLOSE);
  await clickHeaderButton(page, "flow");
  await page.waitForSelector(SEL.FLOW_WRAP);
  await checkComputed(page, SEL.FLOW_TABS, "overscroll-behavior-y", "contain");
  await checkComputed(page, SEL.FLOW_WRAP, "overscroll-behavior-y", "contain");
  await page.click(SEL.MODAL_CLOSE);
  await scrollPageTo(page, 0);
}
// A double tap through CDP with explicit timestamps, so latency cannot spread the taps past the double-tap window.
async function doubleTap(client, x, y) {
  const base = Date.now() / 1000;
  const [start1, end1, start2, end2] = TAP_INTERVAL_S.map((s) => base + s);
  const point = { x: Math.round(x), y: Math.round(y) };
  const send = (type, touchPoints, timestamp) =>
    client.send("Input.dispatchTouchEvent", { type, touchPoints, timestamp });
  await send("touchStart", [point], start1);
  await send("touchEnd", [], end1);
  await send("touchStart", [point], start2);
  await send("touchEnd", [], end2);
}
const visualScale = (page) => page.evaluate(() => window.visualViewport.scale);
async function centreOf(page, selector) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
// The double-tap probe: only when a double tap on the control (touch-action auto) zooms is the stepper held to 1.
async function checkDoubleTapProbe(page) {
  await checkComputed(page, SEL.PAGE_TITLE, "touch-action", "auto", {
    what: "control",
  });
  const client = await page.context().newCDPSession(page);
  const title = await centreOf(page, SEL.PAGE_TITLE);
  await doubleTap(client, title.x, title.y);
  await page.waitForTimeout(ZOOM_SETTLE_MS);
  const controlScale = await visualScale(page);
  if (controlScale === 1) {
    console.log(
      "note: double-tap zoom not reproducible here (control scale 1); computed touch-action is the guard",
    );
    await client.detach();
    return;
  }
  console.log("double tap on the control zoomed to " + controlScale);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  const stepper = await centreOf(page, SEL.RINGS_INCREASE);
  await doubleTap(client, stepper.x, stepper.y);
  await page.waitForTimeout(ZOOM_SETTLE_MS);
  const stepperScale = await visualScale(page);
  check(
    stepperScale === 1,
    "double tap on the rings stepper does not zoom (scale " +
      stepperScale +
      ")",
  );
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await client.detach();
}
// The touch screen: touch-action on every tap target, the tap pipeline, the double-tap probe, modal containment.
async function checkTouch() {
  const { page, errors, close } = await launchBuiltPage({
    viewport: VIEWPORT.PHONE_SMALL,
    touch: true,
    captureErrors: true,
  });
  await startGameAtSetupPrompt(page);
  await answerAll(page); // the Setup walk done, then Phase 1, so the dice pool and glossary terms are on the screen
  await page.click(SEL.phase("p1"));
  await answerAll(page);
  for (const [selector, atLeastOne] of [
    [".btn", true],
    [".stepper button", true],
    ["select", true],
    [".die", false],
    ["summary", false],
    [".term", false],
  ])
    await checkComputed(page, selector, "touch-action", "manipulation", {
      atLeastOne,
      what: "touch",
    });
  const ringsBefore = (await readState(page)).board.rings;
  await page.tap(SEL.RINGS_INCREASE);
  const ringsAfter = (await readState(page)).board.rings;
  check(
    ringsAfter === ringsBefore + 1,
    "control: a tap on the rings stepper acts (" +
      ringsBefore +
      " → " +
      ringsAfter +
      ")",
  );
  await checkDoubleTapProbe(page);
  await openFromToolsMenu(page, "glossary");
  await page.waitForSelector(SEL.MODAL_BODY);
  const opened = await page.evaluate(() => ({
    open: window.document.documentElement.classList.contains("modalOpen"),
    overflow: window.getComputedStyle(window.document.documentElement).overflow,
  }));
  check(
    opened.open && opened.overflow === "hidden",
    "touch glossary open: html.modalOpen with overflow hidden (" +
      JSON.stringify(opened) +
      ")",
  );
  await checkComputed(
    page,
    SEL.MODAL_BODY,
    "overscroll-behavior-y",
    "contain",
    {
      what: "touch glossary",
    },
  );
  await page.click(SEL.MODAL_CLOSE);
  await openFromToolsMenu(page, "flow");
  await page.waitForSelector(SEL.FLOW_TABS);
  check(
    !!(await page.$("#modal .flowtext")),
    "touch flow modal opens in the text view",
  );
  await checkComputed(page, SEL.FLOW_TABS, "overscroll-behavior-y", "contain", {
    what: "touch flow",
  });
  await page.click(SEL.FLOW_TOGGLE);
  await page.waitForSelector(SEL.FLOW_WRAP);
  await checkComputed(page, SEL.FLOW_WRAP, "overscroll-behavior-y", "contain", {
    what: "touch flow",
  });
  await page.click(SEL.MODAL_CLOSE);
  console.log(
    "note: a touch swipe is not exercised: with html overflow hidden the page cannot move under any input; the wheel and computed-style checks are the guard",
  );
  await close();
  return errors;
}
async function main() {
  const desktop = await launchBuiltPage({ captureErrors: true });
  await checkLiveRegionOnSetupScreen(desktop.page);
  await startGameAtSetupPrompt(desktop.page);
  await checkFlowModalKeyboard(desktop.page);
  await checkLiveRegionAfterKeyboardAnswer(desktop.page);
  await checkDarkNativeControls(desktop.page);
  await checkScrollChainingDesktop(desktop.page);
  await desktop.close();
  const errors = desktop.errors.concat(await checkTouch());
  const problems = failures.map((failure) => "FAIL " + failure).concat(errors);
  console.log(
    problems.length
      ? "PROBLEMS:\n" + problems.join("\n")
      : "a11y: every check passed, no page errors",
  );
  process.exit(problems.length ? 1 : 0);
}
await main();
