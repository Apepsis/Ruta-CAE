#!/usr/bin/env python3
"""Rebuild app/data/cefr-words.js: English word -> CEFR band from word frequency.
Same idea as Flexi-Desk's nlp.rs (Zipf frequency -> level), recalibrated so the
bands separate B2 / C1 / C2 better. Requires: pip install wordfreq
Data: wordfreq (Apache-2.0 code, CC BY-SA 4.0 data) https://github.com/rspeer/wordfreq"""
import re, json, pathlib
from wordfreq import top_n_list, zipf_frequency as z
T = [('A1', 5.1), ('A2', 4.6), ('B1', 4.1), ('B2', 3.6), ('C1', 2.9)]
out = {k: [] for k, _ in T}; seen = set()
for w in top_n_list('en', 150000):
    if not re.fullmatch(r"[a-z]+(?:[-'][a-z]+)?", w) or w in seen: continue
    seen.add(w); f = z(w, 'en')
    if f < 2.9: break
    for k, t in T:
        if f >= t: out[k].append(w); break
root = pathlib.Path(__file__).resolve().parent.parent
js = ('/* English word -> CEFR estimate from word frequency (wordfreq Zipf; data CC BY-SA 4.0, github.com/rspeer/wordfreq). '
      'Words not listed are treated as C2/rare. Same method as Flexi-Desk nlp.rs, recalibrated for C1/C2. */\n'
      'window.CEFR_BANDS=' + json.dumps({k: ' '.join(v) for k, v in out.items()}) + ';\n')
(root / 'app/data/cefr-words.js').write_text(js)
print({k: len(v) for k, v in out.items()})
