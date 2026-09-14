// Scripted scenarios for the behaviour fixed in version 52. Exit 1 on any failure.
const W = require("./load.js")();
const Q = W.QB,
  D = Q.DIE_STATE;
let fails = 0;
const ok = (c, m) => {
  if (!c) {
    fails++;
    console.log("FAIL", m);
  } else console.log("ok  ", m);
};
const die = (face, st) => ({ k: "A", face, st: st || D.AVAIL });
// The answer a scenario gives when none of its rules match: No to every question, an empty battle form, "done" otherwise.
function defaultAnswer(p) {
  if (["yesno", "situ", "confirm", "diecheck", "ring"].includes(p.type))
    return false;
  return p.type === "battleForm" ? { nazLead: 0, figures: {} } : "done";
}
// The scenario's answer to a prompt: the first rule whose pattern matches the prompt's text, type or card (a value, or a function of the prompt).
function ruleAnswer(p, rules) {
  for (const [re, v] of rules) {
    if (re.test((p.text || "") + " " + p.type + " " + (p.card || "")))
      return typeof v === "function" ? v(p) : v;
  }
  return undefined;
}
function drive(S, rules, max) {
  let g = 0;
  const seen = [];
  while (S.walk && !S.walk.done && g++ < (max || 80)) {
    const p = S.walk.prompt;
    seen.push(p);
    let a = ruleAnswer(p, rules);
    if (a === undefined) a = defaultAnswer(p);
    Q.answer(S, a);
  }
  return seen;
}
function base(st, strategy) {
  const S = Q.newState(st);
  S.strategy = strategy || "corruption";
  S.phase = "p5";
  S.cards.hand = [];
  S.cards.factionHand = [];
  return S;
}

