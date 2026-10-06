'use strict';
/* ============================================================
   Ruta CAE — Captured words (FlexiLingo's "tap a word → save it").
   Words come from the Media Lab, the Tutor, the browser extension and
   any text you paste. Each one keeps the sentence you met it in, gets a
   CEFR estimate and a definition, and joins spaced repetition as a card.
   The Weekly Word Sheet turns a week of captures into a printable PDF
   with definitions, your sentences, a gap-fill quiz and the key.
   ============================================================ */
const CW = {
  KEY: 'rc2_capwords',          // rc2_ prefix → included in backups
  _list: null,
  all() { if (!this._list) this._list = lsGet(this.KEY, []); return this._list; },
  save() { lsSet(this.KEY, this._list || []); },
  find(w) { const k = cwKey(w); return this.all().find(x => x.k === k); },
  add(entry, {quiet} = {}) {
    const w = String(entry.w || '').trim().replace(/\s+/g, ' ');
    if (!w || w.length > 60) return null;
    const k = cwKey(w);
    let x = this.all().find(e => e.k === k);
    if (x) {
      if (entry.ctx && !(x.ctxs || []).some(c => c.s === entry.ctx)) (x.ctxs = x.ctxs || []).push({s: entry.ctx, src: entry.src || null, t: Date.now()});
      for (const f of ['def', 'pos', 'coll', 'ipa', 'audio']) if (entry[f] && !x[f]) x[f] = entry[f];
    } else {
      x = {k, w, L: entry.L || CEFR.levelOf(w) || 'C2', def: entry.def || '', pos: entry.pos || '', coll: entry.coll || '', ipa: entry.ipa || '', audio: entry.audio || '',
        ctxs: entry.ctx ? [{s: entry.ctx, src: entry.src || null, t: Date.now()}] : [], t: entry.t || Date.now(), from: entry.from || 'app'};
      this.all().push(x);
    }
    this.save(); registerCapCards();
    if (!quiet) toast('Saved “' + w + '” to Captured words');
    if (!x.def) lookupWord(w).then(d => { if (d && !x.def) { Object.assign(x, {def: d.def, pos: x.pos || d.pos, ipa: x.ipa || d.ipa, audio: x.audio || d.audio}); this.save(); registerCapCards(); } }).catch(() => {});
    return x;
  },
  remove(k) { this._list = this.all().filter(x => x.k !== k); this.save(); CARDS.delete('cw:' + k); },
  week(offset = 0) { const [a, b] = weekRange(offset); return this.all().filter(x => x.t >= a && x.t < b); },
};
window.CW = CW;
function cwKey(w) { return String(w).toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z' -]/g, '').trim(); }
function weekRange(offset = 0) { // Monday 00:00 → next Monday
  const d = new Date(); d.setHours(0, 0, 0, 0); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow + offset * 7);
  const e = new Date(d); e.setDate(e.getDate() + 7); return [d.getTime(), e.getTime()];
}
DECKS.push({id: 'cw', name: 'Captured words', tp: 'tvoc', list: []});
function registerCapCards() {
  for (const x of CW.all()) {
    const id = 'cw:' + x.k;
    const ex = x.ctxs?.[0]?.s || '';
    CARDS.set(id, {id, deck: 'cw', tp: 'tvoc', front: x.w, back: (x.def || '(meaning pending)') + (x.coll ? '  ·  ' + x.coll : ''), ex: ex ? clozeOf(ex, x.w, '…') : '', pos: x.pos});
  }
}
function clozeOf(sentence, w, blank = '_____') {
  const re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\w*', 'i');
  return re.test(sentence) ? sentence.replace(re, blank) : sentence;
}
registerCapCards();

