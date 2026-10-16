// What a walk asks the player (PROMPT), how it ends (WALK_RESULT), and the two sentinels handlers return.

// Returned by a handler that has set a prompt and is waiting for the player; only ever compared with ===.
export const PENDING = Symbol("prompt open");
// What the walk is asking the player (walk.prompt.type).
export const PROMPT = {
  YES_NO: "yesno",
  SITUATIONAL: "situ",
  CONFIRM: "confirm",
  DIE_CHECK: "diecheck",
  RING: "ring",
  ACTION: "action",
  STEP: "step",
  ROLL: "roll",
  PLAY_CARD: "playcard",
  CHOICE: "choice",
  PRIORITY: "priority",
  BATTLE_FORM: "battleForm",
  BLOCKED: "blocked",
};
// The prompts answered with yes or no.
export const YES_NO_PROMPTS = [
  PROMPT.YES_NO,
  PROMPT.SITUATIONAL,
  PROMPT.CONFIRM,
  PROMPT.DIE_CHECK,
  PROMPT.RING,
];
// The prompts the player can answer with Not possible (rule 36): an action the app does not perform itself, a move, or
// a draw step (both decks empty, rule 25).
export const offersNotPossible = (prompt, walk) =>
  (prompt.type === PROMPT.ACTION && !prompt.auto) ||
  (prompt.type === PROMPT.STEP && (!!prompt.move || isDrawStep(prompt, walk)));
// The draw steps before "Above full hand", known by their box so a saved prompt needs no flag.
const DRAW_STEPS = new Set(["EV.drawPrefT", "FA.drawT"]);
export const isDrawStep = (prompt, walk) =>
  prompt.type === PROMPT.STEP && DRAW_STEPS.has(walk.page + "." + prompt.node);
// How a walk ended (walk.result); a walk that reached another start point ends with phaseResult(name).
export const WALK_RESULT = {
  ACTION: "action",
  PASS: "pass",
  NO_ACTION: "noaction",
  STRATEGY: "strategy",
  BATTLE_NEXT: "battleNext",
  END: "end",
};
const PHASE_RESULT_PREFIX = "phase:";
export const phaseResult = (startName) => PHASE_RESULT_PREFIX + startName;
// A strategy (the STRATEGY value) as the text writes it: "Military", "Corruption".
export const strategyName = (strategy) =>
  strategy.charAt(0).toUpperCase() + strategy.slice(1);
// The start point a walk ended at, or null for any other result.
export const phaseFromResult = (result) =>
  typeof result === "string" && result.startsWith(PHASE_RESULT_PREFIX)
    ? result.slice(PHASE_RESULT_PREFIX.length)
    : null;
// The strategy roll: 1-3 corruption, 4-6 military.
export const STRATEGY_ROLL = { LOW: "1-3", HIGH: "4-6" };
export const isLowRoll = (roll) => roll <= 3;
// Returned by an action or step handler that leaves the box to the generic handling (the End box, or a plain prompt).
export const FALL_THROUGH = Symbol("not handled");