// 7.1 the set-aside Muster die is used or spent, never re-reserved
{
  const S = base(
    { dice: true, cards: false, tracker: true, wome: false },
    "military",
  );
  S.board.nations.isengard = 0;
  S.dice.pool = [die("Muster", D.RESERVED), die("Eye", D.HUNT)];
  S.minionReserved = true;
  Q.startPhase(S, "p5");
  drive(S, [
    [/Will of the West/, true],
    [/^Pass/, "no"],
    [/action/, "no"],
  ]);
  ok(
    !S.dice.pool.some((d) => d.st === D.RESERVED || d.st === D.AVAIL) &&
      S.walk.done,
    "7.1 set-aside die spent when Muster 2 finds no action (" +
      S.walk.result +
      ")",
  );
  const S2 = base(
    { dice: true, cards: false, tracker: true, wome: false },
    "military",
  );
  S2.board.nations.isengard = 0;
  S2.dice.pool = [die("Muster", D.RESERVED)];
  S2.minionReserved = true;
  Q.startPhase(S2, "p5");
  drive(S2, [
    [/Will of the West/, true],
    [/^Pass/, "no"],
  ]);
  ok(
    S2.walk.result === "action" &&
      S2.dice.pool[0].st === D.USED &&
      S2.walk.trail.some(
        (t) =>
          t.kind === "q" &&
          /Will of the West/.test(t.text) &&
          t.auto &&
          t.answer === "No",
      ),
    "7.1 Will-of-the-West check auto-answered No for a die already set aside; minion mustered",
  );
  ok(
    S2.board.chars.saruman === true,
    "6.3 muster action updated the tracker (Saruman)",
  );
}
// two dice set aside in one walk are both used eventually
{
  const S = base(
    { dice: true, cards: false, tracker: true, wome: false },
    "military",
  );
  S.board.nations.isengard = 0;
  S.dice.pool = [die("Muster", D.RESERVED), die("Army/Muster", D.RESERVED)];
  S.minionReserved = true;
  for (let i = 0; i < 3; i++) {
    Q.startPhase(S, "p5");
    drive(S, [
      [/Will of the West/, true],
      [/^Pass/, "no"],
    ]);
  }
  ok(
    !S.dice.pool.some((d) => d.st === D.RESERVED || d.st === D.AVAIL),
    "7.1 two set-aside dice both consumed within three walks",
  );
}
// 7.2 dice off: the cached "has a Muster die" answer is dropped when the die is set aside
{
  const S = base(
    { dice: false, cards: false, tracker: true, wome: false },
    "military",
  );
  S.board.nations.isengard = 0;
  Q.startPhase(S, "p5");
  const seen = drive(S, [
    [/Does Queller have a Muster die/, true],
    [/Will of the West/, true],
    [/^Pass/, "no"],
    [/threat\b.*muster/, false],
  ]);
  const asks = seen.filter(
    (p) => p?.type === "diecheck" && /Muster/.test(p.text),
  ).length;
  ok(
    asks >= 2,
    "7.2 Muster die asked again after the reserve (" + asks + " asks)",
  );
}
// Ring: dice on, tracker off — no ring without one in the minimal tracker; one ring used once
{
  const mk = () => {
    const S = base({ dice: true, cards: false, tracker: false, wome: false });
    S.dice.pool = [die("Event"), die("Muster")];
    return S;
  };
  const S = mk();
  S.board.rings = 0;
  Q.startPhase(S, "p5");
  drive(S, [
    [/under \*threat\*/, true],
    [/adjacent to \*threat\*/, true],
  ]);
  ok(
    !S.ringUsedThisTurn && !S.log.some((l) => /Elven Ring/.test(l.t)),
    "ring: no ring used when the Shadow holds none",
  );
  const S2 = mk();
  S2.board.rings = 1;
  Q.startPhase(S2, "p5");
  drive(S2, [
    [/under \*threat\*/, true],
    [/adjacent to \*threat\*/, true],
  ]);
  ok(
    S2.ringUsedThisTurn &&
      S2.board.rings === 0 &&
      S2.dice.pool.some((d) => d.face === "Character"),
    "ring: one ring used, count decremented",
  );
}
// 6.1 Military Phase 5 plays the revealed card, Palantír draws
{
  const S = base(
    { dice: true, cards: true, tracker: true, wome: false },
    "military",
  );
  S.cards.hand = ["sa017", "sa002"];
  S.cards.decks.S = ["sa019"];
  S.board.fs.revealed = true;
  S.cards.table.push("sa045");
  S.board.chars.saruman = true;
  S.dice.pool = [die("Event"), die("Army")]; // no Character die → "Play card using event die"
  Q.startPhase(S, "p5");
  const seen = drive(S, [[/confirm/, true]]);
  const pc = seen.find((p) => p?.type === "playcard");
  ok(pc?.card === "sa017", "6.1 playcard prompt raised for Lure of the Ring");
  ok(
    !S.cards.hand.includes("sa017") && S.cards.discards.C.includes("sa017"),
    "6.1 card left the hand",
  );
  ok(
    S.cards.hand.includes("sa019"),
    "6.1 Palantír drew a Strategy card after the Event die play",
  );
  ok(
    S.dice.pool.find((d) => d.face === "Event").st === D.USED,
    "6.1 Event die spent",
  );
}
// 6.2 Balrog on the table is offered as Durin's Bane
{
  const S = base(
    { dice: true, cards: true, tracker: true, wome: false },
    "military",
  );
  S.cards.table = ["sa001b2"];
  S.cards.hand = ["sa002"];
  Q.startBattle(S, 1);
  const seen = drive(S, [
    [/battleForm/, { nazLead: 0, figures: {}, nearMoria: true }],
    [/confirm/, true],
    [/Shadow army attacking/, true],
    [/sortie/, false],
    [/Witch King/, false],
    [/laying siege/, true],
  ]);
  const pc = seen.find((p) => p?.type === "playcard");
  ok(
    pc?.card === "sa001b2" && pc.combat,
    "6.2 Durin's Bane chosen from the table",
  );
  ok(
    !S.cards.table.includes("sa001b2") &&
      S.cards.discards.C.includes("sa001b2"),
    "6.2 Balrog discarded from the table after combat use",
  );
}
// 6.3 Bring faction into play / Mustered Witch King update the tracker
{
  const S = base({ dice: true, cards: true, tracker: true, wome: true });
  S.cards.factionHand = ["sa_Faction01"];
  S.walk = null;
  Q.startWalk(S, "FA", "Recruit Faction", { die: "FRecruit" });
  drive(S, [[/eligible/, true]]);
  ok(
    S.board.factions.corsairs === true,
    '6.3 Corsairs ticked after "Bring faction into play"',
  );
  const S2 = base({ dice: true, cards: false, tracker: true, wome: false });
  S2.walk = null;
  Q.startWalk(S2, "CH", "Character 3 / Muster Witch King", { die: "Muster" });
  drive(S2, [[/Mustered Witch King/, true]]);
  ok(
    S2.board.chars.witchKing === true,
    '6.3 Witch King ticked after "Mustered Witch King"',
  );
  const S3 = base({ dice: true, cards: true, tracker: true, wome: true });
  S3.cards.factionHand = ["sa_Faction06"];
  S3.walk = null;
  Q.startWalk(S3, "FA", "Play Faction Event", { die: "FPlay" });
  drive(S3, [[/confirm/, true]]);
  ok(
    S3.board.factions.dunlendings === true,
    "6.3 Wild Hillmen brought the Dunlendings into play",
  );
}
// 6.4 The Lidless Eye moves dice to the Hunt box, never the die that played it
{
  const S = base(
    { dice: true, cards: true, tracker: true, wome: false },
    "corruption",
  );
  S.cards.hand = ["sa043"];
  S.dice.pool = [
    die("Character"),
    die("Army"),
    die("Muster"),
    die("Event"),
    die("Character"),
  ];
  S.walk = null;
  Q.startWalk(S, "EV", "Event", { die: "Event", dieObj: 3 });
  drive(S, [[/confirm/, true]]);
  const hunt = S.dice.pool.filter((d) => d.st === D.HUNT);
  const ev = S.dice.pool[3];
  ok(
    hunt.length === 2 &&
      S.dice.hunt === 2 &&
      hunt.every((d) => d.face === "Eye"),
    "6.4 the two non-preferred dice changed to Eye and placed in the Hunt box",
  );
  ok(
    ev.st === D.USED,
    "6.4 the Event die that played the card was spent, not changed",
  );
  ok(
    S.dice.pool.filter((d) => d.face === "Character" && d.st === D.AVAIL)
      .length === 2,
    "6.4 preferred (Character) dice left alone while non-preferred ones existed",
  );
  const S2 = base({ dice: true, cards: true, tracker: true, wome: false });
  S2.cards.hand = ["sa043"];
  S2.dice.pool = [die("Event")];
  S2.walk = { dieObj: 0 };
  ok(
    Q.precondition("sa043", S2) === false,
    "6.4 Lidless Eye unplayable when the only unused die is the one that would play it",
  );
  S2.dice.pool.push(die("Army"));
  ok(
    Q.precondition("sa043", S2) === true,
    "6.4 …and playable once another unused die exists",
  );
}
// 6.5 rule 34 caps the fixed allocations
{
  const S = base({ dice: true, cards: false, tracker: true, wome: false });
  S.board.fs.companions = 1;
  S.dice.pool = [die(null, D.POOL), die(null, D.POOL), die(null, D.POOL)];
  ok(
    Q.assignHunt(S, 2) === 1 && S.dice.hunt === 1,
    '6.5 "Assign 2 dice" capped at 1 for one Companion',
  );
  S.board.fs.companions = 0;
  ok(Q.huntCap(S) === 1, "6.5 cap is at least 1 with no Companions");
}
// 6.6 table triggers
{
  const S = base({ dice: true, cards: true, tracker: true, wome: false });
  S.cards.table = ["sa051", "sa045", "sa050", "sa009"];
  S.board.chars.saruman = true;
  let asks = Q.tableTriggers(S, {
    key: "nations.rohan",
    from: "passive",
    to: "active",
  });
  ok(
    !S.cards.table.includes("sa051") && asks.length === 0,
    "6.6 Wormtongue discarded when Rohan activates",
  );
  ok(
    !S.cards.table.includes("sa050"),
    "6.6 Threats and Promises discarded on a passive→active advance",
  );
  S.cards.table.push("sa050");
  asks = Q.tableTriggers(S, {
    key: "nations.gondor",
    from: "active",
    to: "war",
  });
  ok(
    S.cards.table.includes("sa050") &&
      asks.length === 1 &&
      asks[0].card === "sa050",
    "6.6 Threats and Promises asked about on active→war",
  );
  Q.tableTriggers(S, { key: "chars.saruman", from: true, to: false });
  ok(
    !S.cards.table.includes("sa045"),
    "6.6 Palantír discarded when Saruman is eliminated",
  );
  S.board.fs.revealed = true;
  S.board.fs.inFPSettlement = true;
  asks = Q.tableTriggers(S, { key: "fs.revealed", from: false, to: true });
  ok(
    asks.length === 1 && asks[0].card === "sa009",
    "6.6 Flocks of Crebain asked about when revealed in a Free Peoples settlement",
  );
}
// 6.7 rule 19: Call to Battle cards ignore initiative
{
  const S = base({ dice: true, cards: true, tracker: true, wome: true });
  S.board.factions.corsairs = true;
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const r = Q.applyPriority(
      S,
      ["sa_battle01", "sa_battle02"],
      W.QB_FLOW.BA.nodes.atkPri[6].items,
    );
    seen.add(r.chosen);
  }
  ok(
    seen.size === 2,
    "6.7 two Corsairs Call to Battle cards chosen at random, not by initiative",
  );
  const r = Q.applyPriority(
    S,
    ["sa017", "sa002"],
    ["Ascending order of initiative on Character cards"],
  );
  ok(
    ["sa017", "sa002"].includes(r.chosen) &&
      r.steps.length === 1 &&
      /Tie between 2 cards/.test(r.steps[0]),
    '6.7 "on Character cards" ranks Character cards only; the Strategy card is kept alongside so the pick is a rule-3 tie',
  );
}
// 7.4 battleOpen reset each turn; 7.3 guard ends the walk
{
  const S = base({ dice: false, cards: false, tracker: false, wome: false });
  S.battleOpen = true;
  Q.nextTurn(S);
  ok(S.battleOpen === false, "7.4 battleOpen cleared by nextTurn");
  const S2 = base({ dice: true, cards: false, tracker: true, wome: false });
  const E = W.QB_FLOW.C14.edges;
  const saved = E.slice();
  E.unshift(["p4", "title"], ["title", "title"]); // an artificial cycle through a note box
  Q.startPhase(S2, "p4");
  E.length = 0;
  E.push(...saved);
  ok(
    S2.walk?.done &&
      S2.walk.result === "noaction" &&
      /did not finish/.test(S2.walk.trail[S2.walk.trail.length - 1].text),
    "7.3 run() ends a walk that never reaches a prompt instead of leaving it in limbo",
  );
}
console.log(fails ? fails + " failure(s)" : "all scenarios passed");
process.exit(fails ? 1 : 0);
