'use strict';
/* ============================================================
   Ruta C2 — answer sheet for outside tests (Resource Bank).
   You do the test on the other site; you answer and mark here, item by item.
   Every item joins your statistics by exam part, and every miss can become
   a practice question (Claude rebuilds it from the text you paste).
   ============================================================ */
const SHEET_PARTS = {
  P1: {paper: 'uoe', name: 'UoE Part 1 · Multiple-choice cloze', n: 8, type: 'mc', L: 4, first: 1},
  P2: {paper: 'uoe', name: 'UoE Part 2 · Open cloze', n: 8, type: 'txt', first: 9},
  P3: {paper: 'uoe', name: 'UoE Part 3 · Word formation', n: 8, type: 'txt', first: 17},
  P4: {paper: 'uoe', name: 'UoE Part 4 · Key word transformations', n: 6, type: 'txt', marks: 2, first: 25},
  P5: {paper: 'reading', name: 'Reading Part 5 · Multiple choice', n: 6, type: 'mc', L: 4, first: 31},
  P6: {paper: 'reading', name: 'Reading Part 6 · Cross-text matching', n: 4, type: 'mc', L: 4, first: 37},
  P7: {paper: 'reading', name: 'Reading Part 7 · Gapped text', n: 6, type: 'mc', L: 7, first: 41},
  P8: {paper: 'reading', name: 'Reading Part 8 · Multiple matching', n: 10, type: 'mc', L: 6, first: 47},
  L1: {paper: 'listening', name: 'Listening Part 1 · Three extracts', n: 6, type: 'mc', L: 3, first: 1},
  L2: {paper: 'listening', name: 'Listening Part 2 · Sentence completion', n: 8, type: 'txt', first: 7},
  L3: {paper: 'listening', name: 'Listening Part 3 · Interview', n: 6, type: 'mc', L: 4, first: 15},
  L4: {paper: 'listening', name: 'Listening Part 4 · Multiple matching', n: 10, type: 'mc', L: 8, first: 21},
};
const PART_TOPIC_GUESS = {P1: 'coll', P2: 'link', P3: 'wf', P4: 'inv', P5: 'read', P6: 'read', P7: 'read', P8: 'read'};
function sheetParts(r) {
  const f = resFields(r);
  return Object.keys(SHEET_PARTS).filter(p => f.includes(SHEET_PARTS[p].paper));
}
function openSheet(r) {
  const saved = lsGet('rc2_sheet_' + (r?.k ?? 'custom'), null);
  App.sheet = saved && saved.rk === (r?.k ?? null) ? saved : {rk: r?.k ?? null, src: r ? r.t : '', phase: 'answer', t0: Date.now(), parts: Object.fromEntries((r ? sheetParts(r) : Object.keys(SHEET_PARTS)).map(p => [p, {on: true, ans: [], key: [], mk: []}]))};
  setTab('resources');
}
function saveSheet() { const S = App.sheet; if (S) lsSet('rc2_sheet_' + (S.rk ?? 'custom'), S); }
function viewSheet() {
  const S = App.sheet, r = RESOURCES.find(x => x.k === S.rk);
  const on = Object.keys(S.parts).filter(p => S.parts[p].on);
  const mark = S.phase === 'mark';
  const letterBtns = (p, i, field, val) => { const P = SHEET_PARTS[p]; return [...LETTERS.slice(0, P.L)].map(l => `<button class="opt ${val === l ? 'sel' : ''}" data-p="${p}" data-i="${i}" data-f="${field}" data-v="${l}" aria-label="Q${P.first + i} ${l}">${l}</button>`).join(''); };
  const autoOk = (p, i) => { const P = SHEET_PARTS[p], s = S.parts[p]; const a = s.ans[i], k = s.key[i]; if (!k) return null; if (P.type === 'mc') return a === k; return k.split('/').some(x => norm(x) === norm(a)); };
  $('#app').innerHTML = `<div class="view fade">
    <div class="row between"><button class="btn ghost sm" id="shx">← Resources</button><span class="small muted">${mark ? 'Step 2 of 2 · mark it' : 'Step 1 of 2 · answer'}</span></div>
    <div class="panel stack"><div class="eyebrow">Answer sheet</div>
      ${r ? `<h2 style="font-size:21px">${esc(r.t)}</h2><div class="row"><a class="btn accent" href="${esc(r.u)}" target="_blank" rel="noopener" style="text-decoration:none">Open the test ↗</a><span class="small muted">Do the test there, write your answers here. Your answers are kept if you leave and come back.</span></div>`
        : `<input type="text" id="shsrc" placeholder="Which test is it? e.g. Cambridge book 4, Test 2" value="${esc(S.src)}">`}
      ${mark ? '<p class="small muted" style="margin:0">Now copy the answer key in. Ruta marks each item; tap ✓/✗ to override (e.g. an alternative answer the key accepts). For Part 4, give 0, 1 or 2 marks.</p>' : `<div class="row small">${Object.keys(S.parts).map(p => `<label class="chip" style="cursor:pointer"><input type="checkbox" data-on="${p}" ${S.parts[p].on ? 'checked' : ''}> ${p}</label>`).join('')}<span class="muted">Untick the parts you're not doing.</span></div>`}
    </div>
    ${on.map(p => { const P = SHEET_PARTS[p], s = S.parts[p]; return `<div class="panel stack"><h2>${esc(P.name)}</h2><div class="stack" style="gap:8px">${[...Array(P.n).keys()].map(i => {
      const q = P.first + i, a = s.ans[i] || '';
      let row = `<b class="num" style="min-width:30px">${q}</b>`;
      row += P.type === 'mc' ? `<div class="opts">${letterBtns(p, i, 'ans', a)}</div>` : `<input class="shin" data-p="${p}" data-i="${i}" data-f="ans" value="${esc(a)}" aria-label="Answer ${q}" autocomplete="off" spellcheck="false" style="flex:1;min-width:140px">`;
      if (mark) {
        const ok = s.mk[i] != null ? s.mk[i] : autoOk(p, i);
        row += `<span class="small muted">key</span>` + (P.type === 'mc' ? `<div class="opts">${letterBtns(p, i, 'key', s.key[i])}</div>` : `<input class="shin" data-p="${p}" data-i="${i}" data-f="key" value="${esc(s.key[i] || '')}" placeholder="a/b if several" aria-label="Key ${q}" autocomplete="off" spellcheck="false" style="flex:1;min-width:120px">`);
        row += P.marks ? `<div class="seg">${[0, 1, 2].map(m => `<button data-mk="${p}:${i}:${m}" aria-pressed="${(s.mk[i] ?? (ok ? 2 : ok === false ? 0 : -1)) === m}">${m}</button>`).join('')}</div>`
          : `<button class="btn sm ${ok ? '' : ''}" data-tog="${p}:${i}" style="min-width:44px;${ok === true ? 'border-color:var(--good);color:var(--good)' : ok === false ? 'border-color:var(--bad);color:var(--bad)' : ''}">${ok === true ? '✓' : ok === false ? '✗' : '?'}</button>`;
      }
      return `<div class="row" style="gap:8px;flex-wrap:nowrap;overflow-x:auto">${row}</div>`;
    }).join('')}</div></div>`; }).join('')}
    <div class="panel row between"><span class="small muted" id="shmsg"></span>${mark ? '<span class="row"><button class="btn ghost" id="shback">← Edit answers</button><button class="btn accent" id="shsave">Save results</button></span>' : '<button class="btn accent" id="shnext">I\'ve finished: mark it →</button>'}</div></div>`;
  $('#shx').onclick = () => { saveSheet(); App.sheet = null; render(); };
  if ($('#shsrc')) $('#shsrc').oninput = e => { S.src = e.target.value; saveSheet(); };
  $$('[data-on]').forEach(b => b.onchange = () => { S.parts[b.dataset.on].on = b.checked; saveSheet(); viewSheet(); });
  $$('.opts [data-p]').forEach(b => b.onclick = () => { const s = S.parts[b.dataset.p]; s[b.dataset.f][+b.dataset.i] = b.dataset.v; if (b.dataset.f === 'key') s.mk[+b.dataset.i] = null; saveSheet(); viewSheet(); });
  $$('input.shin').forEach(inp => { inp.oninput = () => { const s = S.parts[inp.dataset.p]; s[inp.dataset.f][+inp.dataset.i] = inp.value; if (inp.dataset.f === 'key') s.mk[+inp.dataset.i] = null; saveSheet(); }; inp.onchange = () => { if (inp.dataset.f === 'key') viewSheet(); }; });
  $$('[data-tog]').forEach(b => b.onclick = () => { const [p, i] = b.dataset.tog.split(':'); const s = S.parts[p]; const cur = s.mk[+i] != null ? s.mk[+i] : autoOk(p, +i); s.mk[+i] = !cur; saveSheet(); viewSheet(); });
  $$('[data-mk]').forEach(b => b.onclick = () => { const [p, i, m] = b.dataset.mk.split(':'); S.parts[p].mk[+i] = +m; saveSheet(); viewSheet(); });
  if ($('#shnext')) $('#shnext').onclick = () => { if (!on.length) return toast('Tick at least one part'); S.phase = 'mark'; saveSheet(); viewSheet(); window.scrollTo(0, 0); };
  if ($('#shback')) $('#shback').onclick = () => { S.phase = 'answer'; saveSheet(); viewSheet(); };
  if ($('#shsave')) $('#shsave').onclick = () => {
    const items = []; const tot = {};
    for (const p of on) { const P = SHEET_PARTS[p], s = S.parts[p];
      for (let i = 0; i < P.n; i++) {
        let ok = s.mk[i] != null ? s.mk[i] : autoOk(p, i);
        if (ok == null) continue;
        let marks = P.marks ? (typeof ok === 'number' ? ok : ok ? 2 : 0) : (ok ? 1 : 0);
        items.push({part: p, n: P.first + i, ch: s.ans[i] || '', key: s.key[i] || '', ok: marks === (P.marks || 1), marks});
        const t = tot[P.paper] = tot[P.paper] || [0, 0]; t[0] += marks; t[1] += P.marks || 1;
      } }
    if (!items.length) return $('#shmsg').textContent = 'Enter the key for at least one item.';
    const src = r ? r.t : (S.src || 'Outside test');
    const x = {k: uid(), t: Date.now(), res: S.rk, src, items, ...tot};
    Store.ext.push(x); Store.touch('ext/' + x.k);
    if (r) setResDone(r.k, true);
    try { localStorage.removeItem('rc2_sheet_' + (S.rk ?? 'custom')); } catch (e) {}
    computeModel();
    App.sheet = null; App.extView = x.k; render();
    toast('Saved: ' + items.filter(i => i.ok).length + '/' + items.length + ' correct');
  };
}
/* result of one outside test: misses become practice questions */
function viewExtResult() {
  const x = Store.ext.find(e => e.k === App.extView);
  if (!x) { App.extView = null; return render(); }
  const miss = (x.items || []).filter(i => !i.ok);
  const byPart = {}; for (const it of x.items || []) { const b = byPart[it.part] = byPart[it.part] || [0, 0]; b[0] += it.marks; b[1] += SHEET_PARTS[it.part].marks || 1; }
  $('#app').innerHTML = `<div class="view fade"><div class="row between"><button class="btn ghost sm" id="exx">← Resources</button></div>
    <div class="panel stack"><div class="eyebrow">Outside test · ${new Date(x.t).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}</div><h2 style="font-size:21px">${esc(x.src)}</h2>
      <div class="grid3">${['uoe', 'reading', 'listening'].filter(p => x[p]).map(p => `<div class="stat"><span class="small muted">${PAPERS[p]}</span><b>${x[p][0]}/${x[p][1]}</b>${gradeChip(toScale(x[p][0] / x[p][1]))}</div>`).join('')}</div>
      <div class="bars">${Object.entries(byPart).map(([p, [c, m]]) => `<div class="bar"><span>${p} · ${esc(SHEET_PARTS[p].name.split('·')[1] || '')}</span><span class="meter"><i style="width:${c / m * 100}%;background:var(--${c / m >= .8 ? 'good' : c / m >= .6 ? 'warn' : 'bad'})"></i></span><span class="num">${c}/${m}</span></div>`).join('')}</div>
      <p class="small muted" style="margin:0">These marks now count in your estimate and in “Accuracy by exam part” on Progress.</p></div>
    ${miss.length ? `<div class="panel stack"><h2>Turn your ${miss.length} misses into practice</h2>
      <p class="small muted" style="margin:0">Copy the questions you missed from the test page (the sentence or question, plus the options if there are any) and paste them below. Claude rebuilds each one as a Ruta question, explains why you missed it, and it comes back in your sessions until you get it right. Your answers and the key are added automatically.</p>
      <div class="loglist">${miss.map(m => `<div class="logi"><span><b>${m.part} · Q${m.n}</b> <span class="small muted">you: ${esc(m.ch || '—')} · key: ${esc(m.key)}</span></span>${m.imported ? '<span class="chip good">in practice</span>' : ''}</div>`).join('')}</div>
      ${SAMPLE ? `<textarea id="exq" rows="7" placeholder="Q4. The film didn't ___ up to the hype.  A measure  B live  C keep  D stand&#10;Q19. The ___ of the river at this point is about 200 metres. (WIDE)"></textarea>
      <div class="row"><button class="btn accent" id="eximp">Add them to my practice</button><button class="btn" id="extwin">Write new questions like the ones I missed</button><span class="small" id="exmsg"></span></div>` : '<p class="small muted">Claude isn\'t available in this view.</p>'}</div>` : '<div class="panel"><p style="margin:0">No misses. Excellent.</p></div>'}</div>`;
  $('#exx').onclick = () => { App.extView = null; render(); };
  if ($('#eximp')) $('#eximp').onclick = async () => {
    const txt = $('#exq').value.trim(); if (!txt) return toast('Paste the questions first');
    const ctx = miss.map(m => `${m.part} Q${m.n}: student answered "${m.ch || '(blank)'}", correct answer "${m.key}"`).join('\n');
    $('#eximp').disabled = true; $('#exmsg').innerHTML = '<span class="thinking">Claude is rebuilding your questions</span>';
    try {
      const got = await aiImportMistakes(`ANSWERS FROM THE ANSWER SHEET:\n${ctx}\n\nQUESTIONS (pasted):\n${txt}`, x.src);
      if (got.length >= miss.length) for (const m of miss) m.imported = true;
      x.imported = (x.imported || 0) + got.length; Store.touch('ext/' + x.k);
      toast(got.length + ' question' + (got.length === 1 ? '' : 's') + ' added to your practice');
      viewExtResult();
    } catch (e) { $('#eximp').disabled = false; $('#exmsg').textContent = 'That didn\'t work. Check the text and try again.'; }
  };
  if ($('#extwin')) $('#extwin').onclick = async () => {
    const parts = [...new Set(miss.map(m => m.part).filter(p => /^P[1-4]$/.test(p)))];
    if (!parts.length) return toast('Twin questions are for Use of English parts');
    const p = parts[0], partNo = +p[1];
    const tp = Object.entries(M.S).filter(([k]) => (GEN_PARTS[k] || []).includes(partNo)).sort((a, b) => b[1].prio - a[1].prio)[0]?.[0] || PART_TOPIC_GUESS[p];
    $('#extwin').disabled = true; $('#exmsg').innerHTML = '<span class="thinking">Claude is writing new ' + p + ' questions</span>';
    try { const items = await aiGenerate(tp, 6, [partNo]); App.prac = {...App.prac, mode: 'topic', tp, cur: {q: items[0], why: 'New ' + p + ' item modelled on your outside test.'}}; App.extView = null; setTab('practice'); }
    catch (e) { $('#extwin').disabled = false; $('#exmsg').textContent = 'That didn\'t work. Try again.'; }
  };
}
/* accuracy by exam part across the app and outside tests */
function partAccuracy() {
  const acc = {};
  const add = (p, c, m, src) => { const a = acc[p] = acc[p] || {c: 0, m: 0, app: 0, ext: 0}; a.c += c; a.m += m; a[src] += m; };
  for (const a of Store.attempts) {
    if (a.src === 'card' || a.src === 'import') continue;
    if (a.paper === 'listening' && a.p) add(a.p, a.ok ? 1 : 0, 1, 'app');
    else if (a.p >= 1 && a.p <= 4) add('P' + a.p, a.ok ? 1 : 0, 1, 'app');
    else if (a.p >= 5 && a.p <= 8) add('P' + a.p, a.ok ? 1 : 0, 1, 'app');
  }
  for (const x of Store.ext) for (const it of x.items || []) add(it.part, it.marks, SHEET_PARTS[it.part].marks || 1, 'ext');
  return acc;
}
function partAccuracyHTML() {
  const acc = partAccuracy();
  const keys = Object.keys(SHEET_PARTS).filter(k => acc[k]);
  if (!keys.length) return '<p class="small muted">Appears once you answer questions here or log an outside test with the answer sheet.</p>';
  return `<div class="bars">${keys.map(k => { const a = acc[k], v = a.c / a.m, s = toScale(v); return `<div class="bar" style="grid-template-columns:minmax(0,230px) minmax(0,1fr) 90px"><span>${esc(SHEET_PARTS[k].name)} <span class="small muted">(${a.app ? a.app + ' here' : ''}${a.app && a.ext ? ' + ' : ''}${a.ext ? a.ext + ' outside' : ''})</span></span><span class="meter"><i style="width:${v * 100}%;background:var(--g${gradeOf(s).k})"></i></span><span class="num small">${pct(v)} <span class="grade ${gradeOf(s).k}">${gradeOf(s).k === 'B2' ? 'B2' : gradeOf(s).k}</span></span></div>`; }).join('')}</div>`;
}
