#!/usr/bin/env python3
"""Concatenate the split sources into the single-file artifact (index.html).
The Artifact host wraps the file in its own <!doctype>/<head>/<body>, so the page starts at <title>."""
import pathlib
SRC=pathlib.Path(__file__).parent/"src"
HEAD='''<title>Queller Bot Runner</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
'''
JS=["flow.js","anchors.js","cards.js","ref.js","engine.js","walk.js","debug.js","ui.js","modals.js"]
import datetime
built=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
out=HEAD+"<style>\n"+(SRC/"styles.css").read_text(encoding="utf-8")+"</style>\n"+'<div class="wrap" id="app"></div>\n<script>\n'+'window.QB_BUILT="'+built+'"; // build time (shown in the debug log)\n'
for f in JS: out+=(SRC/f).read_text(encoding="utf-8").rstrip("\n")+"\n\n"
out+="</script>\n"
(pathlib.Path(__file__).parent/"index.html").write_text(out,encoding="utf-8")
print("index.html:",len(out),"bytes")
