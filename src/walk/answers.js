// The player's answers: what each prompt type does with its value, then the walk goes on.
import * as engine from "../engine/index.js";
import { CARD, TRAIL, cardById } from "../engine/index.js";
import { NODE } from "../flow/index.js";
import { exitAction, spendCurrentDie } from "./actions.js";
import { cur, endWalk, follow, trail } from "./core.js";
import { recordDecision } from "./decisions/common.js";
import { dieWithArticle } from "./jumps-table.js";
import { SHADOW_NATION_NAME } from "./nations.js";
import { PROMPT, WALK_RESULT } from "./prompt.js";
import { run } from "./run.js";

// A yes/no answer to a board question asked once per node.
function answerBoardPart(state, walk, prompt, value) {
  walk.parts[prompt.part] = !!value;
  trail(state, {
    kind: TRAIL.QUESTION,
    text: prompt.text,
    answer: value ? "Yes" : "No",
  });
}
// The bold (ring) part of a two-part decision: Yes decides it, No moves on to the plain part.
function answerRingPart(state, walk, prompt, value) {
  if (value)
    return recordDecision(state, {
      text: prompt.text,
      ringCondition: true,
      answer: true,
      auto: false,
    });
  trail(state, { kind: TRAIL.QUESTION, text: prompt.text, answer: "No" });
  walk.sub = 2;
}
function answerPlainPart(state, prompt, value) {
  recordDecision(state, {
    text: prompt.text,
    ringCondition: false,
    answer: value,
    auto: false,
  });
}
function answerYesNo(state, prompt, value) {
  const walk = state.walk;
  if (prompt.part) return answerBoardPart(state, walk, prompt, value);
  if (prompt.sub === 1) return answerRingPart(state, walk, prompt, value);
  if (prompt.sub === 2) return answerPlainPart(state, prompt, value);
  const node = cur(state);
  recordDecision(state, {
    text: NODE.text(node),
    ringCondition: NODE.extra(node).bold,
    answer: value,
    auto: false,
  });
}
function answerChoice(state, prompt, value) {
  state.walk[prompt.set] = value || null;
  trail(state, {
    kind: TRAIL.PRIORITY,
    text: prompt.pri,
    items: prompt.items,
    steps: ["You chose: " + (value || "none")],
    choice: value || "none",
  });
  follow(state, null);
}
function answerSituational(state, prompt, value) {
  state.situational[prompt.key] = !!value;
  trail(state, {
    kind: TRAIL.QUESTION,
    text: prompt.text,
    answer: value ? "Yes" : "No",
    situ: true,
  });
}
function answerConfirm(state, prompt, value) {
  state.playable[(prompt.ctx === "combat" ? "B:" : "") + prompt.card] = !!value;
  trail(state, {
    kind: TRAIL.REVEAL,
    text: cardById[prompt.card].title,
    answer: value ? "playable" : "not playable",
    card: prompt.card,
  });
}
function answerDieCheck(state, prompt, value) {
  const walk = state.walk;
  walk.dieAns[prompt.req] = !!value;
  walk.pendingDie = prompt.label;
  trail(state, {
    kind: TRAIL.QUESTION,
    text: prompt.text,
    answer: value ? "Yes" : "No",
  });
}
function answerRing(state, prompt, value) {
  const walk = state.walk;
  walk.dieAns[prompt.req] = !!value;
  walk.pendingDie = prompt.label;
  if (!value) return;
  state.board.rings = Math.max(0, state.board.rings - 1);
  state.ringUsedThisTurn = true;
  engine.log(
    state,
    "Elven Ring used to create " +
      dieWithArticle(prompt.req) +
      " die (rule 36).",
  );
  trail(state, {
    kind: TRAIL.RING,
    text: "Elven Ring used for " + dieWithArticle(prompt.req) + " die",
  });
}
// The board consequences of an action the player carried out (the tracker keeps up).
function musterMinionOnBoard(state, minionKey) {
  state.board.chars[minionKey] = engine.MINION_STATUS.IN_PLAY;
  state.playable = {};
  engine.log(
    state,
    state.walk.minionPick + " is now in play (tracker updated).",
  );
}
function advanceNationOnBoard(state, nationKey) {
  const now = state.board.nations[nationKey] ?? 0;
  state.board.nations[nationKey] = Math.max(0, now - 1);
  state.playable = {};
  engine.log(
    state,
    SHADOW_NATION_NAME[nationKey] +
      " is now " +
      engine.politicalTrackLabel(state.board.nations[nationKey]) +
      ".",
  );
}
function bringFactionOnBoard(state, factionKey) {
  state.board.factions[factionKey] = true;
  state.playable = {};
  engine.log(
    state,
    state.walk.factionChoice +
      " are now in play (tracker updated; the Faction die joins the pool next turn).",
  );
}
function applyActionToBoard(state, prompt) {
  if (prompt.minion) musterMinionOnBoard(state, prompt.minion);
  if (prompt.nation) advanceNationOnBoard(state, prompt.nation);
  if (prompt.faction) bringFactionOnBoard(state, prompt.faction);
}
function answerAction(state, prompt, value) {
  const walk = state.walk;
  if (value !== "done") {
    trail(state, {
      kind: TRAIL.ACTION,
      text: prompt.text,
      answer: "not possible",
    });
    return exitAction(state);
  }
  trail(state, { kind: TRAIL.ACTION, text: prompt.text, answer: "done" });
  if (prompt.pass) {
    endWalk(state, WALK_RESULT.PASS, "Queller passes.");
    engine.log(state, "Queller passes.");
    return;
  }
  applyActionToBoard(state, prompt);
  if (walk.die) spendCurrentDie(state, "“" + prompt.text + "”");
  else engine.log(state, "Queller: " + prompt.text);
  endWalk(state, WALK_RESULT.ACTION, prompt.text);
}
function answerPlayCard(state, prompt) {
  const walk = state.walk;
  const palantirBefore = state.cards.table.includes(CARD.PALANTIR),
    die = walk.die;
  const card = engine.playCard(state, prompt.card, { combat: prompt.combat });
  trail(state, {
    kind: TRAIL.ACTION,
    text: "Played “" + card.title + "”",
    answer: "done",
    card: prompt.card,
  });
  if (!prompt.combat && walk.die)
    spendCurrentDie(state, "played “" + card.title + "”"); // spent first so a card effect on the dice never touches the die that played it
  for (const entry of engine.resolveCardEffects(state, prompt.card, {
    combat: prompt.combat,
    die,
    palantirBefore,
  }))
    trail(state, entry);
  if (prompt.combat) return follow(state, null);
  endWalk(state, WALK_RESULT.ACTION, "Queller plays “" + card.title + "”.");
}
function answerStep(state, prompt, value) {
  trail(state, {
    kind: TRAIL.STEP,
    text: prompt.text,
    answer: value === "no" ? "not possible" : "done",
  });
  if (prompt.move && value !== "no") state.walk.dieUsed = true;
  follow(state, null);
}
function answerRoll(state, prompt, value) {
  trail(state, { kind: TRAIL.STEP, text: prompt.text, answer: value });
  follow(state, value);
}
function answerPriority(state, prompt) {
  trail(state, {
    kind: TRAIL.PRIORITY,
    text: prompt.text,
    items: prompt.items,
    steps: prompt.steps,
    card: prompt.card,
    choice: prompt.choice,
  });
  follow(state, null);
}
// New battle details invalidate every cached combat-card check.
function forgetCombatPlayability(state) {
  state.playable = Object.fromEntries(
    Object.entries(state.playable).filter(([key]) => !key.startsWith("B:")),
  );
}
function answerBattleForm(state, prompt, value) {
  state.battle = value;
  forgetCombatPlayability(state);
  trail(state, { kind: TRAIL.NOTE, text: "Battle details recorded" });
}
// What each prompt type does with the player's answer: (state, prompt, value).
const ANSWER_HANDLERS = {
  [PROMPT.YES_NO]: answerYesNo,
  [PROMPT.CHOICE]: answerChoice,
  [PROMPT.SITUATIONAL]: answerSituational,
  [PROMPT.CONFIRM]: answerConfirm,
  [PROMPT.DIE_CHECK]: answerDieCheck,
  [PROMPT.RING]: answerRing,
  [PROMPT.ACTION]: answerAction,
  [PROMPT.PLAY_CARD]: answerPlayCard,
  [PROMPT.STEP]: answerStep,
  [PROMPT.ROLL]: answerRoll,
  [PROMPT.PRIORITY]: answerPriority,
  [PROMPT.BATTLE_FORM]: answerBattleForm,
};
// The player's answer to the open prompt: apply it, then walk on until the next prompt.
export function answer(state, value) {
  const walk = state.walk;
  if (!walk?.prompt) return;
  const prompt = walk.prompt;
  walk.prompt = null;
  const handler = ANSWER_HANDLERS[prompt.type];
  if (handler) handler(state, prompt, value);
  run(state);
}
