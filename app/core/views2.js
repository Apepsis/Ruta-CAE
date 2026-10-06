'use strict';
/* ============================================================
   Ruta C2 — views 2: Vocabulary (topic lists, LanGeek-style),
   Resources (Resource Bank inside the app), Write & Improve-style writing
   ============================================================ */

/* ---------------- speech (optional) ---------------- */
const canSpeak = (() => { try { return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function'; } catch (e) { return false; } })();
function speak(text) {
  if (!canSpeak) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = .92;
    const v = speechSynthesis.getVoices().find(x => /en-GB/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}

function speakLong(text) {
  if (!canSpeak || !text) return;
  try {
    speechSynthesis.cancel();
    const voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    const pick = (i) => voices.length ? voices[i % voices.length] : null;
    const who = {}; let k = 0;
    for (const raw of text.split(/\n+/)) {
      const m = raw.match(/^([A-Z][A-Za-z ]{0,14}):\s*(.*)$/);
      const spk = m ? m[1] : (Object.keys(who).length ? Object.keys(who).slice(-1)[0] : '_');
      const line = (m ? m[2] : raw).trim(); if (!line || /=/.test(line) && line.length < 40) continue;
      if (!(spk in who)) who[spk] = k++;
      const u = new SpeechSynthesisUtterance(line); u.lang = 'en-GB'; u.rate = .95; const v = pick(who[spk] * 3); if (v) u.voice = v;
      speechSynthesis.speak(u);
    }
  } catch (e) {}
}
window.speakLong = speakLong;
/* ---------------- vocabulary helpers ---------------- */
function vocabRow(word) { for (const t of allVocab()) { const w = t.words.find(x => x[0] === word); if (w) return w; } return null; }
function topicOfWord(word) { return allVocab().find(t => t.words.some(x => x[0] === word)); }
function vocabStats(t) {
  let learned = 0, seen = 0;
  for (const w of t.words) { const s = Store.cards['vc:' + w[0]]; if (s) { seen++; if (s[0] >= 2) learned++; } }
  return {learned, seen, total: t.words.length};
}
function nextVocabCards(n) { // next unseen words, finishing one topic before starting the next
  const out = [];
  for (const t of allVocab()) for (const w of t.words) { const id = 'vc:' + w[0]; if (!Store.cards[id] && CARDS.has(id) && !out.some(c => c.id === id)) out.push(CARDS.get(id)); if (out.length >= n) return out; }
  return out;
}
function blankWord(ex, word) {
  const stem = word.toLowerCase().split(' ')[0].slice(0, Math.max(3, Math.min(5, word.length - 1)));
  if (word.includes(' ')) { const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); const m = ex.match(re); if (m) return {text: ex.replace(m[0], '_____'), ans: m[0]}; return null; }
  const toks = ex.split(/(\s+)/);
  for (let i = 0; i < toks.length; i++) { const clean = toks[i].replace(/[^A-Za-z'-]/g, ''); if (clean.toLowerCase().startsWith(stem)) { toks[i] = toks[i].replace(clean, '_____'); return {text: toks.join(''), ans: clean}; } }
  return null;
}

/* ---------------- VOCABULARY tab ---------------- */
function viewVocab() {
  if (App.cardRun) return viewCards();
  if (App.vt) return viewVocabTopic();
  const lists = allVocab();
  const due = dueCards();
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel stack"><div class="row between"><div><h2>Vocabulary</h2><p class="small muted" style="margin:4px 0 0">C1 word lists by topic, LanGeek-style: learn each word with its meaning, example, collocation and pronunciation, then quiz yourself. Every word you learn joins your spaced-repetition deck.</p></div>
      <button class="btn accent" id="vdue" ${due.length ? '' : 'disabled'}>Review ${due.length} due cards</button></div>
      ${SAMPLE ? `<div class="row"><input type="text" id="vtheme" placeholder="Any topic, e.g. 'urban planning' or 'emotions at work'" style="flex:1;min-width:200px" aria-label="New topic"><button class="btn" id="vgen">Claude: make a C1 list</button></div>` : ''}
    </div>
    ${(Store.plists || []).length ? `<div class="panel stack"><h2>From your books</h2><div class="vgrid">${Store.plists.map(t => { const s = vocabStats(t); return `<button class="vtopic" data-vt="${t.id}"><b>${esc(t.name)}</b><span class="small muted">${s.total} words · ${s.learned} learned${t.words.some(w => !w[2]) ? ' · meanings pending' : ''}</span><span class="meter"><i style="width:${s.learned / s.total * 100}%"></i></span></button>`; }).join('')}</div></div>` : ''}
    <div class="panel stack"><h2>Topic word lists</h2><div class="vgrid">${lists.filter(t => !t.book).map(t => { const s = vocabStats(t); return `<button class="vtopic" data-vt="${t.id}"><b>${esc(t.name)}</b><span class="small muted">${s.total} words · ${s.learned} learned${t.gen ? ' · Claude-made' : ''}</span><span class="meter"><i style="width:${s.learned / s.total * 100}%"></i></span></button>`; }).join('')}</div>
      <p class="small muted" style="margin:0">More lists to browse: <a href="https://langeek.co/en/vocab/subcategory/915/learn" target="_blank" rel="noopener">LanGeek C1 vocabulary</a>. Words you meet there can go in a Claude-made list here so they enter your review cycle.</p></div>
    <div class="panel stack"><h2>Flashcard decks</h2><div id="decks"></div></div></div>`;
  $('#vdue').onclick = () => { App.cardRun = {title: 'All due cards', list: due.slice(0, 40)}; render(); };
  $$('[data-vt]').forEach(b => b.onclick = () => { App.vt = {id: b.dataset.vt, mode: 'learn', i: 0}; render(); });
  if ($('#vgen')) $('#vgen').onclick = async () => {
    const th = $('#vtheme').value.trim(); if (!th) return toast('Type a topic first');
    $('#vgen').disabled = true; $('#vgen').textContent = 'Writing…';
    try { const v = await aiVocabList(th); App.vt = {id: v.id, mode: 'learn', i: 0}; render(); } catch (e) { toast('That didn\'t work. Try again.'); $('#vgen').disabled = false; $('#vgen').textContent = 'Claude: make a C1 list'; }
  };
  // reuse deck grid from the flashcards view
  const box = $('#decks');
  box.innerHTML = `<div class="decks">${DECKS.map(d => {
    const ids = [...CARDS.values()].filter(c => c.deck === d.id).map(c => c.id);
    const boxes = [0, 0, 0, 0, 0, 0]; let seen = 0;
    for (const id of ids) { const s = Store.cards[id]; if (s) { boxes[s[0]]++; seen++; } }
    const dd = due.filter(c => c.deck === d.id).length, mx = Math.max(1, ...boxes);
    return `<button class="deck" data-deck="${d.id}"><b>${esc(d.name)}</b><span class="small muted">${ids.length} cards · ${seen} started · ${dd} due</span><span class="boxes">${boxes.map(b => `<i style="height:${4 + b / mx * 18}px;opacity:${b ? .9 : .2}"></i>`).join('')}</span><span class="small" style="color:var(--gA);font-weight:700">Study →</span></button>`;
  }).join('')}</div>`;
  $$('[data-deck]', box).forEach(b => b.onclick = () => {
    const d = DECKS.find(x => x.id === b.dataset.deck);
    const dd = dueCards(d.tp).filter(c => c.deck === d.id).slice(0, 20);
    const fresh = d.id === 'vc' ? nextVocabCards(20 - dd.length) : newCards(d.tp, 20 - dd.length).filter(c => c.deck === d.id);
    App.cardRun = {title: d.name, list: [...dd, ...fresh]}; render();
  });
}
function viewVocabTopic() {
  const V = App.vt, t = allVocab().find(x => x.id === V.id);
  if (!t) { App.vt = null; return render(); }
  const s = vocabStats(t);
  $('#app').innerHTML = `<div class="view fade">
    <div class="row between"><button class="btn ghost sm" id="vback">← All topics</button>
      <div class="seg">${[['learn', 'Learn'], ['quiz', 'Quiz'], ['list', 'Word list']].map(([k, l]) => `<button data-vm="${k}" aria-pressed="${V.mode === k}">${l}</button>`).join('')}</div></div>
    ${t.words.some(w => !w[2]) ? `<div class="panel row between"><span class="small">${t.words.filter(w => !w[2]).length} words in this list have no meaning yet (your book's wordlist only gives the word and its pronunciation).</span>${SAMPLE ? '<button class="btn sm accent" id="vdef">Claude: add meanings</button>' : ''}</div>` : ''}
    <div class="panel stack"><div class="row between"><div><div class="eyebrow">${t.book ? 'From your books' : 'C1 topic vocabulary'}${t.gen ? ' · Claude-made' : ''}</div><h2 style="font-size:24px">${esc(t.name)}</h2></div><span class="small muted">${s.learned}/${s.total} learned${/^https?:\/\//.test(t.src || '') ? ` · <a href="${esc(t.src)}" target="_blank" rel="noopener">see on LanGeek</a>` : t.src ? ` · ${esc(t.src)}` : ''}</span></div><div id="vbody"></div></div></div>`;
  $('#vback').onclick = () => { App.vt = null; render(); };
  if ($('#vdef')) $('#vdef').onclick = async () => { const b = $('#vdef'); b.disabled = true; b.textContent = 'Writing meanings…'; try { let n = 0, k; let guard = 0; do { k = await aiDefine(t); n += k; b.textContent = n + ' done…'; } while (k > 0 && t.words.some(w => !w[2]) && ++guard < 80); toast(n + ' meanings added'); } catch (e) { toast('That didn\'t work. Try again.'); } render(); };
  $$('[data-vm]').forEach(b => b.onclick = () => { V.mode = b.dataset.vm; V.i = 0; render(); });
  const body = $('#vbody');
  if (V.mode === 'list') {
    body.innerHTML = `<div class="tablewrap"><table class="t lex"><thead><tr><th>Word</th><th>Meaning</th><th>Collocation</th><th>Example</th></tr></thead><tbody>${t.words.map(w => { const st = Store.cards['vc:' + w[0]]; return `<tr><td>${esc(w[0])} <span class="small muted">${esc(w[1])}${w[5] ? ' ' + esc(w[5]) : ''}</span>${st ? ` <span class="chip ${st[0] >= 2 ? 'good' : 'warn'}">${st[0] >= 2 ? 'learned' : 'learning'}</span>` : ''}</td><td>${esc(w[2])}</td><td class="small">${esc(w[4] || '')}</td><td>${esc(w[3])}</td></tr>`; }).join('')}</tbody></table></div>`;
    return;
  }
  if (V.mode === 'quiz') {
    if (t.words.filter(w => w[2]).length < 4) { body.innerHTML = '<p class="muted">Add meanings to this list first.</p>'; return; }
    const pool = t.words.filter(w => w[2]).slice().sort(() => Math.random() - .5).slice(0, 10);
    mountVocabQuiz(body, pool, () => {}, {nextLabel: 'Back to the list', onNext: () => { V.mode = 'learn'; V.i = 0; render(); }, others: allVocab().flatMap(x => x.words)});
    return;
  }
  // learn mode: one word at a time
  const paint = () => {
    if (V.i >= t.words.length) {
      body.innerHTML = `<div class="stack" style="justify-items:start"><p style="margin:0;font-family:var(--f-read);font-size:18px">You've been through all ${t.words.length} words.</p><div class="row"><button class="btn accent" id="vq">Quiz me on this topic</button><button class="btn" id="vagain">Go through again</button></div></div>`;
      $('#vq').onclick = () => { V.mode = 'quiz'; render(); };
      $('#vagain').onclick = () => { V.i = 0; paint(); };
      return;
    }
    const w = t.words[V.i], st = Store.cards['vc:' + w[0]];
    body.innerHTML = `<div class="stack">
      <div class="dotsbar" aria-label="Progress">${t.words.map((x, i) => { const s2 = Store.cards['vc:' + x[0]]; return `<i class="${s2 && s2[0] >= 2 ? 'on' : ''} ${i === V.i ? 'cur' : ''}"></i>`; }).join('')}</div>
      <div class="wordcard">
        <div class="row between"><span class="chip">${esc(w[1])}</span><span class="small muted">${V.i + 1} / ${t.words.length}${st ? ' · in your deck' : ''}</span></div>
        <div class="row" style="gap:14px"><span class="w">${esc(w[0])}</span>${canSpeak ? `<button class="btn sm" id="vsay" aria-label="Pronounce ${esc(w[0])}">▶ Listen</button>` : ''}</div>
        ${w[5] ? `<div class="small muted" style="font-family:var(--f-mono)">${esc(w[5])}</div>` : ''}
        <div class="d">${w[2] ? esc(w[2]) : '<span class="muted">No meaning yet. Use “Add meanings” above.</span>'}</div>
        <div class="x">${esc(w[3])}</div>
        ${w[4] ? `<div class="c">Collocation: ${esc(w[4])}</div>` : ''}
      </div>
      <div class="row" style="justify-content:center"><button class="btn ghost" id="vprev" ${V.i ? '' : 'disabled'}>← Back</button><button class="btn" id="vknow">I already know it</button><button class="btn accent" id="vlearn">Add to my reviews →</button></div></div>`;
    if ($('#vsay')) $('#vsay').onclick = () => speak(w[0] + '. ' + w[3]);
    const card = CARDS.get('vc:' + w[0]);
    $('#vprev').onclick = () => { V.i--; paint(); };
    $('#vknow').onclick = () => { if (card && !st) rateCard(card, 3); V.i++; paint(); };
    $('#vlearn').onclick = () => { if (card) rateCard(card, st ? 2 : 1); V.i++; paint(); };
  };
  mountQuestion._key = e => {
    if (!body.isConnected || V.mode !== 'learn' || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') $('#vlearn')?.click(); else if (e.key === 'ArrowLeft') $('#vprev')?.click();
  };
  paint();
}
/* quiz: meaning → word, word → meaning, gap-fill */
function mountVocabQuiz(el, words, onResults, opts = {}) {
  const others = opts.others || allVocab().flatMap(x => x.words);
  const qs = words.map((w, i) => {
    const b = blankWord(w[3] || '', w[0]);
    const kind = b && i % 3 === 2 ? 'gap' : i % 2 ? 'w2d' : 'd2w';
    const dis = others.filter(o => o[0] !== w[0]).sort(() => Math.random() - .5).slice(0, 3);
    const opts4 = [w, ...dis].sort(() => Math.random() - .5);
    return {w, kind, b, opts4};
  });
  let i = 0; const res = [];
  const paint = () => {
    if (i >= qs.length) {
      const ok = res.filter(a => a.ok).length;
      el.innerHTML = `<div class="stack"><div class="verdict ${ok / res.length >= .7 ? 'ok' : 'no'}">${ok}/${res.length} correct</div>
        ${res.filter(a => !a.ok).length ? `<div class="loglist">${res.filter(a => !a.ok).map(a => { const w = vocabRow(a.word); return `<div class="logi" style="grid-template-columns:1fr"><b>${esc(a.word)}</b><span class="small">${esc(w?.[2] || '')}</span></div>`; }).join('')}</div><p class="small muted" style="margin:0">Missed words come back in your flashcards within minutes.</p>` : ''}
        <div><button class="btn accent" id="vqn">${opts.nextLabel || 'Continue'}</button></div></div>`;
      $('#vqn', el).onclick = () => opts.onNext?.();
      onResults(res); return;
    }
    const q = qs[i];
    let inner;
    if (q.kind === 'gap') inner = `<div class="eyebrow">Complete the sentence</div><div class="stem">${esc(q.b.text)}</div><div class="small muted">Starts with “${esc(q.b.ans[0])}” · ${q.b.ans.length} letters · meaning: ${esc(q.w[2])}</div><div class="ans"><input id="vin" autocomplete="off" spellcheck="false" aria-label="Your answer"><button class="btn primary" id="vsub">Check</button></div>`;
    else if (q.kind === 'd2w') inner = `<div class="eyebrow">Which word means…</div><div class="stem">${esc(q.w[2])}</div><div class="choices">${q.opts4.map((o, j) => `<button class="choice" data-j="${j}"><span class="b">${LETTERS[j]}</span><span>${esc(o[0])}</span></button>`).join('')}</div>`;
    else inner = `<div class="eyebrow">What does it mean?</div><div class="stem"><b>${esc(q.w[0])}</b> <span class="small muted">${esc(q.w[1])}</span></div><div class="choices">${q.opts4.map((o, j) => `<button class="choice" data-j="${j}"><span class="b">${LETTERS[j]}</span><span>${esc(o[2])}</span></button>`).join('')}</div>`;
    el.innerHTML = `<div class="q fade"><div class="row between"><span class="small muted">Word ${i + 1} of ${qs.length}</span><span class="meter" style="width:140px"><i style="width:${i / qs.length * 100}%"></i></span></div>${inner}<div id="vfb"></div></div>`;
    const finish = (ok, chosenEl) => {
      const card = CARDS.get('vc:' + q.w[0]);
      if (card) rateCard(card, ok ? 2 : 0);
      const a = {word: q.w[0], ok}; res.push(a);
      const last = Store.attempts[Store.attempts.length - 1]; if (last && last.q === 'vc:' + q.w[0]) { last.label = 'Vocabulary: ' + q.w[0]; }
      $$('.choice', el).forEach(b => { b.disabled = true; const o = q.opts4[+b.dataset.j]; if (o && o[0] === q.w[0]) b.classList.add('right'); });
      if (chosenEl && !ok) chosenEl.classList.add('wrong');
      if ($('#vin', el)) { $('#vin', el).disabled = true; $('#vin', el).classList.add(ok ? 'ok' : 'no'); $('#vsub', el)?.remove(); }
      $('#vfb', el).innerHTML = `<div class="stack"><div class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'Correct' : 'Not quite'}<span class="meta"><b>${esc(q.w[0])}</b>: ${esc(q.w[2])}</span></div><div class="expl small">${esc(q.w[3])}${q.w[4] ? ' · Collocation: ' + esc(q.w[4]) : ''}</div><div class="row"><button class="btn accent" id="vnext">Next<span class="kbd">Enter</span></button>${canSpeak ? '<button class="btn ghost sm" id="vsay2">▶ Listen</button>' : ''}</div></div>`;
      $('#vnext', el).onclick = () => { i++; paint(); };
      if ($('#vsay2', el)) $('#vsay2', el).onclick = () => speak(q.w[0]);
      setTimeout(() => $('#vnext', el)?.focus({preventScroll: true}), 30);
    };
    $$('.choice', el).forEach(b => b.onclick = () => finish(q.opts4[+b.dataset.j][0] === q.w[0], b));
    if ($('#vin', el)) {
      const go = () => { const v = norm($('#vin', el).value); if (!v) return; finish(v === norm(q.b.ans) || v === norm(q.w[0])); };
      $('#vsub', el).onclick = go;
      $('#vin', el).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(); } };
      setTimeout(() => $('#vin', el)?.focus({preventScroll: true}), 30);
    }
  };
  mountQuestion._key = null;
  paint();
}

/* ---------------- RESOURCES tab (the Resource Bank, inside Ruta C2) ---------------- */
function resFields(r) {
  if (/audio \(MP3\)/i.test(r.t)) return [];
  if (r.k === 1 || r.k === 2 || r.k === 5 || r.k === 52) return ['uoe', 'reading', 'listening'];
  if (r.p === 'listening') return ['listening'];
  if (r.p === 'reading') return /Parts 1–8|R&UoE|Reading &amp; UoE|Reading & UoE|UoE/.test(r.t + r.g) ? ['uoe', 'reading'] : ['reading'];
  if (r.p === 'uoe') return ['uoe'];
  return [];
}
const FIELD_MAX = {uoe: 36, reading: 42, listening: 30};
const FIELD_NAME = {uoe: 'Use of English (Parts 1–4)', reading: 'Reading (Parts 5–8)', listening: 'Listening'};
function resDone(k) { return !!(Store.settings.resDone || {})[k]; }
function setResDone(k, v) { Store.settings.resDone = Store.settings.resDone || {}; if (v) Store.settings.resDone[k] = Date.now(); else delete Store.settings.resDone[k]; Store.touch('settings'); }
function nextResources(n = 3) {
  const order = PAPER_ORDER.slice().sort((a, b) => (M[a].score ?? 150) - (M[b].score ?? 150));
  const out = [];
  for (const p of order) {
    const want = p === 'uoe' ? ['uoe', 'reading'] : [p];
    const r = RESOURCES.find(x => !resDone(x.k) && want.includes(x.p) && !/audio \(MP3\)/i.test(x.t) && !out.includes(x) && (x.kind !== 'guide' || p === 'writing' || p === 'speaking'));
    if (r) out.push(Object.assign({why: PAPERS[p] + (M[p].score ? ' is at ' + M[p].score : ' has no estimate yet')}, r));
    if (out.length >= n) break;
  }
  return out;
}
function viewResources() {
  if (App.importView) return viewImport();
  if (App.sheet) return viewSheet();
  if (App.extView) return viewExtResult();
  const groups = [...new Set(RESOURCES.map(r => r.g))];
  const done = RESOURCES.filter(r => resDone(r.k)).length;
  const recs = nextResources(3);
  const extL = Store.ext.slice().reverse();
  const row = r => { const f = resFields(r); const logs = Store.ext.filter(x => x.res === r.k);
    return `<div class="res ${resDone(r.k) ? 'done' : ''}"><input type="checkbox" data-done="${r.k}" ${resDone(r.k) ? 'checked' : ''} aria-label="Mark done"><span style="min-width:0"><a href="${esc(r.u)}" target="_blank" rel="noopener">${esc(r.t)}</a>${logs.length ? `<div class="small muted">Logged: ${logs.map(x => fields(x)).join(' · ')}</div>` : ''}</span>${f.length ? `<span class="row" style="gap:6px;justify-content:flex-end"><button class="btn sm accent" data-imp="${r.k}">Practise it here</button><button class="btn sm" data-sheet="${r.k}">Answer sheet</button><button class="btn sm ghost" data-log="${r.k}">Quick score</button></span>` : '<span></span>'}</div>`; };
  const fields = x => ['uoe', 'reading', 'listening'].filter(f => x[f]).map(f => (f === 'uoe' ? 'UoE' : f === 'reading' ? 'R' : 'L') + ' ' + x[f][0] + '/' + x[f][1]).join(', ');
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel stack"><div class="row between"><div><h2>Resources</h2><p class="small muted" style="margin:4px 0 0">Your <a href="${esc(RESOURCE_BANK_URL)}" target="_blank" rel="noopener">CAE Resource Bank</a> lives here too. Do an outside test, log the score and your estimate moves; paste the questions you got wrong and Claude turns them into review items that come back in your sessions.</p></div><span class="chip">${done}/${RESOURCES.length} done</span></div>
      <div class="row"><button class="btn sm accent" data-imp="custom">Practise any test here</button><button class="btn sm" data-sheet="custom">Answer sheet for any other test</button><button class="btn sm ghost" data-log="custom">Quick score</button><a class="btn sm ghost" href="https://writeandimprove.com/" target="_blank" rel="noopener" style="text-decoration:none">Write &amp; Improve ↗</a><a class="btn sm ghost" href="https://langeek.co/en/vocab/subcategory/915/learn" target="_blank" rel="noopener" style="text-decoration:none">LanGeek C1 vocabulary ↗</a></div></div>
    <div class="panel stack"><h2>Up next for you</h2><p class="small muted" style="margin:0">Picked from the bank for your lowest papers.</p>
      ${recs.map(r => `<div class="res rec"><span class="chip">${esc(PAPERS[r.p] || 'All')}</span><span style="min-width:0"><a href="${esc(r.u)}" target="_blank" rel="noopener">${esc(r.t)}</a><div class="small muted">${esc(r.why)}</div></span>${resFields(r).length ? `<button class="btn sm accent" data-sheet="${r.k}">Answer sheet</button>` : `<button class="btn sm" data-mark="${r.k}">Done</button>`}</div>`).join('') || '<p class="muted">You\'ve done everything. Impressive.</p>'}</div>
    ${extL.length ? `<div class="panel stack"><h2>Scores you've logged</h2><div class="loglist">${extL.slice(0, 12).map(x => `<div class="logi" ${x.items ? `data-ext="${x.k}" style="cursor:pointer"` : ''}><span><b>${esc(x.src)}</b><div class="small muted">${new Date(x.t).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}${x.imported ? ' · ' + x.imported + ' imported to reviews' : ''}</div></span><span class="num small">${fields(x)}</span></div>`).join('')}</div></div>` : ''}
    ${groups.map(g => `<div class="panel"><h2 style="margin-bottom:8px">${esc(g)}</h2>${RESOURCES.filter(r => r.g === g).map(row).join('')}</div>`).join('')}
  </div>`;
  $$('[data-done]').forEach(b => b.onchange = () => { setResDone(+b.dataset.done, b.checked); b.closest('.res').classList.toggle('done', b.checked); });
  $$('[data-mark]').forEach(b => b.onclick = () => { setResDone(+b.dataset.mark, true); viewResources(); });
  $$('[data-imp]').forEach(b => b.onclick = () => openImport(b.dataset.imp === 'custom' ? null : RESOURCES.find(r => r.k === +b.dataset.imp)));
  $$('[data-sheet]').forEach(b => b.onclick = () => openSheet(b.dataset.sheet === 'custom' ? null : RESOURCES.find(r => r.k === +b.dataset.sheet)));
  $$('[data-ext]').forEach(b => b.onclick = () => { App.extView = b.dataset.ext; render(); });
  $$('[data-log]').forEach(b => b.onclick = () => openLog(b.dataset.log === 'custom' ? null : RESOURCES.find(r => r.k === +b.dataset.log)));
}
function openLog(r) {
  const fl = r ? resFields(r) : ['uoe', 'reading', 'listening'];
  const o = $('#overlay');
  o.innerHTML = `<div class="modal"><div class="panel stack" role="dialog" aria-label="Log score">
    <div class="eyebrow">Log a score</div><h2 style="font-size:19px">${r ? esc(r.t) : 'Another test'}</h2>
    ${r ? '' : '<input type="text" id="lsrc" placeholder="Where is it from? e.g. Cambridge book 3, Test 2">'}
    <p class="small muted" style="margin:0">Fill in only the parts you did. Change the maximum if you did a shorter task.</p>
    ${fl.map(f => `<div class="nums"><span style="min-width:190px">${FIELD_NAME[f]}</span><input id="c_${f}" inputmode="numeric" placeholder="right" aria-label="${FIELD_NAME[f]} correct"> / <input id="m_${f}" inputmode="numeric" value="${FIELD_MAX[f]}" aria-label="${FIELD_NAME[f]} maximum"></div>`).join('')}
    <label class="small muted" for="lmis">Paste the questions you got wrong (optional). Include the question, your answer and the right answer; Claude does the rest.</label>
    <textarea id="lmis" rows="5" placeholder="e.g. Part 1, Q4: 'The film didn't ___ up to the hype' – I put MEASURE, answer LIVE"></textarea>
    <div class="row"><button class="btn primary" id="lsave">Save</button><button class="btn ghost" id="lx">Cancel</button><span class="small" id="lmsg"></span></div></div></div>`;
  $('#lx', o).onclick = () => o.innerHTML = '';
  $('#lsave', o).onclick = async () => {
    const src = r ? r.t : ($('#lsrc', o).value.trim() || 'Outside test');
    const x = {k: uid(), t: Date.now(), res: r?.k ?? null, src};
    for (const f of fl) { const c = parseInt($('#c_' + f, o).value, 10), m = parseInt($('#m_' + f, o).value, 10); if (isFinite(c) && isFinite(m) && m > 0 && c >= 0 && c <= m) x[f] = [c, m]; }
    const mis = $('#lmis', o).value.trim();
    if (!fl.some(f => x[f]) && !mis) return $('#lmsg', o).textContent = 'Add a score or some mistakes first.';
    $('#lsave', o).disabled = true;
    if (mis && SAMPLE) {
      $('#lmsg', o).innerHTML = '<span class="thinking">Claude is turning your mistakes into review items</span>';
      try { const got = await aiImportMistakes(mis, src); x.imported = got.length; } catch (e) { $('#lmsg', o).textContent = 'Couldn\'t read the mistakes; the score is still saved.'; }
    }
    if (fl.some(f => x[f]) || x.imported) { Store.ext.push(x); Store.touch('ext/' + x.k); }
    if (r) setResDone(r.k, true);
    computeModel();
    o.innerHTML = '';
    toast(x.imported ? x.imported + (x.imported === 1 ? ' mistake' : ' mistakes') + ' added to your reviews' : 'Score saved: your estimate has been updated');
    render();
  };
}

/* ---------------- WRITING: Write & Improve-style checks, annotations, versions ---------------- */
function annotateHTML(text, sentences) {
  let html = '', pos = 0, fx = [];
  for (const s of sentences || []) {
    if (!s?.s) continue;
    const i = text.indexOf(s.s, pos);
    if (i < 0) continue;
    html += esc(text.slice(pos, i));
    let inner = '', cur = 0; const src = s.s;
    const fixes = (s.fix || []).filter(f => f?.from).map(f => ({...f, at: src.indexOf(f.from)})).filter(f => f.at >= 0).sort((a, b) => a.at - b.at);
    for (const f of fixes) { if (f.at < cur) continue; inner += esc(src.slice(cur, f.at)) + `<mark class="fx" tabindex="0" data-fx="${fx.length}">${esc(f.from)}</mark>`; fx.push(f); cur = f.at + f.from.length; }
    inner += esc(src.slice(cur));
    html += `<span class="sn ${['strong', 'ok', 'weak'].includes(s.r) ? s.r : 'ok'}" ${s.note ? `title="${esc(s.note)}"` : ''}>${inner}</span>`;
    pos = i + s.s.length;
  }
  html += esc(text.slice(pos));
  return {html, fx, notes: (sentences || []).filter(s => s?.note && s.r === 'weak')};
}
function annotBlock(text, sentences, idp) {
  const a = annotateHTML(text, sentences);
  const n = {strong: 0, ok: 0, weak: 0}; for (const s of sentences || []) if (n[s.r] != null) n[s.r]++;
  return {html: `<div class="legend2"><span><i style="background:var(--good-soft)"></i>${n.strong} strong</span><span><i style="background:var(--surface-2)"></i>${n.ok} fine</span><span><i style="background:var(--warn-soft)"></i>${n.weak} needs work</span><span><i style="background:var(--bad-soft);border-bottom:2px solid var(--bad)"></i>${a.fx.length} words to change (tap one)</span></div>
    <div class="annot" id="${idp}an">${a.html}</div><div class="fxinfo" id="${idp}fx" hidden></div>
    ${a.notes.length ? `<ul class="small" style="margin:0;padding-left:18px;display:grid;gap:4px">${a.notes.slice(0, 6).map(s => `<li><b>${esc(s.s.slice(0, 50))}${s.s.length > 50 ? '…' : ''}</b>: ${esc(s.note)}</li>`).join('')}</ul>` : ''}`,
    wire: root => $$('mark.fx', root).forEach(m => { const show = () => { const f = a.fx[+m.dataset.fx]; $$('mark.fx.on', root).forEach(x => x.classList.remove('on')); m.classList.add('on'); const box = $('#' + idp + 'fx', root); box.hidden = false; box.innerHTML = `<s style="color:var(--bad)">${esc(f.from)}</s> → <b style="color:var(--good)">${esc(f.to || '(remove)')}</b><div class="small muted">${esc(f.why || '')}</div>`; }; m.onclick = show; m.onkeydown = e => { if (e.key === 'Enter') show(); }; })};
}
function chainOf(w) { const root = w.root || w.k; return Store.works.filter(x => (x.root || x.k) === root).sort((a, b) => a.t - b.t); }

function viewEditor() {
  const W = App.ws, task = W.task, kind = W.mode;
  const dkey = 'rc2_draft_' + task.id + (W.root ? '_' + W.root : '');
  W.checks = W.checks || [];
  const initial = W.prefill != null ? W.prefill : lsGet(dkey, '');
  W.prefill = null;
  $('#app').innerHTML = `<div class="view fade"><div class="row between"><button class="btn ghost sm" id="eback">← Tasks</button><span class="small muted" id="etime"></span></div>
    <div class="panel stack"><div class="eyebrow">${kind === 'W' ? 'Writing ' + (task.part === 1 ? 'Part 1 · compulsory' : 'Part 2') + ' · ' + esc(task.type) : 'Speaking Part ' + task.part + ' · ' + esc(task.time)}${W.root ? ' · revision of an earlier version' : ''}</div>
      <h2 style="font-size:22px">${esc(task.title)}</h2><div class="prompt">${esc(task.prompt)}</div>
      ${task.model ? `<details><summary class="small" style="cursor:pointer;font-weight:700">Model answer from your book (read it after you write)</summary><div class="upgraded" style="margin-top:8px">${esc(task.model)}</div></details>` : ''}
      <label for="etext" class="small muted">${kind === 'W' ? 'Your answer' : 'What you would say'}</label>
      <textarea id="etext" class="essay" spellcheck="false" placeholder="${kind === 'W' ? 'Plan for 5 minutes, then write…' : 'Type your answer as you would say it…'}">${esc(initial)}</textarea>
      <div class="row between"><span class="wc" id="ewc"></span><span class="row"><button class="btn" id="echeck" ${SAMPLE ? '' : 'disabled'}>Check (quick feedback)</button><button class="btn accent" id="esub" ${SAMPLE ? '' : 'disabled'}>Submit for full marking</button></span></div>
      <p class="small muted" style="margin:0">Like <a href="https://writeandimprove.com/" target="_blank" rel="noopener">Write &amp; Improve</a>: Check as many times as you like. Each check shades every sentence and marks the words to change; edit, then check again and watch your level climb. Submit when you're happy for the full 4-criterion mark and an Upgraded C1 Version.</p>
      ${SAMPLE ? '' : '<p class="small muted">Feedback needs Claude, which isn\'t available in this view. Your draft is kept in this browser.</p>'}
      <div id="echk"></div><div id="eres"></div></div></div>`;
  const ta = $('#etext');
  const wc = () => { const n = ta.value.trim().split(/\s+/).filter(Boolean).length; $('#ewc').innerHTML = kind === 'W' ? `${n} words <span class="${n < 220 || n > 260 ? 'down' : 'up'}">· target 220–260</span>` : `${n} words`; };
  ta.oninput = () => { wc(); lsSet(dkey, ta.value); };
  wc();
  const paintChecks = () => {
    const box = $('#echk'); const last = W.checks[W.checks.length - 1];
    if (!last) { box.innerHTML = ''; return; }
    const lvl = {B1: 1, B2: 2, C1: 3, C2: 4};
    const ab = annotBlock(last.text, last.r.sentences, 'ck');
    box.innerHTML = `<div class="stack" style="margin-top:6px"><div class="row between"><h2>Check ${W.checks.length}: <span class="grade ${{C2: 'A', C1: 'B', B2: 'B2', B1: 'B2'}[last.r.cefr] || 'none'}">${esc(last.r.cefr || '?')}</span> <span class="chip dark">Band ${esc(last.r.band ?? '?')}</span></h2>
      <div class="versions" aria-label="Level per check">${W.checks.map((c, i) => `<span class="v"><i style="height:${8 + (lvl[c.r.cefr] || 1) * 12}px;opacity:${i === W.checks.length - 1 ? 1 : .45}"></i>${esc(c.r.cefr || '?')}</span>`).join('')}</div></div>
      ${last.r.headline ? `<div class="rule">${esc(last.r.headline)}</div>` : ''}${ab.html}</div>`;
    ab.wire(box);
  };
  paintChecks();
  clearInterval(App.etick);
  App.etick = setInterval(() => { const e = $('#etime'); if (!e) return clearInterval(App.etick); e.textContent = fmtTime(Date.now() - W.t0) + (kind === 'W' ? ' · aim for 45:00' : ''); }, 1000);
  $('#eback').onclick = () => { W.task = null; W.root = null; W.checks = []; render(); };
  $('#echeck').onclick = async () => {
    const text = ta.value.trim(); if (text.split(/\s+/).length < 30) return toast('Write at least 30 words first.');
    $('#echeck').disabled = true; $('#echeck').textContent = 'Checking…';
    try { const r = await aiQuickCheck(task, text); W.checks.push({t: Date.now(), text, r}); bumpAct('chk'); paintChecks(); $('#echk').scrollIntoView({behavior: 'smooth', block: 'start'}); }
    catch (e) { toast('The check didn\'t come through. Try again.'); }
    $('#echeck').disabled = false; $('#echeck').textContent = 'Check again';
  };
  $('#esub').onclick = async () => {
    const text = ta.value.trim();
    if (text.split(/\s+/).length < 40) return toast('Write at least 40 words first.');
    $('#esub').disabled = true;
    $('#eres').innerHTML = `<div class="loading"><span class="thinking">Claude is marking your ${kind === 'W' ? task.type.toLowerCase() : 'answer'} against the Cambridge criteria</span></div>`;
    try {
      const res = await aiGradeWriting(task, text, kind);
      const w = {k: uid(), t: Date.now(), kind, taskId: task.id, type: task.type || 'Speaking P' + task.part, title: task.title, text, ms: Date.now() - W.t0, res,
        checks: W.checks.map(c => ({t: c.t, cefr: c.r.cefr, band: c.r.band}))};
      if (W.root) w.root = W.root;
      Store.works.push(w); Store.touch('works/' + w.k);
      lsSet(dkey, '');
      W.task = null; W.root = null; W.checks = []; W.view = w.k; render();
    } catch (e) {
      $('#esub').disabled = false;
      $('#eres').innerHTML = `<p class="small muted">${e?.code === 'not_granted' ? 'Claude access was declined for this page.' : 'Marking didn\'t come through. Your text is saved; try again.'}</p>`;
    }
  };
}
function viewWork(k) {
  const w = Store.works.find(x => x.k === k), r = w.res || {};
  const crit = w.kind === 'W' ? WCRIT : SCRIT;
  const sc = toScale((r.total || 0) / 20);
  const chain = chainOf(w);
  const mode = App.ws.vmode || (r.sentences ? 'a' : 'u');
  $('#app').innerHTML = `<div class="view fade"><div class="row between"><button class="btn ghost sm" id="vback">← ${w.kind === 'W' ? 'Writing' : 'Speaking'}</button><span class="small muted">${new Date(w.t).toLocaleString('en-GB')}</span></div>
    <div class="panel stack"><div class="eyebrow">${esc(w.type)} · ${esc(w.title)}${chain.length > 1 ? ' · version ' + (chain.indexOf(w) + 1) + ' of ' + chain.length : ''}</div>
      <div class="row" style="gap:18px;align-items:flex-end"><span class="bigscore">${(r.total || 0).toFixed(1)}<span style="font-size:22px" class="muted">/20</span></span><span style="display:grid;gap:4px"><span class="row" style="gap:6px"><span class="chip dark">Band ${r.band ?? '—'} / 5</span>${r.cefr ? `<span class="chip">CEFR ${esc(r.cefr)}</span>` : ''}</span><span>≈ <span class="num">${sc}</span> ${gradeChip(sc)}</span></span>
        ${chain.length > 1 ? `<div class="versions" style="margin-left:auto" aria-label="Score per version">${chain.map((x, i) => `<button class="v" data-ver="${x.k}" style="border:0;background:transparent;padding:0;cursor:pointer"><i style="height:${6 + (x.res?.total || 0) * 3}px;opacity:${x === w ? 1 : .45}"></i>v${i + 1} · ${(x.res?.total || 0).toFixed(0)}</button>`).join('')}</div>` : ''}</div>
      <p style="margin:0;font-family:var(--f-read);font-size:17px">${esc(r.summary || '')}</p>
      ${r.model_comparison ? `<div class="rule" style="font-size:15px"><b>Compared with your book's model answers:</b> ${esc(r.model_comparison)}</div>` : ''}
      <div class="stack">${crit.map(([k, l]) => `<div><div class="crit"><b>${l}</b><span class="dots5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= (+r.scores?.[k] || 0) ? 'on' : ''}"></i>`).join('')}</span><span class="num">${r.scores?.[k] ?? '—'}/5</span></div><div class="small muted">${esc(r.feedback?.[k] || '')}</div></div>`).join('')}</div>
      <div class="row"><button class="btn accent" id="vrev">Revise this piece →</button><span class="small muted">Opens your text so you can fix it and resubmit; versions are compared above.</span></div>
    </div>
    <div class="panel stack"><div class="row between"><h2>Your text</h2><div class="seg">${r.sentences ? `<button data-v="a" aria-pressed="${mode === 'a'}">Annotated</button>` : ''}<button data-v="u" aria-pressed="${mode === 'u'}">Upgraded C1 Version</button><button data-v="o" aria-pressed="${mode === 'o'}">Original</button></div></div><div id="vtext"></div></div>
    <div class="grid2">
      <div class="panel stack"><h2>Errors to fix</h2><div class="errs">${(r.errors || []).map(e => `<div class="err"><s>${esc(e.original)}</s> → <b>${esc(e.correction)}</b><div class="small muted" style="margin-top:4px">${esc(e.explanation)}${TOP[e.topic] ? ` · <a href="#" data-lt="${e.topic}">${esc(TOP[e.topic].name)}</a>` : ''}</div></div>`).join('') || '<p class="muted">No significant errors.</p>'}</div></div>
      <div class="panel stack"><h2>Strengths & next steps</h2><ul style="margin:0;padding-left:20px;display:grid;gap:6px">${(r.strengths || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul><div class="eyebrow">Work on next</div><ol style="margin:0;padding-left:20px;display:grid;gap:6px">${(r.focus || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${w.checks?.length ? `<div class="small muted">Before submitting you ran ${w.checks.length} check${w.checks.length > 1 ? 's' : ''}: ${w.checks.map(c => esc(c.cefr || '?')).join(' → ')}</div>` : ''}</div>
    </div></div>`;
  const paintText = m => {
    App.ws.vmode = m;
    $$('[data-v]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === m));
    const box = $('#vtext');
    if (m === 'a') { const ab = annotBlock(w.text, r.sentences, 'wk'); box.innerHTML = `<div class="stack">${ab.html}</div>`; ab.wire(box); }
    else box.innerHTML = `<div class="upgraded" style="${m === 'o' ? 'border-color:var(--line);background:var(--surface)' : ''}">${esc(m === 'u' ? r.upgraded || '' : w.text)}</div>`;
  };
  paintText(mode);
  $$('[data-v]').forEach(b => b.onclick = () => paintText(b.dataset.v));
  $$('[data-ver]').forEach(b => b.onclick = () => { App.ws.view = b.dataset.ver; render(); });
  $('#vback').onclick = () => { App.ws.view = null; App.ws.vmode = null; render(); };
  $('#vrev').onclick = () => {
    const list = w.kind === 'W' ? WRITING : SPEAKING;
    const task = list.find(t => t.id === w.taskId);
    if (!task) return toast('Task not found');
    Object.assign(App.ws, {mode: w.kind, task, view: null, vmode: null, root: w.root || w.k, prefill: w.text, checks: [], t0: Date.now()});
    render();
  };
  $$('[data-lt]').forEach(a => a.onclick = e => { e.preventDefault(); openLearn(a.dataset.lt); });
}

/* ---------------- boot ---------------- */
$$('nav.tabs button').forEach(b => b.onclick = () => {
  if (b.dataset.tab === 'cards') { App.cardRun = null; App.vt = null; }
  if (b.dataset.tab === 'resources') { App.sheet = null; App.extView = null; App.importView = null; }
  if (b.dataset.tab === 'write') { App.ws.task = null; App.ws.view = null; App.ws.root = null; App.ws.checks = []; }
  setTab(b.dataset.tab);
});
$('#countdown').onclick = openSettings;
(async function boot() {
  computeModel();
  render();
  await Promise.all([Store.init(), initSample()]);
  registerVocabCards();
  await initPrivate();
  if (['today', 'progress', 'resources', 'cards'].includes(App.tab)) render();
  else updateCountdown();
})();