/* free dictionary (no key) → definition, POS, IPA, audio */
const DICT_CACHE = new Map();
async function lookupWord(w) {
  const k = cwKey(w); if (DICT_CACHE.has(k)) return DICT_CACHE.get(k);
  const p = (async () => {
    try {
      const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(k), {signal: AbortSignal.timeout?.(7000)});
      if (!r.ok) return null;
      const j = await r.json(); const e = j[0]; if (!e) return null;
      const m = e.meanings?.[0]; const d = m?.definitions?.[0];
      return {def: d?.definition || '', pos: ({noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv'})[m?.partOfSpeech] || m?.partOfSpeech || '', ex: d?.example || '',
        ipa: e.phonetic || e.phonetics?.find(x => x.text)?.text || '', audio: e.phonetics?.find(x => x.audio)?.audio || '',
        all: (e.meanings || []).slice(0, 3).map(mm => ({pos: mm.partOfSpeech, defs: (mm.definitions || []).slice(0, 2).map(dd => dd.definition), syn: (mm.synonyms || []).slice(0, 5)}))};
    } catch (err) { return null; }
  })();
  DICT_CACHE.set(k, p); return p;
}
/* AI: meaning in context + C1 usage, for the word popover */
async function aiWordInContext(w, sentence) {
  return aiJSON(`${EXAMINER}
A C1 Advanced candidate tapped the word or phrase "${w}" in this sentence:
"""${sentence.slice(0, 600)}"""
Explain it for exam use. If "${w}" is part of a phrasal verb, collocation or idiom in this sentence, explain the whole chunk and give it in "chunk".
${langLine()} (keep examples and collocations in English)
Respond ONLY with JSON: {"chunk":"the exact chunk to learn (may equal the word)","pos":"n|v|adj|adv|phrase","cefr":"B2|C1|C2","def":"meaning in this context, learner-friendly","register":"neutral|formal|informal|literary|slang","coll":"2-3 typical collocations separated by ;","syn":"1-3 synonyms","example":"a new natural example sentence","exam":"how it could appear in the CAE (e.g. Part 1 collocation, Part 3 word family, Writing register)"}`, {tier: 'quick', cache: true});
}
async function aiDefineCaptured(list) {
  const todo = list.filter(x => !x.def || !x.coll).slice(0, 40);
  if (!todo.length) return 0;
  const r = await aiJSON(`${EXAMINER}
For each English word or phrase (each with the sentence the student met it in), give part of speech, a learner-friendly definition FOR THAT CONTEXT, one typical collocation, and the CEFR level (B1|B2|C1|C2).
${langLine()} (collocations stay in English)
ITEMS: ${JSON.stringify(todo.map(x => ({w: x.w, ctx: x.ctxs?.[0]?.s?.slice(0, 220) || ''})))}
Respond ONLY with JSON: {"items":[{"w":"as given","pos":"n|v|adj|adv|phrase","def":"…","coll":"…","cefr":"C1"}]}`, {tier: 'default'});
  let n = 0;
  for (const it of r?.items || []) { const x = todo.find(y => y.w === it.w); if (!x) continue; x.pos = x.pos || it.pos || ''; x.def = it.def || x.def; x.coll = x.coll || it.coll || ''; if (/^(B1|B2|C1|C2)$/.test(it.cefr)) x.Lai = it.cefr; n++; }
  CW.save(); registerCapCards(); return n;
}

/* ---------- word popover (used by Media Lab, Tutor, pasted texts) ---------- */
function openWordPopover(anchor, w, sentence, src) {
  closeWordPopover();
  const L = CEFR.levelOf(w) || '—';
  const pop = document.createElement('div'); pop.className = 'wpop'; pop.setAttribute('role', 'dialog');
  const saved = CW.find(w);
  pop.innerHTML = `<div class="row between"><b class="wpw">${esc(w)}</b><span class="lvl lvl-${L}">${L}</span></div>
    <div class="wpdef small"><span class="thinking">Looking it up</span></div>
    <div class="row" style="gap:6px"><button class="btn sm accent" data-wsave>${saved ? 'Saved ✓' : 'Save word'}</button>${SAMPLE ? '<button class="btn sm" data-wai>Explain in context</button>' : ''}<button class="btn sm ghost" data-wx>✕</button></div>
    <div class="wpai small"></div>`;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const top = r.bottom + window.scrollY + 6, left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 330);
  pop.style.top = top + 'px'; pop.style.left = Math.max(8, left) + 'px';
  let chunk = w, aiRes = null;
  lookupWord(w).then(d => {
    const box = $('.wpdef', pop); if (!box) return;
    box.innerHTML = d ? `${d.ipa ? `<span class="muted">${esc(d.ipa)}</span> ` : ''}${d.audio ? `<button class="btn sm ghost" data-wplay aria-label="Play pronunciation">🔊</button>` : ''}<div><i>${esc(d.pos)}</i> ${esc(d.def)}</div>${d.ex ? `<div class="muted"><i>${esc(d.ex)}</i></div>` : ''}${d.all?.[0]?.syn?.length ? `<div class="muted">≈ ${esc(d.all[0].syn.join(', '))}</div>` : ''}`
      : '<span class="muted">No dictionary entry (it may be a phrase or a name).</span>';
    if (d?.audio) $('[data-wplay]', pop).onclick = () => new Audio(d.audio).play().catch(() => {});
  });
  $('[data-wx]', pop).onclick = closeWordPopover;
  $('[data-wsave]', pop).onclick = () => {
    CW.add({w: chunk, ctx: sentence, src, def: aiRes?.def, pos: aiRes?.pos, coll: aiRes?.coll, L: aiRes?.cefr});
    $('[data-wsave]', pop).textContent = 'Saved ✓';
    anchor.classList?.add('saved');
  };
  if ($('[data-wai]', pop)) $('[data-wai]', pop).onclick = async () => {
    const box = $('.wpai', pop); box.innerHTML = '<span class="thinking">Thinking</span>';
    try {
      aiRes = await aiWordInContext(w, sentence || w); chunk = aiRes.chunk || w;
      box.innerHTML = `<div style="border-top:1px solid var(--line);padding-top:6px;margin-top:4px">${chunk !== w ? `<b>${esc(chunk)}</b> · ` : ''}<span class="lvl lvl-${esc(aiRes.cefr)}">${esc(aiRes.cefr)}</span> <span class="muted">${esc(aiRes.register)}</span><div>${esc(aiRes.def)}</div><div class="muted">${esc(aiRes.coll)}${aiRes.syn ? ' · ≈ ' + esc(aiRes.syn) : ''}</div><div><i>${esc(aiRes.example)}</i></div><div class="muted">CAE: ${esc(aiRes.exam)}</div></div>`;
      $('[data-wsave]', pop).textContent = CW.find(chunk) ? 'Saved ✓' : 'Save “' + chunk + '”';
    } catch (e) { box.textContent = aiErrText(e); }
  };
  setTimeout(() => document.addEventListener('mousedown', wpOutside, true), 0);
  document.addEventListener('keydown', wpEsc);
}
function wpOutside(e) { if (!e.target.closest('.wpop')) closeWordPopover(); }
function wpEsc(e) { if (e.key === 'Escape') closeWordPopover(); }
function closeWordPopover() { $$('.wpop').forEach(p => p.remove()); document.removeEventListener('mousedown', wpOutside, true); document.removeEventListener('keydown', wpEsc); }

