// The open prompt as HTML: one renderer per prompt type, each giving the body and the answer buttons.
import { FLOW, NODE, NODE_KIND } from "../flow/index.js";
import * as engine from "../qb.js";
import { PROMPT, cardById } from "../qb.js";
import { battleFormHTML, dieHelpText } from "./battle-form.js";
import { CARD_HALF, cardHTML } from "./card.js";
import { ringIcon } from "./dice.js";
import { escapeHTML, formatText } from "./dom.js";

export const NODE_KIND_NAME = {
  [NODE_KIND.START]: "Start point",
  [NODE_KIND.ACTION]: "Action",
  [NODE_KIND.DECISION]: "Decision",
  [NODE_KIND.FOLLOW_UP]: "Follow-up decision",
  [NODE_KIND.JUMP]: "Jump",
  [NODE_KIND.PRIORITY]: "Priority list",
  [NODE_KIND.STEP]: "Step",
  [NODE_KIND.NOTE]: "Note",
};
// The prompt renderers: each turns the open prompt into {body, answers} (the buttons carry data-ans values).
const YES_NO_BUTTONS =
  '<button class="btn yes" data-ans="yes">Yes</button><button class="btn no" data-ans="no">No</button>';
const DONE_BUTTON = '<button class="btn yes" data-ans="done">Done</button>';
const orderedListHTML = (items) =>
  items
    ? "<ol>" +
      items.map((item) => "<li>" + formatText(item) + "</li>").join("") +
      "</ol>"
    : "";
const stepsHTML = (steps) =>
  steps?.length
    ? '<ol class="steps">' +
      steps.map((step) => "<li>" + formatText(step) + "</li>").join("") +
      "</ol>"
    : "";
