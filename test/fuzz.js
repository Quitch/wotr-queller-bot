require("./load.js")();
const crypto = require("node:crypto");
const Q = window.QB;
let seed = +process.argv[2] || 1;
// --digest: print a sha1 over every final game state, so a refactor that
// should not change behaviour can be checked against a recorded hash
const wantDigest = process.argv.includes("--digest");
const digest = crypto.createHash("sha1");
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
Math.random = rnd;
const problems = {};
const prob = (k, d) => {
  problems[k] = problems[k] || { n: 0, ex: d };
  problems[k].n++;
};
function cardTotals(S) {
  const c = S.cards;
  const all = [].concat(
    c.decks.C,
    c.decks.S,
    c.decks.F,
    c.discards.C,
    c.discards.S,
    c.discards.F,
    c.hand,
    c.factionHand,
    c.table,
    c.factionTable,
  );
  return all.length + ":" + new Set(all).size;
}
function randomAnswer(S) {
  const p = S.walk.prompt;
  switch (p.type) {
    case "yesno":
    case "situ":
    case "confirm":
    case "diecheck":
    case "ring":
      return rnd() < 0.5;
    case "count":
      return Math.floor(p.min + rnd() * (p.max - p.min + 1));
    case "choice":
      return p.options[Math.floor(rnd() * p.options.length)].value;
    case "action":
      return rnd() < 0.8 ? "done" : "no";
    case "playcard":
      return "done";
    case "step":
      return rnd() < 0.85 ? "done" : "no";
    case "roll":
      return p.options[Math.floor(rnd() * p.options.length)];
    case "priority":
      return "ok";
    case "battleForm":
      return {
        nazLead: Math.floor(rnd() * 3),
        shadowElite: rnd() < 0.5,
        seElite: rnd() < 0.5,
        isengardStronghold: rnd() < 0.5,
        defInFs: rnd() < 0.5,
        nearMoria: rnd() < 0.5,
        figures: {
          corsairs: rnd() < 0.5,
          dunlendings: rnd() < 0.5,
          spiders: rnd() < 0.5,
        },
        underSiege: rnd() < 0.5,
        attackingSiege: rnd() < 0.5,
      };
  }
  throw new Error("unknown prompt " + p.type);
}
function finish(S, tag) {
  // answer until the walk is done
  let n = 0;
  const total = cardTotals(S);
  while (S.walk && !S.walk.done) {
    if (!S.walk.prompt) {
      prob(
        "LIMBO walk not done and no prompt",
        tag +
          " node " +
          S.walk.page +
          "." +
          S.walk.node +
          " trail:" +
          S.walk.trail
            .slice(-4)
            .map((t) => t.kind + ":" + (t.text || "").slice(0, 30))
            .join(" | "),
      );
      return false;
    }
    const a = randomAnswer(S);
    try {
      Q.answer(S, a);
    } catch (e) {
      prob("EXCEPTION " + e.message, tag + " " + e.stack.split("\n")[1]);
      return false;
    }
    if (
      cardTotals(S) !== total &&
      !/Servants|His Will/.test(JSON.stringify(S.log.slice(-3)))
    ) {
      prob(
        "CARD TOTAL CHANGED " + total + "->" + cardTotals(S),
        tag +
          " " +
          S.log
            .slice(-2)
            .map((l) => l.t)
            .join(" / "),
      );
    }
    if (++n > 400) {
      prob(
        "RUNAWAY prompts in one walk",
        tag + " " + S.walk.page + "." + S.walk.node,
      );
      return false;
    }
  }
  return true;
}
function randomBoard(S) {
  const B = S.board;
  B.fs.progress = Math.floor(rnd() * 8);
  B.fs.revealed = rnd() < 0.3;
  B.fs.mordor = rnd() < 0.2;
  B.fs.inFPSettlement = rnd() < 0.4;
  B.fs.atStart = rnd() < 0.2;
  B.fs.companions = Math.floor(rnd() * 8);
  for (const k in B.chars) B.chars[k] = rnd() < 0.4;
  for (const k of ["sauron", "isengard", "se"])
    B.nations[k] = Math.floor(rnd() * 4);
  for (const k of ["gondor", "rohan", "north", "dwarves", "elves"])
    B.nations[k] = ["passive", "active", "war"][Math.floor(rnd() * 3)];
  for (const k in B.factions) B.factions[k] = rnd() < 0.4;
  B.nazgul = Math.floor(rnd() * 9);
  B.shadowVP = Math.floor(rnd() * 10);
  B.corruption = Math.floor(rnd() * 12);
  B.rings = Math.floor(rnd() * 4);
}
function game(settings, g) {
  const S = Q.newState(settings);
  const tag0 = JSON.stringify(settings) + " g" + g;
  Q.startPhase(S, "setup");
  if (!finish(S, tag0 + " setup")) return S;
  for (let turn = 0; turn < 4; turn++) {
    const tag = tag0 + " T" + S.turn;
    if (rnd() < 0.7) randomBoard(S);
    for (const ph of ["p1", "p2", "p3", "p4"]) {
      Q.startPhase(S, ph);
      if (S.walk && !finish(S, tag + " " + ph)) return S;
    }
    // Phase 5: walk until dice are gone (dice on) or 12 walks (dice off)
    let walks = 0;
    while (true) {
      const dice = S.settings.dice;
      const left = dice
        ? S.dice.pool.filter((d) => d.st === "avail" || d.st === "reserved")
            .length
        : null;
      if (dice && left === 0) break;
      if (!dice && walks >= 12) break;
      if (walks > 60) {
        prob(
          "PHASE 5 NEVER ENDS",
          tag +
            " left=" +
            left +
            " pool=" +
            JSON.stringify(S.dice.pool.map((d) => d.face + "/" + d.st)) +
            " last=" +
            S.walk.result,
        );
        break;
      }
      Q.startPhase(S, "p5");
      if (!finish(S, tag + " p5#" + walks)) return S;
      walks++;
      if (rnd() < 0.25) {
        Q.startBattle(S, 1);
        if (!finish(S, tag + " battle1")) return S;
        if (S.walk.result === "battleNext") {
          Q.startBattle(S, 2);
          if (!finish(S, tag + " battle2")) return S;
        }
      }
      if (rnd() < 0.3) randomBoard(S);
    }
    Q.nextTurn(S);
  }
  return S;
}
let g = 0;
for (let i = 0; i < 16; i++) {
  const st = {
    dice: !!(i & 1),
    cards: !!(i & 2),
    tracker: !!(i & 4),
    wome: !!(i & 8),
  };
  for (let k = 0; k < 25; k++) digest.update(JSON.stringify(game(st, g++)));
}
console.log("games:", g);
if (wantDigest) console.log("digest:", digest.digest("hex"));
for (const k in problems)
  console.log(problems[k].n + "x", k, "\n   e.g.", problems[k].ex);
process.exit(Object.keys(problems).length ? 1 : 0);
