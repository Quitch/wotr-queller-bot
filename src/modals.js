// ===== Modals: glossary, flowcharts (SVG), rules, calculator, save/load, settings, jump-to =====
(function () {
  const engine = window.QB,
    FLOW = window.QB_FLOW,
    ui = window.QBUI,
    GLOSSARY = window.QB_GLOSSARY,
    debug = window.QB_DEBUG;
  const esc = ui.escapeHTML,
    fmt = ui.formatText;
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
  ui.renderModal = function () {
    const modal = ui.getModal();
    if (!modal) return;
    const existing = ui.find("#modal");
    const reopen = !!existing;
    if (existing) existing.remove();
    else opener = document.activeElement;
    const el = document.createElement("div");
    el.className = "modal";
    el.id = "modal";
    const [title, body, narrow] = modalContent(modal);
    const headerButtons =
      modal.name === "calc"
        ? '<button type="button" class="btn" id="calcClear">Clear</button>'
        : "";
    el.innerHTML =
      '<div class="box' +
      (narrow ? " narrow" : "") +
      '" role="dialog" aria-modal="true" aria-labelledby="mtitle"><header><h2 id="mtitle" tabindex="-1">' +
      esc(title) +
      '</h2><span class="hb">' +
      headerButtons +
      '<button class="btn x" id="mclose">Close</button></span></header>' +
      body +
      "</div>";
    document.body.appendChild(el);
    const app = ui.find("#app");
    if (app) app.setAttribute("inert", "");
    ui.find("#mclose").onclick = ui.closeModal;
    el.addEventListener("click", (event) => {
      if (event.target === el) ui.closeModal();
    });
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const focusable = [
        ...el.querySelectorAll(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ].filter(
        (candidate) => !candidate.disabled && candidate.offsetParent !== null,
      );
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    });
    el.querySelectorAll(".body").forEach((region) => {
      region.setAttribute("tabindex", "0");
      region.setAttribute("role", "region");
      region.setAttribute("aria-label", title + " content");
    });
    wireModal(modal);
    if (modal.name === "glossary" && modal.arg) {
      const term = el.querySelector('[data-gl="' + modal.arg + '"]');
      if (term) {
        term.scrollIntoView({ block: "start" });
        term.focus();
      }
    } else if (!reopen) ui.find("#mtitle").focus();
  };
  ui.closeModal = function () {
    ui.setModal(null);
    const element = ui.find("#modal");
    if (element) element.remove();
    const app = ui.find("#app");
    if (app) app.removeAttribute("inert");
    if (opener?.isConnected) {
      opener.focus();
    }
    opener = null;
  };
  function modalContent(modal) {
    switch (modal.name) {
      case "glossary":
        return [
          "Glossary of terms",
          '<div class="body"><p class="notice">Words in italics on the flowcharts are defined here. Hover a term anywhere in the app for its definition; click it to open this list.</p><dl class="gl">' +
            Object.keys(GLOSSARY)
              .map(
                (term) =>
                  '<dt data-gl="' +
                  term +
                  '" tabindex="-1">' +
                  esc(term) +
                  "</dt><dd>" +
                  fmt(GLOSSARY[term]) +
                  "</dd>",
              )
              .join("") +
            "</dl></div>",
          true,
        ];
      case "rules":
        return ["General rules", rulesHTML(), true];
      case "flow":
        if (modal.arg?.current) {
          flowPage = currentPage();
          modal.arg = null;
        }
        return [
          "Flowcharts",
          '<div class="tabs">' +
            Object.keys(FLOW)
              .map(
                (pageKey) =>
                  '<button class="btn small' +
                  (pageKey === flowPage ? " on" : "") +
                  '" data-fp="' +
                  pageKey +
                  '">' +
                  esc(
                    FLOW[pageKey].name
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
        const spec = modal.arg;
        let input = "";
        if (spec.input === "select")
          input =
            '<p><label for="askInput">' +
            esc(spec.inputLabel) +
            '</label><br><select id="askInput" class="askctl">' +
            spec.options
              .map(
                (option, i) =>
                  '<option value="' + i + '">' + esc(option) + "</option>",
              )
              .join("") +
            "</select></p>";
        else if (spec.input === "number")
          input =
            '<p><label for="askInput">' +
            esc(spec.inputLabel) +
            '</label><br><input id="askInput" class="askctl" type="number" min="0" max="20" value="' +
            (spec.value || 1) +
            '"></p>';
        return [
          spec.title,
          '<div class="body"><p class="notice" style="font-size:.95rem;color:var(--ink)">' +
            esc(spec.text) +
            "</p>" +
            input +
            '<div class="answers" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
            spec.buttons
              .map(
                (button) =>
                  '<button class="btn' +
                  (button.primary ? " primary" : "") +
                  '" data-ask="' +
                  button.v +
                  '">' +
                  esc(button.label) +
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
    const state = ui.state;
    if (!state) return "C14";
    if (state.walk && !state.walk.done && FLOW[state.walk.page])
      return state.walk.page;
    const strategyPrefix = state.strategy === "military" ? "M" : "C";
    return state.phase === "p5" || state.phase === "p6"
      ? strategyPrefix + "5"
      : strategyPrefix + "14";
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
    let html =
      '<div class="body rules"><p class="notice">The flowcharts, the rulings and the Learning Guide refer to these numbers.</p>';
    for (const [section, rules] of window.QB_RULES) {
      html +=
        "<h4>" +
        esc(section) +
        "</h4><ol>" +
        rules
          .map(
            ([number, text]) =>
              '<li><span class="n">' +
              number +
              "</span><span>" +
              fmt(text) +
              "</span></li>",
          )
          .join("") +
        "</ol>";
    }
    html +=
      "<h4>Turn sequence</h4><ol>" +
      window.QB_TURN.map(
        ([phase, text]) =>
          '<li><span class="n"></span><span><b>' +
          esc(phase) +
          ".</b> " +
          fmt(text) +
          "</span></li>",
      ).join("") +
      "</ol>";
    html +=
      "<h4>Rulings</h4>" +
      window.QB_RULINGS.map(
        ([question, answer]) =>
          '<p style="max-width:75ch"><b>' +
          esc(question) +
          "</b><br>" +
          fmt(answer) +
          "</p>",
      ).join("");
    html +=
      '<h4>Key for the flowcharts</h4><p class="notice" style="max-width:75ch">A green ellipse is a start point. A red ellipse is an action: if Queller can do it legally, do it and stop; otherwise apply rule 29. A yellow or blue rounded rectangle is a yes/no decision about the board now. A grey striped box is a jump to the start point with that name; a die in brackets means use that die. A purple box is a priority list (rules 30 and 31). An orange box is a step: do it, then continue. Bold text with the ring mark ' +
      ui.ringIcon() +
      " is an Elven Ring condition (rule 36): if it is true and Queller lacks the die the next step needs, it uses a ring. “Phase 5 – continue from where you came” means return to the grey box that sent you here and follow its arrow out.</p></div>";
    return html;
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
  function svgPage(pageKey) {
    const page = FLOW[pageKey];
    const state = ui.state;
    const walk = state?.walk;
    const curNode =
      walk && !walk.done && walk.page === pageKey ? walk.node : null;
    const visited = new Set();
    if (
      walk?.page === pageKey ||
      walk?.trail.some((entry) => entry.page === pageKey)
    )
      walk.trail.forEach((entry) => {
        if (entry.page === pageKey && entry.node) visited.add(entry.node);
      });
    let maxX = 0,
      maxY = 0;
    for (const id in page.nodes) {
      const node = page.nodes[id];
      maxX = Math.max(maxX, node[1] + node[3]);
      maxY = Math.max(maxY, node[2] + node[4]);
    }
    for (const edge of page.edges) {
      for (const waypoint of edge[3] || []) {
        maxX = Math.max(maxX, waypoint[0]);
        maxY = Math.max(maxY, waypoint[1]);
      }
    }
    let svg =
      '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flowchart: ' +
      esc(page.name) +
      '. Use Show as text for a readable version." viewBox="0 0 ' +
      (maxX + 20) +
      " " +
      (maxY + 20) +
      '" width="100%" style="font-family:Helvetica,Arial,sans-serif;font-size:11px"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#999" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#fff"/>';
    // edges first, so the boxes are drawn over them
    let labels = "";
    for (const edge of page.edges) {
      const fromBox = page.nodes[edge[0]],
        toBox = page.nodes[edge[1]];
      if (!fromBox || !toBox) continue;
      const points = route(
        fromBox,
        toBox,
        edge[3],
        edge[4],
        edge[5] === "elbow",
      );
      svg +=
        '<polyline points="' +
        points.map((point) => point.join(",")).join(" ") +
        '" fill="none" stroke="#333" stroke-width="1.2" marker-end="url(#arr)"/>';
      if (edge[2] && !edge[6]) {
        const [labelX, labelY] = midpoint(points);
        const labelWidth = edge[2].length * 5.6 + 8;
        labels +=
          '<rect x="' +
          (labelX - labelWidth / 2) +
          '" y="' +
          (labelY - 7) +
          '" width="' +
          labelWidth +
          '" height="13" rx="2" fill="#fff"/><text x="' +
          labelX +
          '" y="' +
          (labelY + 3) +
          '" text-anchor="middle" font-size="10" fill="#333">' +
          esc(edge[2]) +
          "</text>";
      }
    }
    for (const id in page.nodes) {
      const node = page.nodes[id];
      const [kind, x, y, width, height, text, nodeExtra] = node;
      const style = NODE_STYLE[kind];
      const isCurrent = id === curNode,
        wasVisited = visited.has(id);
      let shape = "";
      const fill = style[0] || "none",
        stroke = style[1] || "none";
      if (kind === "S" || kind === "A")
        shape =
          '<ellipse cx="' +
          (x + width / 2) +
          '" cy="' +
          (y + height / 2) +
          '" rx="' +
          width / 2 +
          '" ry="' +
          height / 2 +
          '" fill="' +
          fill +
          '" stroke="' +
          stroke +
          '"/>';
      else if (kind === "N") {
        if (id === "grp")
          shape =
            '<rect x="' +
            x +
            '" y="' +
            y +
            '" width="' +
            width +
            '" height="' +
            height +
            '" rx="8" fill="none" stroke="#999" stroke-dasharray="4 3"/>';
      } else if (kind === "J")
        shape =
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          width +
          '" height="' +
          height +
          '" fill="' +
          fill +
          '" stroke="' +
          stroke +
          '"/><rect x="' +
          x +
          '" y="' +
          y +
          '" width="8" height="' +
          height +
          '" fill="url(#hatch)" stroke="' +
          stroke +
          '"/><rect x="' +
          (x + width - 8) +
          '" y="' +
          y +
          '" width="8" height="' +
          height +
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
          width +
          '" height="' +
          height +
          '" rx="' +
          (kind === "T" ? 0 : 8) +
          '" fill="' +
          fill +
          '" stroke="' +
          stroke +
          '"/>';
      if (wasVisited && !isCurrent && kind !== "N") {
        const shade = 'fill="#3a332c" fill-opacity=".22" stroke="none"';
        const rx = kind === "T" || kind === "J" ? 0 : 8;
        shape +=
          kind === "S" || kind === "A"
            ? '<ellipse cx="' +
              (x + width / 2) +
              '" cy="' +
              (y + height / 2) +
              '" rx="' +
              width / 2 +
              '" ry="' +
              height / 2 +
              '" ' +
              shade +
              "/>"
            : '<rect x="' +
              x +
              '" y="' +
              y +
              '" width="' +
              width +
              '" height="' +
              height +
              '" rx="' +
              rx +
              '" ' +
              shade +
              "/>";
      }
      if (isCurrent)
        shape +=
          '<rect x="' +
          (x - 5) +
          '" y="' +
          (y - 5) +
          '" width="' +
          (width + 10) +
          '" height="' +
          (height + 10) +
          '" rx="12" fill="none" stroke="#8A2A22" stroke-width="3"/>';
      let inner;
      const bold = nodeExtra?.bold;
      const pad = kind === "N" ? 0 : 4;
      const label = nodeLabel(kind, id, text, node);
      const extraHeight = id === "ringNote" ? 14 : 0;
      inner =
        '<foreignObject x="' +
        (x + pad) +
        '" y="' +
        (y + pad) +
        '" width="' +
        (width - 2 * pad) +
        '" height="' +
        (height - 2 * pad + extraHeight) +
        '"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:' +
        (nodeExtra?.items || id === "grp" ? "flex-start" : "center") +
        ";justify-content:center;text-align:center;color:#1d1a17;line-height:1.15;font-size:11px;overflow:hidden;" +
        (bold ? "font-weight:700;" : "") +
        '"><div style="width:100%">' +
        label +
        "</div></div></foreignObject>";
      let mark = bold
        ? '<g transform="translate(' +
          (x + width - 18) +
          "," +
          (y - 8) +
          ') scale(0.75)" style="color:#7E2419"><title>Elven Ring condition (rule 36)</title><circle cx="12" cy="13.5" r="9.5" fill="#fff"/>' +
          ui.RING_PATH +
          "</g>"
        : "";
      if (id === "ringNote")
        mark =
          '<g transform="translate(' +
          (x - 2) +
          "," +
          (y + 8) +
          ') scale(0.85)" style="color:#7E2419"><title>Elven Ring condition (rule 36)</title>' +
          ui.RING_PATH +
          "</g>";
      svg += '<g data-node="' + id + '">' + shape + inner + mark + "</g>";
    }
    return svg + labels + "</svg>";
  }
  function textPage(pageKey) {
    const page = FLOW[pageKey];
    const state = ui.state,
      walk = state?.walk;
    const curNode =
      walk && !walk.done && walk.page === pageKey ? walk.node : null;
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
    const nodeName = (id) => {
      const node = page.nodes[id];
      return node ? engine.normalizeText(node[5]).replaceAll("*", "") : id;
    };
    let html =
      '<div class="flowtext"><p class="notice">Text version of ' +
      esc(page.name) +
      ". Each box lists where its arrows lead.</p><ol>";
    for (const id in page.nodes) {
      const node = page.nodes[id];
      if (node[0] === "N" && !/grp/.test(id)) continue;
      if (id === "grp") continue;
      const nodeExtra = node[6] || {};
      const outEdges = page.edges.filter((edge) => edge[0] === id);
      let text = "<b>" + esc(KIND[node[0]]) + ":</b> " + fmt(node[5]);
      if (nodeExtra.t2)
        text += " " + ui.ringIcon() + " (ring part) — or " + fmt(nodeExtra.t2);
      if (nodeExtra.bold && !nodeExtra.t2)
        text += " " + ui.ringIcon() + " (ring condition)";
      if (nodeExtra.wome) text += " (WoME only)";
      if (nodeExtra.items)
        text +=
          (nodeExtra.any ? " any of: " : " ") +
          "<ol>" +
          nodeExtra.items.map((item) => "<li>" + fmt(item) + "</li>").join("") +
          "</ol>";
      if (outEdges.length)
        text +=
          '<div class="notice">' +
          outEdges
            .map(
              (edge) =>
                (edge[2] ? esc(edge[2]) + ": " : "then: ") +
                "go to “" +
                esc(nodeName(edge[1])) +
                "”",
            )
            .join("; ") +
          "</div>";
      else if (node[0] === "A")
        text +=
          '<div class="notice">then: stop (if not possible, rule 29)</div>';
      html +=
        '<li id="tx-' +
        id +
        '"' +
        (id === curNode
          ? ' style="outline:2px solid var(--accent);padding:4px"'
          : "") +
        ">" +
        text +
        (id === curNode ? " <b>(current step)</b>" : "") +
        "</li>";
    }
    return html + "</ol></div>";
  }
  // The HTML inside a node box: page titles, the ring note and group labels have their own styling; everything else is the node text.
  function nodeLabel(kind, id, text, node) {
    if (kind === "N" && id !== "grp" && /title/.test(id))
      return (
        '<div style="font-size:16px;font-weight:700;text-align:right">' +
        esc(text) +
        "</div>"
      );
    if (id === "ringNote")
      return (
        '<div style="font-weight:700;text-align:left;line-height:1.1;padding-left:22px">' +
        esc(text) +
        "</div>"
      );
    if (id === "grp")
      return (
        '<div style="text-align:left;padding:5px 8px;color:#555">' +
        esc(text) +
        "</div>"
      );
    return nodeInner(node);
  }
  function nodeInner(node) {
    const [, , , , , text, nodeExtra] = node;
    let html = esc(text)
      .replace(/\*([^*]+)\*/g, "<i>$1</i>")
      .replaceAll("\n", "<br>");
    if (nodeExtra?.t2)
      html =
        "<b>" +
        html +
        "</b> or " +
        esc(nodeExtra.t2).replace(/\*([^*]+)\*/g, "<i>$1</i>");
    if (nodeExtra?.items)
      html =
        '<div style="text-align:left;width:100%"><b style="display:block;text-align:center">' +
        html +
        "</b><" +
        (nodeExtra.any ? "ul" : "ol") +
        ' style="margin:2px 0 0;padding-left:18px">' +
        nodeExtra.items
          .map(
            (item) =>
              "<li>" + esc(item).replace(/\*([^*]+)\*/g, "<i>$1</i>") + "</li>",
          )
          .join("") +
        "</" +
        (nodeExtra.any ? "ul" : "ol") +
        "></div>";
    return html;
  }
  // The point halfway along a polyline, for its label.
  function midpoint(points) {
    let total = 0;
    const segmentLengths = [];
    for (let i = 1; i < points.length; i++) {
      const length = Math.hypot(
        points[i][0] - points[i - 1][0],
        points[i][1] - points[i - 1][1],
      );
      segmentLengths.push(length);
      total += length;
    }
    let remaining = total / 2;
    for (let i = 1; i < points.length; i++) {
      if (remaining <= segmentLengths[i - 1]) {
        const fraction = segmentLengths[i - 1]
          ? remaining / segmentLengths[i - 1]
          : 0;
        return [
          points[i - 1][0] + (points[i][0] - points[i - 1][0]) * fraction,
          points[i - 1][1] + (points[i][1] - points[i - 1][1]) * fraction,
        ];
      }
      remaining -= segmentLengths[i - 1];
    }
    return points[points.length - 1];
  }
  // The point on a box's edge nearest to (px, py): on the top or bottom edge when the point is more above/below than beside it.
  function anchor(box, px, py) {
    const [, x, y, width, height] = box;
    const centreX = x + width / 2,
      centreY = y + height / 2;
    const dx = px - centreX,
      dy = py - centreY;
    if (Math.abs(dy) * width > Math.abs(dx) * height) {
      return dy > 0
        ? [clamp(px, x + 8, x + width - 8), y + height]
        : [clamp(px, x + 8, x + width - 8), y];
    }
    return dx > 0
      ? [x + width, clamp(py, y + 6, y + height - 6)]
      : [x, clamp(py, y + 6, y + height - 6)];
  }
  // anchor towards a draw.io waypoint: leave from the side the point lies beyond (horizontal when it is outside the box's x-range), like draw.io's orthogonal router
  function waypointAnchor(box, px, py) {
    const [, x, y, width, height] = box;
    const outX = px < x || px > x + width,
      outY = py < y || py > y + height;
    if (outX)
      return [
        px < x ? x : x + width,
        py >= y + 6 && py <= y + height - 6 ? py : y + height / 2,
      ];
    if (outY)
      return [
        px >= x + 8 && px <= x + width - 8 ? px : x + width / 2,
        py < y ? y : y + height,
      ];
    return anchor(box, px, py);
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const JOG = 20; // how far an arrow steps out of a box before turning
  const onTopOrBottomEdge = (box, point) =>
    Math.abs(point[1] - box[2]) < 0.5 ||
    Math.abs(point[1] - box[2] - box[4]) < 0.5; // an anchor there means a vertical exit/entry
  // A point on a box from a draw.io anchor (fractions of the width and height).
  const anchorAt = (box, anchorFraction) => [
    box[1] + box[3] * anchorFraction[0],
    box[2] + box[4] * anchorFraction[1],
  ];
  // The point the edge heads for at one end: the first/last waypoint, else the other box's explicit anchor, else its centre.
  function towards(waypoint, anchorFraction, box, centre) {
    if (waypoint) return waypoint;
    return anchorFraction ? anchorAt(box, anchorFraction) : centre;
  }
  // Where the edge meets a box: its explicit anchor when draw.io gives one, else the nearest point facing towardPoint (a waypoint or the other end).
  function edgeEnd(box, anchorFraction, hasWaypoints, towardPoint) {
    if (anchorFraction) return anchorAt(box, anchorFraction);
    return hasWaypoints
      ? waypointAnchor(box, towardPoint[0], towardPoint[1])
      : anchor(box, towardPoint[0], towardPoint[1]);
  }
  // Which way an edge leaves a box: -1 from the top (vertical) or left edge, +1 from the bottom or right.
  function exitDirection(box, point, vertical) {
    const nearStart = vertical
      ? Math.abs(point[1] - box[2]) < 0.5
      : Math.abs(point[0] - box[1]) < 0.5;
    return nearStart ? -1 : 1;
  }
  // The node tuple's position and size slots for each axis.
  const AXIS_SLOTS = {
    x: { position: 1, size: 3 },
    y: { position: 2, size: 4 },
  };
  // A lane for a detour between two boxes along one axis: midway through the gap between them when there is one,
  // otherwise just outside both boxes on the side the edge is heading (towardsStart = towards 0).
  function lane(fromBox, toBox, axis, towardsStart, jog) {
    const { position, size } = AXIS_SLOTS[axis];
    if (towardsStart) {
      if (toBox[position] + toBox[size] <= fromBox[position])
        return (toBox[position] + toBox[size] + fromBox[position]) / 2;
      return Math.min(fromBox[position], toBox[position]) - jog;
    }
    if (fromBox[position] + fromBox[size] <= toBox[position])
      return (fromBox[position] + fromBox[size] + toBox[position]) / 2;
    return (
      Math.max(
        fromBox[position] + fromBox[size],
        toBox[position] + toBox[size],
      ) + jog
    );
  }
  function boxCentre(box) {
    return [box[1] + box[3] / 2, box[2] + box[4] / 2];
  }
  function route(fromBox, toBox, waypoints, anchors, elbow) {
    const fromCentre = boxCentre(fromBox),
      toCentre = boxCentre(toBox);
    if (elbow && waypoints?.length && anchors?.ex && anchors.en) {
      // draw.io elbowEdgeStyle: one elbow positioned by the first waypoint
      const start = anchorAt(fromBox, anchors.ex),
        end = anchorAt(toBox, anchors.en);
      const exitVertical = anchors.ex[1] === 0 || anchors.ex[1] === 1;
      return exitVertical
        ? [start, [start[0], waypoints[0][1]], [end[0], waypoints[0][1]], end]
        : [start, [waypoints[0][0], start[1]], [waypoints[0][0], end[1]], end];
    }
    if (anchors && (anchors.ex || anchors.en)) {
      // explicit draw.io exit/entry anchors (fractions of the box); a missing side falls back to the nearest-point heuristic
      const first = towards(waypoints?.[0], anchors.en, toBox, toCentre),
        last = towards(waypoints?.at(-1), anchors.ex, fromBox, fromCentre);
      const start = edgeEnd(fromBox, anchors.ex, waypoints?.length, first);
      const end = edgeEnd(toBox, anchors.en, waypoints?.length, last);
      const exitVertical = onTopOrBottomEdge(fromBox, start),
        entryVertical = onTopOrBottomEdge(toBox, end);
      const points = [start];
      let previous = start;
      if (waypoints?.length) {
        for (const waypoint of waypoints) {
          if (
            Math.abs(waypoint[0] - previous[0]) > 1 &&
            Math.abs(waypoint[1] - previous[1]) > 1
          )
            points.push(
              exitVertical
                ? [previous[0], waypoint[1]]
                : [waypoint[0], previous[1]],
            );
          points.push(waypoint);
          previous = waypoint;
        }
      }
      if (
        Math.abs(end[0] - previous[0]) > 1 &&
        Math.abs(end[1] - previous[1]) > 1
      ) {
        const jog = JOG;
        const exitDir = exitDirection(fromBox, start, exitVertical),
          entryDir = exitDirection(toBox, end, entryVertical);
        if (
          !waypoints?.length &&
          !exitVertical &&
          !entryVertical &&
          exitDir === entryDir
        ) {
          const outX =
            exitDir > 0
              ? Math.max(previous[0], end[0]) + jog
              : Math.min(previous[0], end[0]) - jog;
          points.push([outX, previous[1]], [outX, end[1]]);
        } else if (
          !waypoints?.length &&
          !exitVertical &&
          !entryVertical &&
          (end[0] - previous[0]) * exitDir < 0
        ) {
          const outX = previous[0] + jog * exitDir,
            inX = end[0] - jog * exitDir;
          const laneY = lane(fromBox, toBox, "y", end[1] < previous[1], jog);
          points.push(
            [outX, previous[1]],
            [outX, laneY],
            [inX, laneY],
            [inX, end[1]],
          );
        } else if (
          !waypoints?.length &&
          exitVertical &&
          entryVertical &&
          exitDir === entryDir
        ) {
          const outY =
            exitDir > 0
              ? Math.max(previous[1], end[1]) + jog
              : Math.min(previous[1], end[1]) - jog;
          points.push([previous[0], outY], [end[0], outY]);
        } else if (
          !waypoints?.length &&
          exitVertical &&
          entryVertical &&
          (end[1] - previous[1]) * exitDir < 0
        ) {
          const outY = previous[1] + jog * exitDir,
            inY = end[1] - jog * exitDir;
          const laneX = lane(fromBox, toBox, "x", end[0] < previous[0], jog);
          points.push(
            [previous[0], outY],
            [laneX, outY],
            [laneX, inY],
            [end[0], inY],
          );
        } else if (exitVertical && entryVertical) {
          const midY = (previous[1] + end[1]) / 2;
          points.push([previous[0], midY], [end[0], midY]);
        } else if (!exitVertical && !entryVertical) {
          const midX = (previous[0] + end[0]) / 2;
          points.push([midX, previous[1]], [midX, end[1]]);
        } else if (exitVertical) points.push([previous[0], end[1]]);
        else points.push([end[0], previous[1]]);
      }
      points.push(end);
      return points;
    }
    if (waypoints?.length) {
      const start = waypointAnchor(fromBox, waypoints[0][0], waypoints[0][1]);
      const end = waypointAnchor(
        toBox,
        waypoints[waypoints.length - 1][0],
        waypoints[waypoints.length - 1][1],
      );
      const points = [start];
      let previous = start;
      for (const waypoint of waypoints) {
        if (
          Math.abs(waypoint[0] - previous[0]) > 1 &&
          Math.abs(waypoint[1] - previous[1]) > 1
        )
          points.push([waypoint[0], previous[1]]);
        points.push(waypoint);
        previous = waypoint;
      }
      if (
        Math.abs(end[0] - previous[0]) > 1 &&
        Math.abs(end[1] - previous[1]) > 1
      )
        points.push([previous[0], end[1]]);
      points.push(end);
      return points;
    }
    const below = toCentre[1] > fromBox[2] + fromBox[4],
      above = toCentre[1] + toBox[4] / 2 < fromBox[2],
      right = toCentre[0] > fromBox[1] + fromBox[3],
      left = toCentre[0] + toBox[3] / 2 < fromBox[1];
    if (
      (below && !(right || left)) ||
      (below &&
        Math.abs(toCentre[0] - fromCentre[0]) <
          Math.abs(toCentre[1] - fromCentre[1]))
    ) {
      const start = [
          clamp(toCentre[0], fromBox[1] + 8, fromBox[1] + fromBox[3] - 8),
          fromBox[2] + fromBox[4],
        ],
        finish = [
          clamp(fromCentre[0], toBox[1] + 8, toBox[1] + toBox[3] - 8),
          toBox[2],
        ];
      const midY = (start[1] + finish[1]) / 2;
      return Math.abs(start[0] - finish[0]) < 1
        ? [start, finish]
        : [start, [start[0], midY], [finish[0], midY], finish];
    }
    if (
      above &&
      Math.abs(toCentre[0] - fromCentre[0]) <
        Math.abs(toCentre[1] - fromCentre[1])
    ) {
      const start = [
          clamp(toCentre[0], fromBox[1] + 8, fromBox[1] + fromBox[3] - 8),
          fromBox[2],
        ],
        finish = [
          clamp(fromCentre[0], toBox[1] + 8, toBox[1] + toBox[3] - 8),
          toBox[2] + toBox[4],
        ];
      const midY = (start[1] + finish[1]) / 2;
      return Math.abs(start[0] - finish[0]) < 1
        ? [start, finish]
        : [start, [start[0], midY], [finish[0], midY], finish];
    }
    if (right) {
      const start = [
          fromBox[1] + fromBox[3],
          clamp(toCentre[1], fromBox[2] + 6, fromBox[2] + fromBox[4] - 6),
        ],
        finish = [
          toBox[1],
          clamp(fromCentre[1], toBox[2] + 6, toBox[2] + toBox[4] - 6),
        ];
      const midX = (start[0] + finish[0]) / 2;
      return Math.abs(start[1] - finish[1]) < 1
        ? [start, finish]
        : [start, [midX, start[1]], [midX, finish[1]], finish];
    }
    const start = [
        fromBox[1],
        clamp(toCentre[1], fromBox[2] + 6, fromBox[2] + fromBox[4] - 6),
      ],
      finish = [
        toBox[1] + toBox[3],
        clamp(fromCentre[1], toBox[2] + 6, toBox[2] + toBox[4] - 6),
      ];
    const midX = (start[0] + finish[0]) / 2;
    return Math.abs(start[1] - finish[1]) < 1
      ? [start, finish]
      : [start, [midX, start[1]], [midX, finish[1]], finish];
  }
  // ---------- calculator ----------
  const CALC_MAX = { reg: 10, elite: 10, lead: 10, cotw: 5 };
  function calcHTML() {
    const number = (key, label) =>
      ui.numberRowHTML(
        "c-" + key,
        fmt(label),
        calc[key],
        'data-cs="' + key + '"',
      );
    const checkbox = (key, label) =>
      ui.checkboxRowHTML(
        "c-" + key,
        fmt(label),
        calc[key],
        'data-c="' + key + '"',
      );
    return (
      '<div class="body"><p class="notice">' +
      fmt(
        "The *value* of an army per the glossary. Hits: 1 per Regular, 2 per Elite. Combat dice: one per Army unit, maximum 5. Leadership: maximum 5 and not more than the number of Army units.",
      ) +
      '</p><div class="calc tracker">' +
      number("reg", "Regular units") +
      number("elite", "Elite units") +
      number(
        "lead",
        "Leadership (Nazgûl, leaders, minions, Companions)\u00b9",
      ) +
      number("cotw", "Captains of the West (Free Peoples only)") +
      checkbox("fort", "Defends in a Fortification or City region") +
      checkbox(
        "strong",
        "Defends in a Stronghold (×1.5, five strongest units’ hits)",
      ) +
      checkbox("sortie", "Sortie (×0.5)") +
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
    const units = calc.reg + calc.elite;
    const lines = [];
    let hits = calc.reg + 2 * calc.elite;
    if (calc.strong) {
      const top = Math.min(5, units);
      const eliteCounted = Math.min(top, calc.elite);
      hits = eliteCounted * 2 + (top - eliteCounted);
      lines.push("Hits (five strongest units): " + hits);
    } else lines.push("Hits: " + hits);
    const dice = Math.min(5, units + calc.cotw);
    lines.push("Combat dice: " + dice);
    const lead = Math.min(5, Math.min(calc.lead, units));
    lines.push("Leadership: " + lead);
    let value = hits + dice + lead + calc.cotw;
    if (calc.cotw) lines.push("Captains of the West: +" + calc.cotw);
    if (calc.fort) {
      value += 1;
      lines.push("Fortification/City: +1");
    }
    if (calc.strong) {
      value = Math.floor(value * 1.5);
      lines.push("Stronghold: ×1.5 rounded down");
    }
    if (calc.sortie) {
      value = Math.floor(value * 0.5);
      lines.push("Sortie: ×0.5 rounded down");
    }
    return (
      '<div class="n">' +
      value +
      "</div><div>" +
      fmt("Army *value*") +
      "</div><ul>" +
      lines.map((line) => "<li>" + esc(line) + "</li>").join("") +
      "</ul>"
    );
  }
  // ---------- transfer helpers (save file, debug log) ----------
  // The artifact host offers a downloads capability; a plain <a download> may be inert for viewers, so the copy button (and the text box) is the fallback.
  async function downloadText({ fileName, data, noteEl, fallbackLabel }) {
    try {
      const downloads = window.claude?.use
        ? await window.claude.use("downloads")
        : null;
      if (downloads) {
        await downloads.save({ filename: fileName, data });
        noteEl.textContent = "Saved " + fileName + ".";
        return;
      }
    } catch (error) {
      noteEl.textContent =
        "Download not completed: " +
        (error.message || error.code || "cancelled");
      return;
    }
    try {
      const link = document.createElement("a");
      link.href =
        "data:application/json;charset=utf-8," + encodeURIComponent(data);
      link.download = fileName;
      link.click();
      noteEl.textContent = "If nothing downloaded, use " + fallbackLabel + ".";
    } catch {
      // The browser blocked the download; the note points the user at the alternative.
      noteEl.textContent =
        "Downloads are not available here — use " + fallbackLabel + ".";
    }
  }
  async function copyText({ data, noteEl, label, textarea }) {
    try {
      await navigator.clipboard.writeText(data);
      noteEl.textContent = label + " copied to the clipboard.";
    } catch {
      // Clipboard access was refused; select the text so the user can copy it by hand.
      if (textarea) {
        textarea.value = data;
        textarea.focus();
        textarea.select();
      }
      noteEl.textContent = "Copy the text from the box below.";
    }
  }
  // ---------- debug log ----------
  function environment() {
    const mediaMatches = (query) => {
      try {
        return window.matchMedia(query).matches;
      } catch {
        return null;
      }
    };
    let storage = "ok";
    try {
      localStorage.setItem(ui.STORAGE_KEY.PROBE, "1");
      localStorage.removeItem(ui.STORAGE_KEY.PROBE);
    } catch (error) {
      storage = "unavailable: " + (error.message || error);
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
      prefersDark: mediaMatches("(prefers-color-scheme: dark)"),
      coarsePointer: mediaMatches("(pointer: coarse)"),
      reducedMotion: mediaMatches("(prefers-reduced-motion: reduce)"),
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
    const overview = {};
    for (const key of Object.values(ui.STORAGE_KEY)) {
      const value = ui.storageGet(key);
      overview[key] = value == null ? null : value.length;
    }
    return overview;
  }
  function domSnapshot() {
    const textOf = (selector) => {
      const el = document.querySelector(selector);
      return el
        ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 600)
        : null;
    };
    const modal = ui.getModal();
    let modalName = null;
    if (modal)
      modalName =
        modal.name +
        (modal.name === "ask" && modal.arg ? ": " + modal.arg.title : "");
    const activeEl = document.activeElement;
    let active = null;
    if (activeEl && activeEl !== document.body) {
      const label = activeEl.textContent
        ? " “" + activeEl.textContent.trim().slice(0, 40) + "”"
        : "";
      active =
        activeEl.tagName.toLowerCase() +
        (activeEl.id ? "#" + activeEl.id : "") +
        label;
    }
    return {
      rendered: !!document.getElementById("app")?.children.length,
      prompt: textOf(".prompt"),
      result: textOf(".result"),
      phaseButtons: [...document.querySelectorAll("[data-phase]")].map(
        (button) => button.dataset.phase,
      ),
      modal: modalName,
      errorBar: !!document.getElementById("errbar"),
      activeElement: active,
    };
  }
  function debugText() {
    let opts = null;
    try {
      opts = JSON.parse(ui.storageGet(ui.STORAGE_KEY.OPTIONS) || "null");
    } catch {}
    return debug.text({
      state: ui.state,
      history: ui.history,
      report: ui.find("#dbgReport")?.value || "",
      env: environment(),
      dom: domSnapshot(),
      storage: storageOverview(),
      brokenAutosave: ui.storageGet(ui.STORAGE_KEY.BROKEN_AUTOSAVE) || null,
      opts,
    });
  }
  function debugHTML() {
    return (
      '<div class="body"><p class="notice" style="color:var(--ink)">The debug log describes this browser, the game as it stands, the last ' +
      debug.LIMITS.actions +
      " actions, the trails of recent walks and any errors the app recorded, so that a problem can be traced from a report. It contains no personal details, but it does show Queller’s hidden cards — only read it if you do not mind seeing them.</p>" +
      '<p style="margin-top:12px"><label for="dbgReport"><b>What went wrong?</b> <span class="notice" style="display:inline">(optional — saved into the log: what you did, what you expected, what happened)</span></label><textarea id="dbgReport" style="min-height:80px" placeholder="For example: after answering Yes to “Witch King in play” the walk jumped to the Army page instead of Character 2."></textarea></p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn primary" id="dbgDl">Download debug log</button><button type="button" class="btn" id="dbgCopy">Copy debug log</button></div><div id="dbgNote" class="notice" role="status" aria-live="polite" style="margin-top:6px"></div>' +
      '<p style="margin-top:12px"><label for="dbgTxt" class="notice">The log (select all and copy if the buttons do not work)</label><textarea id="dbgTxt" readonly spellcheck="false" style="min-height:200px"></textarea></p></div>'
    );
  }
  function wireDebug(el) {
    const textarea = el.querySelector("#dbgTxt");
    if (!textarea) return;
    const refresh = () => {
      try {
        textarea.value = debugText();
      } catch (error) {
        textarea.value =
          "The debug log could not be built: " +
          (error.stack || error.message || error);
        debug.error(error, { a: "debugBuild" }, ui.state);
      }
      return textarea.value;
    };
    refresh();
    el.querySelector("#dbgReport").onchange = refresh;
    el.querySelector("#dbgDl").onclick = () => {
      const data = refresh();
      debug.action(
        { a: "debugExport", how: "download", bytes: data.length },
        ui.state,
      );
      downloadText({
        fileName: debug.fileName(ui.state),
        data,
        noteEl: el.querySelector("#dbgNote"),
        fallbackLabel: "Copy debug log",
      });
    };
    el.querySelector("#dbgCopy").onclick = () => {
      const data = refresh();
      debug.action(
        { a: "debugExport", how: "copy", bytes: data.length },
        ui.state,
      );
      copyText({
        data,
        noteEl: el.querySelector("#dbgNote"),
        label: "Debug log",
        textarea,
      });
    };
  }
  // ---------- save / load ----------
  function slots() {
    try {
      return JSON.parse(ui.storageGet(ui.STORAGE_KEY.SLOTS) || "[]");
    } catch {
      return [];
    }
  }
  function saveHTML() {
    const slotList = slots();
    let html =
      '<div class="body"><p class="notice">The game is saved automatically in this browser after every action. Named saves are also kept in this browser. To move a game to another device, download it or copy the code.</p>';
    html +=
      "<h4>Named saves</h4>" +
      [0, 1, 2]
        .map((i) => {
          const slot = slotList[i];
          return (
            '<div class="slot"><span class="t">Slot ' +
            (i + 1) +
            (slot ? ": turn " + slot.turn + ", " + esc(slot.when) : ": empty") +
            '</span><button class="btn small" data-save="' +
            i +
            '">Save here</button>' +
            (slot
              ? '<button class="btn small" data-load="' + i + '">Load</button>'
              : "") +
            "</div>"
          );
        })
        .join("");
    html +=
      '<h4>Transfer</h4><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="dlBtn">Download save file</button><button class="btn" id="copyBtn">Copy save code</button></div><div id="dlNote" class="notice"></div>';
    html += "<h4>Load</h4>" + ui.loadHTML() + "</div>";
    return html;
  }
  ui.loadHTML = function () {
    return '<p class="notice" style="margin:0 0 6px">Paste a save code, or choose a save file.</p><label for="loadTxt" class="notice">Save code</label><textarea id="loadTxt" placeholder="Paste the save code here"></textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center"><button class="btn" id="loadTxtBtn">Load from code</button><label class="notice">Save file <input type="file" id="loadFile" accept=".json,application/json"></label></div><div id="loadErr" class="notice" role="alert" style="color:var(--bad)"></div>';
  };
  // Replace the game with a parsed save, confirming first when a game is in progress.
  function loadGame(save, title) {
    const replace = () => {
      debug.begin(
        { a: "load", title, turn: save.turn, version: save.appVersion },
        ui.state,
      );
      ui.history = [];
      ui.state = save;
      debug.finishAction(save);
      ui.closeModal();
      ui.commit();
    };
    if (!ui.state) return replace();
    ui.ask({
      title,
      text: "The game in progress will be replaced.",
      buttons: [
        { v: "ok", label: "Load", primary: true },
        { v: "no", label: "Cancel" },
      ],
      onPick: (choice) => {
        if (choice === "ok") replace();
        else ui.openModal("save");
      },
    });
  }
  ui.wireLoad = function (root) {
    const doLoad = (text) => {
      try {
        loadGame(ui.loadJSON(text), "Load this save?");
      } catch (error) {
        const errorEl = root.querySelector("#loadErr");
        if (errorEl)
          errorEl.textContent = "That is not a Queller save: " + error.message;
      }
    };
    const loadBtn = root.querySelector("#loadTxtBtn");
    if (loadBtn)
      loadBtn.onclick = () =>
        doLoad(root.querySelector("#loadTxt").value.trim());
    const fileInput = root.querySelector("#loadFile");
    if (fileInput)
      fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (!file) return;
        file.text().then(doLoad);
      };
  };
  function settingsHTML() {
    const settings = ui.state.settings;
    const checkbox = (key, label, description, disabled) =>
      '<label class="opt' +
      (disabled ? " dis" : "") +
      '"><input type="checkbox" data-set="' +
      key +
      '" ' +
      (settings[key] ? "checked" : "") +
      (disabled ? ' disabled aria-disabled="true"' : "") +
      "><div><b>" +
      label +
      "</b>" +
      (description ? "<span>" + description + "</span>" : "") +
      "</div></label>";
    return (
      '<div class="body setup" style="margin:0"><p class="notice">Changes apply from the next walk.</p>' +
      checkbox("dice", "Roll and track Queller’s dice", "") +
      checkbox(
        "cards",
        "Draw and hold Queller’s cards",
        "Chosen when the game is set up; it cannot be changed mid-game.",
        true,
      ) +
      checkbox("tracker", "Track board state in the app", "") +
      checkbox(
        "wome",
        "Warriors of Middle-earth",
        "Chosen when the game is set up; it cannot be changed mid-game.",
        true,
      ) +
      '<h4 style="margin-top:18px">Report a problem</h4><p class="notice">If the app does something wrong, export a debug log and send it with a description of what happened. The log records the game, the last actions and any errors.</p><p style="margin-top:8px"><button type="button" class="btn" id="dbgOpen">Export debug log</button></p><h4 style="margin-top:18px">About</h4><p class="notice">Queller Bot Runner version ' +
      engine.VERSION +
      ".</p>" +
      ui.LEGAL +
      "</div>"
    );
  }
  function jumpHTML() {
    let html =
      '<div class="body"><p class="notice">Walk a page from any green start point — for example when a card tells Queller to make a choice (rule 12), to place Nazgûl, or to choose a discard. The walk uses no die unless you pick one.</p><div style="display:grid;gap:8px;grid-template-columns:1fr auto;align-items:center"><select id="jumpSel" aria-label="Start point">';
    for (const pageKey in FLOW) {
      for (const id in FLOW[pageKey].nodes) {
        const node = FLOW[pageKey].nodes[id];
        if (node[0] === "S")
          html +=
            '<option value="' +
            pageKey +
            "|" +
            id +
            '">' +
            esc(FLOW[pageKey].name) +
            " — " +
            esc(engine.normalizeText(node[5])) +
            "</option>";
      }
    }
    html +=
      '</select><select id="jumpDie" aria-label="Die to use"><option value="">No die</option>' +
      Object.keys(engine.DIE_REQUIREMENT_NAME)
        .map(
          (requirement) =>
            '<option value="' +
            requirement +
            '">' +
            esc(engine.DIE_REQUIREMENT_NAME[requirement]) +
            " die</option>",
        )
        .join("") +
      '</select></div><div style="margin-top:12px"><button class="btn primary" id="jumpGo">Walk</button></div></div>';
    return html;
  }
  function wireModal(modal) {
    const el = ui.find("#modal");
    el.querySelectorAll("[data-fp]").forEach(
      (button) =>
        (button.onclick = () => {
          flowPage = button.dataset.fp;
          ui.renderModal();
        }),
    );
    const flowToggleBtn = ui.find("#flowToggle");
    if (flowToggleBtn)
      flowToggleBtn.onclick = () => {
        flowText = !flowText;
        ui.renderModal();
        ui.find("#flowToggle").focus();
      };
    el.querySelectorAll("[data-c]").forEach(
      (input) =>
        (input.oninput = () => {
          const key = input.dataset.c;
          calc[key] =
            input.type === "checkbox"
              ? input.checked
              : Math.max(0, +input.value || 0);
          el.querySelector(".out").innerHTML = calcOut();
        }),
    );
    el.querySelectorAll("[data-cs]").forEach(
      (button) =>
        (button.onclick = () => {
          const key = button.dataset.cs;
          calc[key] = Math.max(
            0,
            Math.min(CALC_MAX[key], calc[key] + +button.dataset.d),
          );
          el.querySelector("#c-" + key + "-n").textContent = calc[key];
          el.querySelector(".out").innerHTML = calcOut();
        }),
    );
    const calcClearBtn = ui.find("#calcClear");
    if (calcClearBtn)
      calcClearBtn.onclick = () => {
        Object.assign(calc, CALC_DEFAULTS);
        for (const key in CALC_MAX) {
          const counter = el.querySelector("#c-" + key + "-n");
          if (counter) counter.textContent = calc[key];
        }
        el.querySelectorAll("[data-c]").forEach((input) => {
          if (input.type === "checkbox")
            input.checked = !!calc[input.dataset.c];
          else input.value = calc[input.dataset.c];
        });
        el.querySelector(".out").innerHTML = calcOut();
      };
    el.querySelectorAll("[data-save]").forEach(
      (button) =>
        (button.onclick = () => {
          debug.action({ a: "saveSlot", slot: +button.dataset.save }, ui.state);
          const slotList = slots();
          slotList[+button.dataset.save] = {
            turn: ui.state.turn,
            when: new Date().toLocaleString(),
            data: JSON.stringify(ui.state),
          };
          ui.storageSet(ui.STORAGE_KEY.SLOTS, JSON.stringify(slotList));
          ui.renderModal();
        }),
    );
    el.querySelectorAll("[data-load]").forEach(
      (button) =>
        (button.onclick = () => {
          const slot = slots()[+button.dataset.load];
          if (slot)
            loadGame(
              ui.loadJSON(slot.data),
              "Load slot " + (+button.dataset.load + 1) + "?",
            );
        }),
    );
    const downloadBtn = ui.find("#dlBtn");
    if (downloadBtn)
      downloadBtn.onclick = () =>
        downloadText({
          fileName: "queller-turn" + ui.state.turn + ".json",
          data: JSON.stringify(ui.state),
          noteEl: ui.find("#dlNote"),
          fallbackLabel: "Copy save code",
        });
    const copyBtn = ui.find("#copyBtn");
    if (copyBtn)
      copyBtn.onclick = () =>
        copyText({
          data: JSON.stringify(ui.state),
          noteEl: ui.find("#dlNote"),
          label: "Save code",
          textarea: ui.find("#loadTxt"),
        });
    const debugOpenBtn = ui.find("#dbgOpen");
    if (debugOpenBtn) debugOpenBtn.onclick = () => ui.openModal("debug");
    wireDebug(el);
    ui.wireLoad(el);
    el.querySelectorAll("[data-set]").forEach(
      (input) =>
        (input.onchange = () =>
          ui.act(
            () => {
              const key = input.dataset.set;
              ui.state.settings[key] = input.checked;
              if (
                key === "wome" ||
                (key === "cards" &&
                  input.checked &&
                  !ui.state.cards.decks.C.length &&
                  !ui.state.cards.hand.length)
              ) {
                engine.buildDecks(ui.state);
                engine.log(ui.state, "Decks rebuilt.");
              }
              if (key === "wome" && !input.checked) {
                ui.state.dice.factionDie = false;
              }
              ui.renderModal();
            },
            { a: "setting", key: input.dataset.set, value: input.checked },
          )),
    );
    el.querySelectorAll("[data-ask]").forEach(
      (button) =>
        (button.onclick = () => {
          const spec = modal.arg;
          const input = ui.find("#askInput");
          const inputValue = input ? input.value : undefined;
          debug.action(
            {
              a: "ask",
              title: spec.title,
              pick: button.dataset.ask,
              input: inputValue,
            },
            ui.state,
          );
          ui.closeModal();
          if (spec.onPick) spec.onPick(button.dataset.ask, inputValue);
        }),
    );

    const jumpGoBtn = ui.find("#jumpGo");
    if (jumpGoBtn)
      jumpGoBtn.onclick = () => {
        const [pageKey, id] = ui.find("#jumpSel").value.split("|");
        const die = ui.find("#jumpDie").value || null;
        ui.act(
          () => {
            ui.state.walk = null;
            engine.startWalk(ui.state, pageKey, FLOW[pageKey].nodes[id][5], {
              die,
            });
            ui.closeModal();
          },
          { a: "jump", page: pageKey, start: id, die },
        );
      };
  }
  window.QBUI.svgPage = svgPage;
  document.addEventListener("DOMContentLoaded", ui.boot);
})();
