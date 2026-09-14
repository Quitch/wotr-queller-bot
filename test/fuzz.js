require("./load.js")();
const crypto = require("node:crypto");
const engine = window.QB;
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
// Count a problem by kind, keeping the first example seen.
const recordProblem = (kind, example) => {
  problems[kind] = problems[kind] || { count: 0, example };
  problems[kind].count++;
};
function cardTotals(state) {
  const cards = state.cards;
  const all = [].concat(
    cards.decks.C,
    cards.decks.S,
    cards.decks.F,
    cards.discards.C,
    cards.discards.S,
    cards.discards.F,
    cards.hand,
    cards.factionHand,
    cards.table,
    cards.factionTable,
  );
  return all.length + ":" + new Set(all).size;
}
function randomAnswer(state) {
  const prompt = state.walk.prompt;
  switch (prompt.type) {
    case "yesno":
    case "situ":
    case "confirm":
    case "diecheck":
    case "ring":
      return rnd() < 0.5;
    case "count":
      return Math.floor(prompt.min + rnd() * (prompt.max - prompt.min + 1));
    case "choice":
      return prompt.options[Math.floor(rnd() * prompt.options.length)].value;
    case "action":
      return rnd() < 0.8 ? "done" : "no";
    case "playcard":
      return "done";
    case "step":
      return rnd() < 0.85 ? "done" : "no";
    case "roll":
      return prompt.options[Math.floor(rnd() * prompt.options.length)];
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
  throw new Error("unknown prompt " + prompt.type);
}
function finish(state, tag) {
  // answer until the walk is done
  let prompts = 0;
  const total = cardTotals(state);
  while (state.walk && !state.walk.done) {
    if (!state.walk.prompt) {
      recordProblem(
        "LIMBO walk not done and no prompt",
        tag +
          " node " +
          state.walk.page +
          "." +
          state.walk.node +
          " trail:" +
          state.walk.trail
            .slice(-4)
            .map((entry) => entry.kind + ":" + (entry.text || "").slice(0, 30))
            .join(" | "),
      );
      return false;
    }
    const answer = randomAnswer(state);
    try {
      engine.answer(state, answer);
    } catch (error) {
      recordProblem(
        "EXCEPTION " + error.message,
        tag + " " + error.stack.split("\n")[1],
      );
      return false;
    }
    if (
      cardTotals(state) !== total &&
      !/Servants|His Will/.test(JSON.stringify(state.log.slice(-3)))
    ) {
      recordProblem(
        "CARD TOTAL CHANGED " + total + "->" + cardTotals(state),
        tag +
          " " +
          state.log
            .slice(-2)
            .map((entry) => entry.t)
            .join(" / "),
      );
    }
    if (++prompts > 400) {
      recordProblem(
        "RUNAWAY prompts in one walk",
        tag + " " + state.walk.page + "." + state.walk.node,
      );
      return false;
    }
  }
  return true;
}
function randomBoard(state) {
  const board = state.board;
  board.fs.progress = Math.floor(rnd() * 8);
  board.fs.revealed = rnd() < 0.3;
  board.fs.mordor = rnd() < 0.2;
  board.fs.inFPSettlement = rnd() < 0.4;
  board.fs.atStart = rnd() < 0.2;
  board.fs.companions = Math.floor(rnd() * 8);
  for (const key in board.chars) board.chars[key] = rnd() < 0.4;
  for (const key of engine.SHADOW_NATIONS)
    board.nations[key] = Math.floor(rnd() * 4);
  for (const key of engine.FP_NATIONS)
    board.nations[key] = Object.values(engine.FP_STANCE)[Math.floor(rnd() * 3)];
  for (const key in board.factions) board.factions[key] = rnd() < 0.4;
  board.nazgul = Math.floor(rnd() * 9);
  board.shadowVP = Math.floor(rnd() * 10);
  board.corruption = Math.floor(rnd() * 12);
  board.rings = Math.floor(rnd() * 4);
}
function game(settings, gameNumber) {
  const state = engine.newState(settings);
  const gameTag = JSON.stringify(settings) + " g" + gameNumber;
  engine.startPhase(state, engine.PHASE.SETUP);
  if (!finish(state, gameTag + " setup")) return state;
  for (let turn = 0; turn < 4; turn++) {
    const tag = gameTag + " T" + state.turn;
    if (rnd() < 0.7) randomBoard(state);
    for (const phase of [
      engine.PHASE.P1,
      engine.PHASE.P2,
      engine.PHASE.P3,
      engine.PHASE.P4,
    ]) {
      engine.startPhase(state, phase);
      if (state.walk && !finish(state, tag + " " + phase)) return state;
    }
    // Phase 5: walk until dice are gone (dice on) or 12 walks (dice off)
    let walks = 0;
    while (true) {
      const dice = state.settings.dice;
      const left = dice
        ? state.dice.pool.filter(
            (die) => die.st === "avail" || die.st === "reserved",
          ).length
        : null;
      if (dice && left === 0) break;
      if (!dice && walks >= 12) break;
      if (walks > 60) {
        recordProblem(
          "PHASE 5 NEVER ENDS",
          tag +
            " left=" +
            left +
            " pool=" +
            JSON.stringify(
              state.dice.pool.map((die) => die.face + "/" + die.st),
            ) +
            " last=" +
            state.walk.result,
        );
        break;
      }
      engine.startPhase(state, engine.PHASE.P5);
      if (!finish(state, tag + " p5#" + walks)) return state;
      walks++;
      if (rnd() < 0.25) {
        engine.startBattle(state, 1);
        if (!finish(state, tag + " battle1")) return state;
        if (state.walk.result === "battleNext") {
          engine.startBattle(state, 2);
          if (!finish(state, tag + " battle2")) return state;
        }
      }
      if (rnd() < 0.3) randomBoard(state);
    }
    engine.nextTurn(state);
  }
  return state;
}
// The 16 setting combinations, one per bit pattern.
function settingsFromBits(bits) {
  return {
    dice: !!(bits & 1),
    cards: !!(bits & 2),
    tracker: !!(bits & 4),
    wome: !!(bits & 8),
  };
}
let gameNumber = 0;
for (let bits = 0; bits < 16; bits++) {
  const settings = settingsFromBits(bits);
  for (let i = 0; i < 25; i++)
    digest.update(JSON.stringify(game(settings, gameNumber++)));
}
console.log("games:", gameNumber);
if (wantDigest) console.log("digest:", digest.digest("hex"));
for (const kind in problems)
  console.log(
    problems[kind].count + "x",
    kind,
    "\n   e.g.",
    problems[kind].example,
  );
process.exit(Object.keys(problems).length ? 1 : 0);
