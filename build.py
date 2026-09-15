#!/usr/bin/env python3
"""Concatenate the split sources into the single-file artifact (index.html).
The Artifact host wraps the file in its own <!doctype>/<head>/<body>, so the page starts at <title>."""
import datetime
import pathlib

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT / "index.html"
# The scripts share window.QB* globals, so each one must come after the ones it reads. test/load.js evals the first
# seven of these (everything but the DOM scripts) in the same order; keep the two lists in step.
SOURCE_ORDER = [
    "flow.js",  # window.QB_FLOW: the flowchart pages
    "anchors.js",  # generated arrow routing for the flowchart SVGs
    "cards.js",  # window.QB_CARDS
    "ref.js",  # glossary, rules, rulings, turn sequence
    "engine.js",  # window.QB: game state, dice, cards, priorities
    "walk.js",  # extends window.QB with the flowchart walker
    "debug.js",  # window.QB_DEBUG: action history and error capture
    "ui.js",  # window.QBUI: rendering, undo, autosave
    "modals.js",  # the modal dialogs
]
HEAD = """<title>Queller Bot Runner</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
"""


def read_source(name):
    return (SRC / name).read_text(encoding="utf-8")


def build_page(built_at):
    """The whole page: fonts, the stylesheet, the app root, then every script with the build time stamped first."""
    scripts = "".join(read_source(name).rstrip("\n") + "\n\n" for name in SOURCE_ORDER)
    return (
        HEAD
        + "<style>\n"
        + read_source("styles.css")
        + "</style>\n"
        + '<div class="wrap" id="app"></div>\n'
        + "<script>\n"
        + 'window.QB_BUILT="' + built_at + '"; // build time (shown in the debug log)\n'
        + scripts
        + "</script>\n"
    )


def main():
    built_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    page = build_page(built_at)
    OUT.write_text(page, encoding="utf-8")
    print("index.html:", len(page), "bytes")


if __name__ == "__main__":
    main()