/* render text with CEFR-coloured, clickable words */
function cefrHTML(text, {min = 'B2'} = {}) {
  const tk = CEFR.tokens(text); let out = '', p = 0;
  for (const t of tk) {
    out += esc(text.slice(p, t.i));
    const hl = t.L && CEFR.RANK[t.L] >= CEFR.RANK[min] && !t.stop;
    out += `<span class="tw${hl ? ' lv-' + t.L : ''}${CW.find(t.w) ? ' saved' : ''}" data-w="${esc(t.w)}">${esc(t.w)}</span>`;
    p = t.j;
  }
  return out + esc(text.slice(p));
}
function sentenceAround(text, i) {
  const s = Math.max(text.lastIndexOf('.', i - 1), text.lastIndexOf('?', i - 1), text.lastIndexOf('!', i - 1), text.lastIndexOf('\n', i - 1)) + 1;
  const ends = ['.', '?', '!', '\n'].map(c => text.indexOf(c, i)).filter(x => x >= 0);
  const e = ends.length ? Math.min(...ends) + 1 : text.length;
  return text.slice(s, e).trim();
}
/* make every .tw inside el clickable; getCtx(spanEl) → sentence */
function wireWords(el, getCtx, src) {
  el.addEventListener('click', e => {
    const s = e.target.closest('.tw'); if (!s) return;
    e.stopPropagation();
    openWordPopover(s, s.dataset.w, getCtx(s), src);
  });
}

