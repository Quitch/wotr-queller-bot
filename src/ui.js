// ===== UI =====
(function () {
  const engine = window.QB,
    FLOW = window.QB_FLOW,
    NODE = window.QB_NODE,
    NODE_KIND = window.QB_NODE_KIND,
    { DECK, DIE_KIND, STRATEGY, PHASE, CARD, FP_STANCE } = window.QB,
    cardById = engine.cardById,
    GLOSSARY = window.QB_GLOSSARY,
    debug = window.QB_DEBUG;
  let state = null,
    history = [],
    modal = null,
    shownCard = null;
  const find = (selector) => document.querySelector(selector);
  const escapeHTML = (text) =>
    String(text).replace(
      /[&<>"]/g,
      (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
    );
  function termKey(term) {
    term = term.toLowerCase().replace(/\s+/g, " ").trim();
    if (GLOSSARY[term]) return term;
    if (window.QB_GLOSSARY_ALIASES[term])
      return window.QB_GLOSSARY_ALIASES[term];
    const singular = term.replace(/s$/, "");
    if (GLOSSARY[singular]) return singular;
    return null;
  }
  // Card and flowchart text as HTML: *term* becomes a glossary button (or italics when the glossary has no entry), newlines become <br>.
  function formatText(text) {
    if (text == null) return "";
    return escapeHTML(text)
      .replace(/\*([^*]+)\*/g, (match, term) => {
        const key = termKey(term);
        return key
          ? '<button type="button" class="term" data-term="' +
              key +
              '" aria-describedby="tip">' +
              term +
              "</button>"
          : "<i>" + term + "</i>";
      })
      .replaceAll("\n", "<br>");
  }
  function stripMarkup(text) {
    return String(text || "").replaceAll("*", "");
  }

  // ---------- persistence ----------
  const STORAGE_KEY = {
    AUTOSAVE: "qb.autosave",
    BROKEN_AUTOSAVE: "qb.autosave.broken",
    SLOTS: "qb.slots",
    OPTIONS: "qb.opts",
    DEBUG: "qb.debug",
    PROBE: "qb.probe",
  };
  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
  function snapshot() {
    history.push(JSON.stringify(state));
    if (history.length > 60) history.shift();
  }
  function commit() {
    if (state) state.appVersion = engine.VERSION;
    storageSet(STORAGE_KEY.AUTOSAVE, JSON.stringify(state));
    render();
  }
  // Every change to the game goes through here. `info` names the action for the debug log ({a:"answer", ...}).
  // If the action throws, the game is put back as it was before it, the error is recorded and the error bar offers a debug log.
  function act(fn, info) {
    snapshot();
    debug.begin(info || { a: "act" }, state);
    try {
      fn();
    } catch (error) {
      const brokenState = state;
      state = JSON.parse(history.pop());
      debug.error(error, { a: "actionFailed", rolledBack: true }, brokenState);
      commit();
      showErrBar();
      return;
    }
    debug.finishAction(state);
    commit();
  }
  function undo() {
    if (!history.length) return;
    debug.begin({ a: "undo" }, state);
    state = JSON.parse(history.pop());
    debug.finishAction(state);
    commit();
  }
  function loadJSON(text) {
    const save = JSON.parse(text);
    if (!save?.settings || !save.board) throw new Error("not a Queller save");
    return engine.migrate(save);
  }

  // ---------- boot ----------
  function boot() {
    debug.restore({
      get: () => storageGet(STORAGE_KEY.DEBUG),
      set: (text) => storageSet(STORAGE_KEY.DEBUG, text),
    });
    window.addEventListener("error", (event) => {
      debug.error(
        event.error || event.message,
        {
          a: "uncaught",
          src: event.filename ? String(event.filename).split("/").pop() : null,
          line: event.lineno,
          col: event.colno,
        },
        state,
      );
      showErrBar();
    });
    window.addEventListener("unhandledrejection", (event) => {
      debug.error(
        event.reason || "unhandled promise rejection",
        { a: "unhandledrejection" },
        state,
      );
      showErrBar();
    });
    const autosaveText = storageGet(STORAGE_KEY.AUTOSAVE);
    let loadError = null;
    if (autosaveText) {
      try {
        state = loadJSON(autosaveText);
      } catch (error) {
        state = null;
        loadError = error;
      }
    }
    if (loadError) {
      storageSet(STORAGE_KEY.BROKEN_AUTOSAVE, autosaveText);
      debug.error(loadError, {
        a: "boot-load",
        note:
          "the autosave could not be parsed; kept under " +
          STORAGE_KEY.BROKEN_AUTOSAVE,
      });
    }
    debug.action(
      {
        a: "pageLoad",
        autosave: !!autosaveText,
        restored: !!state,
        broken: !!storageGet(STORAGE_KEY.BROKEN_AUTOSAVE),
      },
      state,
    );
    document.documentElement.lang = document.documentElement.lang || "en";
    tipEl = document.createElement("div");
    tipEl.id = "tip";
    tipEl.hidden = true;
    tipEl.setAttribute("role", "tooltip");
    tipEl.addEventListener("mouseleave", hideTip);
    document.body.appendChild(tipEl);
    document.body.addEventListener("mouseover", (event) => {
      const term = event.target.closest(".term");
      if (term) showTip(term);
    });
    document.body.addEventListener("mouseout", (event) => {
      const term = event.target.closest(".term");
      if (term && !event.relatedTarget?.closest?.("#tip")) hideTip();
    });
    document.body.addEventListener("focusin", (event) => {
      const term = event.target.closest(".term");
      if (term) showTip(term);
    });
    document.body.addEventListener("focusout", (event) => {
      if (event.target.closest(".term")) hideTip();
    });
    document.body.addEventListener("click", (event) => {
      const term = event.target.closest(".term");
      if (term) {
        hideTip();
        openModal("glossary", term.dataset.term);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (tipEl && !tipEl.hidden) {
          hideTip();
          event.stopPropagation();
          return;
        }
        if (modal) closeModal();
      }
    });
    try {
      render();
    } catch (error) {
      console.error(
        "Queller Runner: could not render the saved game — starting at the New game screen.",
        error,
      );
      storageSet(
        STORAGE_KEY.BROKEN_AUTOSAVE,
        storageGet(STORAGE_KEY.AUTOSAVE) || "",
      );
      debug.error(
        error,
        {
          a: "boot-render",
          note:
            "the saved game could not be rendered; kept under " +
            STORAGE_KEY.BROKEN_AUTOSAVE,
        },
        state,
      );
      state = null;
      history = [];
      render();
      showErrBar();
    }
  }
  // A bar above the app after an error: the game carries on (a failed action was rolled back) and a debug log is one tap away.
  function showErrBar() {
    let bar = document.getElementById("errbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "errbar";
      bar.setAttribute("role", "alert");
      document.body.prepend(bar);
    }
    const count = debug.errors.length,
      last = debug.errors[count - 1];
    bar.innerHTML =
      '<div class="wrap"><span class="msg"><b>Something went wrong in the app</b> — ' +
      escapeHTML(last ? last.message : "an error was recorded") +
      (last?.rolledBack
        ? ". Your last action was undone; the game continues."
        : ".") +
      " Please export a debug log and send it with a description of what you were doing.</span>" +
      '<span class="eb"><button type="button" class="btn small" id="errbarLog">Export debug log</button><button type="button" class="btn small ghost" id="errbarClose" aria-label="Dismiss this message">Dismiss</button></span></div>';
    document.getElementById("errbarLog").onclick = () => openModal("debug");
    document.getElementById("errbarClose").onclick = () => bar.remove();
  }
  let tipEl = null;
  function showTip(term) {
    const key = term.dataset.term;
    if (!GLOSSARY[key]) return;
    tipEl.innerHTML =
      "<b>" +
      escapeHTML(key) +
      "</b>" +
      escapeHTML(GLOSSARY[key]).replace(/\*([^*]+)\*/g, "<i>$1</i>");
    const rect = term.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    tipEl.style.maxWidth = width + "px";
    let x = Math.min(rect.left, window.innerWidth - width - 12),
      y = rect.bottom + 8;
    tipEl.style.left = Math.max(8, x) + "px";
    tipEl.style.top = y + "px";
    tipEl.hidden = false;
    const height = tipEl.offsetHeight;
    if (y + height > window.innerHeight - 8)
      tipEl.style.top = Math.max(8, rect.top - height - 8) + "px";
  }
  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  // ---------- render ----------
  function focusKey(el) {
    if (!el || el === document.body) return null;
    if (el.id) return "#" + el.id;
    for (const attr of [
      "data-phase",
      "data-ans",
      "data-card",
      "data-t",
      "data-step",
      "data-modal",
      "data-t-reset",
    ]) {
      if (el.hasAttribute(attr))
        return (
          "[" +
          attr +
          '="' +
          el.getAttribute(attr) +
          '"]' +
          (el.dataset.d === undefined
            ? ""
            : '[data-d="' + el.dataset.d + '"]') +
          (el.dataset.id === undefined
            ? ""
            : '[data-id="' + el.dataset.id + '"]')
        );
    }
    return null;
  }
  function render() {
    const root = find("#app");
    hideTip();
    const prevKey = focusKey(document.activeElement),
      prevWasAnswer = document.activeElement?.dataset?.ans !== undefined;
    const openMore = [...root.querySelectorAll("details.more")].map(
      (details) => details.open,
    );
    if (!state) {
      root.innerHTML = setupHTML();
      wireSetup();
      return;
    }
    root.innerHTML = gameHTML();
    wire();
    root.querySelectorAll("details.more").forEach((details, i) => {
      if (openMore[i]) details.open = true;
    });
    const live = find("#live");
    const last = state.log[state.log.length - 1];
    if (live && last && state.walk) live.textContent = last.t;
    if (prevWasAnswer || (state.walk?.prompt && !prevKey)) {
      const focusTarget = find(".prompt, .result");
      if (focusTarget) focusTarget.focus();
    } else if (prevKey) {
      const el = root.querySelector(prevKey);
      if (el) el.focus();
    }
    if (modal) renderModal();
  }
  // The game screen: header, the dice and cards panels, the walkthrough, the board tracker and the footer.
  // With the full board tracker on, the dice and cards panels sit under the walkthrough in the left column; otherwise they share a top row.
  function gameHTML() {
    const below = state.settings.tracker;
    const panels =
      (state.settings.dice ? diceHTML() : "") +
      (state.settings.cards ? cardsHTML() : "");
    const top = below ? "" : panels;
    const trackerPanel = trackerHTML();
    const body =
      (top
        ? '<div class="toprow" aria-label="Queller’s dice and cards">' +
          top +
          "</div>"
        : "") +
      '<div class="grid' +
      (trackerPanel ? "" : " nowalk") +
      '"><main id="main" tabindex="-1" aria-label="Walkthrough">' +
      walkHTML(below ? panels : "") +
      "</main>" +
      (trackerPanel
        ? '<aside class="side" aria-label="Board tracker">' +
          trackerPanel +
          "</aside>"
        : "") +
      "</div>";
    return (
      '<a class="skip" href="#main">Skip to the walkthrough</a>' +
      headerHTML() +
      body +
      footerHTML() +
      '<div id="live" class="sr" aria-live="polite" aria-atomic="true"></div>'
    );
  }
  const LEGAL =
    '<p><b>You need a copy of War of the Ring (2nd Edition) to play.</b> This app runs the Queller Bot; it does not replace the board, figures, dice or cards. With the Warriors of Middle-earth option on, you also need that expansion.</p><p>Queller Bot for War of the Ring © Quitch, licensed under <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">Creative Commons Attribution-NonCommercial 4.0 International<span class="sr"> (opens in a new tab)</span></a>. Bot text, flowcharts and rules reproduced with the author’s permission; <a href="https://boardgamegeek.com/filepage/141333/queller-bot-solo-play" target="_blank" rel="noopener">file page on BoardGameGeek<span class="sr"> (opens in a new tab)</span></a>.</p><p>War of the Ring, Middle-earth and The Lord of the Rings and the characters, items, events, and places therein are trademarks of Middle-earth Enterprises, LLC used under license by Ares Games srl. War of the Ring Second Edition and Warriors of Middle-earth © Ares Games srl. Event card and Action die text is reproduced here only as a play aid for owners of the game. This is an unofficial fan-made tool and is not affiliated with, endorsed or sponsored by Ares Games or Middle-earth Enterprises.</p>';
  function footerHTML() {
    return (
      '<footer class="notice" aria-label="Licences and trademarks">' +
      LEGAL +
      "</footer>"
    );
  }
  function setupHTML() {
    const settings = { dice: false, cards: false, tracker: false, wome: false };
    try {
      Object.assign(
        settings,
        JSON.parse(storageGet(STORAGE_KEY.OPTIONS) || "{}"),
      );
    } catch {}
    return (
      '<div class="top"><div class="brand"><h1>Queller Bot Runner</h1><span class="sub">Shadow player · War of the Ring 2nd Ed.</span></div></div>' +
      '<div class="setup"><h2 style="font-size:1.3rem;margin-bottom:6px">New game</h2><p class="notice" style="max-width:none">Choose which parts of the bot the app should run for you. Each part works on its own — turn off anything you would rather keep on the table.</p>' +
      optionHTML("dice", {
        title: "Roll and track Queller’s dice",
        description:
          "Rolls the Shadow Action dice (and the Faction die) and keeps the Hunt box.",
        whenOn:
          "the walkthrough takes or skips options by the dice Queller actually has.",
        whenOff:
          "you roll for Queller, and the walkthrough asks which dice are available.",
        checked: settings.dice,
      }) +
      optionHTML("cards", {
        title: "Draw and hold Queller’s cards",
        description:
          "Shuffles the Character, Strategy and Faction Event decks, draws, and discards by the priority lists.",
        whenOn:
          "you only see how many cards Queller holds — a card is shown when a flowchart needs to know whether it is *playable*, or when it is played.",
        whenOff:
          "you hold Queller’s cards yourself, and the walkthrough asks about them.",
        checked: settings.cards,
      }) +
      optionHTML("tracker", {
        title: "Track board state in the app",
        description: "A trade-off. The app always walks the flowcharts.",
        whenOn:
          "you keep a board tracker up to date (Fellowship, characters, Political Track, nations, factions) and the app answers every board question from it.",
        whenOff:
          "no tracker to maintain, but every question about the board is put to you.",
        checked: settings.tracker,
      }) +
      '<h4 style="margin-top:18px">Expansions</h4>' +
      optionHTML("wome", {
        title: "Warriors of Middle-earth",
        description:
          "Adds the Faction Event deck, Call to Battle cards, the Faction die and the “– WoME –” decisions.",
        whenOn:
          "the “– WoME –” decisions are asked and the faction cards and die are in play.",
        whenOff: "those decisions are answered No and skipped.",
        checked: settings.wome,
      }) +
      '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button class="btn primary" id="start">Start game</button><button class="btn" id="loadBtn">Load a saved game</button><button class="btn ghost" id="debugBtn">Export debug log</button></div>' +
      (storageGet(STORAGE_KEY.BROKEN_AUTOSAVE)
        ? '<p class="notice" role="status" style="margin-top:12px;color:var(--bad)">An earlier game could not be shown after the page reloaded, so the app started here. That game is kept in the debug log — please export it and send it with a description of what happened. Starting a new game clears it.</p>'
        : "") +
      '<div id="loadArea" hidden style="margin-top:14px"></div>' +
      '<footer class="notice">' +
      LEGAL +
      "</footer></div>"
    );
  }
  // One New-game option: a checkbox with its title, description and what happens when it is on or off.
  function optionHTML(id, { title, description, whenOn, whenOff, checked }) {
    return (
      '<label class="opt"><input type="checkbox" id="opt-' +
      id +
      '" ' +
      (checked ? "checked" : "") +
      "><div><b>" +
      title +
      "</b><span>" +
      formatText(description) +
      '<span class="oo"><b>On:</b> ' +
      formatText(whenOn) +
      '</span><span class="oo"><b>Off:</b> ' +
      formatText(whenOff) +
      "</span></span></div></label>"
    );
  }
  function wireSetup() {
    find("#start").onclick = () => {
      const settings = {};
      ["dice", "cards", "tracker", "wome"].forEach(
        (key) => (settings[key] = find("#opt-" + key).checked),
      );
      storageSet(STORAGE_KEY.OPTIONS, JSON.stringify(settings));
      storageSet(STORAGE_KEY.BROKEN_AUTOSAVE, "");
      debug.begin({ a: "newGame", settings }, null);
      state = engine.newState(settings);
      history = [];
      engine.log(state, "New game. Roll for Queller’s starting strategy.");
      debug.finishAction(state);
      commit();
    };
    find("#loadBtn").onclick = () => {
      const area = find("#loadArea");
      area.hidden = false;
      area.innerHTML = loadHTML();
      wireLoad(area);
    };
    find("#debugBtn").onclick = () => openModal("debug");
  }
  function headerHTML() {
    const phaseLabel =
      {
        setup: "Setup",
        p1: "Phase 1",
        p2: "Phase 2",
        p3: "Phase 3",
        p4: "Phase 4",
        p5: "Phase 5",
        p6: "Phase 6",
      }[state.phase] || state.phase;
    return (
      '<header class="top"><div class="brand"><h1>Queller Bot Runner</h1><span class="sub">Shadow player</span></div>' +
      '<div class="status"><span class="chip">Turn <b>' +
      state.turn +
      "</b></span>" +
      '<span class="chip">' +
      phaseLabel +
      "</span>" +
      (state.strategy
        ? '<span class="chip strat-' +
          state.strategy +
          '">' +
          capitalize(state.strategy) +
          " strategy</span>"
        : "") +
      (state.settings.wome
        ? '<span class="chip"><abbr title="Warriors of Middle-earth">WoME</abbr></span>'
        : "") +
      "</div>" +
      '<nav class="tools" aria-label="Tools"><button class="btn" id="undoBtn" ' +
      (history.length ? "" : "disabled") +
      ' title="Undo the last action">Undo</button><button class="btn" data-modal="save">Save / Load</button><button class="btn" data-modal="glossary">Glossary</button><button class="btn" data-modal="flow">Flowcharts</button><button class="btn" data-modal="rules">Rules</button><button class="btn" data-modal="calc">Army value</button><button class="btn" data-modal="help">Help</button><button class="btn ghost" data-modal="settings">Settings</button><button class="btn ghost" id="newGameBtn">New game</button></nav></header>'
    );
  }
  const capitalize = (text) =>
    text ? text[0].toUpperCase() + text.slice(1) : "";

  // ---------- walk panel ----------
  function walkHTML(extra) {
    let html =
      '<section class="panel" aria-labelledby="h-walk"><h2 class="ph" id="h-walk">Walkthrough</h2>';
    html += phaseButtonsHTML();
    const walk = state.walk;
    if (walk && !walk.done) {
      html += promptHTML(walk);
    } else if (walk?.done) {
      html += resultHTML(walk);
    } else html += '<div class="idle">' + idleText() + "</div>";
    if (walk)
      html +=
        "<details " +
        (walk.done ? "" : "open") +
        "><summary>Walk trail — " +
        escapeHTML(FLOW[walk.entry.page].name) +
        " from “" +
        escapeHTML(engine.normalizeText(walk.entry.start)) +
        "” (" +
        walk.trail.length +
        " steps)</summary>" +
        trailHTML(walk) +
        "</details>";
    html += "</section>" + (extra || "") + logHTML();
    return html;
  }
  // The data-phase values of the walkthrough's buttons: a phase to start, or one of these.
  const PHASE_ACTION = {
    ABANDON: "abandon",
    NEXT_TURN: "next",
    JUMP_TO: "jumpto",
    BATTLE_1: "battle1",
    BATTLE_2: "battle2",
  };
  function idleText() {
    switch (state.phase) {
      case PHASE.SETUP:
        return "Roll a die to choose Queller’s starting strategy (Start of game box).";
      case PHASE.P1:
        return "Phase 1: recover Queller’s dice, draw cards and check the hand limit.";
      case PHASE.P2:
        return state.strategy === STRATEGY.CORRUPTION
          ? "Phase 2: declare or hide your Fellowship, then check whether Queller changes strategy."
          : "Phase 2: declare or hide your Fellowship. The military strategy has nothing to do here.";
      case PHASE.P3:
        return "Phase 3: Queller allocates dice to the Hunt box.";
      case PHASE.P4:
        return "Phase 4: roll Queller’s remaining dice (Eyes go to the Hunt box). Roll your own dice too.";
      case PHASE.P5:
        return "Phase 5: you act first. Each time Queller is eligible to act, walk from “Phase 5”. Walk the Battle page for each combat round.";
      case PHASE.P6:
        return "Phase 6: victory check.";
    }
    return "";
  }
  const phaseBtn = (id, label, primary) =>
    '<button class="btn ' +
    (primary ? "primary" : "") +
    '" data-phase="' +
    id +
    '">' +
    label +
    "</button>";
  // The start-point buttons offered in each phase (the military strategy has no Phase 2).
  const PHASE_BUTTONS = {
    [PHASE.SETUP]: () => [phaseBtn(PHASE.SETUP, "Start of game", true)],
    [PHASE.P1]: () => [phaseBtn(PHASE.P1, "Phase 1", true)],
    [PHASE.P2]: () => [
      state.strategy === STRATEGY.CORRUPTION
        ? phaseBtn(PHASE.P2, "Phase 2", true)
        : phaseBtn(PHASE.P3, "Phase 3", true),
    ],
    [PHASE.P3]: () => [phaseBtn(PHASE.P3, "Phase 3", true)],
    [PHASE.P4]: () => [phaseBtn(PHASE.P4, "Phase 4", true)],
    [PHASE.P5]: () => {
      const buttons = [
        dicePoolSpent()
          ? phaseBtn(PHASE.P6, "Phase 6", true)
          : phaseBtn(PHASE.P5, "Phase 5", true),
        state.battleOpen
          ? phaseBtn(PHASE_ACTION.BATTLE_2, "Battle (next round)")
          : phaseBtn(PHASE_ACTION.BATTLE_1, "Battle"),
      ];
      if (!state.settings.dice) buttons.push(phaseBtn(PHASE.P6, "Phase 6"));
      return buttons;
    },
    [PHASE.P6]: () => [
      phaseBtn(
        PHASE_ACTION.NEXT_TURN,
        "Phase 1 (turn " + (state.turn + 1) + ")",
        true,
      ),
    ],
  };
  function phaseButtonsHTML() {
    const buttons = [];
    const phase = state.phase;
    const busy = state.walk && !state.walk.done;
    if (busy) {
      buttons.push(
        '<button class="btn small ghost" data-phase="' +
          PHASE_ACTION.ABANDON +
          '">Abandon this walk</button>',
      );
    } else if (PHASE_BUTTONS[phase]) buttons.push(...PHASE_BUTTONS[phase]());
    if (!busy && phase !== PHASE.SETUP)
      buttons.push(
        '<button class="btn small ghost" data-phase="' +
          PHASE_ACTION.JUMP_TO +
          '">Other start point…</button>',
      );
    return (
      '<div class="phasebar"><span class="lbl">' +
      (busy ? "Walking" : "Start point") +
      "</span>" +
      buttons.join("") +
      "</div>"
    );
  }
  // With dice tracked, Phase 6 replaces Phase 5 once Queller has no usable die left (available or set aside for a minion).
  function dicePoolSpent() {
    const DIE_STATE = engine.DIE_STATE;
    return (
      state.settings.dice &&
      state.dice.pool.length > 0 &&
      !state.dice.pool.some(
        (die) => die.st === DIE_STATE.AVAIL || die.st === DIE_STATE.RESERVED,
      )
    );
  }
  const NODE_KIND_NAME = {
    [NODE_KIND.START]: "Start point",
    [NODE_KIND.ACTION]: "Action",
    [NODE_KIND.DECISION]: "Decision",
    [NODE_KIND.FOLLOW_UP]: "Follow-up decision",
    [NODE_KIND.JUMP]: "Jump",
    [NODE_KIND.PRIORITY]: "Priority list",
    [NODE_KIND.STEP]: "Step",
    [NODE_KIND.NOTE]: "Note",
  };
  function promptHTML(walk) {
    const prompt = walk.prompt,
      page = FLOW[walk.page],
      node = page.nodes[walk.node] || [NODE_KIND.DECISION];
    const kind = prompt.kind || NODE.kind(node) || NODE_KIND.DECISION;
    const eyebrow =
      '<div class="eyebrow"><span class="sw" style="background:var(--n' +
      kind +
      ')"></span>' +
      escapeHTML(page.name) +
      " · " +
      (NODE_KIND_NAME[kind] || "") +
      (walk.die
        ? " · " + escapeHTML(engine.DIE_REQUIREMENT_NAME[walk.die]) + " die"
        : "") +
      (walk.mode === "ringAny" ? " · ring search" : "") +
      "</div>";
    let body = "",
      answers = "";
    const yesNoButtons = () =>
      '<button class="btn yes" data-ans="yes">Yes</button><button class="btn no" data-ans="no">No</button>';
    switch (prompt.type) {
      case "yesno": {
        const isRing = prompt.bold || (NODE.extra(node).bold && !prompt.sub);
        body =
          (prompt.board ? '<div class="eyebrow">Board question</div>' : "") +
          '<p class="q">' +
          (isRing ? ringIcon() + " " : "") +
          formatText(prompt.text) +
          "?</p>" +
          (isRing
            ? '<div class="bold-note">Elven Ring condition: if it is true and Queller lacks the die the next step needs, it uses an Elven Ring (rule 36).</div>'
            : "") +
          (prompt.items
            ? "<ol>" +
              prompt.items
                .map((item) => "<li>" + formatText(item) + "</li>")
                .join("") +
              "</ol>"
            : "");
        answers = yesNoButtons();
        break;
      }
      case "count":
        body =
          '<div class="eyebrow">Board question</div><p class="q">' +
          formatText(prompt.text) +
          '</p><p><label for="cnt">Number</label> <input type="number" id="cnt" class="askctl" min="' +
          prompt.min +
          '" max="' +
          prompt.max +
          '" value="' +
          (prompt.value | 0) +
          '" style="min-width:100px"></p>';
        answers = '<button class="btn yes" id="cntOk">Continue</button>';
        break;
      case "choice":
        body =
          '<div class="eyebrow">Priority list — you decide</div><p class="q">' +
          formatText(prompt.text) +
          "</p><ol>" +
          (prompt.items || [])
            .map((item) => "<li>" + formatText(item) + "</li>")
            .join("") +
          "</ol>";
        answers = prompt.options
          .map(
            (option) =>
              '<button class="btn" data-ans="' +
              escapeHTML(option.value) +
              '">' +
              escapeHTML(option.label) +
              "</button>",
          )
          .join("");
        break;
      case "situ":
        body =
          '<div class="eyebrow">Board check (for a card in Queller’s hand)</div><p class="q">' +
          formatText(prompt.text) +
          "</p>";
        answers = yesNoButtons();
        break;
      case "confirm":
        body =
          '<div class="eyebrow">' +
          (prompt.ctx === "combat" ? "Combat card" : "Card") +
          ' check — the condition on this card is met</div><p class="q">Is this card *playable* now? Every paragraph must be usable and have an effect (rule 17).</p>' +
          cardHTML(
            cardById[prompt.card],
            prompt.ctx === "combat" ? CARD_HALF.COMBAT : CARD_HALF.EVENT,
          );
        answers =
          '<button class="btn yes" data-ans="yes">Playable</button><button class="btn no" data-ans="no">Not playable</button>';
        break;
      case "diecheck":
        body =
          '<p class="q">' +
          formatText(prompt.text) +
          '</p><div class="help">Grey box: ' +
          escapeHTML(prompt.label) +
          "</div>";
        answers = yesNoButtons();
        break;
      case "ring":
        body = '<p class="q">' + formatText(prompt.text) + "</p>";
        answers =
          '<button class="btn yes" data-ans="yes">Ring used</button><button class="btn no" data-ans="no">No ring available</button>';
        break;
      case "action":
        body =
          '<p class="q">Queller: ' +
          formatText(prompt.text) +
          "</p>" +
          (prompt.help
            ? '<div class="help">' + formatText(prompt.help) + "</div>"
            : "") +
          (prompt.pass
            ? ""
            : '<div class="help">' + dieHelpText(walk) + "</div>");
        answers =
          '<button class="btn yes" data-ans="done">Done</button>' +
          (prompt.auto
            ? ""
            : '<button class="btn no" data-ans="no">Not possible (rule 29)</button>');
        break;
      case "playcard": {
        const card = cardById[prompt.card];
        body =
          '<p class="q">Queller plays a card' +
          (prompt.combat ? " as its combat card" : "") +
          ":</p>" +
          cardHTML(card) +
          (walk.steps?.length
            ? '<ol class="steps">' +
              walk.steps
                .map((step) => "<li>" + formatText(step) + "</li>")
                .join("") +
              "</ol>"
            : "") +
          '<div class="help">Resolve it with the matching decision page (rule 12). ' +
          (engine.staysOnTable(prompt.card) && !prompt.combat
            ? "It stays on the table until discarded."
            : "") +
          "</div>";
        answers = '<button class="btn yes" data-ans="done">Done</button>';
        break;
      }
      case "step":
        body =
          '<p class="q">' +
          formatText(prompt.text) +
          "</p>" +
          (prompt.items
            ? "<ol>" +
              prompt.items
                .map((item) => "<li>" + formatText(item) + "</li>")
                .join("") +
              "</ol>"
            : "");
        answers = prompt.move
          ? '<button class="btn yes" data-ans="done">Done</button><button class="btn no" data-ans="no">Not possible</button>'
          : '<button class="btn yes" data-ans="done">Continue</button>';
        break;
      case "roll":
        body = '<p class="q">' + formatText(prompt.text) + "</p>";
        answers = prompt.options
          .map(
            (option) =>
              '<button class="btn" data-ans="' +
              option +
              '">' +
              option +
              "</button>",
          )
          .join("");
        break;
      case "priority": {
        const half = walk.page === "BA" ? CARD_HALF.COMBAT : CARD_HALF.EVENT;
        body =
          '<p class="q">' +
          formatText(prompt.text) +
          "</p><ol>" +
          (prompt.items || [])
            .map((item) => "<li>" + formatText(item) + "</li>")
            .join("") +
          "</ol>" +
          (prompt.steps
            ? '<ol class="steps">' +
              prompt.steps
                .map((step) => "<li>" + formatText(step) + "</li>")
                .join("") +
              "</ol>"
            : "") +
          (prompt.card
            ? "<div><b>Chosen:</b> " +
              cardHTML(cardById[prompt.card], half) +
              "</div>"
            : "") +
          (prompt.choice
            ? "<p><b>Result:</b> " + escapeHTML(prompt.choice) + "</p>"
            : "") +
          (!prompt.steps && !prompt.card
            ? '<div class="help">Apply the list as filters (rule 30), then continue.</div>'
            : "");
        answers = '<button class="btn yes" data-ans="ok">Continue</button>';
        break;
      }
      case "battleForm":
        body = battleFormHTML(prompt);
        answers = '<button class="btn yes" id="bfOk">Start the round</button>';
        break;
    }
    return (
      '<div class="prompt k-' +
      kind +
      '" tabindex="-1" role="group" aria-label="Current step">' +
      eyebrow +
      body +
      '<div class="answers">' +
      answers +
      "</div></div>"
    );
  }
  // Touch-sized tracker rows shared by the board tracker, the battle form and the army value calculator.
  // attrs: extra attributes for the control (data-* hooks); id: the control's id (label target / aria-labelledby)
  function checkboxRowHTML(id, label, checked, attrs) {
    return (
      '<label class="row chk"><span><span class="lt">' +
      label +
      '</span></span><input type="checkbox" id="' +
      id +
      '" ' +
      (attrs || "") +
      (checked ? " checked" : "") +
      "></label>"
    );
  }
  function numberRowHTML(id, label, value, attrs = "") {
    return (
      '<div class="row"><span id="' +
      id +
      '-l">' +
      label +
      '</span><span class="stepper" role="group" aria-labelledby="' +
      id +
      '-l"><button type="button" ' +
      attrs +
      ' data-d="-1" aria-label="Decrease ' +
      escapeHTML(stripMarkup(label)) +
      '">\u2212</button><span class="n" id="' +
      id +
      '-n" aria-live="polite">' +
      value +
      '</span><button type="button" ' +
      attrs +
      ' data-d="1" aria-label="Increase ' +
      escapeHTML(stripMarkup(label)) +
      '">+</button></span></div>'
    );
  }
  function battleFormHTML(prompt) {
    const battle = state.battle || {},
      figures = battle.figures || {};
    const checkbox = (id, label, checked) =>
      checkboxRowHTML("bf-" + id, label, checked);
    let html =
      '<p class="q">' +
      escapeHTML(prompt.text) +
      '</p><div class="bform tracker">';
    const nazgulLeadership = battle.nazLead || 0;
    html +=
      numberRowHTML(
        "bf-nazLead",
        "Nazg\u00fbl leadership in the battle",
        nazgulLeadership,
        'data-bs="1"',
      ) +
      '<input type="hidden" id="bf-nazLead" value="' +
      nazgulLeadership +
      '">';
    html += checkbox(
      "shadowElite",
      "A Shadow Elite unit is in the battle",
      battle.shadowElite,
    );
    html += checkbox(
      "seElite",
      "A Southrons & Easterlings Elite is in the battle",
      battle.seElite,
    );
    html += checkbox(
      "isengardStronghold",
      "Isengard unit in the battle and the defender is in a Stronghold",
      battle.isengardStronghold,
    );
    html += checkbox(
      "defInFs",
      "The defending army is in the Fellowship region",
      battle.defInFs,
    );
    html += checkbox(
      "nearMoria",
      "The defending army is within two regions of Moria",
      battle.nearMoria,
    );
    if (state.settings.wome) {
      html +=
        checkbox(
          "underSiege",
          "The Shadow army is under siege",
          battle.underSiege,
        ) +
        checkbox(
          "attackingSiege",
          "The Shadow army is attacking in a siege",
          battle.attackingSiege,
        ) +
        '<h3 class="full">Faction figures with the Shadow army</h3>' +
        checkbox("f-corsairs", "Corsairs", figures.corsairs) +
        checkbox("f-dunlendings", "Dunlendings", figures.dunlendings) +
        checkbox("f-spiders", "Spiders", figures.spiders);
    }
    return html + "</div>";
  }
  function readBattleForm() {
    const checked = (id) => {
      const input = document.getElementById("bf-" + id);
      return input ? input.checked : false;
    };
    return {
      nazLead: +(find("#bf-nazLead").value || 0),
      shadowElite: checked("shadowElite"),
      seElite: checked("seElite"),
      isengardStronghold: checked("isengardStronghold"),
      defInFs: checked("defInFs"),
      nearMoria: checked("nearMoria"),
      figures: {
        corsairs: checked("f-corsairs"),
        dunlendings: checked("f-dunlendings"),
        spiders: checked("f-spiders"),
      },
      underSiege: checked("underSiege"),
      attackingSiege: checked("attackingSiege"),
    };
  }
  // Which die the walk's current action uses, for the action prompt's help line.
  function dieHelpText(walk) {
    if (state.settings.dice && walk.dieObj != null)
      return (
        "Uses the " + escapeHTML(state.dice.pool[walk.dieObj].face) + " die."
      );
    return walk.die
      ? "Uses a " + escapeHTML(engine.DIE_REQUIREMENT_NAME[walk.die]) + " die."
      : "";
  }
  // The deck line above a card's title.
  function cardTag(card) {
    if (card.deck === "F")
      return "Faction Event · " + (card.faction || "Sauron");
    if (card.deck === "B") return "Call to Battle · " + card.faction;
    return (
      (card.deck === "C" ? "Character" : "Strategy") +
      " · " +
      (card.type || "") +
      " symbol"
    );
  }
  // Card text as paragraphs (blank lines separate them).
  const paragraphsHTML = (text) =>
    escapeHTML(text || "")
      .split("\n\n")
      .map((paragraph) => "<p>" + paragraph + "</p>")
      .join("");
  // The combat (bottom) half of a card; styled as the only half when the event half is not shown above it.
  function combatHalfHTML(card, eventShownAbove) {
    return (
      '<div class="combat' +
      (eventShownAbove ? "" : " only") +
      '"><div class="ct"><b style="font-size:.9rem">' +
      escapeHTML(card.ct) +
      '</b><span class="tag">combat</span></div>' +
      (card.cc ? '<div class="cond">' + escapeHTML(card.cc) + "</div>" : "") +
      paragraphsHTML(card.ctext) +
      "</div>"
    );
  }
  // Which half of a card to show: the top (event) half, the bottom (combat) half, or the whole card when omitted.
  const CARD_HALF = { EVENT: "event", COMBAT: "combat" };
  function cardHTML(card, half) {
    const tag = cardTag(card);
    const showEvent = half !== CARD_HALF.COMBAT || card.deck === "B",
      showCombat = half !== CARD_HALF.EVENT && !!card.ct;
    let html =
      '<div class="card' +
      (half ? " half" : "") +
      '"><div class="ct"><b>' +
      escapeHTML(card.title) +
      '</b><span class="tag">' +
      escapeHTML(tag) +
      (card.init != null ? " · init " + escapeHTML(card.init) : "") +
      "</span></div>";
    if (showEvent) {
      if (card.cond)
        html += '<div class="cond">' + escapeHTML(card.cond) + "</div>";
      html += paragraphsHTML(card.text);
    }
    if (showCombat) html += combatHalfHTML(card, showEvent);
    if (half)
      html +=
        '<div class="tag halfnote">' +
        (half === CARD_HALF.COMBAT
          ? "Bottom (combat) half shown"
          : "Top (event) half shown") +
        "</div>";
    return html + "</div>";
  }
  function resultHTML(walk) {
    const result = walk.result || "";
    let big = "",
      small = "";
    if (result === "action") {
      big =
        "Queller acts: " +
        escapeHTML(stripMarkup(walk.trail[walk.trail.length - 1].text));
      small =
        "Do this on the board, then take your own action. When Queller is next eligible to act, walk again.";
    } else if (result === "pass") {
      big = "Queller passes.";
    } else if (result === "noaction") {
      big = "Queller has no usable action.";
      small = escapeHTML(walk.trail[walk.trail.length - 1].text);
    } else if (result === "strategy") {
      big = escapeHTML(walk.trail[walk.trail.length - 1].text);
    } else if (result === "battleNext") {
      big = "Combat continues.";
      small = "After both sides resolve this round, walk “Battle: next round”.";
    } else if (result === "end") {
      big = "End of the walk.";
    } else if (result.startsWith("phase:")) {
      big = escapeHTML(walk.trail[walk.trail.length - 1].text);
    }
    return (
      '<div class="result" tabindex="-1"><div class="big">' +
      big +
      "</div>" +
      (small
        ? '<div style="font-size:.88rem;margin-top:4px">' + small + "</div>"
        : "") +
      "</div>"
    );
  }
  function trailHTML(walk) {
    return (
      '<ul class="trail" tabindex="0" aria-label="Walk trail">' +
      walk.trail
        .map((entry) => {
          const kind = entry.kind;
          let label =
            {
              start: "Start",
              q: "Ask",
              skip: "Skipped",
              jump: "Go to",
              ret: "Return",
              back: "Back at",
              act: "Action",
              step: "Step",
              pri: "Priority",
              note: "Note",
              reveal: "Card",
              ring: "Ring",
              end: "End",
            }[kind] || kind;
          if (kind === "q" && entry.auto) label = "Auto";
          let text =
            (entry.ring ? ringIcon() + " " : "") + formatText(entry.text);
          if (entry.die)
            text +=
              ' <span class="why">(' + escapeHTML(entry.die) + " die)</span>";
          if (entry.why)
            text += ' <span class="why">— ' + formatText(entry.why) + "</span>";
          if (kind === "pri" && entry.card)
            text +=
              ' <span class="why">→ ' +
              escapeHTML(cardById[entry.card].title) +
              "</span>";
          if (kind === "pri" && entry.choice)
            text +=
              ' <span class="why">→ ' + escapeHTML(entry.choice) + "</span>";
          return (
            '<li class="t-' +
            kind +
            (entry.auto ? " auto" : "") +
            '"><span class="k">' +
            label +
            '</span><span class="txt">' +
            text +
            "</span>" +
            (entry.answer
              ? '<span class="a">' + escapeHTML(entry.answer) + "</span>"
              : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }
  function logHTML() {
    const items = state.log.slice(-40).reverse();
    return (
      '<div class="panel" style="margin-top:14px"><h2 class="ph">Log <span class="r">' +
      state.log.length +
      ' entries</span></h2><ul class="log" tabindex="0" aria-label="Game log">' +
      items
        .map(
          (entry) =>
            '<li class="' +
            (entry.card ? "c" : "") +
            '">T' +
            entry.turn +
            " · " +
            escapeHTML(entry.t) +
            "</li>",
        )
        .join("") +
      "</ul></div>"
    );
  }

  // ---------- dice panel ----------
  const FACE_ICON = {
    Muster: "crown",
    "Army/Muster": "crownbanner",
    Army: "banner",
    Character: "sword",
    Event: "palantir",
    Eye: "eye",
    Recruit: "figure",
    "Play/Draw": "card",
    "Recruit/Play": "figurecard",
    "Recruit/Draw": "figuredraw",
    Wild: "wild",
  };
  const RING_PATH =
    '<circle cx="12" cy="13.5" r="7" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M8.6 4.6L12 1.4l3.4 3.2-3.4 3.2z" fill="currentColor"/>';
  function ringIcon(label) {
    return (
      '<svg class="ring-ico" viewBox="0 0 24 24" role="img" aria-label="' +
      escapeHTML(label || "Elven Ring condition") +
      '"><title>' +
      escapeHTML(label || "Elven Ring condition (rule 36)") +
      "</title>" +
      RING_PATH +
      "</svg>"
    );
  }
  const SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<symbol id="f-sword" viewBox="0 0 24 24"><path d="M4 20l9.5-9.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12.2 7.8L18 2h4v4l-5.8 5.8" fill="currentColor"/><path d="M8.5 12.5l3 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="4" cy="20" r="1.8" fill="currentColor"/></symbol>' +
    '<symbol id="f-banner" viewBox="0 0 24 24"><path d="M6 3v18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7.5 4h12l-3 4.5 3 4.5h-12z" fill="currentColor"/></symbol>' +
    '<symbol id="f-crown" viewBox="0 0 24 24"><path d="M3 19V7l5 5 4-8 4 8 5-5v12z" fill="currentColor"/></symbol>' +
    '<symbol id="f-crownbanner" viewBox="0 0 24 24"><path d="M2 11V3l3.5 3.2L8 2l2.5 4.2L14 3v8z" fill="currentColor"/><path d="M13 12v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14.2 12.6h8l-2 3.2 2 3.2h-8z" fill="currentColor"/></symbol>' +
    '<symbol id="f-palantir" viewBox="0 0 24 24"><circle cx="12" cy="10.5" r="7.5" fill="currentColor"/><circle cx="9.3" cy="7.8" r="2" fill="var(--surface2)" opacity=".85"/><path d="M5 21c0-1.8 3.1-3 7-3s7 1.2 7 3z" fill="currentColor"/></symbol>' +
    '<symbol id="f-eye" viewBox="0 0 24 24"><path d="M1.5 12C4.5 6.5 8 4.5 12 4.5s7.5 2 10.5 7.5C19.5 17.5 16 19.5 12 19.5S4.5 17.5 1.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="4.2" ry="4.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="1.1" ry="3.4" fill="var(--accent)"/></symbol>' +
    '<symbol id="f-figure" viewBox="0 0 24 24"><circle cx="12" cy="6" r="3.4" fill="currentColor"/><path d="M5 22c0-5 2.5-8.5 7-8.5s7 3.5 7 8.5z" fill="currentColor"/></symbol>' +
    '<symbol id="f-card" viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="7" width="6" height="7" fill="currentColor"/></symbol>' +
    '<symbol id="f-figurecard" viewBox="0 0 24 24"><circle cx="7.5" cy="6.5" r="2.8" fill="currentColor"/><path d="M1.5 21c0-4 2-7.5 6-7.5s6 3.5 6 7.5z" fill="currentColor"/><rect x="14" y="4" width="8.5" height="13" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="16.2" y="7" width="4" height="5" fill="currentColor"/></symbol>' +
    '<symbol id="f-figuredraw" viewBox="0 0 24 24"><circle cx="7.5" cy="6.5" r="2.8" fill="currentColor"/><path d="M1.5 21c0-4 2-7.5 6-7.5s6 3.5 6 7.5z" fill="currentColor"/><rect x="14" y="3" width="8.5" height="11" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M18.25 15v6M15.5 18.5l2.75 2.8 2.75-2.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="f-wild" viewBox="0 0 24 24"><path d="M12 2l2.6 6.4 6.9.5-5.3 4.5 1.7 6.7L12 16.4 6.1 20.1l1.7-6.7L2.5 8.9l6.9-.5z" fill="currentColor"/></symbol>' +
    "</defs></svg>";
  function faceIcon(face) {
    const id = FACE_ICON[face];
    return id
      ? '<svg class="ico" aria-hidden="true"><use href="#f-' + id + '"/></svg>'
      : "";
  }
  const DIE_STATUS_TEXT = {
    pool: "not yet rolled",
    hunt: "in the Hunt box",
    avail: "available — tap to mark it used",
    used: "used",
    reserved: "set aside for a minion",
  };
  // One die in the pool; an available die is a button that marks it used (index = its position in the pool).
  function dieHTML(die, index) {
    const dieStatus = DIE_STATUS_TEXT[die.st];
    const cls =
      "die k-" +
      die.k +
      " st-" +
      die.st +
      (die.face ? " f-" + die.face.replace("/", "-") : "");
    const inner =
      (die.face
        ? faceIcon(die.face)
        : '<span class="blank" aria-hidden="true"></span>') +
      '<span class="sr">' +
      (die.k === DIE_KIND.FACTION ? "Faction die" : "Action die") +
      (die.face ? " showing " + escapeHTML(die.face) : "") +
      ", " +
      dieStatus +
      "</span>";
    const title = escapeHTML(die.face || "not rolled") + " · " + dieStatus;
    return die.st === "avail"
      ? '<li><button type="button" class="' +
          cls +
          '" data-spend="' +
          index +
          '" title="' +
          title +
          '">' +
          inner +
          "</button></li>"
      : '<li class="' + cls + '" title="' + title + '">' + inner + "</li>";
  }
  function diceHTML() {
    const dice = state.dice,
      available = engine.availableDice(state);
    let html =
      '<section class="panel" aria-labelledby="h-dice"><h2 class="ph" id="h-dice">Queller’s dice <span class="r">' +
      engine.diceCount(state) +
      " action dice" +
      (dice.factionDie && state.settings.wome ? " + Faction die" : "") +
      "</span></h2>";
    html += SPRITE;
    if (!dice.pool.length)
      html += '<div class="notice">Dice are recovered in Phase 1.</div>';
    else {
      const indexedDice = dice.pool.map((die, index) => [die, index]);
      const huntDice = indexedDice.filter(([die]) => die.st === "hunt"),
        otherDice = indexedDice.filter(([die]) => die.st !== "hunt");
      html +=
        '<div class="dicewrap"><div class="huntbox"><span class="hlbl">Hunt box</span><ul class="dice" aria-label="Dice in the Hunt box">' +
        (huntDice.length
          ? huntDice.map(([die, index]) => dieHTML(die, index)).join("")
          : '<li class="die empty" aria-hidden="true"></li>') +
        '</ul></div><ul class="dice" aria-label="Dice">' +
        otherDice.map(([die, index]) => dieHTML(die, index)).join("") +
        "</ul></div>";
      if (available.length)
        html +=
          '<div class="notice" style="margin-top:8px">Tap an available die to mark it used (a card effect, for example).</div>';
    }
    html +=
      '<div class="legend" aria-hidden="true">' +
      ["Character", "Army", "Muster", "Army/Muster", "Event", "Eye"]
        .map((face) => "<span>" + faceIcon(face) + escapeHTML(face) + "</span>")
        .join("") +
      (dice.factionDie && state.settings.wome
        ? ["Recruit", "Play/Draw", "Recruit/Play", "Recruit/Draw", "Wild"]
            .map(
              (face) =>
                "<span>" + faceIcon(face) + escapeHTML(face) + "</span>",
            )
            .join("")
        : "") +
      "</div>";
    html +=
      '<div class="dicerow"><span>Available: <b>' +
      available.length +
      "</b></span>" +
      (state.minionReserved ? "<span>1 set aside for a minion</span>" : "") +
      (engine.ringsKnown(state)
        ? "<span>Rings held: <b>" + state.board.rings + "</b></span>"
        : "") +
      "</div>";
    const huntCards = state.cards.table.filter(
      (id) => id === CARD.BALROG || id === CARD.FLOCKS_OF_CREBAIN,
    );
    if (huntCards.length)
      html +=
        '<div class="notice" style="margin-top:8px">At a Hunt roll: ' +
        huntCards
          .map((id) =>
            id === CARD.FLOCKS_OF_CREBAIN
              ? "Flocks of Crebain on the table — discard it before the roll for +1 to every Hunt die"
              : "Balrog of Moria on the table — discard it for an extra Hunt tile when the Fellowship moves into, out of or through Moria while declared or revealed",
          )
          .join("; ") +
        ".</div>";
    return html + "</section>";
  }
  // ---------- cards panel ----------
  function cardsHTML() {
    const cards = state.cards,
      handCount = engine.handCounts(state);
    let html =
      '<section class="panel" aria-labelledby="h-cards"><h2 class="ph" id="h-cards">Queller’s cards <span class="r">' +
      handCount.total +
      " in hand" +
      (state.settings.wome ? " · " + handCount.faction + " faction" : "") +
      "</span></h2>";
    html +=
      '<div class="hand"><ul aria-label="Cards in hand: ' +
      handCount.character +
      " Character, " +
      handCount.strategy +
      " Strategy" +
      (state.settings.wome ? ", " + handCount.faction + " Faction Event" : "") +
      '">' +
      cards.hand
        .map(
          (id) =>
            '<li class="back' +
            (cardById[id].deck === DECK.STRATEGY ? " s" : "") +
            '" title="' +
            (cardById[id].deck === DECK.CHARACTER ? "Character" : "Strategy") +
            ' card"><span aria-hidden="true">' +
            (cardById[id].deck === DECK.CHARACTER ? "C" : "S") +
            '</span><span class="sr">' +
            (cardById[id].deck === DECK.CHARACTER ? "Character" : "Strategy") +
            " card</span></li>",
        )
        .join("") +
      cards.factionHand
        .map(
          () =>
            '<li class="back f" title="Faction Event card"><span aria-hidden="true">F</span><span class="sr">Faction Event card</span></li>',
        )
        .join("") +
      "</ul></div>";
    html +=
      '<div class="kv"><span>Character deck</span><span class="v">' +
      cards.decks.C.length +
      " / " +
      cards.discards.C.length +
      ' discarded</span><span>Strategy deck</span><span class="v">' +
      cards.decks.S.length +
      " / " +
      cards.discards.S.length +
      " discarded</span>" +
      (state.settings.wome
        ? '<span>Faction deck</span><span class="v">' +
          cards.decks.F.length +
          " / " +
          cards.discards.F.length +
          " discarded</span>"
        : "") +
      "</div>";
    const tableCards = cards.table.concat(cards.factionTable);
    html += '<div class="more tablecards"><div class="mlbl">On the table</div>';
    if (!tableCards.length)
      html +=
        '<div class="notice">No cards in play. Cards Queller plays “on the table” are listed here until discarded.</div>';
    else
      html += tableCards
        .map((id) => {
          const open = shownCard === id,
            card = cardById[id];
          return (
            '<div class="tc"><b>' +
            escapeHTML(card.title) +
            '</b><button class="btn small" data-card="' +
            (open ? "hide" : "show") +
            '" data-id="' +
            id +
            '" aria-expanded="' +
            open +
            '">' +
            (open ? "Hide" : "Details") +
            '</button><button class="btn small" data-card="discard" data-id="' +
            id +
            '">Discard</button>' +
            (card.reminder
              ? '<div class="notice rem">' +
                escapeHTML(card.reminder) +
                "</div>"
              : "") +
            "</div>" +
            (open ? cardHTML(card) : "")
          );
        })
        .join("");
    html += "</div>";
    return html + "</section>";
  }
  // ---------- tracker ----------
  // Tracker rows: a checkbox, a number stepper and a Free Peoples nation selector, keyed by the tracker path (e.g. "fs.progress").
  const trackerId = (path) => "t-" + path.replaceAll(".", "-");
  const trackerCheckbox = (path, label) =>
    checkboxRowHTML(
      trackerId(path),
      label,
      boardValue(path),
      'data-t="' + path + '"',
    );
  const trackerNumber = (path, label) =>
    numberRowHTML(
      trackerId(path),
      label,
      boardValue(path),
      'data-step="' + path + '"',
    );
  const trackerSelect = (path, label) =>
    '<div class="row"><label for="' +
    trackerId(path) +
    '">' +
    label +
    '</label><select id="' +
    trackerId(path) +
    '" data-t="' +
    path +
    '">' +
    [
      [FP_STANCE.PASSIVE, "Passive"],
      [FP_STANCE.ACTIVE, "Active"],
      [FP_STANCE.WAR, "At war"],
    ]
      .map(
        ([stance, label]) =>
          '<option value="' +
          stance +
          '"' +
          (boardValue(path) === stance ? " selected" : "") +
          ">" +
          label +
          "</option>",
      )
      .join("") +
    "</select></div>";
  // The situational card checks answered this turn, with a button to forget them (and the playability cache).
  function situBlockHTML() {
    const answeredKeys = Object.keys(state.situ);
    return (
      '<h3>Card checks answered this turn</h3><div class="situ">' +
      (answeredKeys.length
        ? answeredKeys
            .map(
              (key) =>
                '<div class="row"><span>' +
                escapeHTML(engine.SITUATIONAL_QUESTIONS[key]) +
                "</span><b>" +
                (state.situ[key] ? "Yes" : "No") +
                "</b></div>",
            )
            .join("")
        : '<div class="row"><span>None yet</span></div>') +
      (answeredKeys.length || Object.keys(state.playable).length
        ? '<div class="row"><span></span><button class="btn small" data-t-reset="1">Forget</button></div>'
        : "") +
      "</div>"
    );
  }
  // Without the full tracker, only the facts the dice pool and card priorities need are tracked.
  function minimalTrackerHTML() {
    let html = "";
    if (state.settings.dice)
      html +=
        "<h3>Minions in play (sizes the dice pool)</h3>" +
        trackerCheckbox("chars.saruman", "Saruman") +
        trackerCheckbox("chars.witchKing", "Witch King") +
        trackerCheckbox("chars.mouth", "Mouth of Sauron");
    if ((state.settings.cards || state.settings.dice) && state.settings.wome)
      html +=
        "<h3>Shadow factions in play (" +
        (state.settings.cards ? "card priorities" : "") +
        (state.settings.cards && state.settings.dice ? ", " : "") +
        (state.settings.dice ? "Faction die" : "") +
        ")</h3>" +
        trackerCheckbox("factions.corsairs", "Corsairs") +
        trackerCheckbox("factions.dunlendings", "Dunlendings") +
        trackerCheckbox("factions.spiders", "Spiders");
    if (state.settings.dice)
      html +=
        "<h3>Hunt box and Elven Rings</h3>" +
        trackerNumber("fs.companions", "Companions in the Fellowship") +
        trackerNumber("rings", "Elven Rings held by the Shadow");
    if (state.settings.cards) html += situBlockHTML();
    if (!html) return "";
    return (
      '<section class="panel" aria-labelledby="h-track"><h2 class="ph" id="h-track">Board tracker <span class="r">minimal</span></h2><div class="tracker">' +
      html +
      "</div></section>"
    );
  }
  function trackerHTML() {
    if (!state.settings.tracker) return minimalTrackerHTML();
    let html =
      '<section class="panel" aria-labelledby="h-track"><h2 class="ph" id="h-track">Board tracker <span class="r">answers what it can</span></h2><div class="tracker">';
    html +=
      "<h3>Score</h3>" +
      trackerNumber("shadowVP", "Shadow victory points") +
      trackerNumber("corruption", "Corruption") +
      trackerNumber("rings", "Elven Rings held by the Shadow");
    html +=
      "<h3>Fellowship</h3>" +
      trackerNumber("fs.progress", "Progress counter") +
      trackerNumber("fs.companions", "Companions in the Fellowship") +
      trackerCheckbox("fs.revealed", "Revealed") +
      trackerCheckbox("fs.mordor", "On the Mordor track") +
      trackerCheckbox("fs.atStart", "Figure in Rivendell") +
      trackerCheckbox(
        "fs.inFPSettlement",
        "Figure in a Free Peoples settlement region",
      ) +
      trackerCheckbox(
        "fs.inStrongholdOrSea",
        "Figure in a Stronghold or at sea",
      ) +
      trackerCheckbox("fs.guideGollum", "Gollum is the Guide");
    html +=
      "<h3>Characters in play</h3>" +
      trackerCheckbox("chars.saruman", "Saruman") +
      trackerCheckbox("chars.witchKing", "Witch King") +
      trackerCheckbox("chars.mouth", "Mouth of Sauron") +
      trackerNumber("nazgul", "Nazg\u00fbl on the map") +
      trackerCheckbox("chars.gandalfWhite", "Gandalf the White") +
      trackerCheckbox("chars.aragorn", "Aragorn, Heir to Isildur");
    const shadowNationSelect = (path, label, max) => {
      let options = "";
      for (let steps = 0; steps <= max; steps++)
        options +=
          '<option value="' +
          steps +
          '"' +
          ((boardValue(path) | 0) === steps ? " selected" : "") +
          ">" +
          engine.politicalTrackLabel(steps) +
          "</option>";
      return (
        '<div class="row"><label for="' +
        trackerId(path) +
        '">' +
        label +
        '</label><select id="' +
        trackerId(path) +
        '" data-t="' +
        path +
        '" data-num="1">' +
        options +
        "</select></div>"
      );
    };
    html +=
      "<h3>Shadow nations (Political Track)</h3>" +
      shadowNationSelect("nations.sauron", "Sauron", 3) +
      shadowNationSelect("nations.isengard", "Isengard", 3) +
      shadowNationSelect("nations.se", "Southrons & Easterlings", 3);
    html +=
      "<h3>Free Peoples nations</h3>" +
      trackerSelect("nations.gondor", "Gondor") +
      trackerSelect("nations.rohan", "Rohan") +
      trackerSelect("nations.north", "North") +
      trackerSelect("nations.dwarves", "Dwarves") +
      trackerSelect("nations.elves", "Elves");
    if (state.settings.wome)
      html +=
        "<h3>Factions in play</h3>" +
        trackerCheckbox("factions.corsairs", "Corsairs") +
        trackerCheckbox("factions.dunlendings", "Dunlendings") +
        trackerCheckbox("factions.spiders", "Spiders") +
        trackerCheckbox("factions.ents", "Ents") +
        trackerCheckbox("factions.eagles", "Eagles") +
        trackerCheckbox("factions.deadmen", "Dead Men");
    html += situBlockHTML();
    return html + "</div></section>";
  }
  // dotted paths into state.board ("fs.progress")
  function boardValue(path) {
    return path.split(".").reduce((object, key) => object[key], state.board);
  }
  function setBoardValue(path, value) {
    const keys = path.split(".");
    let object = state.board;
    for (let i = 0; i < keys.length - 1; i++) object = object[keys[i]];
    object[keys[keys.length - 1]] = value;
  }
  const STEP_LIMITS = {
    shadowVP: [0, 10],
    corruption: [0, 12],
    rings: [0, 3],
    "fs.progress": [0, 12],
    "fs.companions": [0, 7],
    nazgul: [0, 8],
  };
  // A tracker change: apply it, forget cached card checks it may affect, and discard table cards whose condition it triggers (asking when the app cannot tell).
  function trackerChange(path, value) {
    let asks = [];
    const from = boardValue(path);
    act(
      () => {
        setBoardValue(path, value);
        if (/^(nations|chars|fs|factions)\./.test(path) || path === "rings")
          state.playable = {};
        asks = engine.tableTriggers(state, { key: path, from, to: value });
      },
      { a: "tracker", key: path, from, to: value },
    );
    const next = () => {
      const pending = asks.shift();
      if (!pending) return;
      ask({
        title: "Discard “" + cardById[pending.card].title + "”?",
        text: pending.q,
        buttons: [
          { v: "ok", label: "Discard it", primary: true },
          { v: "no", label: "Keep it" },
        ],
        onPick: (choice) => {
          if (choice === "ok")
            act(
              () =>
                engine.discardCard(
                  state,
                  pending.card,
                  "its discard condition was met",
                ),
              { a: "tableTrigger", card: pending.card },
            );
          next();
        },
      });
    };
    next();
  }

  // ---------- wiring ----------
  function wire() {
    find("#undoBtn").onclick = undo;
    const newGameBtn = find("#newGameBtn");
    if (newGameBtn) newGameBtn.onclick = askNewGame;
    document
      .querySelectorAll("[data-modal]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            openModal(
              button.dataset.modal,
              button.dataset.modal === "flow" ? { current: true } : undefined,
            )),
      );
    document
      .querySelectorAll("[data-phase]")
      .forEach(
        (button) => (button.onclick = () => onPhase(button.dataset.phase)),
      );
    document
      .querySelectorAll("[data-ans]")
      .forEach(
        (button) => (button.onclick = () => onAnswer(button.dataset.ans)),
      );
    const battleFormOk = find("#bfOk");
    if (battleFormOk)
      battleFormOk.onclick = () => {
        const form = readBattleForm();
        act(
          () => {
            engine.answer(state, form);
          },
          { a: "answer", prompt: "battleForm", value: form },
        );
      };
    document.querySelectorAll("[data-bs]").forEach(
      (button) =>
        (button.onclick = () => {
          const input = find("#bf-nazLead");
          const value = Math.max(
            0,
            Math.min(8, (+input.value || 0) + +button.dataset.d),
          );
          input.value = value;
          find("#bf-nazLead-n").textContent = value;
        }),
    );
    const countOk = find("#cntOk");
    if (countOk)
      countOk.onclick = () => {
        const value = find("#cnt").value;
        act(
          () => {
            engine.answer(state, value);
            afterWalk();
          },
          {
            a: "answer",
            prompt: "count",
            page: state.walk?.page,
            node: state.walk?.node,
            value,
          },
        );
      };
    document
      .querySelectorAll("[data-spend]")
      .forEach(
        (button) =>
          (button.onclick = () => spendDieClick(+button.dataset.spend)),
      );
    document
      .querySelectorAll("[data-card]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            onCard(button.dataset.card, button.dataset.id)),
      );
    document.querySelectorAll(".tracker [data-t]").forEach((el) => {
      el.onchange = () => trackerChange(el.dataset.t, trackerValue(el));
    });
    document.querySelectorAll("[data-step]").forEach(
      (button) =>
        (button.onclick = () => {
          const path = button.dataset.step;
          const limits = STEP_LIMITS[path] || [0, 99];
          trackerChange(
            path,
            Math.min(
              limits[1],
              Math.max(limits[0], boardValue(path) + +button.dataset.d),
            ),
          );
        }),
    );
    const resetBtn = find("[data-t-reset]");
    if (resetBtn)
      resetBtn.onclick = () =>
        act(
          () => {
            state.situ = {};
            state.playable = {};
          },
          { a: "forgetCardChecks" },
        );
  }
  function onAnswer(answer) {
    const walk = state.walk,
      prompt = walk?.prompt;
    if (!prompt) return;
    act(
      () => {
        let value = answer;
        if (
          ["yesno", "situ", "confirm", "diecheck", "ring"].includes(prompt.type)
        )
          value = answer === "yes";
        engine.answer(state, value);
        afterWalk();
      },
      {
        a: "answer",
        prompt: prompt.type,
        page: walk.page,
        node: walk.node,
        text: prompt.text ? String(prompt.text).slice(0, 80) : undefined,
        card: prompt.card,
        value: answer,
      },
    );
  }
  // A tracker field's value: checkboxes give a boolean, numeric fields a number, the rest their text.
  function trackerValue(el) {
    if (el.type === "checkbox") return el.checked;
    return el.dataset.num ? +el.value : el.value;
  }
  // The player marks an available die as used by hand (the [data-spend] buttons in the dice row).
  function spendDieClick(index) {
    const die = state.dice.pool[index];
    if (die?.st !== "avail") return;
    ask({
      title: "Mark this die as used?",
      text:
        "The " +
        die.face +
        (die.k === DIE_KIND.FACTION ? " Faction" : "") +
        " die will be marked as used for the rest of this turn. Undo reverses it.",
      buttons: [
        { v: "ok", label: "Mark as used", primary: true },
        { v: "no", label: "Cancel" },
      ],
      onPick: (choice) => {
        if (choice !== "ok") return;
        act(
          () => {
            const dieNow = state.dice.pool[index];
            if (dieNow?.st === "avail")
              engine.spendDie(state, dieNow, "marked by you");
          },
          { a: "spendDie", index, face: die.face },
        );
      },
    });
  }
  function afterWalk() {
    const walk = state.walk;
    if (!walk?.done) return;
    const result = walk.result || "";
    if (walk.entry.page === "BA") {
      state.battleOpen = result === "battleNext";
    } else if (result !== "") {
      state.battleOpen = false;
    }
    if (result === "strategy") {
      state.phase = PHASE.P1;
    } else if (result.startsWith("phase:")) {
      const name = result.slice(6);
      const map = {
        "Phase 2": PHASE.P2,
        "Phase 3": PHASE.P3,
        "Phase 4": PHASE.P4,
        "Phase 5": PHASE.P5,
      };
      if (map[name]) state.phase = map[name];
    }
  }
  function onPhase(id) {
    act(
      () => {
        if (id === PHASE_ACTION.ABANDON) {
          state.walk = null;
          engine.log(state, "Walk abandoned.");
          return;
        }
        if (id === PHASE_ACTION.NEXT_TURN) {
          engine.nextTurn(state);
          return;
        }
        if (id === PHASE.P6) {
          state.phase = PHASE.P6;
          state.walk = null;
          engine.log(
            state,
            "Phase 6: check victory conditions (Shadow VP 10, Corruption 12, Ring destroyed).",
          );
          return;
        }
        if (id === PHASE_ACTION.BATTLE_1) {
          engine.startBattle(state, 1);
          afterWalk();
          return;
        }
        if (id === PHASE_ACTION.BATTLE_2) {
          engine.startBattle(state, 2);
          afterWalk();
          return;
        }
        if (id === PHASE_ACTION.JUMP_TO) {
          openModal("jump");
          return;
        }
        if (id === PHASE.SETUP) {
          engine.startPhase(state, PHASE.SETUP);
          afterWalk();
          return;
        }
        engine.startPhase(state, id);
        afterWalk();
      },
      { a: "phase", id },
    );
  }
  function onCard(action, id) {
    if (action === "discard") {
      const card = cardById[id];
      ask({
        title: "Discard “" + card.title + "”?",
        text: "Do this when the card’s own text says it must be discarded, or when a Free Peoples action discards it. It goes to the discard pile.",
        buttons: [
          { v: "ok", label: "Discard", primary: true },
          { v: "no", label: "Cancel" },
        ],
        onPick: (choice) => {
          if (choice !== "ok") return;
          act(
            () => {
              engine.discardCard(state, id, "discarded from the table");
              if (shownCard === id) shownCard = null;
            },
            { a: "discardTable", card: id },
          );
        },
      });
      return;
    }
    shownCard = action === "show" ? id : null;
    debug.action({ a: "tableCard", show: action === "show", card: id }, state);
    render();
  }

  // expose for modals file
  window.QBUI = {
    showErrBar,
    ringIcon,
    RING_PATH,
    get state() {
      return state;
    },
    set state(value) {
      state = value;
    },
    get history() {
      return history;
    },
    set history(value) {
      history = value;
    },
    act,
    commit,
    render,
    find,
    formatText,
    escapeHTML,
    stripMarkup,
    cardHTML,
    CARD_HALF,
    NODE_KIND_NAME,
    checkboxRowHTML,
    numberRowHTML,
    openModal,
    setModal: (spec) => {
      modal = spec;
    },
    getModal: () => modal,
    loadJSON,
    storageGet,
    storageSet,
    STORAGE_KEY,
    boot,
    LEGAL,
  };
  function openModal(name, arg) {
    modal = { name, arg };
    if (name !== "ask") debug.action({ a: "modal", name }, state);
    window.QBUI.renderModal();
  }
  function ask(spec) {
    openModal("ask", spec);
  }
  function askNewGame() {
    ask({
      title: "Start a new game?",
      text: "The current game is replaced and its autosave is cleared. Named save slots are kept.",
      buttons: [
        { v: "ok", label: "Start a new game", primary: true },
        { v: "no", label: "Cancel" },
      ],
      onPick: (choice) => {
        if (choice !== "ok") return;
        debug.begin({ a: "newGameScreen" }, state);
        history = [];
        state = null;
        modal = null;
        storageSet(STORAGE_KEY.AUTOSAVE, "");
        debug.finishAction(null);
        render();
      },
    });
  }
  window.QBUI.ask = ask;
  window.QBUI.askNewGame = askNewGame;
  function closeModal() {
    window.QBUI.closeModal();
  }
  function renderModal() {
    window.QBUI.renderModal();
  }
  function loadHTML() {
    return window.QBUI.loadHTML();
  }
  function wireLoad(area) {
    window.QBUI.wireLoad(area);
  }
})();
