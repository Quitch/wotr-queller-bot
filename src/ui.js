// ===== UI =====
(function () {
  const Q = window.QB,
    F = Q.F,
    byId = Q.byId,
    G = window.QB_GLOSSARY,
    DBG = window.QB_DEBUG;
  let S = null,
    history = [],
    modal = null,
    shownCard = null;
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  function termKey(t) {
    t = t.toLowerCase().replace(/\s+/g, " ").trim();
    if (G[t]) return t;
    if (window.QB_GLOSSARY_ALIASES[t]) return window.QB_GLOSSARY_ALIASES[t];
    const s = t.replace(/s$/, "");
    if (G[s]) return s;
    return null;
  }
  function fmt(t) {
    if (t == null) return "";
    return esc(t)
      .replace(/\*([^*]+)\*/g, (m, w) => {
        const k = termKey(w);
        return k
          ? '<button type="button" class="term" data-term="' +
              k +
              '" aria-describedby="tip">' +
              w +
              "</button>"
          : "<i>" + w + "</i>";
      })
      .replaceAll("\n", "<br>");
  }
  function plain(t) {
    return String(t || "").replaceAll("*", "");
  }

  // ---------- persistence ----------
  const LS = "qb.autosave",
    LSLOTS = "qb.slots",
    LSOPTS = "qb.opts",
    LSDEBUG = "qb.debug";
  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  function snapshot() {
    history.push(JSON.stringify(S));
    if (history.length > 60) history.shift();
  }
  function commit() {
    if (S) S.appVersion = Q.VERSION;
    lsSet(LS, JSON.stringify(S));
    render();
  }
  // Every change to the game goes through here. `info` names the action for the debug log ({a:"answer", ...}).
  // If the action throws, the game is put back as it was before it, the error is recorded and the error bar offers a debug log.
  function act(fn, info) {
    snapshot();
    DBG.begin(info || { a: "act" }, S);
    try {
      fn();
    } catch (e) {
      const bad = S;
      S = JSON.parse(history.pop());
      DBG.error(e, { a: "actionFailed", rolledBack: true }, bad);
      commit();
      showErrBar();
      return;
    }
    DBG.end(S);
    commit();
  }
  function undo() {
    if (!history.length) return;
    DBG.begin({ a: "undo" }, S);
    S = JSON.parse(history.pop());
    DBG.end(S);
    commit();
  }
  function loadJSON(txt) {
    const o = JSON.parse(txt);
    if (!o?.settings || !o.board) throw new Error("not a Queller save");
    return Q.migrate(o);
  }

  // ---------- boot ----------
  function boot() {
    DBG.restore({ get: () => lsGet(LSDEBUG), set: (v) => lsSet(LSDEBUG, v) });
    window.addEventListener("error", (e) => {
      DBG.error(
        e.error || e.message,
        {
          a: "uncaught",
          src: e.filename ? String(e.filename).split("/").pop() : null,
          line: e.lineno,
          col: e.colno,
        },
        S,
      );
      showErrBar();
    });
    window.addEventListener("unhandledrejection", (e) => {
      DBG.error(
        e.reason || "unhandled promise rejection",
        { a: "unhandledrejection" },
        S,
      );
      showErrBar();
    });
    const a = lsGet(LS);
    let loadErr = null;
    if (a) {
      try {
        S = loadJSON(a);
      } catch (e) {
        S = null;
        loadErr = e;
      }
    }
    if (loadErr) {
      lsSet(LS + ".broken", a);
      DBG.error(loadErr, {
        a: "boot-load",
        note: "the autosave could not be parsed; kept under " + LS + ".broken",
      });
    }
    DBG.action(
      {
        a: "pageLoad",
        autosave: !!a,
        restored: !!S,
        broken: !!lsGet(LS + ".broken"),
      },
      S,
    );
    document.documentElement.lang = document.documentElement.lang || "en";
    tipEl = document.createElement("div");
    tipEl.id = "tip";
    tipEl.hidden = true;
    tipEl.setAttribute("role", "tooltip");
    tipEl.addEventListener("mouseleave", hideTip);
    document.body.appendChild(tipEl);
    document.body.addEventListener("mouseover", (e) => {
      const t = e.target.closest(".term");
      if (t) showTip(t);
    });
    document.body.addEventListener("mouseout", (e) => {
      const t = e.target.closest(".term");
      if (t && !e.relatedTarget?.closest?.("#tip")) hideTip();
    });
    document.body.addEventListener("focusin", (e) => {
      const t = e.target.closest(".term");
      if (t) showTip(t);
    });
    document.body.addEventListener("focusout", (e) => {
      if (e.target.closest(".term")) hideTip();
    });
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest(".term");
      if (t) {
        hideTip();
        openModal("glossary", t.dataset.term);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (tipEl && !tipEl.hidden) {
          hideTip();
          e.stopPropagation();
          return;
        }
        if (modal) closeModal();
      }
    });
    try {
      render();
    } catch (e) {
      console.error(
        "Queller Runner: could not render the saved game — starting at the New game screen.",
        e,
      );
      lsSet(LS + ".broken", lsGet(LS) || "");
      DBG.error(
        e,
        {
          a: "boot-render",
          note:
            "the saved game could not be rendered; kept under " +
            LS +
            ".broken",
        },
        S,
      );
      S = null;
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
    const n = DBG.errors.length,
      last = DBG.errors[n - 1];
    bar.innerHTML =
      '<div class="wrap"><span class="msg"><b>Something went wrong in the app</b> — ' +
      esc(last ? last.message : "an error was recorded") +
      (last?.rolledBack
        ? ". Your last action was undone; the game continues."
        : ".") +
      " Please export a debug log and send it with a description of what you were doing.</span>" +
      '<span class="eb"><button type="button" class="btn small" id="errbarLog">Export debug log</button><button type="button" class="btn small ghost" id="errbarClose" aria-label="Dismiss this message">Dismiss</button></span></div>';
    document.getElementById("errbarLog").onclick = () => openModal("debug");
    document.getElementById("errbarClose").onclick = () => bar.remove();
  }
  let tipEl = null;
  function showTip(t) {
    const k = t.dataset.term;
    if (!G[k]) return;
    tipEl.innerHTML =
      "<b>" + esc(k) + "</b>" + esc(G[k]).replace(/\*([^*]+)\*/g, "<i>$1</i>");
    const r = t.getBoundingClientRect();
    const w = Math.min(360, window.innerWidth - 24);
    tipEl.style.maxWidth = w + "px";
    let x = Math.min(r.left, window.innerWidth - w - 12),
      y = r.bottom + 8;
    tipEl.style.left = Math.max(8, x) + "px";
    tipEl.style.top = y + "px";
    tipEl.hidden = false;
    const h = tipEl.offsetHeight;
    if (y + h > window.innerHeight - 8)
      tipEl.style.top = Math.max(8, r.top - h - 8) + "px";
  }
  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  // ---------- render ----------
  function focusKey(el) {
    if (!el || el === document.body) return null;
    if (el.id) return "#" + el.id;
    for (const a of [
      "data-phase",
      "data-ans",
      "data-card",
      "data-t",
      "data-step",
      "data-modal",
      "data-t-reset",
    ]) {
      if (el.hasAttribute(a))
        return (
          "[" +
          a +
          '="' +
          el.getAttribute(a) +
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
    const root = $("#app");
    hideTip();
    const prevKey = focusKey(document.activeElement),
      prevWasAnswer = document.activeElement?.dataset?.ans !== undefined;
    const openMore = [...root.querySelectorAll("details.more")].map(
      (d) => d.open,
    );
    if (!S) {
      root.innerHTML = setupHTML();
      wireSetup();
      return;
    }
    root.innerHTML = gameHTML();
    wire();
    root.querySelectorAll("details.more").forEach((d, i) => {
      if (openMore[i]) d.open = true;
    });
    const live = $("#live");
    const last = S.log[S.log.length - 1];
    if (live && last && S.walk) live.textContent = last.t;
    if (prevWasAnswer || (S.walk?.prompt && !prevKey)) {
      const p = $(".prompt, .result");
      if (p) p.focus();
    } else if (prevKey) {
      const el = root.querySelector(prevKey);
      if (el) el.focus();
    }
    if (modal) renderModal();
  }
  // The game screen: header, the dice and cards panels, the walkthrough, the board tracker and the footer.
  // With the full board tracker on, the dice and cards panels sit under the walkthrough in the left column; otherwise they share a top row.
  function gameHTML() {
    const below = S.settings.tracker;
    const panels =
      (S.settings.dice ? diceHTML() : "") +
      (S.settings.cards ? cardsHTML() : "");
    const top = below ? "" : panels;
    const tr = trackerHTML();
    const body =
      (top
        ? '<div class="toprow" aria-label="Queller’s dice and cards">' +
          top +
          "</div>"
        : "") +
      '<div class="grid' +
      (tr ? "" : " nowalk") +
      '"><main id="main" tabindex="-1" aria-label="Walkthrough">' +
      walkHTML(below ? panels : "") +
      "</main>" +
      (tr
        ? '<aside class="side" aria-label="Board tracker">' + tr + "</aside>"
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
    const s = { dice: false, cards: false, tracker: false, wome: false };
    try {
      Object.assign(s, JSON.parse(lsGet(LSOPTS) || "{}"));
    } catch (e) {}
    return (
      '<div class="top"><div class="brand"><h1>Queller Bot Runner</h1><span class="sub">Shadow player · War of the Ring 2nd Ed.</span></div></div>' +
      '<div class="setup"><h2 style="font-size:1.3rem;margin-bottom:6px">New game</h2><p class="notice" style="max-width:none">Choose which parts of the bot the app should run for you. Each part works on its own — turn off anything you would rather keep on the table.</p>' +
      opt(
        "dice",
        "Roll and track Queller’s dice",
        "Rolls the Shadow Action dice (and the Faction die) and keeps the Hunt box.",
        "the walkthrough takes or skips options by the dice Queller actually has.",
        "you roll for Queller, and the walkthrough asks which dice are available.",
        s.dice,
      ) +
      opt(
        "cards",
        "Draw and hold Queller’s cards",
        "Shuffles the Character, Strategy and Faction Event decks, draws, and discards by the priority lists.",
        "you only see how many cards Queller holds — a card is shown when a flowchart needs to know whether it is *playable*, or when it is played.",
        "you hold Queller’s cards yourself, and the walkthrough asks about them.",
        s.cards,
      ) +
      opt(
        "tracker",
        "Track board state in the app",
        "A trade-off. The app always walks the flowcharts.",
        "you keep a board tracker up to date (Fellowship, characters, Political Track, nations, factions) and the app answers every board question from it.",
        "no tracker to maintain, but every question about the board is put to you.",
        s.tracker,
      ) +
      '<h4 style="margin-top:18px">Expansions</h4>' +
      opt(
        "wome",
        "Warriors of Middle-earth",
        "Adds the Faction Event deck, Call to Battle cards, the Faction die and the “– WoME –” decisions.",
        "the “– WoME –” decisions are asked and the faction cards and die are in play.",
        "those decisions are answered No and skipped.",
        s.wome,
      ) +
      '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button class="btn primary" id="start">Start game</button><button class="btn" id="loadBtn">Load a saved game</button><button class="btn ghost" id="debugBtn">Export debug log</button></div>' +
      (lsGet(LS + ".broken")
        ? '<p class="notice" role="status" style="margin-top:12px;color:var(--bad)">An earlier game could not be shown after the page reloaded, so the app started here. That game is kept in the debug log — please export it and send it with a description of what happened. Starting a new game clears it.</p>'
        : "") +
      '<div id="loadArea" hidden style="margin-top:14px"></div>' +
      '<footer class="notice">' +
      LEGAL +
      "</footer></div>"
    );
  }
  function opt(id, t, d, onT, offT, on) {
    return (
      '<label class="opt"><input type="checkbox" id="opt-' +
      id +
      '" ' +
      (on ? "checked" : "") +
      "><div><b>" +
      t +
      "</b><span>" +
      fmt(d) +
      '<span class="oo"><b>On:</b> ' +
      fmt(onT) +
      '</span><span class="oo"><b>Off:</b> ' +
      fmt(offT) +
      "</span></span></div></label>"
    );
  }
  function wireSetup() {
    $("#start").onclick = () => {
      const st = {};
      ["dice", "cards", "tracker", "wome"].forEach(
        (k) => (st[k] = $("#opt-" + k).checked),
      );
      lsSet(LSOPTS, JSON.stringify(st));
      lsSet(LS + ".broken", "");
      DBG.begin({ a: "newGame", settings: st }, null);
      S = Q.newState(st);
      history = [];
      Q.log(S, "New game. Roll for Queller’s starting strategy.");
      DBG.end(S);
      commit();
    };
    $("#loadBtn").onclick = () => {
      const a = $("#loadArea");
      a.hidden = false;
      a.innerHTML = loadHTML();
      wireLoad(a);
    };
    $("#debugBtn").onclick = () => openModal("debug");
  }
  function headerHTML() {
    const ph =
      {
        setup: "Setup",
        p1: "Phase 1",
        p2: "Phase 2",
        p3: "Phase 3",
        p4: "Phase 4",
        p5: "Phase 5",
        p6: "Phase 6",
      }[S.phase] || S.phase;
    return (
      '<header class="top"><div class="brand"><h1>Queller Bot Runner</h1><span class="sub">Shadow player</span></div>' +
      '<div class="status"><span class="chip">Turn <b>' +
      S.turn +
      "</b></span>" +
      '<span class="chip">' +
      ph +
      "</span>" +
      (S.strategy
        ? '<span class="chip strat-' +
          S.strategy +
          '">' +
          cap(S.strategy) +
          " strategy</span>"
        : "") +
      (S.settings.wome
        ? '<span class="chip"><abbr title="Warriors of Middle-earth">WoME</abbr></span>'
        : "") +
      "</div>" +
      '<nav class="tools" aria-label="Tools"><button class="btn" id="undoBtn" ' +
      (history.length ? "" : "disabled") +
      ' title="Undo the last action">Undo</button><button class="btn" data-modal="save">Save / Load</button><button class="btn" data-modal="glossary">Glossary</button><button class="btn" data-modal="flow">Flowcharts</button><button class="btn" data-modal="rules">Rules</button><button class="btn" data-modal="calc">Army value</button><button class="btn" data-modal="help">Help</button><button class="btn ghost" data-modal="settings">Settings</button><button class="btn ghost" id="newGameBtn">New game</button></nav></header>'
    );
  }
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

  // ---------- walk panel ----------
  function walkHTML(extra) {
    let h =
      '<section class="panel" aria-labelledby="h-walk"><h2 class="ph" id="h-walk">Walkthrough</h2>';
    h += phaseButtonsHTML(false);
    const w = S.walk;
    if (w && !w.done) {
      h += promptHTML(w);
    } else if (w?.done) {
      h += resultHTML(w);
    } else h += '<div class="idle">' + idleText() + "</div>";
    if (w)
      h +=
        "<details " +
        (w.done ? "" : "open") +
        "><summary>Walk trail — " +
        esc(F[w.entry.page].name) +
        " from “" +
        esc(Q.norm(w.entry.start)) +
        "” (" +
        w.trail.length +
        " steps)</summary>" +
        trailHTML(w) +
        "</details>";
    h += "</section>" + (extra || "") + logHTML();
    return h;
  }
  function idleText() {
    switch (S.phase) {
      case "setup":
        return "Roll a die to choose Queller’s starting strategy (Start of game box).";
      case "p1":
        return "Phase 1: recover Queller’s dice, draw cards and check the hand limit.";
      case "p2":
        return S.strategy === "corruption"
          ? "Phase 2: declare or hide your Fellowship, then check whether Queller changes strategy."
          : "Phase 2: declare or hide your Fellowship. The military strategy has nothing to do here.";
      case "p3":
        return "Phase 3: Queller allocates dice to the Hunt box.";
      case "p4":
        return "Phase 4: roll Queller’s remaining dice (Eyes go to the Hunt box). Roll your own dice too.";
      case "p5":
        return "Phase 5: you act first. Each time Queller is eligible to act, walk from “Phase 5”. Walk the Battle page for each combat round.";
      case "p6":
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
    setup: () => [phaseBtn("setup", "Start of game", true)],
    p1: () => [phaseBtn("p1", "Phase 1", true)],
    p2: () => [
      S.strategy === "corruption"
        ? phaseBtn("p2", "Phase 2", true)
        : phaseBtn("p3", "Phase 3", true),
    ],
    p3: () => [phaseBtn("p3", "Phase 3", true)],
    p4: () => [phaseBtn("p4", "Phase 4", true)],
    p5: () => {
      const b = [
        dicePoolSpent()
          ? phaseBtn("p6", "Phase 6", true)
          : phaseBtn("p5", "Phase 5", true),
        S.battleOpen
          ? phaseBtn("battle2", "Battle (next round)")
          : phaseBtn("battle1", "Battle"),
      ];
      if (!S.settings.dice) b.push(phaseBtn("p6", "Phase 6"));
      return b;
    },
    p6: () => [phaseBtn("next", "Phase 1 (turn " + (S.turn + 1) + ")", true)],
  };
  function phaseButtonsHTML(minimal) {
    const b = [];
    const P = S.phase;
    const busy = S.walk && !S.walk.done;
    if (busy) {
      b.push(
        '<button class="btn small ghost" data-phase="abandon">Abandon this walk</button>',
      );
    } else if (PHASE_BUTTONS[P]) b.push(...PHASE_BUTTONS[P]());
    if (!busy && P !== "setup")
      b.push(
        '<button class="btn small ghost" data-phase="jumpto">Other start point…</button>',
      );
    return (
      '<div class="phasebar"><span class="lbl">' +
      (busy ? "Walking" : "Start point") +
      "</span>" +
      b.join("") +
      "</div>"
    );
  }
  // With dice tracked, Phase 6 replaces Phase 5 once Queller has no usable die left (available or set aside for a minion).
  function dicePoolSpent() {
    const D = Q.DIE_STATE;
    return (
      S.settings.dice &&
      S.dice.pool.length > 0 &&
      !S.dice.pool.some((d) => d.st === D.AVAIL || d.st === D.RESERVED)
    );
  }
  const KIND_NAME = {
    D: "Decision",
    d: "Follow-up decision",
    A: "Action",
    T: "Step",
    P: "Priority list",
    J: "Jump",
    S: "Start",
  };
  function promptHTML(w) {
    const p = w.prompt,
      page = F[w.page],
      node = page.nodes[w.node] || ["D"];
    const kind = p.kind || node[0] || "D";
    const eyebrow =
      '<div class="eyebrow"><span class="sw" style="background:var(--n' +
      kind +
      ')"></span>' +
      esc(page.name) +
      " · " +
      (KIND_NAME[kind] || "") +
      (w.die ? " · " + esc(Q.DIE_NAME[w.die]) + " die" : "") +
      (w.mode === "ringAny" ? " · ring search" : "") +
      "</div>";
    let body = "",
      answers = "";
    const yn = () =>
      '<button class="btn yes" data-ans="yes">Yes</button><button class="btn no" data-ans="no">No</button>';
    switch (p.type) {
      case "yesno": {
        const isRing = p.bold || (node[6]?.bold && !p.sub);
        body =
          (p.board ? '<div class="eyebrow">Board question</div>' : "") +
          '<p class="q">' +
          (isRing ? ringIcon() + " " : "") +
          fmt(p.text) +
          "?</p>" +
          (isRing
            ? '<div class="bold-note">Elven Ring condition: if it is true and Queller lacks the die the next step needs, it uses an Elven Ring (rule 36).</div>'
            : "") +
          (p.items
            ? "<ol>" +
              p.items.map((i) => "<li>" + fmt(i) + "</li>").join("") +
              "</ol>"
            : "");
        answers = yn();
        break;
      }
      case "count":
        body =
          '<div class="eyebrow">Board question</div><p class="q">' +
          fmt(p.text) +
          '</p><p><label for="cnt">Number</label> <input type="number" id="cnt" class="askctl" min="' +
          p.min +
          '" max="' +
          p.max +
          '" value="' +
          (p.value | 0) +
          '" style="min-width:100px"></p>';
        answers = '<button class="btn yes" id="cntOk">Continue</button>';
        break;
      case "choice":
        body =
          '<div class="eyebrow">Priority list — you decide</div><p class="q">' +
          fmt(p.text) +
          "</p><ol>" +
          (p.items || []).map((i) => "<li>" + fmt(i) + "</li>").join("") +
          "</ol>";
        answers = p.options
          .map(
            (o) =>
              '<button class="btn" data-ans="' +
              esc(o.v) +
              '">' +
              esc(o.l) +
              "</button>",
          )
          .join("");
        break;
      case "situ":
        body =
          '<div class="eyebrow">Board check (for a card in Queller’s hand)</div><p class="q">' +
          fmt(p.text) +
          "</p>";
        answers = yn();
        break;
      case "confirm":
        body =
          '<div class="eyebrow">' +
          (p.ctx === "combat" ? "Combat card" : "Card") +
          ' check — the condition on this card is met</div><p class="q">Is this card *playable* now? Every paragraph must be usable and have an effect (rule 17).</p>' +
          cardHTML(byId[p.card], p.ctx === "combat" ? "combat" : "event");
        answers =
          '<button class="btn yes" data-ans="yes">Playable</button><button class="btn no" data-ans="no">Not playable</button>';
        break;
      case "diecheck":
        body =
          '<p class="q">' +
          fmt(p.text) +
          '</p><div class="help">Grey box: ' +
          esc(p.label) +
          "</div>";
        answers = yn();
        break;
      case "ring":
        body = '<p class="q">' + fmt(p.text) + "</p>";
        answers =
          '<button class="btn yes" data-ans="yes">Ring used</button><button class="btn no" data-ans="no">No ring available</button>';
        break;
      case "action":
        body =
          '<p class="q">Queller: ' +
          fmt(p.text) +
          "</p>" +
          (p.help ? '<div class="help">' + fmt(p.help) + "</div>" : "") +
          (p.pass ? "" : '<div class="help">' + dieHelpText(w) + "</div>");
        answers =
          '<button class="btn yes" data-ans="done">Done</button>' +
          (p.auto
            ? ""
            : '<button class="btn no" data-ans="no">Not possible (rule 29)</button>');
        break;
      case "playcard": {
        const c = byId[p.card];
        body =
          '<p class="q">Queller plays a card' +
          (p.combat ? " as its combat card" : "") +
          ":</p>" +
          cardHTML(c) +
          (w.steps?.length
            ? '<ol class="steps">' +
              w.steps.map((s) => "<li>" + fmt(s) + "</li>").join("") +
              "</ol>"
            : "") +
          '<div class="help">Resolve it with the matching decision page (rule 12). ' +
          (Q.ON_TABLE(p.card) && !p.combat
            ? "It stays on the table until discarded."
            : "") +
          "</div>";
        answers = '<button class="btn yes" data-ans="done">Done</button>';
        break;
      }
      case "step":
        body =
          '<p class="q">' +
          fmt(p.text) +
          "</p>" +
          (p.items
            ? "<ol>" +
              p.items.map((i) => "<li>" + fmt(i) + "</li>").join("") +
              "</ol>"
            : "");
        answers = p.move
          ? '<button class="btn yes" data-ans="done">Done</button><button class="btn no" data-ans="no">Not possible</button>'
          : '<button class="btn yes" data-ans="done">Continue</button>';
        break;
      case "roll":
        body = '<p class="q">' + fmt(p.text) + "</p>";
        answers = p.options
          .map(
            (o) =>
              '<button class="btn" data-ans="' + o + '">' + o + "</button>",
          )
          .join("");
        break;
      case "priority": {
        const half = w.page === "BA" ? "combat" : "event";
        body =
          '<p class="q">' +
          fmt(p.text) +
          "</p><ol>" +
          (p.items || []).map((i) => "<li>" + fmt(i) + "</li>").join("") +
          "</ol>" +
          (p.steps
            ? '<ol class="steps">' +
              p.steps.map((s) => "<li>" + fmt(s) + "</li>").join("") +
              "</ol>"
            : "") +
          (p.card
            ? "<div><b>Chosen:</b> " + cardHTML(byId[p.card], half) + "</div>"
            : "") +
          (p.choice ? "<p><b>Result:</b> " + esc(p.choice) + "</p>" : "") +
          (!p.steps && !p.card
            ? '<div class="help">Apply the list as filters (rule 30), then continue.</div>'
            : "");
        answers = '<button class="btn yes" data-ans="ok">Continue</button>';
        break;
      }
      case "battleForm":
        body = battleFormHTML(p);
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
  function rowChk(id, label, on, attrs) {
    return (
      '<label class="row chk"><span><span class="lt">' +
      label +
      '</span></span><input type="checkbox" id="' +
      id +
      '" ' +
      (attrs || "") +
      (on ? " checked" : "") +
      "></label>"
    );
  }
  function rowNum(id, label, value, attrs = "") {
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
      esc(plain(label)) +
      '">\u2212</button><span class="n" id="' +
      id +
      '-n" aria-live="polite">' +
      value +
      '</span><button type="button" ' +
      attrs +
      ' data-d="1" aria-label="Increase ' +
      esc(plain(label)) +
      '">+</button></span></div>'
    );
  }
  function battleFormHTML(p) {
    const B = S.battle || {},
      f = B.figures || {};
    const chk = (id, l, v) => rowChk("bf-" + id, l, v);
    let h = '<p class="q">' + esc(p.text) + '</p><div class="bform tracker">';
    const nl = B.nazLead || 0;
    h +=
      rowNum(
        "bf-nazLead",
        "Nazg\u00fbl leadership in the battle",
        nl,
        'data-bs="1"',
      ) +
      '<input type="hidden" id="bf-nazLead" value="' +
      nl +
      '">';
    h += chk(
      "shadowElite",
      "A Shadow Elite unit is in the battle",
      B.shadowElite,
    );
    h += chk(
      "seElite",
      "A Southrons & Easterlings Elite is in the battle",
      B.seElite,
    );
    h += chk(
      "isengardStronghold",
      "Isengard unit in the battle and the defender is in a Stronghold",
      B.isengardStronghold,
    );
    h += chk(
      "defInFs",
      "The defending army is in the Fellowship region",
      B.defInFs,
    );
    h += chk(
      "nearMoria",
      "The defending army is within two regions of Moria",
      B.nearMoria,
    );
    if (S.settings.wome) {
      h +=
        chk("underSiege", "The Shadow army is under siege", B.underSiege) +
        chk(
          "attackingSiege",
          "The Shadow army is attacking in a siege",
          B.attackingSiege,
        ) +
        '<h3 class="full">Faction figures with the Shadow army</h3>' +
        chk("f-corsairs", "Corsairs", f.corsairs) +
        chk("f-dunlendings", "Dunlendings", f.dunlendings) +
        chk("f-spiders", "Spiders", f.spiders);
    }
    return h + "</div>";
  }
  function readBattleForm() {
    const g = (id) => {
      const e = document.getElementById("bf-" + id);
      return e ? e.checked : false;
    };
    return {
      nazLead: +($("#bf-nazLead").value || 0),
      shadowElite: g("shadowElite"),
      seElite: g("seElite"),
      isengardStronghold: g("isengardStronghold"),
      defInFs: g("defInFs"),
      nearMoria: g("nearMoria"),
      figures: {
        corsairs: g("f-corsairs"),
        dunlendings: g("f-dunlendings"),
        spiders: g("f-spiders"),
      },
      underSiege: g("underSiege"),
      attackingSiege: g("attackingSiege"),
    };
  }
  // Which die the walk's current action uses, for the action prompt's help line.
  function dieHelpText(w) {
    if (S.settings.dice && w.dieObj != null)
      return "Uses the " + esc(S.dice.pool[w.dieObj].face) + " die.";
    return w.die ? "Uses a " + esc(Q.DIE_NAME[w.die]) + " die." : "";
  }
  // The deck line above a card's title.
  function cardTag(c) {
    if (c.deck === "F") return "Faction Event · " + (c.faction || "Sauron");
    if (c.deck === "B") return "Call to Battle · " + c.faction;
    return (
      (c.deck === "C" ? "Character" : "Strategy") +
      " · " +
      (c.type || "") +
      " symbol"
    );
  }
  // Card text as paragraphs (blank lines separate them).
  const paragraphsHTML = (text) =>
    esc(text || "")
      .split("\n\n")
      .map((p) => "<p>" + p + "</p>")
      .join("");
  // The combat (bottom) half of a card; `only` when the event half is not shown above it.
  function combatHalfHTML(c, showEvent) {
    return (
      '<div class="combat' +
      (showEvent ? "" : " only") +
      '"><div class="ct"><b style="font-size:.9rem">' +
      esc(c.ct) +
      '</b><span class="tag">combat</span></div>' +
      (c.cc ? '<div class="cond">' + esc(c.cc) + "</div>" : "") +
      paragraphsHTML(c.ctext) +
      "</div>"
    );
  }
  function cardHTML(c, half) {
    // half: "event" (top half only), "combat" (bottom half only) or omitted for the whole card
    const tag = cardTag(c);
    const showEvent = half !== "combat" || c.deck === "B",
      showCombat = half !== "event" && !!c.ct;
    let h =
      '<div class="card' +
      (half ? " half" : "") +
      '"><div class="ct"><b>' +
      esc(c.title) +
      '</b><span class="tag">' +
      esc(tag) +
      (c.init != null ? " · init " + esc(c.init) : "") +
      "</span></div>";
    if (showEvent) {
      if (c.cond) h += '<div class="cond">' + esc(c.cond) + "</div>";
      h += paragraphsHTML(c.text);
    }
    if (showCombat) h += combatHalfHTML(c, showEvent);
    if (half)
      h +=
        '<div class="tag halfnote">' +
        (half === "combat"
          ? "Bottom (combat) half shown"
          : "Top (event) half shown") +
        "</div>";
    return h + "</div>";
  }
  function resultHTML(w) {
    const r = w.result || "";
    let big = "",
      small = "";
    if (r === "action") {
      big = "Queller acts: " + esc(plain(w.trail[w.trail.length - 1].text));
      small =
        "Do this on the board, then take your own action. When Queller is next eligible to act, walk again.";
    } else if (r === "pass") {
      big = "Queller passes.";
    } else if (r === "noaction") {
      big = "Queller has no usable action.";
      small = esc(w.trail[w.trail.length - 1].text);
    } else if (r === "strategy") {
      big = esc(w.trail[w.trail.length - 1].text);
    } else if (r === "battleNext") {
      big = "Combat continues.";
      small = "After both sides resolve this round, walk “Battle: next round”.";
    } else if (r === "end") {
      big = "End of the walk.";
    } else if (r.startsWith("phase:")) {
      big = esc(w.trail[w.trail.length - 1].text);
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
  function trailHTML(w) {
    return (
      '<ul class="trail" tabindex="0" aria-label="Walk trail">' +
      w.trail
        .map((e) => {
          const k = e.kind;
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
            }[k] || k;
          if (k === "q" && e.auto) label = "Auto";
          let txt = (e.ring ? ringIcon() + " " : "") + fmt(e.text);
          if (e.die)
            txt += ' <span class="why">(' + esc(e.die) + " die)</span>";
          if (e.why) txt += ' <span class="why">— ' + fmt(e.why) + "</span>";
          if (k === "pri" && e.card)
            txt +=
              ' <span class="why">→ ' + esc(byId[e.card].title) + "</span>";
          if (k === "pri" && e.choice)
            txt += ' <span class="why">→ ' + esc(e.choice) + "</span>";
          return (
            '<li class="t-' +
            k +
            (e.auto ? " auto" : "") +
            '"><span class="k">' +
            label +
            '</span><span class="txt">' +
            txt +
            "</span>" +
            (e.answer ? '<span class="a">' + esc(e.answer) + "</span>" : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }
  function logHTML() {
    const items = S.log.slice(-40).reverse();
    return (
      '<div class="panel" style="margin-top:14px"><h2 class="ph">Log <span class="r">' +
      S.log.length +
      ' entries</span></h2><ul class="log" tabindex="0" aria-label="Game log">' +
      items
        .map(
          (l) =>
            '<li class="' +
            (l.card ? "c" : "") +
            '">T' +
            l.turn +
            " · " +
            esc(l.t) +
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
      esc(label || "Elven Ring condition") +
      '"><title>' +
      esc(label || "Elven Ring condition (rule 36)") +
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
  function diceHTML() {
    const d = S.dice,
      av = Q.availDice(S);
    let h =
      '<section class="panel" aria-labelledby="h-dice"><h2 class="ph" id="h-dice">Queller’s dice <span class="r">' +
      Q.diceCount(S) +
      " action dice" +
      (d.factionDie && S.settings.wome ? " + Faction die" : "") +
      "</span></h2>";
    h += SPRITE;
    if (!d.pool.length)
      h += '<div class="notice">Dice are recovered in Phase 1.</div>';
    else {
      const die = ([x, i]) => {
        const st = {
          pool: "not yet rolled",
          hunt: "in the Hunt box",
          avail: "available — tap to mark it used",
          used: "used",
          reserved: "set aside for a minion",
        }[x.st];
        const cls =
          "die k-" +
          x.k +
          " st-" +
          x.st +
          (x.face ? " f-" + x.face.replace("/", "-") : "");
        const inner =
          (x.face
            ? faceIcon(x.face)
            : '<span class="blank" aria-hidden="true"></span>') +
          '<span class="sr">' +
          (x.k === "F" ? "Faction die" : "Action die") +
          (x.face ? " showing " + esc(x.face) : "") +
          ", " +
          st +
          "</span>";
        const t = esc(x.face || "not rolled") + " · " + st;
        return x.st === "avail"
          ? '<li><button type="button" class="' +
              cls +
              '" data-spend="' +
              i +
              '" title="' +
              t +
              '">' +
              inner +
              "</button></li>"
          : '<li class="' + cls + '" title="' + t + '">' + inner + "</li>";
      };
      const all = d.pool.map((x, i) => [x, i]);
      const hunt = all.filter(([x]) => x.st === "hunt"),
        rest = all.filter(([x]) => x.st !== "hunt");
      h +=
        '<div class="dicewrap"><div class="huntbox"><span class="hlbl">Hunt box</span><ul class="dice" aria-label="Dice in the Hunt box">' +
        (hunt.length
          ? hunt.map(die).join("")
          : '<li class="die empty" aria-hidden="true"></li>') +
        '</ul></div><ul class="dice" aria-label="Dice">' +
        rest.map(die).join("") +
        "</ul></div>";
      if (av.length)
        h +=
          '<div class="notice" style="margin-top:8px">Tap an available die to mark it used (a card effect, for example).</div>';
    }
    h +=
      '<div class="legend" aria-hidden="true">' +
      ["Character", "Army", "Muster", "Army/Muster", "Event", "Eye"]
        .map((f) => "<span>" + faceIcon(f) + esc(f) + "</span>")
        .join("") +
      (d.factionDie && S.settings.wome
        ? ["Recruit", "Play/Draw", "Recruit/Play", "Recruit/Draw", "Wild"]
            .map((f) => "<span>" + faceIcon(f) + esc(f) + "</span>")
            .join("")
        : "") +
      "</div>";
    h +=
      '<div class="dicerow"><span>Available: <b>' +
      av.length +
      "</b></span>" +
      (S.minionReserved ? "<span>1 set aside for a minion</span>" : "") +
      (Q.ringsKnown(S)
        ? "<span>Rings held: <b>" + S.board.rings + "</b></span>"
        : "") +
      "</div>";
    const huntCards = S.cards.table.filter(
      (id) => id === Q.BALROG || id === "sa009",
    );
    if (huntCards.length)
      h +=
        '<div class="notice" style="margin-top:8px">At a Hunt roll: ' +
        huntCards
          .map((id) =>
            id === "sa009"
              ? "Flocks of Crebain on the table — discard it before the roll for +1 to every Hunt die"
              : "Balrog of Moria on the table — discard it for an extra Hunt tile when the Fellowship moves into, out of or through Moria while declared or revealed",
          )
          .join("; ") +
        ".</div>";
    return h + "</section>";
  }
  // ---------- cards panel ----------
  function cardsHTML() {
    const c = S.cards,
      hc = Q.handCounts(S);
    let h =
      '<section class="panel" aria-labelledby="h-cards"><h2 class="ph" id="h-cards">Queller’s cards <span class="r">' +
      hc.total +
      " in hand" +
      (S.settings.wome ? " · " + hc.F + " faction" : "") +
      "</span></h2>";
    h +=
      '<div class="hand"><ul aria-label="Cards in hand: ' +
      hc.C +
      " Character, " +
      hc.S +
      " Strategy" +
      (S.settings.wome ? ", " + hc.F + " Faction Event" : "") +
      '">' +
      c.hand
        .map(
          (id) =>
            '<li class="back' +
            (byId[id].deck === "S" ? " s" : "") +
            '" title="' +
            (byId[id].deck === "C" ? "Character" : "Strategy") +
            ' card"><span aria-hidden="true">' +
            (byId[id].deck === "C" ? "C" : "S") +
            '</span><span class="sr">' +
            (byId[id].deck === "C" ? "Character" : "Strategy") +
            " card</span></li>",
        )
        .join("") +
      c.factionHand
        .map(
          () =>
            '<li class="back f" title="Faction Event card"><span aria-hidden="true">F</span><span class="sr">Faction Event card</span></li>',
        )
        .join("") +
      "</ul></div>";
    h +=
      '<div class="kv"><span>Character deck</span><span class="v">' +
      c.decks.C.length +
      " / " +
      c.discards.C.length +
      ' discarded</span><span>Strategy deck</span><span class="v">' +
      c.decks.S.length +
      " / " +
      c.discards.S.length +
      " discarded</span>" +
      (S.settings.wome
        ? '<span>Faction deck</span><span class="v">' +
          c.decks.F.length +
          " / " +
          c.discards.F.length +
          " discarded</span>"
        : "") +
      "</div>";
    const tbl = c.table.concat(c.factionTable);
    h += '<div class="more tablecards"><div class="mlbl">On the table</div>';
    if (!tbl.length)
      h +=
        '<div class="notice">No cards in play. Cards Queller plays “on the table” are listed here until discarded.</div>';
    else
      h += tbl
        .map((id) => {
          const open = shownCard === id,
            cd = byId[id];
          return (
            '<div class="tc"><b>' +
            esc(cd.title) +
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
            (cd.reminder
              ? '<div class="notice rem">' + esc(cd.reminder) + "</div>"
              : "") +
            "</div>" +
            (open ? cardHTML(cd) : "")
          );
        })
        .join("");
    h += "</div>";
    return h + "</section>";
  }
  // ---------- tracker ----------
  // Tracker rows: a checkbox, a number stepper and a Free Peoples nation selector, keyed by the tracker path (e.g. "fs.progress").
  const tId = (k) => "t-" + k.replaceAll(".", "-");
  const tChk = (k, l) => rowChk(tId(k), l, getT(k), 'data-t="' + k + '"');
  const tNum = (k, l) => rowNum(tId(k), l, getT(k), 'data-step="' + k + '"');
  const tSel = (k, l) =>
    '<div class="row"><label for="' +
    tId(k) +
    '">' +
    l +
    '</label><select id="' +
    tId(k) +
    '" data-t="' +
    k +
    '"><option value="passive"' +
    (getT(k) === "passive" ? " selected" : "") +
    '>Passive</option><option value="active"' +
    (getT(k) === "active" ? " selected" : "") +
    '>Active</option><option value="war"' +
    (getT(k) === "war" ? " selected" : "") +
    ">At war</option></select></div>";
  // The situational card checks answered this turn, with a button to forget them (and the playability cache).
  function situBlockHTML() {
    const sk = Object.keys(S.situ);
    return (
      '<h3>Card checks answered this turn</h3><div class="situ">' +
      (sk.length
        ? sk
            .map(
              (k) =>
                '<div class="row"><span>' +
                esc(Q.SITU_Q[k]) +
                "</span><b>" +
                (S.situ[k] ? "Yes" : "No") +
                "</b></div>",
            )
            .join("")
        : '<div class="row"><span>None yet</span></div>') +
      (sk.length || Object.keys(S.playable).length
        ? '<div class="row"><span></span><button class="btn small" data-t-reset="1">Forget</button></div>'
        : "") +
      "</div>"
    );
  }
  // Without the full tracker, only the facts the dice pool and card priorities need are tracked.
  function minimalTrackerHTML() {
    let m = "";
    if (S.settings.dice)
      m +=
        "<h3>Minions in play (sizes the dice pool)</h3>" +
        tChk("chars.saruman", "Saruman") +
        tChk("chars.witchKing", "Witch King") +
        tChk("chars.mouth", "Mouth of Sauron");
    if ((S.settings.cards || S.settings.dice) && S.settings.wome)
      m +=
        "<h3>Shadow factions in play (" +
        (S.settings.cards ? "card priorities" : "") +
        (S.settings.cards && S.settings.dice ? ", " : "") +
        (S.settings.dice ? "Faction die" : "") +
        ")</h3>" +
        tChk("factions.corsairs", "Corsairs") +
        tChk("factions.dunlendings", "Dunlendings") +
        tChk("factions.spiders", "Spiders");
    if (S.settings.dice)
      m +=
        "<h3>Hunt box and Elven Rings</h3>" +
        tNum("fs.companions", "Companions in the Fellowship") +
        tNum("rings", "Elven Rings held by the Shadow");
    if (S.settings.cards) m += situBlockHTML();
    if (!m) return "";
    return (
      '<section class="panel" aria-labelledby="h-track"><h2 class="ph" id="h-track">Board tracker <span class="r">minimal</span></h2><div class="tracker">' +
      m +
      "</div></section>"
    );
  }
  function trackerHTML() {
    if (!S.settings.tracker) return minimalTrackerHTML();
    let h =
      '<section class="panel" aria-labelledby="h-track"><h2 class="ph" id="h-track">Board tracker <span class="r">answers what it can</span></h2><div class="tracker">';
    h +=
      "<h3>Score</h3>" +
      tNum("shadowVP", "Shadow victory points") +
      tNum("corruption", "Corruption") +
      tNum("rings", "Elven Rings held by the Shadow");
    h +=
      "<h3>Fellowship</h3>" +
      tNum("fs.progress", "Progress counter") +
      tNum("fs.companions", "Companions in the Fellowship") +
      tChk("fs.revealed", "Revealed") +
      tChk("fs.mordor", "On the Mordor track") +
      tChk("fs.atStart", "Figure in Rivendell") +
      tChk("fs.inFPSettlement", "Figure in a Free Peoples settlement region") +
      tChk("fs.inStrongholdOrSea", "Figure in a Stronghold or at sea") +
      tChk("fs.guideGollum", "Gollum is the Guide");
    h +=
      "<h3>Characters in play</h3>" +
      tChk("chars.saruman", "Saruman") +
      tChk("chars.witchKing", "Witch King") +
      tChk("chars.mouth", "Mouth of Sauron") +
      tNum("nazgul", "Nazg\u00fbl on the map") +
      tChk("chars.gandalfWhite", "Gandalf the White") +
      tChk("chars.aragorn", "Aragorn, Heir to Isildur");
    const selN = (k, l, max) => {
      let o = "";
      for (let v = 0; v <= max; v++)
        o +=
          '<option value="' +
          v +
          '"' +
          ((getT(k) | 0) === v ? " selected" : "") +
          ">" +
          Q.snLabel(v) +
          "</option>";
      return (
        '<div class="row"><label for="' +
        tId(k) +
        '">' +
        l +
        '</label><select id="' +
        tId(k) +
        '" data-t="' +
        k +
        '" data-num="1">' +
        o +
        "</select></div>"
      );
    };
    h +=
      "<h3>Shadow nations (Political Track)</h3>" +
      selN("nations.sauron", "Sauron", 3) +
      selN("nations.isengard", "Isengard", 3) +
      selN("nations.se", "Southrons & Easterlings", 3);
    h +=
      "<h3>Free Peoples nations</h3>" +
      tSel("nations.gondor", "Gondor") +
      tSel("nations.rohan", "Rohan") +
      tSel("nations.north", "North") +
      tSel("nations.dwarves", "Dwarves") +
      tSel("nations.elves", "Elves");
    if (S.settings.wome)
      h +=
        "<h3>Factions in play</h3>" +
        tChk("factions.corsairs", "Corsairs") +
        tChk("factions.dunlendings", "Dunlendings") +
        tChk("factions.spiders", "Spiders") +
        tChk("factions.ents", "Ents") +
        tChk("factions.eagles", "Eagles") +
        tChk("factions.deadmen", "Dead Men");
    h += situBlockHTML();
    return h + "</div></section>";
  }
  // dotted paths into S.board ("fs.progress")
  function getT(k) {
    return k.split(".").reduce((o, p) => o[p], S.board);
  }
  function setT(k, v) {
    const ps = k.split(".");
    let o = S.board;
    for (let i = 0; i < ps.length - 1; i++) o = o[ps[i]];
    o[ps[ps.length - 1]] = v;
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
  function trackerChange(k, v) {
    let asks = [];
    const from = getT(k);
    act(
      () => {
        setT(k, v);
        if (/^(nations|chars|fs|factions)\./.test(k) || k === "rings")
          S.playable = {};
        asks = Q.tableTriggers(S, { key: k, from, to: v });
      },
      { a: "tracker", key: k, from, to: v },
    );
    const next = () => {
      const a = asks.shift();
      if (!a) return;
      ask({
        title: "Discard “" + byId[a.card].title + "”?",
        text: a.q,
        buttons: [
          { v: "ok", label: "Discard it", primary: true },
          { v: "no", label: "Keep it" },
        ],
        onPick: (v) => {
          if (v === "ok")
            act(
              () => Q.discardCard(S, a.card, "its discard condition was met"),
              { a: "tableTrigger", card: a.card },
            );
          next();
        },
      });
    };
    next();
  }

  // ---------- wiring ----------
  function wire() {
    $("#undoBtn").onclick = undo;
    const ng = $("#newGameBtn");
    if (ng) ng.onclick = askNewGame;
    document
      .querySelectorAll("[data-modal]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            openModal(
              b.dataset.modal,
              b.dataset.modal === "flow" ? { current: true } : undefined,
            )),
      );
    document
      .querySelectorAll("[data-phase]")
      .forEach((b) => (b.onclick = () => onPhase(b.dataset.phase)));
    document
      .querySelectorAll("[data-ans]")
      .forEach((b) => (b.onclick = () => onAnswer(b.dataset.ans)));
    const bf = $("#bfOk");
    if (bf)
      bf.onclick = () => {
        const form = readBattleForm();
        act(
          () => {
            Q.answer(S, form);
          },
          { a: "answer", prompt: "battleForm", value: form },
        );
      };
    document.querySelectorAll("[data-bs]").forEach(
      (b) =>
        (b.onclick = () => {
          const h = $("#bf-nazLead");
          const v = Math.max(0, Math.min(8, (+h.value || 0) + +b.dataset.d));
          h.value = v;
          $("#bf-nazLead-n").textContent = v;
        }),
    );
    const co = $("#cntOk");
    if (co)
      co.onclick = () => {
        const v = $("#cnt").value;
        act(
          () => {
            Q.answer(S, v);
            afterWalk();
          },
          {
            a: "answer",
            prompt: "count",
            page: S.walk?.page,
            node: S.walk?.node,
            value: v,
          },
        );
      };
    document
      .querySelectorAll("[data-spend]")
      .forEach((b) => (b.onclick = () => spendDieClick(+b.dataset.spend)));
    document
      .querySelectorAll("[data-card]")
      .forEach((b) => (b.onclick = () => onCard(b.dataset.card, b.dataset.id)));
    document.querySelectorAll(".tracker [data-t]").forEach((el) => {
      el.onchange = () => trackerChange(el.dataset.t, trackerValue(el));
    });
    document.querySelectorAll("[data-step]").forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.step;
          const lim = STEP_LIMITS[k] || [0, 99];
          trackerChange(
            k,
            Math.min(lim[1], Math.max(lim[0], getT(k) + +b.dataset.d)),
          );
        }),
    );
    const tr = $("[data-t-reset]");
    if (tr)
      tr.onclick = () =>
        act(
          () => {
            S.situ = {};
            S.playable = {};
          },
          { a: "forgetCardChecks" },
        );
  }
  function onAnswer(a) {
    const w = S.walk,
      p = w?.prompt;
    if (!p) return;
    act(
      () => {
        let v = a;
        if (["yesno", "situ", "confirm", "diecheck", "ring"].includes(p.type))
          v = a === "yes";
        Q.answer(S, v);
        afterWalk();
      },
      {
        a: "answer",
        prompt: p.type,
        page: w.page,
        node: w.node,
        text: p.text ? String(p.text).slice(0, 80) : undefined,
        card: p.card,
        value: a,
      },
    );
  }
  // A tracker field's value: checkboxes give a boolean, numeric fields a number, the rest their text.
  function trackerValue(el) {
    if (el.type === "checkbox") return el.checked;
    return el.dataset.num ? +el.value : el.value;
  }
  // The player marks an available die as used by hand (the [data-spend] buttons in the dice row).
  function spendDieClick(i) {
    const d = S.dice.pool[i];
    if (d?.st !== "avail") return;
    ask({
      title: "Mark this die as used?",
      text:
        "The " +
        d.face +
        (d.k === "F" ? " Faction" : "") +
        " die will be marked as used for the rest of this turn. Undo reverses it.",
      buttons: [
        { v: "ok", label: "Mark as used", primary: true },
        { v: "no", label: "Cancel" },
      ],
      onPick: (v) => {
        if (v !== "ok") return;
        act(
          () => {
            const d2 = S.dice.pool[i];
            if (d2?.st === "avail") Q.spendDie(S, d2, "marked by you");
          },
          { a: "spendDie", index: i, face: d.face },
        );
      },
    });
  }
  function afterWalk() {
    const w = S.walk;
    if (!w?.done) return;
    const r = w.result || "";
    if (w.entry.page === "BA") {
      S.battleOpen = r === "battleNext";
    } else if (r !== "") {
      S.battleOpen = false;
    }
    if (r === "strategy") {
      S.phase = "p1";
    } else if (r.startsWith("phase:")) {
      const name = r.slice(6);
      const map = {
        "Phase 2": "p2",
        "Phase 3": "p3",
        "Phase 4": "p4",
        "Phase 5": "p5",
      };
      if (map[name]) S.phase = map[name];
    }
  }
  function onPhase(id) {
    act(
      () => {
        if (id === "abandon") {
          S.walk = null;
          Q.log(S, "Walk abandoned.");
          return;
        }
        if (id === "next") {
          Q.nextTurn(S);
          return;
        }
        if (id === "p6") {
          S.phase = "p6";
          S.walk = null;
          Q.log(
            S,
            "Phase 6: check victory conditions (Shadow VP 10, Corruption 12, Ring destroyed).",
          );
          return;
        }
        if (id === "battle1") {
          Q.startBattle(S, 1);
          afterWalk();
          return;
        }
        if (id === "battle2") {
          Q.startBattle(S, 2);
          afterWalk();
          return;
        }
        if (id === "jumpto") {
          openModal("jump");
          return;
        }
        if (id === "setup") {
          Q.startPhase(S, "setup");
          afterWalk();
          return;
        }
        Q.startPhase(S, id);
        afterWalk();
      },
      { a: "phase", id },
    );
  }
  function onCard(k, id) {
    if (k === "discard") {
      const c = byId[id];
      ask({
        title: "Discard “" + c.title + "”?",
        text: "Do this when the card’s own text says it must be discarded, or when a Free Peoples action discards it. It goes to the discard pile.",
        buttons: [
          { v: "ok", label: "Discard", primary: true },
          { v: "no", label: "Cancel" },
        ],
        onPick: (v) => {
          if (v !== "ok") return;
          act(
            () => {
              Q.discardCard(S, id, "discarded from the table");
              if (shownCard === id) shownCard = null;
            },
            { a: "discardTable", card: id },
          );
        },
      });
      return;
    }
    shownCard = k === "show" ? id : null;
    DBG.action({ a: "tableCard", show: k === "show", card: id }, S);
    render();
  }

  // expose for modals file
  window.QBUI = {
    showErrBar,
    ringIcon,
    RING_PATH,
    get S() {
      return S;
    },
    set S(v) {
      S = v;
    },
    get history() {
      return history;
    },
    set history(v) {
      history = v;
    },
    act,
    commit,
    render,
    fmt,
    esc,
    plain,
    cardHTML,
    rowChk,
    rowNum,
    openModal,
    setModal: (m) => {
      modal = m;
    },
    getModal: () => modal,
    loadJSON,
    lsGet,
    lsSet,
    LS,
    LSLOTS,
    boot,
    LEGAL,
  };
  function openModal(name, arg) {
    modal = { name, arg };
    if (name !== "ask") DBG.action({ a: "modal", name }, S);
    window.QBUI.renderModal();
  }
  function ask(a) {
    openModal("ask", a);
  }
  function askNewGame() {
    ask({
      title: "Start a new game?",
      text: "The current game is replaced and its autosave is cleared. Named save slots are kept.",
      buttons: [
        { v: "ok", label: "Start a new game", primary: true },
        { v: "no", label: "Cancel" },
      ],
      onPick: (v) => {
        if (v !== "ok") return;
        DBG.begin({ a: "newGameScreen" }, S);
        history = [];
        S = null;
        modal = null;
        lsSet(LS, "");
        DBG.end(null);
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
  function wireLoad(a) {
    window.QBUI.wireLoad(a);
  }
})();