/* ---------- Captured words panel (inside Vocabulary) ---------- */
function capturedPanelHTML() {
  const all = CW.all(), wk = CW.week(0), last = CW.week(-1);
  const byL = CEFR.LEVELS.map(L => [L, all.filter(x => (x.Lai || x.L) === L).length]);
  return `<div class="panel stack" id="cwpanel"><div class="row between"><div><h2>Captured words</h2><p class="small muted" style="margin:4px 0 0">Words you tapped in videos, podcasts, the tutor and websites (with the extension). Each keeps its sentence and becomes a flashcard.</p></div>
      <div class="row"><button class="btn accent" id="cwsheet">Weekly Word Sheet (PDF)</button><button class="btn" id="cwstudy" ${all.length ? '' : 'disabled'}>Study captured</button></div></div>
    <div class="row small"><span class="chip dark">${all.length} words</span><span class="chip">${wk.length} this week</span><span class="chip">${last.length} last week</span>${byL.filter(x => x[1]).map(([L, n]) => `<span class="lvl lvl-${L}">${L} ${n}</span>`).join('')}</div>
    <div class="row"><input type="text" id="cwadd" placeholder="Add a word or phrase…" style="flex:1;min-width:180px"><button class="btn" id="cwaddb">Add</button>${SAMPLE ? `<button class="btn" id="cwdef" ${all.some(x => !x.def || !x.coll) ? '' : 'disabled'}>AI: fill meanings & collocations</button>` : ''}<button class="btn ghost" id="cwanki" ${all.length ? '' : 'disabled'}>Export to Anki</button></div>
    ${all.length ? `<div class="tablewrap"><table class="t cwt"><thead><tr><th>Word</th><th>Level</th><th>Meaning</th><th>Met in</th><th></th></tr></thead><tbody>${all.slice().reverse().slice(0, 60).map(x => `<tr><td><b>${esc(x.w)}</b>${x.pos ? ` <i class="muted small">${esc(x.pos)}</i>` : ''}</td><td><span class="lvl lvl-${esc(x.Lai || x.L)}">${esc(x.Lai || x.L)}</span></td><td class="small">${esc(x.def || '…')}${x.coll ? `<div class="muted">${esc(x.coll)}</div>` : ''}</td><td class="small muted" style="max-width:280px">${x.ctxs?.[0] ? `<i>${esc(x.ctxs[0].s.slice(0, 140))}</i>${x.ctxs[0].src?.title ? `<div>${esc(x.ctxs[0].src.title.slice(0, 60))}</div>` : ''}` : ''}</td><td><button class="btn sm ghost" data-cwdel="${esc(x.k)}" aria-label="Delete ${esc(x.w)}">✕</button></td></tr>`).join('')}</tbody></table></div>${all.length > 60 ? `<p class="small muted" style="margin:0">Showing the latest 60 of ${all.length}.</p>` : ''}` : '<p class="small muted" style="margin:0">Nothing captured yet. Open the Media Lab, or install the extension and tap words on YouTube.</p>'}
  </div>`;
}
function wireCaptured() {
  const p = $('#cwpanel'); if (!p) return;
  $('#cwsheet').onclick = () => openWeeklySheet();
  $('#cwstudy').onclick = () => {
    const list = [...dueCards('tvoc').filter(c => c.deck === 'cw'), ...[...CARDS.values()].filter(c => c.deck === 'cw' && !Store.cards[c.id])].slice(0, 25);
    if (!list.length) return toast('No captured words are due');
    App.cardRun = {title: 'Captured words', list}; render();
  };
  const add = () => { const v = $('#cwadd').value.trim(); if (!v) return; CW.add({w: v, from: 'manual'}); render(); };
  $('#cwaddb').onclick = add; $('#cwadd').onkeydown = e => { if (e.key === 'Enter') add(); };
  if ($('#cwdef')) $('#cwdef').onclick = async () => { $('#cwdef').disabled = true; $('#cwdef').textContent = 'Working…'; try { const n = await aiDefineCaptured(CW.all()); toast(n + ' words completed'); } catch (e) { toast(aiErrText(e)); } render(); };
  $('#cwanki').onclick = () => exportAnki('Ruta CAE — Captured words', CW.all().map(x => [x.w, (x.def || '') + (x.coll ? '<br><i>' + x.coll + '</i>' : ''), x.ctxs?.[0]?.s || '', x.Lai || x.L]));
  $$('[data-cwdel]').forEach(b => b.onclick = () => { CW.remove(b.dataset.cwdel); render(); });
  // the generic deck grid binds all decks; captured-words deck needs its own pick
  const d = $('[data-deck="cw"]'); if (d) d.onclick = () => $('#cwstudy').click();
}
hookView('cards', () => {
  if (App.cardRun || App.vt) return;
  const v = $('#app .view'); if (!v) return;
  v.children[0].insertAdjacentHTML('afterend', capturedPanelHTML());
  wireCaptured();
});

