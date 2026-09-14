// ===== Modals: glossary, flowcharts (SVG), rules, calculator, save/load, settings, jump-to =====
(function () {
  const Q = window.QB,
    F = window.QB_FLOW,
    U = window.QBUI,
    G = window.QB_GLOSSARY,
    DBG = window.QB_DEBUG;
  const esc = U.escapeHTML,
    fmt = U.formatText;
  const $ = (s) => document.querySelector(s);
  const CALC_DEFAULTS = {
    reg: 0,
    elite: 0,
    lead: 0,
    cotw: 0,
    fort: false,
    strong: false,
    sortie: false,
  };
  let flowPage = "C14",
    calc = { ...CALC_DEFAULTS };

  let opener = null,
    flowText = false;
  U.renderModal = function () {
    const m = U.getModal();
    if (!m) return;
    let old = $("#modal");
    const reopen = !!old;
    if (old) old.remove();
    else opener = document.activeElement;
    const el = document.createElement("div");
    el.className = "modal";
    el.id = "modal";
    const [title, body, narrow] = content(m);
    const hb =
      m.name === "calc"
        ? '<button type="button" class="btn" id="calcClear">Clear</button>'
        : "";
    el.innerHTML =
      '<div class="box' +
      (narrow ? " narrow" : "") +
      '" role="dialog" aria-modal="true" aria-labelledby="mtitle"><header><h2 id="mtitle" tabindex="-1">' +
      esc(title) +
      '</h2><span class="hb">' +
      hb +
      '<button class="btn x" id="mclose">Close</button></span></header>' +
      body +
      "</div>";
    document.body.appendChild(el);
    const app = $("#app");
    if (app) app.setAttribute("inert", "");
    $("#mclose").onclick = U.closeModal;
    el.addEventListener("click", (e) => {
      if (e.target === el) U.closeModal();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = [
        ...el.querySelectorAll(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0],
        last = f.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    });
    el.querySelectorAll(".body").forEach((b) => {
      b.setAttribute("tabindex", "0");
      b.setAttribute("role", "region");
      b.setAttribute("aria-label", title + " content");
    });
    wireModal(m);
    if (m.name === "glossary" && m.arg) {
      const t = el.querySelector('[data-gl="' + m.arg + '"]');
      if (t) {
        t.scrollIntoView({ block: "start" });
        t.focus();
      }
    } else if (!reopen) $("#mtitle").focus();
  };
  U.closeModal = function () {
    U.setModal(null);
    const m = $("#modal");
    if (m) m.remove();
    const app = $("#app");
    if (app) app.removeAttribute("inert");
    if (opener?.isConnected) {
      opener.focus();
    }
    opener = null;
  };
  function content(m) {
    switch (m.name) {
      case "glossary":
        return [
          "Glossary of terms",
          '<div class="body"><p class="notice">Words in italics on the flowcharts are defined here. Hover a term anywhere in the app for its definition; click it to open this list.</p><dl class="gl">' +
            Object.keys(G)
              .map(
                (k) =>
                  '<dt data-gl="' +
                  k +
                  '" tabindex="-1">' +
                  esc(k) +
                  "</dt><dd>" +
                  fmt(G[k]) +
                  "</dd>",
              )
              .join("") +
            "</dl></div>",
          true,
        ];
      case "rules":
        return ["General rules", rulesHTML(), true];
      case "flow":
        if (m.arg?.current) {
          flowPage = currentPage();
          m.arg = null;
        }
        return [
          "Flowcharts",
          '<div class="tabs">' +
            Object.keys(F)
              .map(
                (k) =>
                  '<button class="btn small' +
                  (k === flowPage ? " on" : "") +
                  '" data-fp="' +
                  k +
                  '">' +
                  esc(
                    F[k].name
                      .replace("Strategy ", "")
                      .replace("Move/Recruit/Play/Draw ", ""),
                  ) +
                  "</button>",
              )
              .join("") +
            '</div><div class="body"><p class="notice" style="margin:0 0 8px">Green: start point. Red: action. Yellow/blue: decision. Grey: jump to another page. Purple: priority list. Orange: step. The current node of the walk is outlined; visited nodes are shaded.</p><p style="margin:0 0 8px"><button class="btn small" id="flowToggle" aria-pressed="' +
            flowText +
            '">' +
            (flowText ? "Show the diagram" : "Show as text") +
            "</button></p>" +
            (flowText
              ? textPage(flowPage)
              : '<div class="flowwrap">' + svgPage(flowPage) + "</div>") +
            "</div>",
          false,
        ];
      case "calc":
        return ["Army value calculator", calcHTML(), true];
      case "save":
        return ["Save and load", saveHTML(), true];
      case "settings":
        return ["Settings", settingsHTML(), true];
      case "jump":
        return ["Walk from another start point", jumpHTML(), true];
      case "help":
        return ["Help", helpHTML(), true];
      case "debug":
        return ["Debug log", debugHTML(), true];
      case "ask": {
        const a = m.arg;
        let inp = "";
        if (a.input === "select")
          inp =
            '<p><label for="askInput">' +
            esc(a.inputLabel) +
            '</label><br><select id="askInput" class="askctl">' +
            a.options
              .map(
                (o, i) => '<option value="' + i + '">' + esc(o) + "</option>",
              )
              .join("") +
            "</select></p>";
        else if (a.input === "number")
          inp =
            '<p><label for="askInput">' +
            esc(a.inputLabel) +
            '</label><br><input id="askInput" class="askctl" type="number" min="0" max="20" value="' +
            (a.value || 1) +
            '"></p>';
        return [
          a.title,
          '<div class="body"><p class="notice" style="font-size:.95rem;color:var(--ink)">' +
            esc(a.text) +
            "</p>" +
            inp +
            '<div class="answers" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
            a.buttons
              .map(
                (b) =>
                  '<button class="btn' +
                  (b.primary ? " primary" : "") +
                  '" data-ask="' +
                  b.v +
                  '">' +
                  esc(b.label) +
                  "</button>",
              )
              .join("") +
            "</div></div>",
          true,
        ];
      }
    }
    return ["", ""];
  }
  function currentPage() {
    const S = U.state;
    if (!S) return "C14";
    if (S.walk && !S.walk.done && F[S.walk.page]) return S.walk.page;
    const c = S.strategy === "military" ? "M" : "C";
    return S.phase === "p5" || S.phase === "p6" ? c + "5" : c + "14";
  }
  function helpHTML() {
    return (
      '<div class="body"><div class="notice" style="max-width:75ch;font-size:.9rem;color:var(--ink)">' +
      "<h4>What this app does</h4><p>It plays the Shadow side using the Queller Bot. You play the Free Peoples on your physical copy of War of the Ring. The app rolls Queller\u2019s dice, holds its cards and asks you the yes/no questions from the flowcharts; you answer from the board and carry out the action it names.</p>" +
      "<h4>A turn</h4><p>The buttons at the top of the walkthrough are the green start points of the flowcharts, in turn order: Phase 1 (dice and cards), Phase 2 (strategy check, corruption strategy only), Phase 3 (Hunt box), Phase 4 (roll), then \u201cPhase 5\u201d each time Queller is eligible to act. When a battle starts, use \u201cBattle\u201d for the first round; the button becomes \u201cBattle (next round)\u201d while the battle continues. \u201cPhase 6\u201d is the victory check; the next turn then begins at Phase 1.</p>" +
      "<h4>Answering</h4><p>Each step is coloured like the paper flowchart and named in the line above it: a decision asks a question, an action tells you what Queller does (press Done, or Not possible if the game rules prevent it), a step is something to do before continuing. Italic terms show their definition when you hover or focus them; press Enter to open the glossary at that term.</p>" +
      "<h4>The board tracker</h4><p>Keep it up to date: it answers questions about the Fellowship, minions, nations and factions for you, and decides which of Queller\u2019s cards can be played without showing you the rest of the hand. Card checks it asks you about are remembered for the turn; press Forget if the board has changed.</p>" +
      "<h4>Mistakes</h4><p>Undo reverses your last action (up to 60 steps). The game is saved automatically in this browser; Save / Load keeps named copies or moves a game to another device.</p>" +
      "<h4>Reporting a bug</h4><p>If the app itself goes wrong — a step that makes no sense, a card or die handled wrongly, a button that does nothing — open Settings and press Export debug log. The log holds the game state, the last actions you took and any errors; send it with a short description of what you expected. It also shows Queller’s hidden cards, so only read it if you do not mind seeing them.</p>" +
      "<h4>Abbreviations</h4><p>WoME: Warriors of Middle-earth. VP: victory points. FP: Free Peoples.</p></div></div>"
    );
  }
  function rulesHTML() {
    let h =
      '<div class="body rules"><p class="notice">The flowcharts, the rulings and the Learning Guide refer to these numbers.</p>';
    for (const [sec, rs] of window.QB_RULES) {
      h +=
        "<h4>" +
        esc(sec) +
        "</h4><ol>" +
        rs
          .map(
            ([n, t]) =>
              '<li><span class="n">' +
              n +
              "</span><span>" +
              fmt(t) +
              "</span></li>",
          )
          .join("") +
        "</ol>";
    }
    h +=
      "<h4>Turn sequence</h4><ol>" +
      window.QB_TURN.map(
        ([p, t]) =>
          '<li><span class="n"></span><span><b>' +
          esc(p) +
          ".</b> " +
          fmt(t) +
          "</span></li>",
      ).join("") +
      "</ol>";
    h +=
      "<h4>Rulings</h4>" +
      window.QB_RULINGS.map(
        ([q, a]) =>
          '<p style="max-width:75ch"><b>' +
          esc(q) +
          "</b><br>" +
          fmt(a) +
          "</p>",
      ).join("");
    h +=
      '<h4>Key for the flowcharts</h4><p class="notice" style="max-width:75ch">A green ellipse is a start point. A red ellipse is an action: if Queller can do it legally, do it and stop; otherwise apply rule 29. A yellow or blue rounded rectangle is a yes/no decision about the board now. A grey striped box is a jump to the start point with that name; a die in brackets means use that die. A purple box is a priority list (rules 30 and 31). An orange box is a step: do it, then continue. Bold text with the ring mark ' +
      U.ringIcon() +
      " is an Elven Ring condition (rule 36): if it is true and Queller lacks the die the next step needs, it uses a ring. “Phase 5 – continue from where you came” means return to the grey box that sent you here and follow its arrow out.</p></div>";
    return h;
  }
  // ---------- flowchart SVG ----------
  const NODE_STYLE = {
    S: ["#d5e8d4", "#82b366"],
    A: ["#f8cecc", "#b85450"],
    D: ["#fff2cc", "#d6b656"],
    d: ["#dae8fc", "#6c8ebf"],
    J: ["#f5f5f5", "#666666"],
    P: ["#e1d5e7", "#9673a6"],
    T: ["#ffe6cc", "#d79b00"],
    N: [null, null],
  };
  function svgPage(pk) {
    const P = F[pk];
    const S = U.state;
    const w = S?.walk;
    const curNode = w && !w.done && w.page === pk ? w.node : null;
    const visited = new Set();
    if (w?.page === pk || w?.trail.some((t) => t.page === pk))
      w.trail.forEach((t) => {
        if (t.page === pk && t.node) visited.add(t.node);
      });
    let maxX = 0,
      maxY = 0;
    for (const id in P.nodes) {
      const n = P.nodes[id];
      maxX = Math.max(maxX, n[1] + n[3]);
      maxY = Math.max(maxY, n[2] + n[4]);
    }
    for (const e of P.edges) {
      for (const w of e[3] || []) {
        maxX = Math.max(maxX, w[0]);
        maxY = Math.max(maxY, w[1]);
      }
    }
    let s =
      '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flowchart: ' +
      esc(P.name) +
      '. Use Show as text for a readable version." viewBox="0 0 ' +
      (maxX + 20) +
      " " +
      (maxY + 20) +
      '" width="100%" style="font-family:Helvetica,Arial,sans-serif;font-size:11px"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#999" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#fff"/>';
    // edges first
    let labels = "";
    for (const e of P.edges) {
      const a = P.nodes[e[0]],
        b = P.nodes[e[1]];
      if (!a || !b) continue;
      const pts = route(a, b, e[3], e[4], e[5] === "elbow");
      s +=
        '<polyline points="' +
        pts.map((p) => p.join(",")).join(" ") +
        '" fill="none" stroke="#333" stroke-width="1.2" marker-end="url(#arr)"/>';
      if (e[2] && !e[6]) {
        const [lx, ly] = midpoint(pts);
        const w = e[2].length * 5.6 + 8;
        labels +=
          '<rect x="' +
          (lx - w / 2) +
          '" y="' +
          (ly - 7) +
          '" width="' +
          w +
          '" height="13" rx="2" fill="#fff"/><text x="' +
          lx +
          '" y="' +
          (ly + 3) +
          '" text-anchor="middle" font-size="10" fill="#333">' +
          esc(e[2]) +
          "</text>";
      }
    }
    for (const id in P.nodes) {
      const n = P.nodes[id];
      const [k, x, y, wd, ht, t, ex] = n;
      const st = NODE_STYLE[k];
      const isCur = id === curNode,
        vis = visited.has(id);
      let shape = "";
      const fill = st[0] || "none",
        stroke = st[1] || "none";
      if (k === "S" || k === "A")
        shape =
          '<ellipse cx="' +
          (x + wd / 2) +
          '" cy="' +
          (y + ht / 2) +
          '" rx="' +
          wd / 2 +
          '" ry="' +
          ht / 2 +
          '" fill="' +
          fill +
          '" stroke="' +
          stroke +
          '"/>';
      else if (k === "N") {
        if (id === "grp")
          shape =
            '<rect x="' +
            x +
            '" y="' +
            y +
            '" width="' +
            wd +
            '" height="' +
            ht +
            '" rx="8" fill="none" stroke="#999" stroke-dasharray="4 3"/>';
      } else if (k === "J")
        shape =
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          wd +
          '" height="' +
          ht +
          '" fill="' +
          fill +
          '" stroke="' +
          stroke +
          '"/><rect x="' +
          x +
          '" y="' +
          y +
          '" width="8" height="' +
          ht +
          '" fill="url(#hatch)" stroke="' +
          stroke +
          '"/><rect x="' +
          (x + wd - 8) +
          '" y="' +
          y +
          '" width="8" height="' +
          ht +
          '" fill="url(#hatch)" stroke="' +
          stroke +
          '"/>';
      else
        shape =
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          wd +
          '" height="' +
          ht +
          '" rx="' +
          (k === "T" ? 0 : 8) +
          '" fill="' +
          fill +
          '" stroke="' +
          stroke +
          '"/>';
      if (vis && !isCur && k !== "N") {
        const sh = 'fill="#3a332c" fill-opacity=".22" stroke="none"';
        const rx = k === "T" || k === "J" ? 0 : 8;
        shape +=
          k === "S" || k === "A"
            ? '<ellipse cx="' +
              (x + wd / 2) +
              '" cy="' +
              (y + ht / 2) +
              '" rx="' +
              wd / 2 +
              '" ry="' +
              ht / 2 +
              '" ' +
              sh +
              "/>"
            : '<rect x="' +
              x +
              '" y="' +
              y +
              '" width="' +
              wd +
              '" height="' +
              ht +
              '" rx="' +
              rx +
              '" ' +
              sh +
              "/>";
      }
      if (isCur)
        shape +=
          '<rect x="' +
          (x - 5) +
          '" y="' +
          (y - 5) +
          '" width="' +
          (wd + 10) +
          '" height="' +
          (ht + 10) +
          '" rx="12" fill="none" stroke="#8A2A22" stroke-width="3"/>';
      let inner;
      const bold = ex?.bold;
      const pad = k === "N" ? 0 : 4;
      const txt = nodeLabel(k, id, t, n);
      const extra = id === "ringNote" ? 14 : 0;
      inner =
        '<foreignObject x="' +
        (x + pad) +
        '" y="' +
        (y + pad) +
        '" width="' +
        (wd - 2 * pad) +
        '" height="' +
        (ht - 2 * pad + extra) +
        '"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:' +
        (ex?.items || id === "grp" ? "flex-start" : "center") +
        ";justify-content:center;text-align:center;color:#1d1a17;line-height:1.15;font-size:11px;overflow:hidden;" +
        (bold ? "font-weight:700;" : "") +
        '"><div style="width:100%">' +
        txt +
        "</div></div></foreignObject>";
      let mark = bold
        ? '<g transform="translate(' +
          (x + wd - 18) +
          "," +
          (y - 8) +
          ') scale(0.75)" style="color:#7E2419"><title>Elven Ring condition (rule 36)</title><circle cx="12" cy="13.5" r="9.5" fill="#fff"/>' +
          U.RING_PATH +
          "</g>"
        : "";
      if (id === "ringNote")
        mark =
          '<g transform="translate(' +
          (x - 2) +
          "," +
          (y + 8) +
          ') scale(0.85)" style="color:#7E2419"><title>Elven Ring condition (rule 36)</title>' +
          U.RING_PATH +
          "</g>";
      s += '<g data-node="' + id + '">' + shape + inner + mark + "</g>";
    }
    return s + labels + "</svg>";
  }
  function textPage(pk) {
    const P = F[pk];
    const S = U.state,
      w = S?.walk;
    const curNode = w && !w.done && w.page === pk ? w.node : null;
    const KIND = {
      S: "Start point",
      A: "Action",
      D: "Decision",
      d: "Follow-up decision",
      J: "Jump",
      P: "Priority list",
      T: "Step",
      N: "Note",
    };
    const name = (id) => {
      const n = P.nodes[id];
      return n ? Q.normalizeText(n[5]).replaceAll("*", "") : id;
    };
    let h =
      '<div class="flowtext"><p class="notice">Text version of ' +
      esc(P.name) +
      ". Each box lists where its arrows lead.</p><ol>";
    for (const id in P.nodes) {
      const n = P.nodes[id];
      if (n[0] === "N" && !/grp/.test(id)) continue;
      if (id === "grp") continue;
      const ex = n[6] || {};
      const outs = P.edges.filter((e) => e[0] === id);
      let t = "<b>" + esc(KIND[n[0]]) + ":</b> " + fmt(n[5]);
      if (ex.t2) t += " " + U.ringIcon() + " (ring part) — or " + fmt(ex.t2);
      if (ex.bold && !ex.t2) t += " " + U.ringIcon() + " (ring condition)";
      if (ex.wome) t += " (WoME only)";
      if (ex.items)
        t +=
          (ex.any ? " any of: " : " ") +
          "<ol>" +
          ex.items.map((i) => "<li>" + fmt(i) + "</li>").join("") +
          "</ol>";
      if (outs.length)
        t +=
          '<div class="notice">' +
          outs
            .map(
              (e) =>
                (e[2] ? esc(e[2]) + ": " : "then: ") +
                "go to “" +
                esc(name(e[1])) +
                "”",
            )
            .join("; ") +
          "</div>";
      else if (n[0] === "A")
        t += '<div class="notice">then: stop (if not possible, rule 29)</div>';
      h +=
        '<li id="tx-' +
        id +
        '"' +
        (id === curNode
          ? ' style="outline:2px solid var(--accent);padding:4px"'
          : "") +
        ">" +
        t +
        (id === curNode ? " <b>(current step)</b>" : "") +
        "</li>";
    }
    return h + "</ol></div>";
  }
  // The HTML inside a node box: page titles, the ring note and group labels have their own styling; everything else is the node text.
  function nodeLabel(k, id, t, n) {
    if (k === "N" && id !== "grp" && /title/.test(id))
      return (
        '<div style="font-size:16px;font-weight:700;text-align:right">' +
        esc(t) +
        "</div>"
      );
    if (id === "ringNote")
      return (
        '<div style="font-weight:700;text-align:left;line-height:1.1;padding-left:22px">' +
        esc(t) +
        "</div>"
      );
    if (id === "grp")
      return (
        '<div style="text-align:left;padding:5px 8px;color:#555">' +
        esc(t) +
        "</div>"
      );
    return nodeInner(n);
  }
  function nodeInner(n) {
    const [, , , , , t, ex] = n;
    let s = esc(t)
      .replace(/\*([^*]+)\*/g, "<i>$1</i>")
      .replaceAll("\n", "<br>");
    if (ex?.t2)
      s =
        "<b>" +
        s +
        "</b> or " +
        esc(ex.t2).replace(/\*([^*]+)\*/g, "<i>$1</i>");
    if (ex?.items)
      s =
        '<div style="text-align:left;width:100%"><b style="display:block;text-align:center">' +
        s +
        "</b><" +
        (ex.any ? "ul" : "ol") +
        ' style="margin:2px 0 0;padding-left:18px">' +
        ex.items
          .map(
            (i) =>
              "<li>" + esc(i).replace(/\*([^*]+)\*/g, "<i>$1</i>") + "</li>",
          )
          .join("") +
        "</" +
        (ex.any ? "ul" : "ol") +
        "></div>";
    return s;
  }
  function midpoint(pts) {
    let L = 0;
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(
        pts[i][0] - pts[i - 1][0],
        pts[i][1] - pts[i - 1][1],
      );
      segs.push(d);
      L += d;
    }
    let t = L / 2;
    for (let i = 1; i < pts.length; i++) {
      if (t <= segs[i - 1]) {
        const f = segs[i - 1] ? t / segs[i - 1] : 0;
        return [
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
        ];
      }
      t -= segs[i - 1];
    }
    return pts[pts.length - 1];
  }
  function anchor(n, px, py) {
    const [, x, y, w, h] = n;
    const cx = x + w / 2,
      cy = y + h / 2;
    const dx = px - cx,
      dy = py - cy;
    if (Math.abs(dy) * w > Math.abs(dx) * h) {
      return dy > 0
        ? [clamp(px, x + 8, x + w - 8), y + h]
        : [clamp(px, x + 8, x + w - 8), y];
    }
    return dx > 0
      ? [x + w, clamp(py, y + 6, y + h - 6)]
      : [x, clamp(py, y + 6, y + h - 6)];
  }
  // anchor towards a draw.io waypoint: leave from the side the point lies beyond (horizontal when it is outside the box's x-range), like draw.io's orthogonal router
  function wpAnchor(n, px, py) {
    const [, x, y, w, h] = n;
    const outX = px < x || px > x + w,
      outY = py < y || py > y + h;
    if (outX)
      return [
        px < x ? x : x + w,
        py >= y + 6 && py <= y + h - 6 ? py : y + h / 2,
      ];
    if (outY)
      return [
        px >= x + 8 && px <= x + w - 8 ? px : x + w / 2,
        py < y ? y : y + h,
      ];
    return anchor(n, px, py);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const JOG = 20; // how far an arrow steps out of a box before turning
  const onTopOrBottomEdge = (n, p) =>
    Math.abs(p[1] - n[2]) < 0.5 || Math.abs(p[1] - n[2] - n[4]) < 0.5; // an anchor there means a vertical exit/entry
  // A point on a box from a draw.io anchor (fractions of the width and height).
  const anchorAt = (box, frac) => [
    box[1] + box[3] * frac[0],
    box[2] + box[4] * frac[1],
  ];
  // The point the edge heads for at one end: the first/last waypoint, else the other box's explicit anchor, else its centre.
  function towards(wp, frac, box, centre) {
    if (wp) return wp;
    return frac ? anchorAt(box, frac) : centre;
  }
  // Where the edge meets a box: its explicit anchor when draw.io gives one, else the nearest point facing pt (a waypoint or the other end).
  function edgeEnd(box, frac, hasWp, pt) {
    if (frac) return anchorAt(box, frac);
    return hasWp ? wpAnchor(box, pt[0], pt[1]) : anchor(box, pt[0], pt[1]);
  }
  // Which way an edge leaves a box: -1 from the top (vertical) or left edge, +1 from the bottom or right.
  function edgeDir(box, p, vertical) {
    const nearStart = vertical
      ? Math.abs(p[1] - box[2]) < 0.5
      : Math.abs(p[0] - box[1]) < 0.5;
    return nearStart ? -1 : 1;
  }
  // A lane for a detour between two boxes along one axis (i, s = the box tuple's position and size indexes for that axis): midway through
  // the gap between them when there is one, otherwise just outside both boxes on the side the edge is heading (towardsStart = towards 0).
  function lane(a, b, i, s, towardsStart, J) {
    if (towardsStart) {
      if (b[i] + b[s] <= a[i]) return (b[i] + b[s] + a[i]) / 2;
      return Math.min(a[i], b[i]) - J;
    }
    if (a[i] + a[s] <= b[i]) return (a[i] + a[s] + b[i]) / 2;
    return Math.max(a[i] + a[s], b[i] + b[s]) + J;
  }
  function route(a, b, wp, an, elbow) {
    const ac = [a[1] + a[3] / 2, a[2] + a[4] / 2],
      bc = [b[1] + b[3] / 2, b[2] + b[4] / 2];
    if (elbow && wp?.length && an?.ex && an.en) {
      // draw.io elbowEdgeStyle: one elbow positioned by the first waypoint
      const p0 = anchorAt(a, an.ex),
        pn = anchorAt(b, an.en);
      const exV = an.ex[1] === 0 || an.ex[1] === 1;
      return exV
        ? [p0, [p0[0], wp[0][1]], [pn[0], wp[0][1]], pn]
        : [p0, [wp[0][0], p0[1]], [wp[0][0], pn[1]], pn];
    }
    if (an && (an.ex || an.en)) {
      // explicit draw.io exit/entry anchors (fractions of the box); a missing side falls back to the nearest-point heuristic
      const first = towards(wp?.[0], an.en, b, bc),
        last = towards(wp?.at(-1), an.ex, a, ac);
      const p0 = edgeEnd(a, an.ex, wp?.length, first);
      const pn = edgeEnd(b, an.en, wp?.length, last);
      const exV = onTopOrBottomEdge(a, p0),
        enV = onTopOrBottomEdge(b, pn);
      const pts = [p0];
      let prev = p0;
      if (wp?.length) {
        for (const p of wp) {
          if (Math.abs(p[0] - prev[0]) > 1 && Math.abs(p[1] - prev[1]) > 1)
            pts.push(exV ? [prev[0], p[1]] : [p[0], prev[1]]);
          pts.push(p);
          prev = p;
        }
      }
      if (Math.abs(pn[0] - prev[0]) > 1 && Math.abs(pn[1] - prev[1]) > 1) {
        const J = JOG;
        const exDir = edgeDir(a, p0, exV),
          enDir = edgeDir(b, pn, enV);
        if (!wp?.length && !exV && !enV && exDir === enDir) {
          const ox =
            exDir > 0
              ? Math.max(prev[0], pn[0]) + J
              : Math.min(prev[0], pn[0]) - J;
          pts.push([ox, prev[1]], [ox, pn[1]]);
        } else if (
          !wp?.length &&
          !exV &&
          !enV &&
          (pn[0] - prev[0]) * exDir < 0
        ) {
          const ox = prev[0] + J * exDir,
            ix = pn[0] - J * exDir;
          const ya = lane(a, b, 2, 4, pn[1] < prev[1], J);
          pts.push([ox, prev[1]], [ox, ya], [ix, ya], [ix, pn[1]]);
        } else if (!wp?.length && exV && enV && exDir === enDir) {
          const oy =
            exDir > 0
              ? Math.max(prev[1], pn[1]) + J
              : Math.min(prev[1], pn[1]) - J;
          pts.push([prev[0], oy], [pn[0], oy]);
        } else if (!wp?.length && exV && enV && (pn[1] - prev[1]) * exDir < 0) {
          const oy = prev[1] + J * exDir,
            iy = pn[1] - J * exDir;
          const xa = lane(a, b, 1, 3, pn[0] < prev[0], J);
          pts.push([prev[0], oy], [xa, oy], [xa, iy], [pn[0], iy]);
        } else if (exV && enV) {
          const my = (prev[1] + pn[1]) / 2;
          pts.push([prev[0], my], [pn[0], my]);
        } else if (!exV && !enV) {
          const mx = (prev[0] + pn[0]) / 2;
          pts.push([mx, prev[1]], [mx, pn[1]]);
        } else if (exV) pts.push([prev[0], pn[1]]);
        else pts.push([pn[0], prev[1]]);
      }
      pts.push(pn);
      return pts;
    }
    if (wp?.length) {
      const p0 = wpAnchor(a, wp[0][0], wp[0][1]);
      const pn = wpAnchor(b, wp[wp.length - 1][0], wp[wp.length - 1][1]);
      const pts = [p0];
      let prev = p0;
      for (const p of wp) {
        if (Math.abs(p[0] - prev[0]) > 1 && Math.abs(p[1] - prev[1]) > 1)
          pts.push([p[0], prev[1]]);
        pts.push(p);
        prev = p;
      }
      if (Math.abs(pn[0] - prev[0]) > 1 && Math.abs(pn[1] - prev[1]) > 1)
        pts.push([prev[0], pn[1]]);
      pts.push(pn);
      return pts;
    }
    const below = bc[1] > a[2] + a[4],
      above = bc[1] + b[4] / 2 < a[2],
      right = bc[0] > a[1] + a[3],
      left = bc[0] + b[3] / 2 < a[1];
    if (
      (below && !(right || left)) ||
      (below && Math.abs(bc[0] - ac[0]) < Math.abs(bc[1] - ac[1]))
    ) {
      const p0 = [clamp(bc[0], a[1] + 8, a[1] + a[3] - 8), a[2] + a[4]],
        p1 = [clamp(ac[0], b[1] + 8, b[1] + b[3] - 8), b[2]];
      const my = (p0[1] + p1[1]) / 2;
      return Math.abs(p0[0] - p1[0]) < 1
        ? [p0, p1]
        : [p0, [p0[0], my], [p1[0], my], p1];
    }
    if (above && Math.abs(bc[0] - ac[0]) < Math.abs(bc[1] - ac[1])) {
      const p0 = [clamp(bc[0], a[1] + 8, a[1] + a[3] - 8), a[2]],
        p1 = [clamp(ac[0], b[1] + 8, b[1] + b[3] - 8), b[2] + b[4]];
      const my = (p0[1] + p1[1]) / 2;
      return Math.abs(p0[0] - p1[0]) < 1
        ? [p0, p1]
        : [p0, [p0[0], my], [p1[0], my], p1];
    }
    if (right) {
      const p0 = [a[1] + a[3], clamp(bc[1], a[2] + 6, a[2] + a[4] - 6)],
        p1 = [b[1], clamp(ac[1], b[2] + 6, b[2] + b[4] - 6)];
      const mx = (p0[0] + p1[0]) / 2;
      return Math.abs(p0[1] - p1[1]) < 1
        ? [p0, p1]
        : [p0, [mx, p0[1]], [mx, p1[1]], p1];
    }
    const p0 = [a[1], clamp(bc[1], a[2] + 6, a[2] + a[4] - 6)],
      p1 = [b[1] + b[3], clamp(ac[1], b[2] + 6, b[2] + b[4] - 6)];
    const mx = (p0[0] + p1[0]) / 2;
    return Math.abs(p0[1] - p1[1]) < 1
      ? [p0, p1]
      : [p0, [mx, p0[1]], [mx, p1[1]], p1];
  }
  // ---------- calculator ----------
  const CALC_MAX = { reg: 10, elite: 10, lead: 10, cotw: 5 };
  function calcHTML() {
    const c = calc;
    const num = (k, l) =>
      U.numberRowHTML("c-" + k, fmt(l), c[k], 'data-cs="' + k + '"');
    const chk = (k, l) =>
      U.checkboxRowHTML("c-" + k, fmt(l), c[k], 'data-c="' + k + '"');
    return (
      '<div class="body"><p class="notice">' +
      fmt(
        "The *value* of an army per the glossary. Hits: 1 per Regular, 2 per Elite. Combat dice: one per Army unit, maximum 5. Leadership: maximum 5 and not more than the number of Army units.",
      ) +
      '</p><div class="calc tracker">' +
      num("reg", "Regular units") +
      num("elite", "Elite units") +
      num("lead", "Leadership (Nazgûl, leaders, minions, Companions)\u00b9") +
      num("cotw", "Captains of the West (Free Peoples only)") +
      chk("fort", "Defends in a Fortification or City region") +
      chk(
        "strong",
        "Defends in a Stronghold (×1.5, five strongest units’ hits)",
      ) +
      chk("sortie", "Sortie (×0.5)") +
      '<div class="out">' +
      calcOut() +
      '</div><p class="notice" style="margin-top:10px">' +
      fmt(
        "\u00b9 When testing whether an army is *mobile*, do not count Saruman in its leadership.",
      ) +
      "</p></div></div>"
    );
  }
  function calcOut() {
    const c = calc;
    const units = c.reg + c.elite;
    const lines = [];
    let hits = c.reg + 2 * c.elite;
    if (c.strong) {
      const top = Math.min(5, units);
      const e = Math.min(top, c.elite);
      hits = e * 2 + (top - e);
      lines.push("Hits (five strongest units): " + hits);
    } else lines.push("Hits: " + hits);
    const dice = Math.min(5, units + c.cotw);
    lines.push("Combat dice: " + dice);
    const lead = Math.min(5, Math.min(c.lead, units));
    lines.push("Leadership: " + lead);
    let v = hits + dice + lead + c.cotw;
    if (c.cotw) lines.push("Captains of the West: +" + c.cotw);
    if (c.fort) {
      v += 1;
      lines.push("Fortification/City: +1");
    }
    if (c.strong) {
      v = Math.floor(v * 1.5);
      lines.push("Stronghold: ×1.5 rounded down");
    }
    if (c.sortie) {
      v = Math.floor(v * 0.5);
      lines.push("Sortie: ×0.5 rounded down");
    }
    return (
      '<div class="n">' +
      v +
      "</div><div>" +
      fmt("Army *value*") +
      "</div><ul>" +
      lines.map((l) => "<li>" + esc(l) + "</li>").join("") +
      "</ul>"
    );
  }
  // ---------- transfer helpers (save file, debug log) ----------
  // The artifact host offers a downloads capability; a plain <a download> may be inert for viewers, so the copy button (and the text box) is the fallback.
  async function downloadText(name, data, note, alt) {
    try {
      const d = window.claude?.use
        ? await window.claude.use("downloads")
        : null;
      if (d) {
        await d.save({ filename: name, data });
        note.textContent = "Saved " + name + ".";
        return;
      }
    } catch (e) {
      note.textContent =
        "Download not completed: " + (e.message || e.code || "cancelled");
      return;
    }
    try {
      const a = document.createElement("a");
      a.href =
        "data:application/json;charset=utf-8," + encodeURIComponent(data);
      a.download = name;
      a.click();
      note.textContent = "If nothing downloaded, use " + alt + ".";
    } catch (e) {
      // The browser blocked the download; the note points the user at the alternative.
      note.textContent = "Downloads are not available here — use " + alt + ".";
    }
  }
  async function copyText(data, note, what, ta) {
    try {
      await navigator.clipboard.writeText(data);
      note.textContent = what + " copied to the clipboard.";
    } catch (e) {
      // Clipboard access was refused; select the text so the user can copy it by hand.
      if (ta) {
        ta.value = data;
        ta.focus();
        ta.select();
      }
      note.textContent = "Copy the text from the box below.";
    }
  }
  // ---------- debug log ----------
  function environment() {
    const mq = (q) => {
      try {
        return window.matchMedia(q).matches;
      } catch (e) {
        return null;
      }
    };
    let storage = "ok";
    try {
      localStorage.setItem(U.STORAGE_KEY.PROBE, "1");
      localStorage.removeItem(U.STORAGE_KEY.PROBE);
    } catch (e) {
      storage = "unavailable: " + (e.message || e);
    }
    return {
      built: window.QB_BUILT || null,
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      touchPoints: navigator.maxTouchPoints,
      viewport: [window.innerWidth, window.innerHeight],
      screen: [screen.width, screen.height],
      dpr: window.devicePixelRatio,
      theme: document.documentElement.dataset.theme || "system",
      prefersDark: mq("(prefers-color-scheme: dark)"),
      coarsePointer: mq("(pointer: coarse)"),
      reducedMotion: mq("(prefers-reduced-motion: reduce)"),
      online: navigator.onLine,
      storage,
      timeZone: Intl.DateTimeFormat().resolvedOptions()?.timeZone,
      utcOffsetMin: -new Date().getTimezoneOffset(),
      visibility: document.visibilityState,
      uptimeMs: Math.round(performance.now()),
      url: location.origin + location.pathname,
    };
  }
  function storageOverview() {
    const o = {};
    for (const k of Object.values(U.STORAGE_KEY)) {
      const v = U.storageGet(k);
      o[k] = v == null ? null : v.length;
    }
    return o;
  }
  function domSnapshot() {
    const t = (sel) => {
      const e = document.querySelector(sel);
      return e ? e.textContent.replace(/\s+/g, " ").trim().slice(0, 600) : null;
    };
    const m = U.getModal();
    let modal = null;
    if (m)
      modal = m.name + (m.name === "ask" && m.arg ? ": " + m.arg.title : "");
    const ae = document.activeElement;
    let active = null;
    if (ae && ae !== document.body) {
      const label = ae.textContent
        ? " “" + ae.textContent.trim().slice(0, 40) + "”"
        : "";
      active = ae.tagName.toLowerCase() + (ae.id ? "#" + ae.id : "") + label;
    }
    return {
      rendered: !!document.getElementById("app")?.children.length,
      prompt: t(".prompt"),
      result: t(".result"),
      phaseButtons: [...document.querySelectorAll("[data-phase]")].map(
        (b) => b.dataset.phase,
      ),
      modal,
      errorBar: !!document.getElementById("errbar"),
      activeElement: active,
    };
  }
  function debugText() {
    let opts = null;
    try {
      opts = JSON.parse(U.storageGet(U.STORAGE_KEY.OPTIONS) || "null");
    } catch (e) {}
    return DBG.text({
      state: U.state,
      history: U.history,
      report: $("#dbgReport")?.value || "",
      env: environment(),
      dom: domSnapshot(),
      storage: storageOverview(),
      brokenAutosave: U.storageGet(U.STORAGE_KEY.BROKEN_AUTOSAVE) || null,
      opts,
    });
  }
  function debugHTML() {
    return (
      '<div class="body"><p class="notice" style="color:var(--ink)">The debug log describes this browser, the game as it stands, the last ' +
      DBG.LIMITS.actions +
      " actions, the trails of recent walks and any errors the app recorded, so that a problem can be traced from a report. It contains no personal details, but it does show Queller’s hidden cards — only read it if you do not mind seeing them.</p>" +
      '<p style="margin-top:12px"><label for="dbgReport"><b>What went wrong?</b> <span class="notice" style="display:inline">(optional — saved into the log: what you did, what you expected, what happened)</span></label><textarea id="dbgReport" style="min-height:80px" placeholder="For example: after answering Yes to “Witch King in play” the walk jumped to the Army page instead of Character 2."></textarea></p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn primary" id="dbgDl">Download debug log</button><button type="button" class="btn" id="dbgCopy">Copy debug log</button></div><div id="dbgNote" class="notice" role="status" aria-live="polite" style="margin-top:6px"></div>' +
      '<p style="margin-top:12px"><label for="dbgTxt" class="notice">The log (select all and copy if the buttons do not work)</label><textarea id="dbgTxt" readonly spellcheck="false" style="min-height:200px"></textarea></p></div>'
    );
  }
  function wireDebug(el) {
    const ta = el.querySelector("#dbgTxt");
    if (!ta) return;
    const refresh = () => {
      try {
        ta.value = debugText();
      } catch (e) {
        ta.value =
          "The debug log could not be built: " + (e.stack || e.message || e);
        DBG.error(e, { a: "debugBuild" }, U.state);
      }
      return ta.value;
    };
    refresh();
    el.querySelector("#dbgReport").onchange = refresh;
    el.querySelector("#dbgDl").onclick = () => {
      const data = refresh();
      DBG.action(
        { a: "debugExport", how: "download", bytes: data.length },
        U.state,
      );
      downloadText(
        DBG.fileName(U.state),
        data,
        el.querySelector("#dbgNote"),
        "Copy debug log",
      );
    };
    el.querySelector("#dbgCopy").onclick = () => {
      const data = refresh();
      DBG.action(
        { a: "debugExport", how: "copy", bytes: data.length },
        U.state,
      );
      copyText(data, el.querySelector("#dbgNote"), "Debug log", ta);
    };
  }
  // ---------- save / load ----------
  function slots() {
    try {
      return JSON.parse(U.storageGet(U.STORAGE_KEY.SLOTS) || "[]");
    } catch (e) {
      return [];
    }
  }
  function saveHTML() {
    const sl = slots();
    let h =
      '<div class="body"><p class="notice">The game is saved automatically in this browser after every action. Named saves are also kept in this browser. To move a game to another device, download it or copy the code.</p>';
    h +=
      "<h4>Named saves</h4>" +
      [0, 1, 2]
        .map((i) => {
          const s = sl[i];
          return (
            '<div class="slot"><span class="t">Slot ' +
            (i + 1) +
            (s ? ": turn " + s.turn + ", " + esc(s.when) : ": empty") +
            '</span><button class="btn small" data-save="' +
            i +
            '">Save here</button>' +
            (s
              ? '<button class="btn small" data-load="' + i + '">Load</button>'
              : "") +
            "</div>"
          );
        })
        .join("");
    h +=
      '<h4>Transfer</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="dlBtn">Download save file</button><button class="btn" id="copyBtn">Copy save code</button></div><div id="dlNote" class="notice"></div>';
    h += "<h4>Load</h4>" + U.loadHTML() + "</div>";
    return h;
  }
  U.loadHTML = function () {
    return '<p class="notice" style="margin:0 0 6px">Paste a save code, or choose a save file.</p><label for="loadTxt" class="notice">Save code</label><textarea id="loadTxt" placeholder="Paste the save code here"></textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center"><button class="btn" id="loadTxtBtn">Load from code</button><label class="notice">Save file <input type="file" id="loadFile" accept=".json,application/json"></label></div><div id="loadErr" class="notice" role="alert" style="color:var(--bad)"></div>';
  };
  // Replace the game with a parsed save, confirming first when a game is in progress.
  function loadGame(o, title) {
    const go = () => {
      DBG.begin(
        { a: "load", title, turn: o.turn, version: o.appVersion },
        U.state,
      );
      U.history = [];
      U.state = o;
      DBG.finishAction(o);
      U.closeModal();
      U.commit();
    };
    if (!U.state) return go();
    U.ask({
      title,
      text: "The game in progress will be replaced.",
      buttons: [
        { v: "ok", label: "Load", primary: true },
        { v: "no", label: "Cancel" },
      ],
      onPick: (v) => {
        if (v === "ok") go();
        else U.openModal("save");
      },
    });
  }
  U.wireLoad = function (root) {
    const doLoad = (txt) => {
      try {
        loadGame(U.loadJSON(txt), "Load this save?");
      } catch (e) {
        const er = root.querySelector("#loadErr");
        if (er) er.textContent = "That is not a Queller save: " + e.message;
      }
    };
    const b = root.querySelector("#loadTxtBtn");
    if (b)
      b.onclick = () => doLoad(root.querySelector("#loadTxt").value.trim());
    const f = root.querySelector("#loadFile");
    if (f)
      f.onchange = () => {
        const file = f.files[0];
        if (!file) return;
        file.text().then(doLoad);
      };
  };
  function settingsHTML() {
    const s = U.state.settings;
    const chk = (k, l, d, dis) =>
      '<label class="opt' +
      (dis ? " dis" : "") +
      '"><input type="checkbox" data-set="' +
      k +
      '" ' +
      (s[k] ? "checked" : "") +
      (dis ? ' disabled aria-disabled="true"' : "") +
      "><div><b>" +
      l +
      "</b>" +
      (d ? "<span>" + d + "</span>" : "") +
      "</div></label>";
    return (
      '<div class="body setup" style="margin:0"><p class="notice">Changes apply from the next walk.</p>' +
      chk("dice", "Roll and track Queller’s dice", "") +
      chk(
        "cards",
        "Draw and hold Queller’s cards",
        "Chosen when the game is set up; it cannot be changed mid-game.",
        true,
      ) +
      chk("tracker", "Track board state in the app", "") +
      chk(
        "wome",
        "Warriors of Middle-earth",
        "Chosen when the game is set up; it cannot be changed mid-game.",
        true,
      ) +
      '<h4 style="margin-top:18px">Report a problem</h4><p class="notice">If the app does something wrong, export a debug log and send it with a description of what happened. The log records the game, the last actions and any errors.</p><p style="margin-top:8px"><button type="button" class="btn" id="dbgOpen">Export debug log</button></p><h4 style="margin-top:18px">About</h4><p class="notice">Queller Bot Runner version ' +
      Q.VERSION +
      ".</p>" +
      U.LEGAL +
      "</div>"
    );
  }
  function jumpHTML() {
    let h =
      '<div class="body"><p class="notice">Walk a page from any green start point — for example when a card tells Queller to make a choice (rule 12), to place Nazgûl, or to choose a discard. The walk uses no die unless you pick one.</p><div style="display:grid;gap:8px;grid-template-columns:1fr auto;align-items:center"><select id="jumpSel" aria-label="Start point">';
    for (const k in F) {
      for (const id in F[k].nodes) {
        const n = F[k].nodes[id];
        if (n[0] === "S")
          h +=
            '<option value="' +
            k +
            "|" +
            id +
            '">' +
            esc(F[k].name) +
            " — " +
            esc(Q.normalizeText(n[5])) +
            "</option>";
      }
    }
    h +=
      '</select><select id="jumpDie" aria-label="Die to use"><option value="">No die</option>' +
      Object.keys(Q.DIE_REQUIREMENT_NAME)
        .map(
          (k) =>
            '<option value="' +
            k +
            '">' +
            esc(Q.DIE_REQUIREMENT_NAME[k]) +
            " die</option>",
        )
        .join("") +
      '</select></div><div style="margin-top:12px"><button class="btn primary" id="jumpGo">Walk</button></div></div>';
    return h;
  }
  function wireModal(m) {
    const el = $("#modal");
    el.querySelectorAll("[data-fp]").forEach(
      (b) =>
        (b.onclick = () => {
          flowPage = b.dataset.fp;
          U.renderModal();
        }),
    );
    const ft = $("#flowToggle");
    if (ft)
      ft.onclick = () => {
        flowText = !flowText;
        U.renderModal();
        $("#flowToggle").focus();
      };
    el.querySelectorAll("[data-c]").forEach(
      (i) =>
        (i.oninput = () => {
          const k = i.dataset.c;
          calc[k] =
            i.type === "checkbox" ? i.checked : Math.max(0, +i.value || 0);
          el.querySelector(".out").innerHTML = calcOut();
        }),
    );
    el.querySelectorAll("[data-cs]").forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.cs;
          calc[k] = Math.max(0, Math.min(CALC_MAX[k], calc[k] + +b.dataset.d));
          el.querySelector("#c-" + k + "-n").textContent = calc[k];
          el.querySelector(".out").innerHTML = calcOut();
        }),
    );
    const cc = $("#calcClear");
    if (cc)
      cc.onclick = () => {
        Object.assign(calc, CALC_DEFAULTS);
        for (const k in CALC_MAX) {
          const n = el.querySelector("#c-" + k + "-n");
          if (n) n.textContent = calc[k];
        }
        el.querySelectorAll("[data-c]").forEach((i) => {
          if (i.type === "checkbox") i.checked = !!calc[i.dataset.c];
          else i.value = calc[i.dataset.c];
        });
        el.querySelector(".out").innerHTML = calcOut();
      };
    el.querySelectorAll("[data-save]").forEach(
      (b) =>
        (b.onclick = () => {
          DBG.action({ a: "saveSlot", slot: +b.dataset.save }, U.state);
          const sl = slots();
          sl[+b.dataset.save] = {
            turn: U.state.turn,
            when: new Date().toLocaleString(),
            data: JSON.stringify(U.state),
          };
          U.storageSet(U.STORAGE_KEY.SLOTS, JSON.stringify(sl));
          U.renderModal();
        }),
    );
    el.querySelectorAll("[data-load]").forEach(
      (b) =>
        (b.onclick = () => {
          const s = slots()[+b.dataset.load];
          if (s)
            loadGame(
              U.loadJSON(s.data),
              "Load slot " + (+b.dataset.load + 1) + "?",
            );
        }),
    );
    const dl = $("#dlBtn");
    if (dl)
      dl.onclick = () =>
        downloadText(
          "queller-turn" + U.state.turn + ".json",
          JSON.stringify(U.state),
          $("#dlNote"),
          "Copy save code",
        );
    const cp = $("#copyBtn");
    if (cp)
      cp.onclick = () =>
        copyText(
          JSON.stringify(U.state),
          $("#dlNote"),
          "Save code",
          $("#loadTxt"),
        );
    const dbo = $("#dbgOpen");
    if (dbo) dbo.onclick = () => U.openModal("debug");
    wireDebug(el);
    U.wireLoad(el);
    el.querySelectorAll("[data-set]").forEach(
      (i) =>
        (i.onchange = () =>
          U.act(
            () => {
              const k = i.dataset.set;
              U.state.settings[k] = i.checked;
              if (
                k === "wome" ||
                (k === "cards" &&
                  i.checked &&
                  !U.state.cards.decks.C.length &&
                  !U.state.cards.hand.length)
              ) {
                Q.buildDecks(U.state);
                Q.log(U.state, "Decks rebuilt.");
              }
              if (k === "wome" && !i.checked) {
                U.state.dice.factionDie = false;
              }
              U.renderModal();
            },
            { a: "setting", key: i.dataset.set, value: i.checked },
          )),
    );
    el.querySelectorAll("[data-ask]").forEach(
      (b) =>
        (b.onclick = () => {
          const a = m.arg;
          const inp = $("#askInput");
          const val = inp ? inp.value : undefined;
          DBG.action(
            { a: "ask", title: a.title, pick: b.dataset.ask, input: val },
            U.state,
          );
          U.closeModal();
          if (a.onPick) a.onPick(b.dataset.ask, val);
        }),
    );

    const jg = $("#jumpGo");
    if (jg)
      jg.onclick = () => {
        const [pk, id] = $("#jumpSel").value.split("|");
        const die = $("#jumpDie").value || null;
        U.act(
          () => {
            U.state.walk = null;
            Q.startWalk(U.state, pk, F[pk].nodes[id][5], { die });
            U.closeModal();
          },
          { a: "jump", page: pk, start: id, die },
        );
      };
  }
  window.QBUI.svgPage = svgPage;
  document.addEventListener("DOMContentLoaded", U.boot);
})();
