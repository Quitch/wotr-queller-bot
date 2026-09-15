// Static consistency checks between the walker / the engine, the UI and the flowchart, card, reference and arrow data.
// Exit 1 on any failure.
import fs from "node:fs";
import path from "node:path";
import anchors from "../src/flow/anchors.json" with { type: "json" };
import * as fakeWindow from "./load.js";
const FLOW = fakeWindow.QB_FLOW,
  NODE = fakeWindow.QB_NODE,
  NODE_KIND = fakeWindow.QB_NODE_KIND,
  EDGE = fakeWindow.QB_EDGE,
  engine = fakeWindow.QB,
  { GLOSSARY, GLOSSARY_ALIASES, RULES, RULINGS, TURN } = fakeWindow;
const SRC_DIR = path.join(import.meta.dirname, "..", "src");
// The card data as it stands: a card added, dropped or moved between decks or sets changes these on purpose.
const CARD_COUNT = 79;
const CARDS_PER_DECK = { C: 25, S: 28, F: 20, B: 6 };
const CARDS_PER_SET = { "2E": 48, WoME: 29, "WoME-rev": 2 };
const CARD_TYPES = ["Character", "Army", "Muster"];
const INIT_RANGE = /^\d+-\d+$/; // an initiative given as a range, "3-5"
const CARD_TEXT_FIELDS = [
  "title",
  "cond",
  "text",
  "combatTitle",
  "combatCond",
  "combatText",
  "reminder",
];
// *term* in any text (ui/dom.js MARKUP_TERM), and "rule N" / "rules N and M" citations.
const MARKUP_TERM = /\*([^*]+)\*/g;
const RULE_CITATION = /\brules? (\d+)(?:\s*(?:and|to|-|–)\s*(\d+))?/g;
// A "[PROMPT.NAME]:" key of a handler table.
const PROMPT_KEY = /\[PROMPT\.([A-Z_]+)\]:/g;
let fails = 0;
const fail = (message) => {
  fails++;
  console.log("FAIL", message);
};
// A "PAGE.node" string literal, as the walker's handler tables and jump specs use them.
const NODE_KEY = /"([A-Z0-9]+)\.([A-Za-z0-9]+)"/g;
const WALK_DIR = path.join(import.meta.dirname, "..", "src", "walk");
const MIN_NODE_KEYS = 129; // the keys the walker held when this check was written; a split that lost a file would show here
// Every "PAGE.node" key in the walker's modules names a real node. Returns how many keys were checked, so a regex that
// stops matching (or a module the scan no longer reaches) is visible.
function checkNodeKeysExist() {
  const keys = new Set();
  for (const file of fs.readdirSync(WALK_DIR, { recursive: true })) {
    if (!file.endsWith(".js")) continue;
    const source = fs.readFileSync(path.join(WALK_DIR, file), "utf8");
    for (const [, pageKey, nodeId] of source.matchAll(NODE_KEY)) {
      if (!FLOW[pageKey]) continue;
      keys.add(pageKey + "." + nodeId);
      if (!FLOW[pageKey].nodes[nodeId])
        fail(file + " refers to missing node " + pageKey + "." + nodeId);
    }
  }
  if (keys.size < MIN_NODE_KEYS)
    fail("only " + keys.size + " node keys found under src/walk/");
  return keys.size;
}
// Every criterion on a card priority list is understood by criterionTest.
function checkCardCriteriaResolve(state) {
  for (const nodeKey of engine.CARD_CRITERIA_NODES) {
    const [pageKey, nodeId] = nodeKey.split(".");
    const node = FLOW[pageKey]?.nodes[nodeId];
    if (!node) {
      fail("card list " + nodeKey + " missing");
      continue;
    }
    for (const criterion of NODE.extra(node).items)
      if (
        !engine.criterionTest(criterion, state, null, {
          eventFull: false,
          factionFull: false,
        })
      )
        fail(nodeKey + ': criterionTest cannot resolve "' + criterion + '"');
  }
}
// Every grey box has a JUMPS entry; every decision has two arrows; every non-action box has a way out.
function checkFlowchartShape() {
  for (const pageKey in FLOW)
    for (const nodeId in FLOW[pageKey].nodes) {
      const node = FLOW[pageKey].nodes[nodeId];
      const kind = NODE.kind(node);
      const outEdges = FLOW[pageKey].edges.filter(
        (edge) => EDGE.from(edge) === nodeId,
      );
      if (kind === NODE_KIND.JUMP && !engine.jumpSpec(NODE.text(node)))
        fail(
          "no JUMPS entry for " +
            pageKey +
            "." +
            nodeId +
            ' "' +
            engine.normalizeText(NODE.text(node)) +
            '"',
        );
      if (
        (kind === NODE_KIND.DECISION || kind === NODE_KIND.FOLLOW_UP) &&
        outEdges.length !== 2
      )
        fail(pageKey + "." + nodeId + " has " + outEdges.length + " arrows");
      if (
        !outEdges.length &&
        ![NODE_KIND.ACTION, NODE_KIND.JUMP, NODE_KIND.NOTE].includes(kind)
      )
        fail(pageKey + "." + nodeId + " (" + kind + ") has no arrow out");
    }
}
// The card's pre/cpre keys resolve (the engine throws on an unknown key).
function checkCardPreconditions(state, card) {
  if (card.pre) {
    try {
      engine.precondition(state, card.id);
    } catch (error) {
      fail(card.id + ' pre "' + card.pre + '": ' + error.message);
    }
  }
  if (card.cpre) {
    try {
      engine.combatPrecondition({ ...state, battle: { figures: {} } }, card);
    } catch (error) {
      fail(card.id + ' cpre "' + card.cpre + '": ' + error.message);
    }
  }
}
// The card's deck, effect and onTable flags are consistent with each other and with the condition text.
function checkCardEffectFlags(card) {
  if (card.deck === engine.DECK.CALL_TO_BATTLE && !card.faction)
    fail(card.id + " Call to Battle card without a faction");
  if (card.effect && !Object.keys(engine.CARD_EFFECTS).includes(card.effect))
    fail(card.id + " unknown effect " + card.effect);
  if (card.effect === engine.CARD_EFFECT.RECRUIT_FACTION && !card.faction)
    fail(card.id + " recruitFaction without a faction");
  if (!!card.onTable !== /play on the table/i.test(card.cond || ""))
    fail(card.id + " onTable flag disagrees with its condition text");
}
// Every card flag key exists; every card the engine expects has its data; onTable agrees with the condition text (a transcription guard).
function checkCardFlags(state) {
  for (const card of fakeWindow.QB_CARDS) {
    checkCardPreconditions(state, card);
    checkCardEffectFlags(card);
  }
}
// The card data: the counts, unique ids, the enums every card uses and the flags that imply each other.
function checkCardData() {
  const cards = fakeWindow.QB_CARDS;
  const count = (field) =>
    cards.reduce((tally, card) => {
      tally[card[field]] = (tally[card[field]] || 0) + 1;
      return tally;
    }, {});
  if (cards.length !== CARD_COUNT)
    fail(cards.length + " cards, expected " + CARD_COUNT);
  const sameTally = (tally, expected) =>
    JSON.stringify(Object.entries(tally).sort()) ===
    JSON.stringify(Object.entries(expected).sort());
  if (!sameTally(count("deck"), CARDS_PER_DECK))
    fail("cards per deck " + JSON.stringify(count("deck")));
  if (!sameTally(count("set"), CARDS_PER_SET))
    fail("cards per set " + JSON.stringify(count("set")));
  if (new Set(cards.map((card) => card.id)).size !== cards.length)
    fail("duplicate card ids");
  const decks = Object.values(engine.DECK);
  for (const card of cards) {
    if (!decks.includes(card.deck))
      fail(card.id + " unknown deck " + card.deck);
    if (
      card.deck === engine.DECK.CALL_TO_BATTLE
        ? card.type != null
        : !CARD_TYPES.includes(card.type)
    )
      fail(card.id + " unknown type " + card.type); // a Call to Battle card is played by no die
    if (!card.title || typeof card.text !== "string")
      fail(card.id + " lacks a title or text");
    if (
      card.init != null &&
      typeof card.init !== "number" &&
      !INIT_RANGE.test(card.init)
    )
      fail(card.id + " init is neither a number nor a range: " + card.init);
    if (card.tableCombat && !card.onTable)
      fail(card.id + " tableCombat without onTable");
    if (!!card.combatTitle !== !!card.combatText)
      fail(card.id + " has half a combat half");
  }
}
// The glossary key a *term* resolves to, as ui/dom.js termKey does: the term, an alias, or the term without its plural s.
function termKey(term) {
  term = term.toLowerCase().replace(/\s+/g, " ").trim();
  if (GLOSSARY[term]) return term;
  if (GLOSSARY_ALIASES[term]) return GLOSSARY_ALIASES[term];
  const singular = term.replace(/s$/, "");
  return GLOSSARY[singular] ? singular : null;
}
// Every text that is shown with its markup rendered: [where, text].
function markedUpTexts() {
  const texts = [];
  for (const pageKey in FLOW)
    for (const id in FLOW[pageKey].nodes) {
      const node = FLOW[pageKey].nodes[id],
        where = pageKey + "." + id;
      texts.push([where, NODE.text(node)]);
      const nodeExtra = NODE.extra(node);
      if (nodeExtra.t2) texts.push([where, nodeExtra.t2]);
      for (const item of nodeExtra.items || []) texts.push([where, item]);
    }
  for (const card of fakeWindow.QB_CARDS)
    for (const field of CARD_TEXT_FIELDS)
      if (card[field]) texts.push([card.id + "." + field, card[field]]);
  for (const term in GLOSSARY) texts.push(["glossary " + term, GLOSSARY[term]]);
  for (const [section, rules] of RULES)
    for (const [number, text] of rules)
      texts.push([section + " rule " + number, text]);
  for (const [question, answer] of RULINGS)
    texts.push(
      ["ruling " + question, question],
      ["ruling " + question, answer],
    );
  for (const [phase, text] of TURN) texts.push(["turn " + phase, text]);
  return texts;
}
// Every *term* names a glossary entry, every alias points at one, and every rule cited exists.
function checkReferenceText() {
  const ruleNumbers = new Set(
    RULES.flatMap(([, rules]) => rules.map(([number]) => number)),
  );
  let terms = 0,
    citations = 0;
  const checkCitations = (where, text) => {
    for (const [, from, to] of text.matchAll(RULE_CITATION)) {
      citations++;
      for (const number of [from, to]) {
        if (number === undefined) continue;
        if (!ruleNumbers.has(+number))
          fail(where + " cites rule " + number + " which does not exist");
      }
    }
  };
  for (const [where, text] of markedUpTexts()) {
    for (const [, term] of text.matchAll(MARKUP_TERM)) {
      terms++;
      if (!termKey(term))
        fail(where + ' marks "' + term + '" which is not in the glossary');
    }
    checkCitations(where, text);
  }
  for (const alias in GLOSSARY_ALIASES)
    if (!GLOSSARY[GLOSSARY_ALIASES[alias]])
      fail('alias "' + alias + '" points at a missing glossary term');
  for (const file of fs.readdirSync(SRC_DIR, { recursive: true })) {
    if (!file.endsWith(".js")) continue;
    checkCitations(
      "src/" + file,
      fs.readFileSync(path.join(SRC_DIR, file), "utf8"),
    );
  }
  return { terms, citations };
}
// anchors.json has one record per arrow and every record matches an arrow (applyAnchors drops the ones that do not).
function checkAnchors() {
  const edges = Object.values(FLOW).reduce(
    (sum, page) => sum + page.edges.length,
    0,
  );
  if (anchors.length !== edges)
    fail(anchors.length + " anchor records for " + edges + " arrows");
  const matched = new Set();
  for (const record of anchors) {
    const edge = FLOW[record.p]?.edges.find(
      (candidate) =>
        EDGE.from(candidate) === record.f &&
        EDGE.to(candidate) === record.t &&
        (EDGE.label(candidate) || null) === (record.l || null),
    );
    if (!edge)
      fail(
        "anchor record matches no arrow: " +
          record.p +
          " " +
          record.f +
          "→" +
          record.t +
          (record.l ? " (" + record.l + ")" : ""),
      );
    else matched.add(edge);
  }
  if (matched.size !== edges)
    fail(matched.size + " arrows have an anchor record, " + edges + " arrows");
}
// Every prompt type has an answer handler (walk/answers.js) and a renderer (ui/prompts.js), and nothing else does.
function checkPromptTables() {
  const source = fs.readFileSync(
    path.join(SRC_DIR, "walk", "answers.js"),
    "utf8",
  );
  const handled = new Set(
    [...source.matchAll(PROMPT_KEY)].map(([, name]) => engine.PROMPT[name]),
  );
  const rendered = new Set(Object.keys(fakeWindow.PROMPT_RENDERERS));
  const types = Object.values(engine.PROMPT);
  for (const type of types) {
    if (!handled.has(type)) fail("prompt " + type + " has no answer handler");
    if (!rendered.has(type)) fail("prompt " + type + " has no renderer");
  }
  for (const type of handled)
    if (!types.includes(type))
      fail("answer handler for unknown prompt " + type);
  for (const type of rendered)
    if (!types.includes(type)) fail("renderer for unknown prompt " + type);
}
function main() {
  const state = engine.newState({
    dice: true,
    cards: true,
    tracker: true,
    wome: true,
  });
  const nodeKeys = checkNodeKeysExist();
  checkCardCriteriaResolve(state);
  checkFlowchartShape();
  checkCardFlags(state);
  checkCardData();
  const { terms, citations } = checkReferenceText();
  checkAnchors();
  checkPromptTables();
  console.log(
    fails
      ? fails + " failure(s)"
      : "all checks passed (" +
          nodeKeys +
          " node keys, " +
          terms +
          " glossary markers, " +
          citations +
          " rule citations, " +
          anchors.length +
          " anchor records)",
  );
  process.exit(fails ? 1 : 0);
}
main();
