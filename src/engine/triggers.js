// Table cards whose discard condition the board tracker can see, checked after every tracker change.
import {
  CARD,
  FP_NATIONS,
  FP_STANCE,
  FP_STANCE_RANK,
  MINION_STATUS,
} from "./constants.js";
import { discardCard } from "./hand.js";
import { log } from "./log.js";

const FP_NATION_KEY = new RegExp(
  String.raw`^nations\.(${FP_NATIONS.join("|")})$`,
); // a tracker change key for a Free Peoples nation
// A declaration is an event, not a board field: the counter stays Hidden, so "Revealed" cannot stand in for it.
const FS_DECLARED = "fs.declared";
// Table cards whose discard condition the board tracker can see. `outcome(state, change)` returns {discard: reason} (discard now),
// {ask: question} (the player must decide) or null (nothing happens).
// Only "eliminated" counts: moving Saruman back to "available" is a correction and discards nothing.
const sarumanEliminated = (change) =>
  change.key === "chars.saruman" && change.to === MINION_STATUS.ELIMINATED
    ? { discard: "Saruman eliminated" }
    : null;
const TABLE_TRIGGERS = [
  {
    id: CARD.WORMTONGUE,
    outcome: (state, change) => {
      if (
        change.key === "nations.rohan" &&
        change.from === FP_STANCE.PASSIVE &&
        change.to !== FP_STANCE.PASSIVE
      )
        return { discard: "Rohan activated" };
      return sarumanEliminated(change);
    },
  },
  {
    id: CARD.PALANTIR,
    outcome: (state, change) => sarumanEliminated(change),
  },
  {
    id: CARD.THREATS_AND_PROMISES,
    outcome: (state, change) => {
      if (!FP_NATION_KEY.test(change.key)) return null;
      if (FP_STANCE_RANK[change.to] <= FP_STANCE_RANK[change.from]) return null;
      if (change.from === FP_STANCE.PASSIVE)
        return {
          ask: "Threats and Promises: was the Nation activated by an attack or a Companion’s special ability (not by a Fellowship declaration or an enemy Army entering it)?",
        };
      return {
        ask: "Threats and Promises: did the Nation go to war because of an attack or a Companion’s special ability (not a Muster die)?",
      };
    },
  },
  {
    id: CARD.FLOCKS_OF_CREBAIN,
    outcome: (state, change) =>
      change.key === FS_DECLARED
        ? {
            ask: "Flocks of Crebain: was the Fellowship declared in an unconquered Free Peoples City or Stronghold?",
          }
        : null,
  },
  {
    id: CARD.WORN_WITH_SORROW,
    outcome: (state, change) =>
      change.key === FS_DECLARED
        ? {
            ask: "Worn with Sorrow and Toil: was the Fellowship declared in an unconquered Free Peoples City or Stronghold?",
          }
        : null,
  },
];
// The tracker's "declared" button: logs the declaration and returns the table cards to ask about.
export function fellowshipDeclared(state) {
  log(
    state,
    "The Fellowship was declared in a Free Peoples City or Stronghold.",
  );
  return tableTriggers(state, { key: FS_DECLARED, from: false, to: true });
}
// After a tracker change {key, from, to}: discards the table cards whose condition is now met; returns the questions the app cannot answer itself.
export function tableTriggers(state, change) {
  const asks = [];
  for (const trigger of TABLE_TRIGGERS) {
    if (!state.cards.table.includes(trigger.id)) continue;
    const outcome = trigger.outcome(state, change);
    if (outcome?.discard) discardCard(state, trigger.id, outcome.discard);
    else if (outcome?.ask) asks.push({ card: trigger.id, q: outcome.ask });
  }
  return asks;
}
