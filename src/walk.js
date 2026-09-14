// ===== Flowchart walk engine =====
(function () {
  const Q = window.QB,
    F = Q.F,
    byId = Q.byId;
  const SN_NAME = {
      sauron: "Sauron",
      isengard: "Isengard",
      se: "Southrons and Easterlings",
    },
    SN_KEY = {
      Sauron: "sauron",
      Isengard: "isengard",
      "Southrons and Easterlings": "se",
    };
  const PENDING = null; // returned by a step that has set a prompt and is waiting for the player

  // flow.js node tuple: [kind, x, y, w, h, text, extra]
  const kind = (n) => n[0],
    text = (n) => n[5],
    extra = (n) => n[6] || {};

  const JUMPS = [
    [/^Army$/, { page: "AR", start: "Army", die: "Army" }],
    [/^Army 2$/, { page: "AR", start: "Army 2", die: "Army" }],
    [/^Army 3$/, { page: "AR", start: "Army 3", die: "Army" }],
    [/^Army 4$/, { page: "AR", start: "Army 4", die: "Army" }],
    [
      /^Army 4 \((use )?character die\)$/,
      { page: "AR", start: "Army 4", die: "Character" },
    ],
    [/^Muster$/, { page: "MU", start: "Muster", die: "Muster" }],
    [/^Muster 2$/, { page: "MU", start: "Muster 2", die: "Muster" }],
    [
      /^Muster 3 \/ Muster Event card$/,
      { page: "MU", start: "Muster 3/Muster Event card", die: "Muster" },
    ],
    [/^Character$/, { page: "CH", start: "Character", die: "Character" }],
    [/^Character 2$/, { page: "CH", start: "Character 2", die: "Character" }],
    [
      /^Character 3 \/ Muster Witch King$/,
      {
        page: "CH",
        start: "Character 3 / Muster Witch King",
        die: "CharOrMuster",
      },
    ],
    [/^Event$/, { page: "EV", start: "Event", die: "Event" }],
    [
      /^Event \(use character die\)$/,
      { page: "EV", start: "Event", die: "Character" },
    ],
    [/^Event 2$/, { page: "EV", start: "Event 2", die: "Event" }],
    [
      /^Event 2 \(use character die\)$/,
      { page: "EV", start: "Event 2", die: "Character" },
    ],
    [
      /^Recruit Faction$/,
      { page: "FA", start: "Recruit Faction", die: "FRecruit", wome: true },
    ],
    [
      /^Play Faction Event$/,
      { page: "FA", start: "Play Faction Event", die: "FPlay", wome: true },
    ],
    [
      /^Draw Faction Event$/,
      { page: "FA", start: "Draw Faction Event", die: "FDraw", wome: true },
    ],
    [/^Phase 5 - continue/, { kind: "return" }],
    [/^Phase 5 \(use a ring/, { kind: "ringAny" }],
    [/^Save muster/, { kind: "reserve" }],
    [
      /^Switch to military/,
      {
        kind: "switch",
        strategy: "military",
        endWalk: "Phase 3",
        text: "Queller switches to the military strategy. Continue at “Phase 3” on the Military flowchart.",
      },
    ],
    [
      /^Switch to Corruption/,
      {
        kind: "switch",
        strategy: "corruption",
        page: "C14",
        start: "From Military Strategy",
      },
    ],
    [/Strategy Phase 5$/, { kind: "endPhase4" }],
    [/^Battle \(next round\)$/, { kind: "battleNext" }],
  ];
  const DIE_NAME = {
    Army: "Army",
    Muster: "Muster",
    Character: "Character",
    Event: "Event",
    CharOrMuster: "Character or Muster",
    FRecruit: "Faction (Recruit)",
    FPlay: "Faction (Play)",
    FDraw: "Faction (Draw)",
  };
  function aDie(k) {
    const n = DIE_NAME[k] || k;
    return (/^[AEIOU]/.test(n) ? "an " : "a ") + n;
  }
  function norm(t) {
    return t.replaceAll("\n", " ").replaceAll(/\s+/g, " ").trim();
  }
  function jumpSpec(t) {
    t = norm(t);
    for (const [re, spec] of JUMPS) if (re.test(t)) return spec;
    return null;
  }
  function outEdges(page, id) {
    return F[page].edges.filter((e) => e[0] === id);
  }
  function edgeFor(page, id, label) {
    const es = outEdges(page, id);
    let e = es.find((x) => x[2] === label);
    if (!e) e = es.find((x) => x[2] == null);
    return e;
  }
  function findStart(page, name) {
    const ns = F[page].nodes;
    for (const id in ns) {
      if (kind(ns[id]) === "S" && norm(text(ns[id])) === norm(name)) return id;
    }
    return null;
  }

  function startWalk(S, page, startName, opts) {
    opts = opts || {};
    const id = findStart(page, startName);
    if (!id) {
      Q.log(S, "No start point “" + startName + "” on " + F[page].name);
      return;
    }
    S.walk = {
      page,
      node: id,
      entry: { page, start: startName },
      stack: [],
      trail: [],
      prompt: null,
      done: false,
      result: null,
      die: opts.die || null,
      dieObj: opts.dieObj != null ? opts.dieObj : null,
      dieAns: {},
      dieUsed: false,
      pendingDie: null, // the die this walk holds; dieAns/pendingDie: the player's die answers when dice are not rolled
      mode: opts.mode || null,
      ringArmed: false,
      ringAsked: false, // Elven Ring state (rules 36–38)
      battleRound: opts.battleRound || null,
      fromReserve: false,
      reserveDieObj: null, // set when "Use Muster die set aside for minion" re-enters Muster 2
      cands: null,
      chosen: null,
      steps: null,
      ctb: null,
      discards: null, // card candidates and the priority-list result
      nationChoice: null,
      factionChoice: null,
      minionPick: null, // results of the Muster/Faction priority lists
      sub: 0,
      parts: {},
    }; // multi-part decisions and answers to board questions
    trail(S, { kind: "start", text: startName, page });
    Q.log(
      S,
      "Walk: " +
        F[page].name +
        " from “" +
        norm(startName) +
        "”" +
        (opts.mode === "ringAny" ? " (looking for a ring use, rule 37)" : "") +
        ".",
    );
    if (!opts.noRun) run(S);
  }
  function trail(S, e) {
    e.page = e.page || S.walk.page;
    e.node = e.node || S.walk.node;
    S.walk.trail.push(e);
  }
  function cur(S) {
    return F[S.walk.page].nodes[S.walk.node];
  }
  function goto(S, page, id) {
    S.walk.page = page;
    S.walk.node = id;
  }
  function follow(S, label) {
    const w = S.walk;
    const e = edgeFor(w.page, w.node, label);
    if (!e) return false;
    goto(S, w.page, e[1]);
    return true;
  }
  function endWalk(S, result, txt) {
    const w = S.walk;
    w.done = true;
    w.result = result;
    w.prompt = null;
    trail(S, { kind: "end", text: txt || result });
    if (txt) Q.log(S, txt);
  }
  function setPrompt(S, p) {
    S.walk.prompt = p;
  }

  // --- main loop ---
  const RUN_GUARD = 300;
  function run(S) {
    let guard = 0;
    while (S.walk && !S.walk.done && !S.walk.prompt) {
      if (guard++ >= RUN_GUARD) {
        endWalk(
          S,
          "noaction",
          "The walk did not finish (more than " +
            RUN_GUARD +
            " steps) — walk again.",
        );
        break;
      }
      const w = S.walk,
        n = cur(S),
        k = kind(n);
      if (k === "S") {
        const first = w.trail[0];
        if (!(first.page === w.page && first.node === w.node)) {
          endWalk(
            S,
            "phase:" + norm(text(n)),
            "Reached “" + norm(text(n)) + "”.",
          );
          break;
        }
        follow(S, null);
        continue;
      }
      if (k === "N") {
        follow(S, null);
        continue;
      }
      if (k === "D" || k === "d") {
        handleDecision(S, n);
        continue;
      }
      if (k === "J") {
        handleJump(S, n);
        continue;
      }
      if (k === "A") {
        handleAction(S, n);
        continue;
      }
      if (k === "T") {
        handleStep(S, n);
        continue;
      }
      if (k === "P") {
        handlePriority(S, n);
        continue;
      }
      endWalk(S, "noaction", "Unknown box kind “" + k + "”.");
      break;
    }
  }
  // Board consequences of a decision the player answered (the tracker keeps up with what the flowchart just established).
  const DECIDE_HOOKS = {
    "CH.musteredWK": (S, ans) => {
      if (ans && !S.board.chars.witchKing) {
        S.board.chars.witchKing = true;
        S.playable = {};
        Q.log(
          S,
          "Witch King is now in play (tracker updated; his die joins the pool next turn).",
        );
      }
    },
  };
  // Record a decision (`txt` as shown, `bold` = Elven Ring condition) and follow its Yes/No arrow.
  function decided(S, txt, bold, ans, auto, why) {
    const w = S.walk;
    trail(S, {
      kind: "q",
      text: txt,
      answer: ans ? "Yes" : "No",
      auto: !!auto,
      why,
      ring: !!bold,
    });
    if (ans && bold && !S.ringUsedThisTurn) w.ringArmed = true;
    const hook = DECIDE_HOOKS[w.page + "." + w.node];
    if (hook) hook(S, ans);
    w.sub = 0;
    w.parts = {};
    if (!follow(S, ans ? "Yes" : "No")) {
      endWalk(S, "noaction", "The flowchart has no arrow for that answer.");
    }
  }
  function ask(S, n, txt, opts) {
    setPrompt(S, {
      type: "yesno",
      text: txt || text(n),
      node: S.walk.node,
      page: S.walk.page,
      kind: kind(n),
      ...opts,
    });
  }
  // A board fact: from the tracker when it is on, otherwise asked of the player once per node (answers live in w.parts). Returns PENDING while the question is open.
  function boardFact(S, k, question, trackerValue, range) {
    if (S.settings.tracker) return trackerValue;
    const w = S.walk,
      pk = w.page + "." + w.node + "." + k;
    if (pk in w.parts) return w.parts[pk];
    setPrompt(
      S,
      range
        ? {
            type: "count",
            text: question,
            part: pk,
            node: w.node,
            page: w.page,
            min: range.min,
            max: range.max,
            value: trackerValue,
          }
        : {
            type: "yesno",
            text: question,
            part: pk,
            node: w.node,
            page: w.page,
            kind: "d",
            board: true,
          },
    );
    return PENDING;
  }

  // ----- decisions -----
  function handleDecision(S, n) {
    const w = S.walk,
      id = w.node,
      page = w.page,
      x = extra(n),
      B = S.board,
      cards = S.settings.cards,
      dice = S.settings.dice;
    if (x.wome && !S.settings.wome)
      return decided(S, text(n), x.bold, false, true, "WoME not in play");
    const key = page + "." + id,
      T = S.settings.tracker,
      facKnown = T || (cards && S.settings.wome);
    const auto = (v, why) => decided(S, text(n), x.bold, v, true, why);
    const bauto = (v, why) => (T ? auto(v, why) : ask(S, n));
    const hc = Q.handCounts(S);
    const handC = () => Q.handBy(S, "C"),
      handS = () => Q.handBy(S, "S");
    // Evaluate which of `ids` are playable (asking the player as needed), keep them as this walk's candidates and answer "any playable?"
    const playableCount = (ids, ctx, noun) => {
      const r = evalPlayable(S, ids, ctx);
      if (r === PENDING) return;
      w.cands = r;
      auto(r.length > 0, r.length + " " + noun + (r.length === 1 ? "" : "s"));
    };
    switch (key) {
      // ---- Phases 1-4
      case "C14.more6":
      case "M14.more6":
        if (cards) return auto(hc.total > 6, "hand: " + hc.total);
        return ask(S, n);
      case "C14.strat1":
        if (cards) return auto(hc.S > 1, "Strategy cards: " + hc.S);
        return ask(S, n);
      case "C14.more4f":
      case "M14.more4f":
        if (cards) return auto(hc.F > 4, "Faction cards: " + hc.F);
        return ask(S, n);
      case "C14.corrLow":
        return bauto(
          B.corruption < B.shadowVP,
          "Corruption " + B.corruption + " vs Shadow VP " + B.shadowVP,
        );
      case "M14.vpLow":
        return bauto(
          B.shadowVP < B.corruption,
          "Shadow VP " + B.shadowVP + " vs Corruption " + B.corruption,
        );
      case "C14.fsStart":
      case "M14.fsStart":
        return bauto(B.fs.atStart && B.fs.progress === 0, "tracker");
      case "C14.fsMordor":
      case "M14.fsMordor":
        return bauto(B.fs.mordor, "tracker");
      case "C14.prog4":
        return bauto(B.fs.progress > 4, "Progress " + B.fs.progress);
      case "M14.prog5":
        return bauto(B.fs.progress > 5, "Progress " + B.fs.progress);
      case "C14.winOr7":
        if (dice && Q.diceCount(S) === 7)
          return auto(true, "Shadow has 7 dice");
        return ask(
          S,
          n,
          "*Mobile* army adjacent to *target* which would win the game" +
            (dice ? "" : " or Shadow only has 7 dice"),
        );
      // ---- Phase 5
      case "C5.charMordor":
      case "M5.charMordor":
        if (!T && !cards) return ask(S, n);
        {
          const m = boardFact(
            S,
            "mordor",
            "Is the Fellowship on the Mordor track or revealed?",
            B.fs.mordor || B.fs.revealed,
          );
          if (m === PENDING) return;
          if (!m)
            return auto(
              false,
              "Fellowship not on the Mordor track or revealed",
            );
        }
        if (cards) return auto(hc.C > 0, "Character cards: " + hc.C);
        return ask(
          S,
          n,
          "Character cards > 0? (the Fellowship is on the Mordor track or revealed)",
        );
      case "C5.wkNotMob":
      case "M5.wkNotMob":
      case "CH.wkJoin":
        if (T && !B.chars.witchKing)
          return auto(false, "Witch King not in play");
        return ask(S, n);
      case "C5.minion":
      case "M5.minion": {
        // bold part: a minion can be mustered; plain part: Muster 2 can still advance a nation or recruit a faction
        if (!T) break;
        if (w.sub === 0) {
          const m = Q.minionsAvailable(S);
          if (m.length)
            return decided(
              S,
              text(n),
              true,
              true,
              true,
              m[0].name + ": " + m[0].why,
            );
          trail(S, {
            kind: "q",
            text: text(n),
            answer: "No",
            auto: true,
            why: "no minion can be mustered (tracker)",
          });
          w.sub = 1;
        }
        const seNot = !Q.snAtWar(S, "se"),
          noFac = S.settings.wome && !Q.shadowFactionInPlay(S);
        let why =
          "S&E at war" + (S.settings.wome ? ", a faction is in play" : "");
        if (seNot) why = "Southrons & Easterlings not at war";
        else if (noFac) why = "no faction recruited";
        return decided(S, x.t2, false, seNot || noFac, true, why);
      }
      case "C5.mordorWin": {
        if (w.sub === 0) {
          if (T && B.fs.mordor)
            return decided(
              S,
              text(n),
              true,
              true,
              true,
              "Fellowship on the Mordor track",
            );
          return ask(S, n, "*Target* would win the game", {
            sub: 1,
            bold: true,
          });
        }
        return ask(S, n, x.t2, { sub: 2 });
      }
      case "C5.playChar":
        if (cards)
          return playableCount(handC(), "event", "playable Character card");
        return ask(S, n);
      case "C5.allFac":
        if (facKnown) return auto(Q.allShadowFactionsInPlay(S), "tracker");
        return ask(S, n);
      case "M5.revCard":
        if (cards)
          return playableCount(
            handC().filter((i) => byId[i].revealed),
            "event",
            "playable “Fellowship revealed” card",
          );
        return ask(S, n);
      case "M5.playMuster":
      case "MU.musterCard":
        if (cards)
          return playableCount(
            handS().filter((i) => byId[i].type === "Muster"),
            "event",
            "playable Muster card",
          );
        return ask(S, n);
      case "M5.anyCond":
        if (T && B.fs.mordor) return auto(true, "Fellowship is in Mordor");
        return ask(S, n, null, { items: x.items, any: true });
      // ---- Character
      case "CH.nazInPlay":
        return bauto(
          B.chars.witchKing || B.nazgul > 0,
          "tracker: " +
            B.nazgul +
            " Nazgûl" +
            (B.chars.witchKing ? ", Witch King in play" : ""),
        );
      // CH.wkJoin shares the Witch King check with C5/M5.wkNotMob above.
      case "CH.nazFs":
      case "CH.nazJoin":
        if (T && B.nazgul === 0) return auto(false, "no Nazgûl on the map");
        return ask(S, n);
      case "CH.mosMob":
        if (T && !B.chars.mouth)
          return auto(false, "Mouth of Sauron not in play");
        return ask(S, n);
      case "CH.dieUsed":
        return auto(w.dieUsed, w.dieUsed ? "a move was made" : "nothing moved");
      // ---- Army
      case "AR.huntDice":
        if (dice && S.dice.hunt === 0)
          return auto(false, "no dice in the Hunt box");
        if (T && B.fs.mordor) return auto(false, "Fellowship in Mordor");
        return ask(S, n);
      // ---- Muster
      case "MU.minion": {
        const m = Q.minionsAvailable(S);
        return bauto(
          m.length > 0,
          m.length
            ? m[0].name + ": " + m[0].why
            : "no minion can be mustered (tracker)",
        );
      }
      case "MU.wotw":
        if (w.fromReserve)
          return auto(
            false,
            "the die set aside for the minion must be used now (Rulings)",
          );
        if (
          T &&
          (B.chars.gandalfWhite ||
            B.chars.saruman ||
            B.chars.witchKing ||
            B.chars.mouth)
        )
          return auto(
            false,
            B.chars.gandalfWhite
              ? "Gandalf the White is in play"
              : "a minion is already in play",
          );
        return ask(S, n);
      case "MU.notWar": {
        if (!T) return ask(S, n);
        const nw = !Q.snAllAtWar(S);
        const nf = S.settings.wome && !Q.shadowFactionInPlay(S);
        let why = "all at war" + (S.settings.wome ? ", faction in play" : "");
        if (nw) why = "a Shadow nation is not at war";
        else if (nf) why = "no faction in play";
        return auto(nw || nf, why);
      }
      case "MU.facTop":
        return auto(
          w.nationChoice === "Faction",
          "priority chose " + (w.nationChoice || "nothing"),
        );
      // MU.musterCard shares the playable Muster card count with M5.playMuster above.
      case "MU.cardChoice":
        if (cards && w.chosen)
          return auto(
            !!Q.MUSTER_CHOICE[w.chosen],
            "card: " + byId[w.chosen].title,
          );
        return ask(S, n);
      case "MU.sixNaz":
        return bauto(B.nazgul < 6, B.nazgul + " Nazgûl on the map");
      // ---- Event
      case "EV.prefPlay":
        if (cards)
          return playableCount(
            S.cards.hand
              .concat(S.cards.factionHand)
              .filter((i) => Q.cardFlags(byId[i], S).preferred),
            "event",
            "playable *preferred* card",
          );
        return ask(S, n);
      case "EV.eventDie":
        if (w.die)
          return auto(w.die === "Event", "using a " + DIE_NAME[w.die] + " die");
        return ask(S, n);
      case "EV.less4":
      case "EV.less4b":
        if (cards)
          return auto(hc.total < 4, "Event cards in hand: " + hc.total);
        return ask(S, n);
      case "EV.less3f":
        if (cards) return auto(hc.F < 3, "Faction cards: " + hc.F);
        return ask(S, n);
      case "EV.anyPlay":
        if (cards)
          return playableCount(
            S.cards.hand.concat(S.cards.factionHand),
            "event",
            "playable card",
          );
        return ask(S, n);
      case "EV.aboveFull":
        if (cards)
          return auto(
            hc.total > 6 || hc.F > 4,
            "hand " +
              hc.total +
              "/6" +
              (S.settings.wome ? ", faction " + hc.F + "/4" : ""),
          );
        return ask(S, n);
      case "EV.revCard":
        if (cards)
          return playableCount(
            handC().filter((i) => byId[i].revealed),
            "event",
            "card",
          );
        return ask(S, n);
      case "EV.corrCard":
        if (cards)
          return playableCount(
            S.cards.hand.filter((i) => byId[i].corruption || byId[i].tile),
            "event",
            "card",
          );
        return ask(S, n);
      // ---- Faction
      case "FA.playable":
        if (cards)
          return playableCount(
            S.cards.factionHand,
            "event",
            "playable Faction Event card",
          );
        return ask(S, n);
      case "FA.blackSails":
        if (cards)
          return auto(
            S.cards.factionTable.includes("sa_Faction03") &&
              B.factions.corsairs,
            "table",
          );
        return ask(S, n);
      case "FA.playDie":
        if (w.die) return auto(w.die === "FPlay", "using " + DIE_NAME[w.die]);
        return ask(S, n);
      case "FA.aboveFull":
        if (cards) return auto(hc.F > 4, "faction hand " + hc.F + "/4");
        return ask(S, n);
      case "FA.eligible":
        if (w.factionChoice)
          return ask(
            S,
            n,
            "Are the " + w.factionChoice + " eligible to be brought into play?",
          );
        if (cards || T) return auto(false, "every faction is already in play");
        return ask(S, n);
      // ---- Battle
      case "BA.playChar":
        if (cards)
          return playableCount(
            Q.combatCandidates(S).filter((i) => byId[i].deck === "C"),
            "combat",
            "usable Character card",
          );
        return ask(S, n);
      case "BA.wkFirst":
        if (w.battleRound !== 1) return auto(false, "not the first round");
        if (T && !B.chars.witchKing)
          return auto(false, "Witch King not in play");
        return ask(
          S,
          n,
          "Army includes the Witch King (this is the first round)",
        );
      case "BA.more4":
        if (cards)
          return auto(hc.total > 4, "Event cards in hand: " + hc.total);
        return ask(S, n);
      case "BA.ctb":
        if (!S.settings.wome) return auto(false, "WoME not in play");
        if (cards) {
          const r = evalPlayable(S, Q.ctbCards(S), "combat");
          if (r === PENDING) return;
          w.ctb = r;
          return auto(
            r.length > 0,
            r.length +
              " usable Call to Battle card" +
              (r.length === 1 ? "" : "s"),
          );
        }
        return ask(S, n);
      case "BA.round1":
        return auto(w.battleRound === 1, "round " + w.battleRound);
      case "BA.fieldOrMil":
        if (S.strategy === "military") return auto(true, "military strategy");
        if (T && B.fs.mordor)
          return auto(true, "Fellowship on the Mordor track");
        return ask(
          S,
          n,
          "Field battle? (not military strategy; Fellowship not on the Mordor track)",
        );
      case "BA.aggrCont":
        if (T && B.fs.mordor)
          return auto(true, "Fellowship on the Mordor track");
        return ask(S, n);
      case "BA.anyCond":
        return ask(S, n, null, { items: x.items, any: true });
    }
    if (x.t2 && !x.any) {
      // two-part decision: the bold (ring) part first, then the plain part
      if (w.sub === 0) return ask(S, n, text(n), { sub: 1, bold: true });
      return ask(S, n, x.t2, { sub: 2 });
    }
    return ask(S, n, null, x.any ? { items: x.items, any: true } : null);
  }

  // ----- playability evaluation with lazy prompts -----
  // A card's precondition in this context: the combat test in a battle, the board test when the tracker is on, otherwise taken as met.
  function playablePre(S, c, id, ctx) {
    if (ctx === "combat") return Q.combatPre(c, S);
    return S.settings.tracker ? Q.precondition(id, S) : true;
  }
  function evalPlayable(S, ids, ctx) {
    const out = [];
    for (const id of ids) {
      const c = byId[id];
      const cacheKey = (ctx === "combat" ? "B:" : "") + id;
      if (S.playable[cacheKey] !== undefined) {
        if (S.playable[cacheKey]) out.push(id);
        continue;
      }
      let pre = playablePre(S, c, id, ctx);
      if (pre && typeof pre === "object") {
        setPrompt(S, { type: "situ", key: pre.situ, text: pre.q });
        return PENDING;
      }
      if (!pre) {
        S.playable[cacheKey] = false;
        continue;
      }
      setPrompt(S, { type: "confirm", card: id, ctx });
      return PENDING;
    }
    return out;
  }

  // ----- jumps -----
  function handleJump(S, n) {
    const w = S.walk,
      spec = jumpSpec(text(n)),
      label = norm(text(n));
    if (!spec) {
      trail(S, { kind: "skip", text: label, why: "unknown box" });
      exitJump(S);
      return;
    }
    if (extra(n).wome && !S.settings.wome) {
      trail(S, { kind: "skip", text: label, why: "WoME not in play" });
      exitJump(S);
      return;
    }
    if (spec.kind === "return") {
      trail(S, { kind: "ret", text: label });
      doReturn(S);
      return;
    }
    if (spec.kind === "endPhase4") {
      endWalk(S, "phase:Phase 5", "Phase 5 begins — you act first.");
      return;
    }
    if (spec.kind === "battleNext") {
      endWalk(
        S,
        "battleNext",
        "Another combat round: walk again from “Battle (next round)”.",
      );
      return;
    }
    if (spec.kind === "switch") {
      S.strategy = spec.strategy;
      Q.log(S, "Strategy changed to " + spec.strategy + " (rule 40).");
      trail(S, { kind: "jump", text: label });
      if (spec.endWalk) {
        endWalk(S, "phase:" + spec.endWalk, spec.text);
        return;
      }
      goto(S, spec.page, findStart(spec.page, spec.start));
      w.trail[0] = {
        kind: "start",
        text: spec.start,
        page: spec.page,
        node: w.node,
      };
      follow(S, null);
      return;
    }
    if (spec.kind === "reserve") {
      // A die already set aside and brought back by "Use Muster die set aside for minion" must be used now (Rulings), not set aside again.
      if (w.fromReserve) {
        trail(S, {
          kind: "skip",
          text: label,
          why: "this die was already set aside — it must be used now",
        });
        exitJump(S);
        return;
      }
      S.minionReserved = true;
      if (w.dieObj != null && S.settings.dice) {
        S.dice.pool[w.dieObj].st = Q.DIE_STATE.RESERVED;
      }
      delete w.dieAns.Muster;
      delete w.dieAns.CharOrMuster; // the die the player said Queller had is no longer available
      Q.log(S, "Muster die set aside for a minion (Rulings).");
      trail(S, { kind: "note", text: "Muster die set aside for a minion" });
      w.dieObj = null;
      w.die = null;
      doReturn(S);
      return;
    }
    if (spec.kind === "ringAny") {
      const can =
        w.mode !== "ringAny" &&
        Q.ringAvailable(S) &&
        (!S.settings.dice || Q.availDice(S).some((d) => d.k === "A"));
      if (can) {
        trail(S, { kind: "jump", text: label });
        const entry = w.entry;
        w.done = true;
        S.walk = null;
        startWalk(S, entry.page, entry.start, { mode: "ringAny" });
        return;
      }
      let why = "no die to change";
      if (S.ringUsedThisTurn) why = "a ring was already used this turn";
      else if (Q.ringsKnown(S) && !S.board.rings) why = "no Elven Ring";
      trail(S, { kind: "skip", text: label, why });
      exitJump(S);
      return;
    }
    jumpWithDie(S, spec, label);
  }
  // Grey box naming a page: enter it with the die it needs (or the die already held), or skip it.
  function jumpWithDie(S, spec, label) {
    const w = S.walk;
    if (Q.dieSatisfies(w.die, spec.die)) {
      enterPage(S, spec, label);
      return;
    }
    const ok = ensureDie(S, spec.die, label);
    if (ok === PENDING) return;
    if (ok) enterPage(S, spec, label);
    else exitJump(S);
  }
  // Make sure Queller has a die of type `req` for the step `label`. Returns true (use it), false (skipped, trail written), or PENDING (prompt open).
  function ensureDie(S, req, label) {
    const w = S.walk;
    if (w.pendingDie === label) {
      w.pendingDie = null;
      const ok = w.dieAns[req];
      w.ringArmed = false;
      if (!ok)
        trail(S, {
          kind: "skip",
          text: label,
          why: "no " + DIE_NAME[req] + " die",
        });
      return !!ok;
    }
    if (S.settings.dice) {
      let d = Q.findDie(S, req);
      if (!d && ringPossible(S)) {
        d = Q.ringChange(S, req);
        if (d)
          trail(S, {
            kind: "ring",
            text: "Elven Ring: die changed to " + d.face,
          });
      }
      w.ringArmed = false;
      if (!d) {
        trail(S, {
          kind: "skip",
          text: label,
          why: "no " + DIE_NAME[req] + " die available",
        });
        return false;
      }
      w.dieObj = S.dice.pool.indexOf(d);
      return true;
    }
    if (w.dieAns[req] === undefined) {
      setPrompt(S, {
        type: "diecheck",
        req,
        label,
        text:
          "Does Queller have " +
          aDie(req) +
          " die available" +
          (req === "Army" || req === "Muster"
            ? " (an Army/Muster die counts)"
            : "") +
          "?",
      });
      return PENDING;
    }
    if (w.dieAns[req]) {
      w.ringArmed = false;
      return true;
    }
    if (ringPossible(S) && !w.ringAsked) {
      w.ringAsked = true;
      setPrompt(S, {
        type: "ring",
        req,
        label,
        text:
          (Q.ringsKnown(S) ? "" : "If the Shadow holds an Elven Ring: ") +
          "Use an Elven Ring (rule 36): change one Queller die that does not show a *preferred* result into " +
          aDie(req) +
          " result. Choose the die at random.",
      });
      return PENDING;
    }
    w.ringArmed = false;
    trail(S, {
      kind: "skip",
      text: label,
      why: "no " + DIE_NAME[req] + " die",
    });
    return false;
  }
  function ringPossible(S) {
    const w = S.walk;
    return Q.ringAvailable(S) && (w.ringArmed || w.mode === "ringAny");
  }
  function enterPage(S, spec, label) {
    const w = S.walk;
    w.stack.push({
      page: w.page,
      node: w.node,
      die: w.die,
      dieObj: w.dieObj,
      dieUsed: w.dieUsed,
    });
    if (!Q.dieSatisfies(w.die, spec.die)) w.die = spec.die;
    trail(S, { kind: "jump", text: label, die: DIE_NAME[w.die] });
    w.ringAsked = false;
    w.cands = null;
    w.chosen = null;
    w.steps = null;
    goto(S, spec.page, findStart(spec.page, spec.start));
    follow(S, null);
  }
  function exitJump(S) {
    // follow the arrow out of the current grey box; if none, return further
    if (!follow(S, null)) doReturn(S);
  }
  function doReturn(S) {
    const w = S.walk;
    if (!w.stack.length) {
      // A die brought back from "set aside for a minion" that found no action is spent, not set aside again (Rulings: it cannot be used for anything else).
      if (
        w.fromReserve &&
        S.settings.dice &&
        w.reserveDieObj != null &&
        S.dice.pool[w.reserveDieObj].st === Q.DIE_STATE.AVAIL
      ) {
        Q.spendDie(
          S,
          S.dice.pool[w.reserveDieObj],
          "set aside for a minion, no action possible",
        );
        endWalk(
          S,
          "action",
          "Queller sets aside the Muster die it had kept for a minion — no action was possible with it.",
        );
        return;
      }
      endWalk(
        S,
        "noaction",
        w.page === "BA"
          ? "Nothing further from the Battle page this round."
          : "Queller has no action from this walk.",
      );
      return;
    }
    const fr = w.stack.pop();
    goto(S, fr.page, fr.node);
    w.die = fr.die;
    w.dieObj = fr.dieObj;
    w.dieUsed = fr.dieUsed;
    w.cands = null;
    w.chosen = null;
    trail(S, { kind: "back", text: norm(text(cur(S))) });
    exitJump(S);
  }

  // ----- actions -----
  // Draw steps and actions on the Event/Faction pages: the deck depends on the box; with cards off the player draws.
  // The deck a draw node draws from: Character or Faction Event where the node says so, otherwise the strategy's preferred deck.
  function drawDeck(S, key) {
    if (key === "EV.drawChar") return "C";
    if (key === "EV.drawFac" || key === "FA.drawT") return "F";
    return S.strategy === "corruption" ? "C" : "S";
  }
  function drawStep(S, n, key) {
    const w = S.walk,
      txt = norm(text(n)),
      isStep = kind(n) === "T";
    if (!S.settings.cards)
      return setPrompt(S, {
        type: isStep ? "step" : "action",
        text: txt,
        node: w.node,
      });
    const deck = drawDeck(S, key);
    const id = Q.drawCard(S, deck);
    trail(S, {
      kind: "note",
      text:
        "Drew a " + Q.deckName(deck) + " card" + (id ? "" : " — deck empty"),
    });
    if (isStep) {
      follow(S, null);
      return;
    }
    const hc = Q.handCounts(S);
    setPrompt(S, {
      type: "action",
      text:
        txt +
        " — done: Queller now holds " +
        hc.total +
        " Event card" +
        (S.settings.wome ? "s and " + hc.F + " Faction Event card" : "") +
        "s.",
      node: w.node,
      auto: true,
    });
  }
  function handleAction(S, n) {
    const w = S.walk,
      key = w.page + "." + w.node,
      txt = norm(text(n)),
      x = extra(n),
      cards = S.settings.cards,
      dice = S.settings.dice;
    if (x.die && !(w.die === x.die && w.dieObj != null)) {
      const ok = ensureDie(S, x.die, txt);
      if (ok === PENDING) return;
      if (!ok) {
        exitAction(S);
        return;
      }
      w.die = x.die;
    }
    switch (key) {
      case "C14.sogCorr":
      case "M14.sogCorr":
        S.strategy = "corruption";
        Q.log(S, "Queller uses the corruption strategy.");
        endWalk(S, "strategy", "Queller uses the corruption strategy.");
        return;
      case "C14.sogMil":
      case "M14.sogMil":
        S.strategy = "military";
        Q.log(S, "Queller uses the military strategy.");
        endWalk(S, "strategy", "Queller uses the military strategy.");
        return;
      case "C5.discardDie":
      case "M5.discardDie":
        if (dice) {
          const av = Q.availDice(S);
          if (!av.length) {
            trail(S, {
              kind: "skip",
              text: txt,
              why: "no die left to discard",
            });
            exitAction(S);
            return;
          }
          const d = Q.pick(av);
          d.st = Q.DIE_STATE.USED;
          Q.log(
            S,
            "Discarded an unplayable " + d.face + " die at random (rule 32).",
          );
          endWalk(
            S,
            "action",
            "Queller sets aside a " +
              d.face +
              " die it could not use (rule 32).",
          );
          return;
        }
        return setPrompt(S, {
          type: "action",
          text: "Discard unplayable die: set aside one Queller die that could not be used, chosen at random (rule 32).",
          node: w.node,
        });
      case "C5.minionDie":
      case "M5.minionDie": {
        const reserved = dice
          ? S.dice.pool.find((z) => z.st === Q.DIE_STATE.RESERVED)
          : null;
        if (dice ? !reserved : !S.minionReserved) {
          trail(S, { kind: "skip", text: txt, why: "no Muster die set aside" });
          endWalk(
            S,
            "noaction",
            "Queller has no action — it has no die it can use.",
          );
          return;
        }
        let obj = null;
        if (dice) {
          reserved.st = Q.DIE_STATE.AVAIL;
          obj = S.dice.pool.indexOf(reserved);
          S.minionReserved = S.dice.pool.some(
            (z) => z.st === Q.DIE_STATE.RESERVED,
          );
        } else S.minionReserved = false;
        w.fromReserve = true;
        w.reserveDieObj = obj;
        trail(S, {
          kind: "jump",
          text: "Muster 2 (die set aside for the minion)",
        });
        w.stack.push({
          page: w.page,
          node: w.node,
          die: null,
          dieObj: null,
          dieUsed: false,
        });
        w.die = "Muster";
        w.dieObj = obj;
        goto(S, "MU", findStart("MU", "Muster 2"));
        follow(S, null);
        return;
      }
      case "C5.pass":
      case "M5.pass":
        return setPrompt(S, {
          type: "action",
          text: "Pass",
          node: w.node,
          pass: true,
          help: "Only if the game rules permit a pass (Rulings). If Queller cannot pass, follow the arrow out.",
        });
      case "EV.drawPref":
      case "EV.drawChar":
      case "EV.drawFac":
        return drawStep(S, n, key);
      case "EV.discard":
      case "FA.discard": {
        if (cards && w.discards) {
          if (w.die) spendCurrentDie(S, "drew a card");
          endWalk(S, "action", "Discarded down to the hand limit.");
          return;
        }
        return setPrompt(S, {
          type: "action",
          text: "Discard the card chosen by the priority list.",
          node: w.node,
        });
      }
      case "EV.playA":
      case "EV.playB":
      case "EV.playC":
      case "EV.playD":
      case "FA.playA":
      case "MU.musterCardA":
      case "M5.playCharDie":
      case "M5.playEventDie": {
        if (cards && !w.chosen && w.cands?.length) {
          const r = Q.applyPriority(S, w.cands, [
            "Ascending order of initiative",
          ]);
          w.chosen = r.chosen;
          w.steps = r.steps;
        }
        if (cards && w.chosen) {
          return setPrompt(S, {
            type: "playcard",
            card: w.chosen,
            text: txt,
            node: w.node,
          });
        }
        return setPrompt(S, { type: "action", text: txt, node: w.node });
      }
      case "MU.musterE":
      case "MU.musterEnd": {
        if (cards && w.chosen) {
          return setPrompt(S, {
            type: "playcard",
            card: w.chosen,
            text: "Muster with the card",
            node: w.node,
          });
        }
        break;
      }
      case "MU.polTrack": {
        if (!w.nationChoice || w.nationChoice === "Faction") {
          trail(S, { kind: "skip", text: txt, why: "no nation to advance" });
          exitAction(S);
          return;
        }
        const k = SN_KEY[w.nationChoice];
        if (!S.settings.tracker)
          return setPrompt(S, {
            type: "action",
            text:
              "Move " + w.nationChoice + " down one on the Political Track.",
            node: w.node,
          });
        const now = S.board.nations[k] | 0,
          next = Math.max(0, now - 1);
        return setPrompt(S, {
          type: "action",
          text:
            "Move " +
            w.nationChoice +
            " down one on the Political Track (" +
            Q.snLabel(now) +
            " → " +
            Q.snLabel(next) +
            ").",
          node: w.node,
          nation: k,
        });
      }
      case "MU.musterMinion":
        if (!w.minionPick) {
          trail(S, {
            kind: "skip",
            text: txt,
            why: "no minion can be mustered",
          });
          exitAction(S);
          return;
        }
        return setPrompt(S, {
          type: "action",
          text: "Muster " + w.minionPick + ".",
          node: w.node,
          minion: {
            Saruman: "saruman",
            "Witch King": "witchKing",
            "Mouth of Sauron": "mouth",
          }[w.minionPick],
        });
      case "FA.bringIn":
        if (w.factionChoice)
          return setPrompt(S, {
            type: "action",
            text: "Bring the " + w.factionChoice + " into play.",
            node: w.node,
            faction: w.factionChoice.toLowerCase(),
          });
        if (cards || S.settings.tracker) {
          trail(S, { kind: "skip", text: txt, why: "no faction to bring in" });
          exitAction(S);
          return;
        }
        break;
    }
    if (/^End( action)?$/.test(txt)) {
      endWalk(
        S,
        w.die ? "action" : "end",
        "End of " + (w.die ? "action" : "walk") + ".",
      );
      if (w.die) spendCurrentDie(S, "end of action");
      return;
    }
    setPrompt(S, { type: "action", text: txt, node: w.node, help: x.help });
  }
  function spendCurrentDie(S, why) {
    const w = S.walk;
    if (!w?.die) return;
    if (S.settings.dice && w.dieObj != null) {
      Q.spendDie(S, S.dice.pool[w.dieObj], why);
    } else
      Q.log(
        S,
        "Queller used a " +
          DIE_NAME[w.die] +
          " die" +
          (why ? " — " + why : "") +
          ".",
      );
    w.die = null;
    w.dieObj = null;
  }
  function exitAction(S) {
    // rule 29
    if (follow(S, null)) return;
    doReturn(S);
  }

  // ----- steps (orange) -----
  function handleStep(S, n) {
    const w = S.walk,
      key = w.page + "." + w.node,
      txt = norm(text(n)),
      x = extra(n),
      dice = S.settings.dice,
      cards = S.settings.cards;
    const cont = (note) => {
      trail(S, { kind: "step", text: txt, auto: true, why: note });
      follow(S, null);
    };
    switch (key) {
      case "C14.rec":
      case "M14.rec":
        if (dice) {
          Q.recoverDice(S);
          return cont("pool: " + S.dice.pool.length + " dice");
        }
        return setPrompt(S, {
          type: "step",
          text:
            "Recover Queller’s action dice" +
            (S.settings.wome
              ? " (and the Faction die if a Shadow faction is in play)"
              : "") +
            ".",
          node: w.node,
        });
      case "C14.draw":
      case "M14.draw":
        if (cards) {
          Q.drawCard(S, "C");
          Q.drawCard(S, "S");
          if (S.settings.wome) Q.drawCard(S, "F");
          return cont(
            "hand: " +
              Q.handCounts(S).total +
              (S.settings.wome ? " + " + Q.handCounts(S).F + " faction" : ""),
          );
        }
        return setPrompt(S, {
          type: "step",
          text:
            "Draw one Character and one Strategy Event card for Queller" +
            (S.settings.wome ? ", and one Faction Event card" : "") +
            ".",
          node: w.node,
        });
      case "C14.disc14":
      case "C14.disc18":
      case "M14.disc":
        if (cards) {
          const d = Q.autoDiscard(S, x.items, "E");
          return cont(
            "discarded " + d.map((i) => "“" + byId[i].title + "”").join(", "),
          );
        }
        return setPrompt(S, {
          type: "step",
          text: txt,
          items: x.items,
          node: w.node,
        });
      case "C14.discF":
      case "M14.discF":
        if (cards) {
          const d = Q.autoDiscard(S, x.items, "F");
          return cont(
            "discarded " + d.map((i) => "“" + byId[i].title + "”").join(", "),
          );
        }
        return setPrompt(S, {
          type: "step",
          text: txt,
          items: x.items,
          node: w.node,
        });
      case "C14.rollHunt":
        if (dice) {
          const r = Q.rnd(6) + 1;
          const k = r <= 3 ? 0 : 1;
          Q.log(
            S,
            "Rolled " + r + " for the hunt allocation → " + k + " dice.",
          );
          Q.assignHunt(S, k);
          return cont("rolled " + r + " → " + k + " in the Hunt box");
        }
        return setPrompt(S, { type: "step", text: txt, node: w.node });
      case "C14.huntMax":
      case "M14.huntMax":
        if (dice) {
          const k = Q.assignHunt(S, Q.huntCap(S));
          return cont(
            k + " dice (Companions: " + (S.board.fs.companions | 0) + ")",
          );
        }
        return setPrompt(S, {
          type: "step",
          text: txt + " (up to the number of Companions, minimum 1).",
          node: w.node,
        });
      case "C14.hunt1a":
      case "C14.hunt1b":
      case "M14.hunt1":
        if (dice) {
          Q.assignHunt(S, 1);
          return cont();
        }
        break;
      case "C14.hunt2a":
      case "C14.hunt2b":
      case "M14.hunt2":
        if (dice) {
          const k = Q.assignHunt(S, 2);
          return cont(
            k < 2
              ? "capped at " +
                  k +
                  " (rule 34: " +
                  (S.board.fs.companions | 0) +
                  " Companions)"
              : undefined,
          );
        }
        break;
      case "M14.hunt0":
        if (dice) {
          Q.log(S, "No dice placed in the Hunt box before rolling.");
          return cont();
        }
        break;
      case "C14.rollRest":
      case "M14.rollRest":
        if (dice) {
          const r = Q.rollRemaining(S);
          return cont(r.join(", "));
        }
        return setPrompt(S, {
          type: "step",
          text: "Roll Queller’s remaining action dice. Put every Eye in the Hunt box.",
          node: w.node,
        });
      case "C14.sogRoll":
      case "M14.sogRoll":
        if (dice) {
          const r = Q.rnd(6) + 1;
          Q.log(S, "Strategy roll: " + r + ".");
          trail(S, {
            kind: "step",
            text: "Roll a die",
            auto: true,
            why: "rolled " + r,
          });
          follow(S, r <= 3 ? "1-3" : "4-6");
          return;
        }
        return setPrompt(S, {
          type: "roll",
          text: "Roll a die: 1-3 corruption strategy, 4-6 military strategy.",
          node: w.node,
          options: ["1-3", "4-6"],
        });
      case "BA.playCard":
        if (cards) {
          if (w.chosen) {
            return setPrompt(S, {
              type: "playcard",
              card: w.chosen,
              text: "Play combat card",
              node: w.node,
              combat: true,
            });
          }
          return cont("no card to play");
        }
        break;
      case "FA.drawT":
      case "EV.drawPrefT":
        return drawStep(S, n, key);
    }
    setPrompt(S, {
      type: "step",
      text: txt,
      items: x.items,
      node: w.node,
      move: txt.startsWith("Move"),
    });
  }

  // ----- priority lists -----
  function handlePriority(S, n) {
    const w = S.walk,
      key = w.page + "." + w.node,
      x = extra(n),
      cards = S.settings.cards,
      txt = text(n);
    const cont = (why) => {
      trail(S, { kind: "pri", text: txt, items: x.items, auto: true, why });
      follow(S, null);
    };
    if (cards) {
      const cardPri = [
        "EV.prefPri",
        "EV.anyPri",
        "FA.playPri",
        "BA.sortiePri",
        "BA.wkPri",
        "BA.atkPri",
        "BA.defPri",
      ];
      if (cardPri.includes(key)) {
        if (key === "BA.wkPri" || key === "BA.atkPri" || key === "BA.defPri") {
          // every card Queller could use as a combat card, plus Call to Battle cards
          const r = evalPlayable(S, Q.combatCandidates(S), "combat");
          if (r === PENDING) return;
          w.cands = r;
          if (S.settings.wome) {
            const b = evalPlayable(S, Q.ctbCards(S), "combat");
            if (b === PENDING) return;
            w.ctb = b;
          } else w.ctb = [];
        }
        let cands = (w.cands || []).slice();
        if (key === "BA.atkPri") cands = cands.concat(w.ctb || []);
        if (!cands.length) {
          w.chosen = null;
          return cont("no candidate card");
        }
        const r = Q.applyPriority(S, cands, x.items);
        w.chosen = r.chosen;
        w.steps = r.steps;
        trail(S, {
          kind: "pri",
          text: txt,
          items: x.items,
          steps: r.steps,
          card: r.chosen,
          auto: true,
        });
        follow(S, null);
        return;
      }
      if (key === "EV.discPri" || key === "FA.discPri") {
        const ds = [];
        if (key === "EV.discPri") {
          ds.push(...Q.autoDiscard(S, x.items, "E"));
          if (S.settings.wome)
            ds.push(...Q.autoDiscard(S, extra(F.FA.nodes.discPri).items, "F"));
        } else ds.push(...Q.autoDiscard(S, x.items, "F"));
        w.discards = ds;
        trail(S, {
          kind: "pri",
          text: txt,
          items: x.items,
          steps: ds.length
            ? ds.map((i) => "Discarded “" + byId[i].title + "”")
            : ["Nothing to discard"],
          auto: true,
        });
        follow(S, null);
        return;
      }
      if (key === "FA.recruitPri") {
        const B = S.board.factions;
        const counts = {};
        for (const id of S.cards.factionHand.concat(S.cards.factionTable)) {
          const c = byId[id];
          if (!c.faction) continue;
          const k = c.faction;
          counts[k] = counts[k] || { p: 0, n: 0 };
          counts[k].n++;
          if (Q.cardFlags(c, S).preferred) counts[k].p++;
        }
        const facs = ["Corsairs", "Dunlendings", "Spiders"].filter(
          (f) => !B[f.toLowerCase()],
        );
        let best = facs.slice(),
          steps = [];
        if (best.length > 1) {
          const m = Math.max(...best.map((f) => (counts[f] || { p: 0 }).p));
          best = best.filter((f) => (counts[f] || { p: 0 }).p === m);
          steps.push(
            "most *preferred* Faction Event cards → " + best.join(", "),
          );
        }
        if (best.length > 1) {
          const m = Math.max(...best.map((f) => (counts[f] || { n: 0 }).n));
          best = best.filter((f) => (counts[f] || { n: 0 }).n === m);
          steps.push("most Faction Event cards → " + best.join(", "));
        }
        if (best.length > 1) {
          best = [Q.pick(best)];
          steps.push("tie — chosen at random (rule 3)");
        }
        w.factionChoice = best[0] || null;
        if (!best.length) steps.push("all factions already in play");
        trail(S, {
          kind: "pri",
          text: txt,
          items: x.items,
          steps,
          choice: w.factionChoice || "none",
          auto: true,
        });
        follow(S, null);
        return;
      }
    }
    if (key === "FA.recruitPri" && S.settings.tracker) {
      // without cards the tracker still knows which factions are left; the player picks among them
      const facs = ["Corsairs", "Dunlendings", "Spiders"].filter(
        (f) => !S.board.factions[f.toLowerCase()],
      );
      if (facs.length <= 1) {
        w.factionChoice = facs[0] || null;
        trail(S, {
          kind: "pri",
          text: txt,
          items: x.items,
          steps: [
            facs.length
              ? "Only the " + facs[0] + " are not yet in play"
              : "all factions already in play",
          ],
          choice: w.factionChoice || "none",
          auto: true,
        });
        follow(S, null);
        return;
      }
      return setPrompt(S, {
        type: "choice",
        text: "Recruit priority: which faction has the most Faction Event cards in Queller’s hand and in play (preferred cards first)?",
        items: x.items,
        options: facs.map((f) => ({ v: f, l: f })),
        set: "factionChoice",
        node: w.node,
        page: w.page,
        pri: txt,
      });
    }
    if (key === "MU.nationPri") {
      const N = S.board.nations,
        allFac = Q.allShadowFactionsInPlay(S);
      if (!S.settings.tracker) {
        const fk = S.settings.cards && S.settings.wome;
        const o = [{ v: "Isengard", l: "Isengard (not yet At War)" }];
        if (S.settings.wome && !(fk && allFac))
          o.push({
            v: "Faction",
            l: "Faction (a Shadow faction can still be recruited)",
          });
        o.push(
          { v: "Sauron", l: "Sauron (not yet At War)" },
          {
            v: "Southrons and Easterlings",
            l: "Southrons and Easterlings (not yet At War)",
          },
          { v: "", l: "None of these" },
        );
        return setPrompt(S, {
          type: "choice",
          text: "Political Track priority: which is the first of these that applies?",
          items: x.items,
          options: o,
          set: "nationChoice",
          node: w.node,
          page: w.page,
          pri: txt,
        });
      }
      const opts = [];
      if (!Q.snAtWar(S, "isengard")) opts.push("Isengard");
      if (S.settings.wome && !allFac) opts.push("Faction");
      if (!Q.snAtWar(S, "sauron")) opts.push("Sauron");
      if (!Q.snAtWar(S, "se")) opts.push("Southrons and Easterlings");
      w.nationChoice = opts[0] || null;
      const pos = ["sauron", "isengard", "se"]
        .map((k) => SN_NAME[k] + ": " + Q.snLabel(N[k] | 0))
        .join(", ");
      trail(S, {
        kind: "pri",
        text: txt,
        items: x.items,
        steps: [
          "Political Track — " + pos,
          opts.length
            ? "Eligible: " + opts.join(", ")
            : "Every Shadow nation is at war",
        ],
        choice: w.nationChoice || "none",
        auto: true,
      });
      follow(S, null);
      return;
    }
    if (key === "MU.minionPri") {
      const c = S.board.chars;
      if (!S.settings.tracker) {
        const mk = S.settings.dice;
        const o = [];
        if (!(mk && c.saruman))
          o.push({ v: "Saruman", l: "Saruman (Isengard At War)" });
        if (!(mk && c.witchKing))
          o.push({
            v: "Witch King",
            l: "Witch King (Sauron At War and a Free Peoples nation At War)",
          });
        if (!(mk && c.mouth))
          o.push({
            v: "Mouth of Sauron",
            l: "Mouth of Sauron (all Shadow nations At War)",
          });
        o.push({ v: "", l: "None can be mustered" });
        return setPrompt(S, {
          type: "choice",
          text: "Minion priority: which is the first of these that can be mustered (not already in play)?",
          items: x.items,
          options: o,
          set: "minionPick",
          node: w.node,
          page: w.page,
          pri: txt,
        });
      }
      const m = Q.minionsAvailable(S);
      w.minionPick = m.length ? m[0].name : null;
      trail(S, {
        kind: "pri",
        text: txt,
        items: x.items,
        steps: m.length
          ? ["Eligible: " + m.map((z) => z.name).join(", ")]
          : ["No minion can be mustered"],
        choice: w.minionPick || "none",
        auto: true,
      });
      follow(S, null);
      return;
    }
    setPrompt(S, { type: "priority", text: txt, items: x.items, node: w.node });
  }

  // ----- answers from the UI -----
  function answer(S, v) {
    const w = S.walk;
    if (!w?.prompt) return;
    const p = w.prompt;
    w.prompt = null;
    const n = cur(S);
    switch (p.type) {
      case "yesno": {
        if (p.part) {
          w.parts[p.part] = !!v;
          trail(S, { kind: "q", text: p.text, answer: v ? "Yes" : "No" });
          break;
        }
        if (p.sub === 1) {
          // bold part of a two-part decision
          if (v) {
            decided(S, p.text, true, true, false);
          } else {
            trail(S, { kind: "q", text: p.text, answer: "No" });
            w.sub = 2;
          }
          break;
        }
        if (p.sub === 2) {
          decided(S, p.text, false, v, false);
          break;
        }
        decided(S, text(n), extra(n).bold, v, false);
        break;
      }
      case "count": {
        const c = Math.max(p.min, Math.min(p.max, Number.parseInt(v, 10) || 0));
        w.parts[p.part] = c;
        trail(S, { kind: "q", text: p.text, answer: String(c) });
        break;
      }
      case "choice": {
        w[p.set] = v || null;
        trail(S, {
          kind: "pri",
          text: p.pri,
          items: p.items,
          steps: ["You chose: " + (v || "none")],
          choice: v || "none",
        });
        follow(S, null);
        break;
      }
      case "situ":
        S.situ[p.key] = !!v;
        trail(S, {
          kind: "q",
          text: p.text,
          answer: v ? "Yes" : "No",
          situ: true,
        });
        break;
      case "confirm":
        S.playable[(p.ctx === "combat" ? "B:" : "") + p.card] = !!v;
        trail(S, {
          kind: "reveal",
          text: byId[p.card].title,
          answer: v ? "playable" : "not playable",
          card: p.card,
        });
        break;
      case "diecheck":
        w.dieAns[p.req] = !!v;
        w.pendingDie = p.label;
        trail(S, { kind: "q", text: p.text, answer: v ? "Yes" : "No" });
        break;
      case "ring":
        if (v) {
          S.board.rings = Math.max(0, S.board.rings - 1);
          S.ringUsedThisTurn = true;
          w.dieAns[p.req] = true;
          w.pendingDie = p.label;
          Q.log(
            S,
            "Elven Ring used to create " + aDie(p.req) + " die (rule 36).",
          );
          trail(S, {
            kind: "ring",
            text: "Elven Ring used for " + aDie(p.req) + " die",
          });
        } else {
          w.dieAns[p.req] = false;
          w.pendingDie = p.label;
        }
        break;
      case "action": {
        if (v === "done") {
          trail(S, { kind: "act", text: p.text, answer: "done" });
          if (p.pass) {
            endWalk(S, "pass", "Queller passes.");
            Q.log(S, "Queller passes.");
            break;
          }
          if (p.minion) {
            S.board.chars[p.minion] = true;
            S.playable = {};
            Q.log(S, w.minionPick + " is now in play (tracker updated).");
          }
          if (p.nation) {
            const now = S.board.nations[p.nation] | 0;
            S.board.nations[p.nation] = Math.max(0, now - 1);
            S.playable = {};
            Q.log(
              S,
              SN_NAME[p.nation] +
                " is now " +
                Q.snLabel(S.board.nations[p.nation]) +
                ".",
            );
          }
          if (p.faction) {
            S.board.factions[p.faction] = true;
            S.playable = {};
            Q.log(
              S,
              w.factionChoice +
                " are now in play (tracker updated; the Faction die joins the pool next turn).",
            );
          }
          if (w.die) spendCurrentDie(S, "“" + p.text + "”");
          else Q.log(S, "Queller: " + p.text);
          endWalk(S, "action", p.text);
          break;
        }
        trail(S, { kind: "act", text: p.text, answer: "not possible" });
        exitAction(S);
        break;
      }
      case "playcard": {
        const palantirBefore = S.cards.table.includes(Q.PALANTIR),
          die = w.die;
        const c = Q.playCard(S, p.card, { combat: p.combat });
        trail(S, {
          kind: "act",
          text: "Played “" + c.title + "”",
          answer: "done",
          card: p.card,
        });
        if (!p.combat && w.die) spendCurrentDie(S, "played “" + c.title + "”"); // spent first so a card effect on the dice never touches the die that played it
        for (const e of Q.resolveCardEffects(S, p.card, {
          combat: p.combat,
          die,
          palantirBefore,
        }))
          trail(S, e);
        if (p.combat) {
          follow(S, null);
          break;
        }
        endWalk(S, "action", "Queller plays “" + c.title + "”.");
        break;
      }
      case "step": {
        trail(S, {
          kind: "step",
          text: p.text,
          answer: v === "no" ? "not possible" : "done",
        });
        if (p.move && v !== "no") w.dieUsed = true;
        follow(S, null);
        break;
      }
      case "roll": {
        trail(S, { kind: "step", text: p.text, answer: v });
        follow(S, v);
        break;
      }
      case "priority": {
        trail(S, {
          kind: "pri",
          text: p.text,
          items: p.items,
          steps: p.steps,
          card: p.card,
          choice: p.choice,
        });
        follow(S, null);
        break;
      }
      case "battleForm": {
        S.battle = v;
        S.playable = Object.fromEntries(
          Object.entries(S.playable).filter(([k]) => !k.startsWith("B:")),
        );
        trail(S, { kind: "note", text: "Battle details recorded" });
        break;
      }
    }
    run(S);
  }

  // ----- phase driver helpers -----
  function phasePage(S) {
    return S.strategy === "military" ? "M14" : "C14";
  }
  function p5Page(S) {
    return S.strategy === "military" ? "M5" : "C5";
  }
  function startPhase(S, phase) {
    const P = phasePage(S);
    if (phase === "setup") {
      S.walk = null;
      startWalk(S, "C14", "Start of game");
      return;
    }
    if (phase === "p1") {
      S.phase = "p1";
      startWalk(S, P, "Phase 1");
      return;
    }
    if (phase === "p2") {
      S.phase = "p2";
      if (S.strategy === "corruption") startWalk(S, "C14", "Phase 2");
      return;
    }
    if (phase === "p3") {
      S.phase = "p3";
      startWalk(S, P, "Phase 3");
      return;
    }
    if (phase === "p4") {
      S.phase = "p4";
      startWalk(S, P, "Phase 4");
      return;
    }
    if (phase === "p5") {
      S.phase = "p5";
      startWalk(S, p5Page(S), "Phase 5");
    }
  }
  function startBattle(S, round) {
    S.walk = null;
    startWalk(S, "BA", round === 1 ? "Battle" : "Battle (next round)", {
      battleRound: round,
      noRun: true,
    });
    if (S.settings.cards) {
      S.walk.prompt = {
        type: "battleForm",
        round,
        text: "Battle details (used to judge which combat cards Queller can play)",
      };
    } else run(S);
  }
  function nextTurn(S) {
    S.turn++;
    S.phase = "p1";
    S.walk = null;
    S.situ = {};
    S.playable = {};
    S.battle = null;
    S.battleOpen = false;
    S.ringUsedThisTurn = false;
    Q.log(S, "— Turn " + S.turn + " —");
  }

  Object.assign(window.QB, {
    startWalk,
    answer,
    run,
    startPhase,
    startBattle,
    nextTurn,
    jumpSpec,
    norm,
    DIE_NAME,
    findStart,
    p5Page,
    phasePage,
  });
})();
