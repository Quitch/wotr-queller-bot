// The modal names, the limits, the tooltip geometry, the localStorage keys and the legal notice.

// The modals (modals/) by the `name` passed to openModal.
export const MODAL = {
  GLOSSARY: "glossary",
  FLOW: "flow",
  RULES: "rules",
  CALC: "calc",
  SAVE: "save",
  SETTINGS: "settings",
  JUMP: "jump",
  HELP: "help",
  DEBUG: "debug",
  ASK: "ask",
  TOOLS: "tools",
};
export const UNDO_DEPTH = 60; // snapshots kept for Undo
export const LOG_ROWS_SHOWN = 40;
export const TOOLTIP = {
  MAX_WIDTH: 360,
  VIEWPORT_MARGIN: 12,
  EDGE_MARGIN: 8,
  GAP: 8,
};
export const STORAGE_KEY = {
  AUTOSAVE: "qb.autosave",
  BROKEN_AUTOSAVE: "qb.autosave.broken",
  SLOTS: "qb.slots",
  OPTIONS: "qb.opts",
  DEBUG: "qb.debug",
  PROBE: "qb.probe",
};
export const LEGAL =
  '<p><b>You need a copy of War of the Ring (2nd Edition) to play.</b> This app runs the Queller Bot; it does not replace the board, figures, dice or cards. With the Warriors of Middle-earth option on, you also need that expansion.</p><p>Queller Bot for War of the Ring © Quitch, licensed under <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">Creative Commons Attribution-NonCommercial 4.0 International<span class="sr"> (opens in a new tab)</span></a>. Bot text, flowcharts and rules reproduced with the author’s permission; <a href="https://boardgamegeek.com/filepage/141333/queller-bot-solo-play" target="_blank" rel="noopener">file page on BoardGameGeek<span class="sr"> (opens in a new tab)</span></a>.</p><p>War of the Ring, Middle-earth and The Lord of the Rings and the characters, items, events, and places therein are trademarks of Middle-earth Enterprises, LLC used under license by Ares Games srl. War of the Ring Second Edition and Warriors of Middle-earth © Ares Games srl. Event card and Action die text is reproduced here only as a play aid for owners of the game. This is an unofficial fan-made tool and is not affiliated with, endorsed or sponsored by Ares Games or Middle-earth Enterprises.</p>';