const questionHTML = (text) => '<p class="q">' + formatText(text) + "</p>";
// The line above a prompt: the page, the box kind, the die held and whether this is a ring search.
function promptEyebrowHTML(walk, page, kind) {
  return (
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
    "</div>"
  );
}
function renderYesNoPrompt(prompt, walk, node) {
  const isRing = prompt.bold || (NODE.extra(node).bold && !prompt.sub);
  return {
    body:
      (prompt.board ? '<div class="eyebrow">Board question</div>' : "") +
      '<p class="q">' +
      (isRing ? ringIcon() + " " : "") +
      formatText(prompt.text) +
      "?</p>" +
      (isRing
        ? '<div class="bold-note">Elven Ring condition: if it is true and Queller lacks the die the next step needs, it uses an Elven Ring (rule 36).</div>'
        : "") +
      orderedListHTML(prompt.items),
    answers: YES_NO_BUTTONS,
  };
}
function renderChoicePrompt(prompt) {
  return {
    body:
      '<div class="eyebrow">Priority list — you decide</div><p class="q">' +
      formatText(prompt.text) +
      "</p>" +
      orderedListHTML(prompt.items || []),
    answers: prompt.options
      .map(
        (option) =>
          '<button class="btn" data-ans="' +
          escapeHTML(option.value) +
          '">' +
          escapeHTML(option.label) +
          "</button>",
      )
      .join(""),
  };
}
function renderSituationalPrompt(prompt) {
  return {
    body:
      '<div class="eyebrow">Board check (for a card in Queller’s hand)</div><p class="q">' +
      formatText(prompt.text) +
      "</p>",
    answers: YES_NO_BUTTONS,
  };
}
function renderConfirmPrompt(prompt) {
  const combat = prompt.ctx === "combat";
  return {
    body:
      '<div class="eyebrow">' +
      (combat ? "Combat card" : "Card") +
      ' check — the condition on this card is met</div><p class="q">Is this card *playable* now? Every paragraph must be usable and have an effect (rule 17).</p>' +
      cardHTML(
        cardById[prompt.card],
        combat ? CARD_HALF.COMBAT : CARD_HALF.EVENT,
      ),
    answers:
      '<button class="btn yes" data-ans="yes">Playable</button><button class="btn no" data-ans="no">Not playable</button>',
  };
}
function renderDieCheckPrompt(prompt) {
  return {
    body:
      questionHTML(prompt.text) +
      '<div class="help">Grey box: ' +
      escapeHTML(prompt.label) +
      "</div>",
    answers: YES_NO_BUTTONS,
  };
}
function renderRingPrompt(prompt) {
  return {
    body: questionHTML(prompt.text),
    answers:
      '<button class="btn yes" data-ans="yes">Ring used</button><button class="btn no" data-ans="no">No ring available</button>',
  };
}
function renderActionPrompt(prompt, walk) {
  return {
    body:
      '<p class="q">Queller: ' +
      formatText(prompt.text) +
      "</p>" +
      (prompt.help
        ? '<div class="help">' + formatText(prompt.help) + "</div>"
        : "") +
      (prompt.pass ? "" : '<div class="help">' + dieHelpText(walk) + "</div>"),
    answers:
      DONE_BUTTON +
      (prompt.auto
        ? ""
        : '<button class="btn no" data-ans="no">Not possible (rule 29)</button>'),
  };
}
function renderPlayCardPrompt(prompt, walk) {
  return {
    body:
      '<p class="q">Queller plays a card' +
      (prompt.combat ? " as its combat card" : "") +
      ":</p>" +
      cardHTML(cardById[prompt.card]) +
      stepsHTML(walk.steps) +
      '<div class="help">Resolve it with the matching decision page (rule 12). ' +
      (engine.staysOnTable(prompt.card) && !prompt.combat
        ? "It stays on the table until discarded."
        : "") +
      "</div>",
    answers: DONE_BUTTON,
  };
}
function renderStepPrompt(prompt) {
  return {
    body: questionHTML(prompt.text) + orderedListHTML(prompt.items),
    answers: prompt.move
      ? DONE_BUTTON +
        '<button class="btn no" data-ans="no">Not possible</button>'
      : '<button class="btn yes" data-ans="done">Continue</button>',
  };
}
function renderRollPrompt(prompt) {
  return {
    body: questionHTML(prompt.text),
    answers: prompt.options
      .map(
        (option) =>
          '<button class="btn" data-ans="' +
          option +
          '">' +
          option +
          "</button>",
      )
      .join(""),
  };
}
function renderPriorityPrompt(prompt, walk) {
  const half = walk.page === "BA" ? CARD_HALF.COMBAT : CARD_HALF.EVENT;
  return {
    body:
      questionHTML(prompt.text) +
      orderedListHTML(prompt.items || []) +
      stepsHTML(prompt.steps) +
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
        : ""),
    answers: '<button class="btn yes" data-ans="ok">Continue</button>',
  };
}
function renderBattleFormPrompt(prompt) {
  return {
    body: battleFormHTML(prompt),
    answers: '<button class="btn yes" id="bfOk">Start the round</button>',
  };
}
// One renderer per PROMPT type (test/check.js verifies the two match).
export const PROMPT_RENDERERS = {
  [PROMPT.YES_NO]: renderYesNoPrompt,
  [PROMPT.CHOICE]: renderChoicePrompt,
  [PROMPT.SITUATIONAL]: renderSituationalPrompt,
  [PROMPT.CONFIRM]: renderConfirmPrompt,
  [PROMPT.DIE_CHECK]: renderDieCheckPrompt,
  [PROMPT.RING]: renderRingPrompt,
  [PROMPT.ACTION]: renderActionPrompt,
  [PROMPT.PLAY_CARD]: renderPlayCardPrompt,
  [PROMPT.STEP]: renderStepPrompt,
  [PROMPT.ROLL]: renderRollPrompt,
  [PROMPT.PRIORITY]: renderPriorityPrompt,
  [PROMPT.BATTLE_FORM]: renderBattleFormPrompt,
};
export function promptHTML(walk) {
  const prompt = walk.prompt,
    page = FLOW[walk.page],
    node = page.nodes[walk.node] || [NODE_KIND.DECISION];
  const kind = prompt.kind || NODE.kind(node) || NODE_KIND.DECISION;
  const renderer = PROMPT_RENDERERS[prompt.type];
  const { body, answers } = renderer
    ? renderer(prompt, walk, node)
    : { body: "", answers: "" };
  return (
    '<div class="prompt k-' +
    kind +
    '" tabindex="-1" role="group" aria-label="Current step">' +
    promptEyebrowHTML(walk, page, kind) +
    body +
    '<div class="answers">' +
    answers +
    "</div></div>"
  );
}