/* Anki: tab-separated text, which Anki imports directly (File → Import) */
function exportAnki(deckName, rows) {
  const clean = s => String(s ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  const txt = `#separator:tab\n#html:true\n#deck:${deckName}\n#columns:Front\tBack\tExample\tTags\n` + rows.map(r => [r[0], r[1], r[2], 'ruta-cae ' + (r[3] || '')].map(clean).join('\t')).join('\n');
  downloadFile(deckName.replace(/[^\w]+/g, '-').toLowerCase() + '.txt', txt, 'text/plain');
  toast('Anki file downloaded: in Anki, File → Import');
}

/* ---------- Weekly Word Sheet ---------- */
function openWeeklySheet(offset = 0) {
  const o = $('#overlay');
  const [a, b] = weekRange(offset);
  const words = CW.all().filter(x => x.t >= a && x.t < b);
  const fmt = t => new Date(t).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
  o.innerHTML = `<div class="modal"><div class="panel stack" style="max-width:640px">
    <div class="row between"><h2>Weekly Word Sheet</h2><button class="btn ghost sm" id="wsx">Close</button></div>
    <div class="row"><button class="btn sm" id="wsprev">←</button><b>${fmt(a)} – ${fmt(b - 1)}</b><button class="btn sm" id="wsnext" ${offset >= 0 ? 'disabled' : ''}>→</button><span class="chip">${words.length} words</span></div>
    <p class="small muted" style="margin:0">A printable sheet of every word you captured this week: meaning, level, collocation and the sentence you met it in, then a gap-fill quiz built from your own sentences and the answer key. In the print dialog choose “Save as PDF”.</p>
    ${words.some(x => !x.def) && SAMPLE ? '<label class="row small"><input type="checkbox" id="wsfill" checked> Fill missing meanings with AI first</label>' : ''}
    <label class="row small"><input type="checkbox" id="wsall"> Include all captured words (not only this week)</label>
    <div class="row"><button class="btn accent" id="wsgo" ${words.length || CW.all().length ? '' : 'disabled'}>Create PDF</button><span class="small" id="wsmsg"></span></div></div></div>`;
  $('#wsx').onclick = () => o.innerHTML = '';
  $('#wsprev').onclick = () => openWeeklySheet(offset - 1);
  $('#wsnext').onclick = () => openWeeklySheet(offset + 1);
  $('#wsgo').onclick = async () => {
    const list = $('#wsall').checked ? CW.all() : words;
    if (!list.length) return toast('No words in this week');
    if ($('#wsfill')?.checked) { $('#wsmsg').innerHTML = '<span class="thinking">Completing meanings</span>'; try { for (let i = 0; i < 3 && list.some(x => !x.def); i++) await aiDefineCaptured(list); } catch (e) {} }
    $('#wsmsg').textContent = '';
    printWordSheet(list, $('#wsall').checked ? 'All captured words' : `Week of ${fmt(a)} – ${fmt(b - 1)}`);
  };
}
function printWordSheet(list, title) {
  const rows = list.slice().sort((x, y) => CEFR.RANK[y.Lai || y.L] - CEFR.RANK[x.Lai || x.L] || x.w.localeCompare(y.w));
  const quiz = rows.filter(x => x.ctxs?.[0]?.s && clozeOf(x.ctxs[0].s, x.w) !== x.ctxs[0].s).slice(0, 20);
  const shuffled = shuffleIdx(quiz.length, title).map(i => quiz[i]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ruta CAE — ${esc(title)}</title><style>
    @page{size:A4;margin:14mm}
    body{font:11pt/1.45 Georgia,'Times New Roman',serif;color:#111;margin:0}
    h1{font:700 20pt/1.1 system-ui,sans-serif;margin:0}
    h2{font:700 13pt system-ui,sans-serif;margin:18px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}
    .meta{font:9pt system-ui,sans-serif;color:#555;margin:4px 0 12px}
    table{width:100%;border-collapse:collapse;font-size:10pt}
    th{font:700 8pt system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em;text-align:left;border-bottom:1.5px solid #111;padding:4px}
    td{border-bottom:1px solid #ccc;padding:5px 4px;vertical-align:top}
    tr{break-inside:avoid}
    .w{font-weight:700;font-family:system-ui,sans-serif}
    .lv{font:700 8pt ui-monospace,monospace;border:1px solid #111;border-radius:3px;padding:0 3px}
    .ctx{font-style:italic;color:#333}
    .mine{height:16px;border-bottom:1px dotted #999}
    ol li{margin:0 0 7px;break-inside:avoid}
    .bank{font:10pt system-ui,sans-serif;border:1.5px solid #111;padding:6px 8px;margin:6px 0 10px;line-height:1.8}
    .key{font:9pt system-ui,sans-serif;color:#333;columns:3}
    .foot{font:8pt system-ui,sans-serif;color:#777;margin-top:16px}
  </style></head><body>
  <h1>Weekly Word Sheet</h1><div class="meta">Ruta CAE · ${esc(title)} · ${rows.length} words · C1 Advanced</div>
  <h2>1 · Your words</h2>
  <table><thead><tr><th style="width:18%">Word</th><th style="width:6%">Level</th><th style="width:30%">Meaning · collocation</th><th>Where you met it</th></tr></thead><tbody>
  ${rows.map(x => `<tr><td class="w">${esc(x.w)}${x.pos ? ` <span style="font-weight:400;font-style:italic">${esc(x.pos)}</span>` : ''}${x.ipa ? `<div style="font-weight:400;color:#555;font-size:9pt">${esc(x.ipa)}</div>` : ''}</td><td><span class="lv">${esc(x.Lai || x.L)}</span></td><td>${esc(x.def || '')}${x.coll ? `<div style="color:#444;font-size:9pt">→ ${esc(x.coll)}</div>` : ''}</td><td class="ctx">${esc(x.ctxs?.[0]?.s?.slice(0, 220) || '')}${x.ctxs?.[0]?.src?.title ? `<div style="font:8pt system-ui;color:#777;font-style:normal">${esc(x.ctxs[0].src.title.slice(0, 70))}</div>` : ''}</td></tr>`).join('')}
  </tbody></table>
  <h2>2 · Write your own sentence</h2>
  <table><tbody>${rows.slice(0, 12).map(x => `<tr><td class="w" style="width:20%">${esc(x.w)}</td><td><div class="mine"></div></td></tr>`).join('')}</tbody></table>
  ${shuffled.length >= 3 ? `<h2>3 · Gap-fill (your own sentences)</h2>
  <div class="bank">${shuffled.map(x => esc(x.w)).sort().join(' · ')}</div>
  <ol>${shuffled.map(x => `<li>${esc(clozeOf(x.ctxs[0].s.slice(0, 260), x.w))}</li>`).join('')}</ol>
  <h2>Key</h2><div class="key">${shuffled.map((x, i) => `${i + 1}. ${esc(x.w)}`).join('<br>')}</div>` : ''}
  <div class="foot">Review these words in Ruta CAE → Vocabulary → Captured words. Definitions: dictionaryapi.dev / AI. Levels are frequency-based estimates.</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { downloadFile('word-sheet.html', html, 'text/html'); return toast('Pop-up blocked: open the downloaded sheet and print it'); }
  w.document.open(); w.document.write(html); w.document.close();
}
