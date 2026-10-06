'use strict';
/* ============================================================
   Ruta C2 — imported practice sets.
   Paste a test page from the Resource Bank (questions, options, key);
   Claude turns it into interactive Ruta questions: you answer inside the
   app, see the question and its text, get marked and diagnosed, and every
   miss joins your relearning queue. Sets are stored privately for you.
   ============================================================ */
Object.assign(PART_NAME, {G: 'Exercise from your book', 6: 'Reading · Part 6 cross-text matching', 7: 'Reading · Part 7 gapped text', 8: 'Reading · Part 8 multiple matching', L1: 'Listening · Part 1', L2: 'Listening · Part 2', L3: 'Listening · Part 3', L4: 'Listening · Part 4'});
Object.assign(PART_SHORT, {G: 'Book', 6: 'Reading 6', 7: 'Reading 7', 8: 'Reading 8', L1: 'Listening 1', L2: 'Listening 2', L3: 'Listening 3', L4: 'Listening 4'});
function qPaper(q) { return String(q.p).startsWith('L') ? 'listening' : q.p >= 5 ? 'reading' : 'uoe'; }

const PRIV = {uid: null, db: null, assets: null};
async function initPrivate() {
  try {
    if (!window.claude?.use) return;
    const [user, assets] = await Promise.all([window.claude.use('user'), window.claude.use('assets')]);
    PRIV.assets = assets;
    PRIV.uid = user ? await user.id() : null;
    PRIV.db = Store.db;
    if (PRIV.db && PRIV.uid) {
      const snap = await PRIV.db.collection('data/users/' + PRIV.uid).get();
      const have = new Set(Store.sets.map(s => s.id));
      Store.plists = [];
      for (const d of snap.docs) { const s = d.data(); if (!s?.id) continue;
        if (s.items && !have.has(s.id)) Store.sets.push(s);
        else if (s.items && s.book) { const i = Store.sets.findIndex(x => x.id === s.id); if (i >= 0) Store.sets[i] = s; }
        if (s.words) Store.plists.push(s);
        if (s.wmodels) Store.wmodels = s; }
      Store.sets.sort((a, b) => (a.book && b.book) ? a.id.localeCompare(b.id) : 0);
      mergeBookWriting(); registerVocabCards();
      const inDb = new Set(snap.docs.map(d => d.data()?.id));
      for (const s of Store.sets) if (!inDb.has(s.id)) savePrivate(s, true);
      registerSets();
    }
  } catch (e) { console.warn('private', e); }
}
Store.sets = lsGet('rc2_sets', []);
function saveSets() { lsSet('rc2_sets', Store.sets); }
async function savePrivate(set, quiet) {
  saveSets();
  if (!PRIV.db || !PRIV.uid) return;
  try { await PRIV.db.doc('data/users/' + PRIV.uid + '/' + set.id).set(set); } catch (e) { if (!quiet) console.warn('save set', e); }
}
function audioUrl(set) { return set.audio ? (window.BLOB_URLS?.[set.audio.id] || set.audio.url || null) : null; }
function registerSets() {
  for (const set of Store.sets) {
    const parts = Object.fromEntries((set.parts || []).map(p => [p.part, p]));
    for (const q of set.items) {
      const pt = parts[q.part] || {};
      q.src = 'imp'; q.set = set.id; q.ctx = pt.text || ''; q.script = pt.script || null; q.lab = q.lab || pt.label || null; q.audio = String(q.p).startsWith('L') ? audioUrl(set) : null;
      Q.set(q.id, q);
    }
  }
}
registerSets();

const PART_NUM = {P1: 1, P2: 2, P3: 3, P4: 4, P5: 5, P6: 6, P7: 7, P8: 8, L1: 'L1', L2: 'L2', L3: 'L3', L4: 'L4'};
async function aiImportSet(raw, source) {
  const topicList = TOPICS.filter(t => t.paper === 'uoe').map(t => t.id + ' = ' + t.name).join('; ');
  const prompt = `${EXAMINER}
The student pasted the text of a C1 Advanced practice test page for their own private study. Convert it into structured, interactive questions. Keep the questions, options, texts and answer key EXACTLY as given; do not invent answers if a key is present (if no key is given, solve each item yourself and set "keyed": false).
PASTED PAGE (${source}):
<<<${raw.slice(0, 40000)}>>>
Identify which exam parts are present (UoE P1–P4, Reading P5–P8, Listening L1–L4).
For each part give "text": the full reading/cloze text with gaps shown as (1), (2)… exactly as numbered ("" for Listening or Part 4).
For each item:
- P1: {"n","type":"mc","q":"the sentence containing the gap, with ___ for the gap","o":["4 options, no letters"],"a":index}
- P2: {"n","type":"gap","q":"sentence with ___","a":["accepted words"]}
- P3: {"n","type":"gap","q":"sentence with ___","r":"ROOT WORD","a":["accepted forms"]}
- P4: {"n","type":"kwt","s1":"first sentence","k":"KEY WORD","s2":"second sentence with ___","a":["accepted answers, lowercase"]}
- P5 / L1 / L3: {"n","type":"mc","q":"question stem","o":["options, no letters"],"a":index}
- P6 / P8 / L4: {"n","type":"mc","q":"the question or statement","o":["each option label with its short description, e.g. 'A – Reviewer 1'"],"a":index}
- P7: {"n","type":"mc","q":"Which paragraph fills gap (n)?","o":["A – first words of paragraph A…", …],"a":index}
- L2: {"n","type":"gap","q":"sentence with ___","a":["accepted answers"]}
Add to every item "ex": a short explanation of why the answer is right (your own words), and for P1–P4 "tp": the closest topic id from: ${topicList}.
Respond ONLY with JSON: {"title":"short title","keyed":true,"parts":[{"part":"P1","instructions":"...","text":"...","items":[...]}]}`;
  const r = await ai(prompt, {tier: 'complex', cache: false});
  if (!r?.parts?.length) throw {code: 'bad_output'};
  const sid = 'set' + hash(source + raw.slice(0, 300) + Date.now());
  const set = {id: sid, t: Date.now(), title: r.title || source, source, keyed: r.keyed !== false, parts: [], items: []};
  for (const pt of r.parts) {
    const P = PART_NUM[pt.part]; if (!P) continue;
    set.parts.push({part: pt.part, instructions: pt.instructions || '', text: pt.text || ''});
    for (const it of pt.items || []) {
      const q = {part: pt.part, p: P, n: it.n, lv: 3, ex: it.ex || '', tp: String(P).startsWith('L') ? 'listen' : P >= 5 ? 'read' : (TOP[it.tp] ? it.tp : ({1: 'coll', 2: 'link', 3: 'wf', 4: 'inv'})[P])};
      if (it.type === 'kwt' || P === 4) { if (!it.s1 || !it.s2 || !Array.isArray(it.a)) continue; Object.assign(q, {s1: it.s1, k: it.k || '', s2: it.s2.includes('___') ? it.s2 : it.s2 + ' ___', a: it.a.map(String)}); }
      else if (it.type === 'mc' || Array.isArray(it.o)) { if (!Array.isArray(it.o) || it.o.length < 2 || !Number.isInteger(+it.a)) continue; Object.assign(q, {s: it.q || ('Question ' + it.n), o: it.o.map(String), a: +it.a, noShuffle: true}); }
      else { const ans = Array.isArray(it.a) ? it.a.map(String) : [String(it.a ?? '')]; if (!ans[0]) continue; Object.assign(q, {s: (it.q || '').includes('___') ? it.q : (it.q || '') + ' ___', a: ans}); if (it.r) q.r = it.r; }
      q.id = 'i' + hash(sid + pt.part + it.n);
      set.items.push(q);
    }
  }
  if (!set.items.length) throw {code: 'bad_output'};
  return set;
}

/* ---- Import view (inside Resources) ---- */
function openImport(r) { App.importView = {rk: r?.k ?? null, src: r ? r.t : ''}; App.sheet = null; App.extView = null; setTab('resources'); }
function viewImport() {
  const V = App.importView, r = RESOURCES.find(x => x.k === V.rk);
  const lis = r ? resFields(r).includes('listening') && resFields(r).length === 1 : true;
  $('#app').innerHTML = `<div class="view fade"><div class="row between"><button class="btn ghost sm" id="imx">← Resources</button></div>
    <div class="panel stack"><div class="eyebrow">Bring a test into Ruta C2</div>
      ${r ? `<h2 style="font-size:21px">${esc(r.t)}</h2>` : '<input type="text" id="imsrc" placeholder="Name of the test, e.g. EngExam R&UoE Test 4">'}
      <ol class="small" style="margin:0;padding-left:20px;display:grid;gap:4px">
        <li>${r ? `<a href="${esc(r.u)}" target="_blank" rel="noopener">Open the test page ↗</a>` : 'Open the test page'} (the printable version is best: it shows the answer key).</li>
        <li>Select everything on the page (Ctrl/Cmd + A), copy it and paste it below. One paper per paste works best (Reading &amp; Use of English, or Listening).</li>
        <li>For Listening, also attach the MP3 you downloaded so you can play it here.</li></ol>
      <textarea id="imtxt" rows="12" placeholder="Paste the page here…"></textarea>
      <div class="row"><label class="small muted" for="imaud">Audio (optional, MP3)</label><input type="file" id="imaud" accept="audio/*" ${PRIV.assets ? '' : 'disabled'}>${PRIV.assets ? '' : '<span class="small muted">Audio upload isn\'t available in this view.</span>'}</div>
      <div class="row"><button class="btn accent" id="imgo" ${SAMPLE ? '' : 'disabled'}>Build my practice set</button><span class="small" id="immsg"></span></div>
      <p class="small muted" style="margin:0">Claude keeps the questions, options and key as they are, adds short explanations, and tags each item with its exam part and topic. The set is saved privately to your account.</p></div>
    ${Store.sets.length ? `<div class="panel stack"><h2>Your imported sets</h2>${setListHTML()}</div>` : ''}</div>`;
  $('#imx').onclick = () => { App.importView = null; render(); };
  wireSetList();
  $('#imgo').onclick = async () => {
    const raw = $('#imtxt').value.trim(); if (raw.length < 200) return toast('Paste the whole test page first');
    const src = r ? r.t : ($('#imsrc').value.trim() || 'Outside test');
    const file = $('#imaud').files?.[0];
    $('#imgo').disabled = true; $('#immsg').innerHTML = '<span class="thinking">Claude is building your set (this can take a minute for a full paper)</span>';
    try {
      const set = await aiImportSet(raw, src);
      if (file && PRIV.assets) { $('#immsg').innerHTML = '<span class="thinking">Uploading the audio</span>'; try { const up = await PRIV.assets.upload(file); set.audio = {id: up.id, url: up.url}; } catch (e) { toast('The audio didn\'t upload (max 20 MB); the questions are saved.'); } }
      set.rk = V.rk;
      Store.sets.push(set); await savePrivate(set); registerSets();
      if (r) setResDone(r.k, true);
      toast(set.items.length + ' questions imported');
      App.importView = null; App.prac = {...App.prac, mode: 'set', setId: set.id, cur: null}; setTab('practice');
    } catch (e) { $('#imgo').disabled = false; $('#immsg').textContent = e?.code === 'not_granted' ? 'Claude access was declined for this page.' : 'That didn\'t work. Try pasting one paper or a few parts at a time.'; }
  };
}
function setProgress(set) {
  const ok = new Set(Store.attempts.filter(a => a.ok && a.q.startsWith('i')).map(a => a.q));
  const tried = new Set(Store.attempts.filter(a => a.q.startsWith('i')).map(a => a.q));
  const ids = set.items.map(q => q.id);
  return {n: ids.length, tried: ids.filter(i => tried.has(i)).length, ok: ids.filter(i => ok.has(i)).length};
}
function setListHTML() {
  return `<div class="tracks">${Store.sets.slice().reverse().map(s => { const pr = setProgress(s); const parts = [...new Set(s.items.map(q => q.part))].join(' · ');
    if (s.book) return `<button class="trk" data-set="${s.id}"><span class="pn">BOOK</span><span style="min-width:0"><b>${esc(s.title)}</b><div class="small muted">${s.items.length} questions · ${s.parts.length} exercises${s.writing?.length ? ' · ' + s.writing.length + ' writing tasks' : ''}</div><span class="meter" style="margin-top:4px"><i style="width:${pr.tried / pr.n * 100}%"></i></span></span><span class="small">${pr.tried ? `<span class="chip ${pr.ok / Math.max(1, pr.tried) >= .8 ? 'good' : pr.ok / Math.max(1, pr.tried) >= .6 ? 'warn' : 'bad'}">${pr.ok}/${pr.n}</span>` : '<span class="chip">New</span>'}</span></button>`;
    return `<button class="trk" data-set="${s.id}"><span class="pn">${s.book ? 'BOOK' : esc(parts.split(' · ')[0] || 'SET')}</span><span style="min-width:0"><b>${esc(s.title)}</b><div class="small muted">${s.items.length} questions · ${esc(parts)}${s.audio ? ' · audio' : ''}${s.keyed ? '' : ' · answers by Claude (no key pasted)'}</div><span class="meter" style="margin-top:4px"><i style="width:${pr.tried / pr.n * 100}%"></i></span></span><span class="small">${pr.tried ? `<span class="chip ${pr.ok / Math.max(1, pr.tried) >= .8 ? 'good' : pr.ok / Math.max(1, pr.tried) >= .6 ? 'warn' : 'bad'}">${pr.ok}/${pr.n}</span>` : '<span class="chip">New</span>'}</span></button>`; }).join('')}</div>`;
}
function wireSetList() { $$('[data-set]').forEach(b => b.onclick = () => { App.prac = {...App.prac, mode: 'set', setId: b.dataset.set, cur: null, setDone: null}; App.importView = null; setTab('practice'); }); }
function nextSetItem() {
  const P = App.prac, set = Store.sets.find(s => s.id === P.setId); if (!set) return null;
  P.setDone = P.setDone || new Set();
  const okIds = new Set(Store.attempts.filter(a => a.ok).map(a => a.q));
  const q = set.items.find(x => !P.setDone.has(x.id) && !okIds.has(x.id)) || set.items.find(x => !P.setDone.has(x.id));
  if (!q) return null;
  P.setDone.add(q.id);
  return {q, why: `${set.title} · ${q.lab || q.part} · Q${q.n} · ${set.items.indexOf(q) + 1}/${set.items.length}`};
}

function mergeBookWriting() {
  for (const set of Store.sets) for (const w of set.writing || []) {
    const list = w.speaking ? SPEAKING : WRITING;
    if (!list.some(x => x.id === w.id)) list.push(w);
  }
}

/* Model writing answers from the student's books: used as the grading benchmark */
const GENRE = t => /letter|email/i.test(t || '') ? 'Letter' : /essay/i.test(t || '') ? 'Essay' : /report/i.test(t || '') ? 'Report' : /proposal/i.test(t || '') ? 'Proposal' : /review/i.test(t || '') ? 'Review' : 'Other';
function benchmarkModels(task) {
  const W = Store.wmodels; if (!W) return [];
  const g = GENRE(task.type);
  const same = W.models.filter(m => GENRE(m.type) === g && m.text !== task.model);
  const near = g === 'Proposal' ? W.models.filter(m => GENRE(m.type) === 'Report') : [];
  return [...same, ...near].slice(0, 2);
}
function exemplarBlock(task, kind) {
  const W = Store.wmodels; if (!W || kind !== 'W') return '';
  const ms = benchmarkModels(task);
  return `BENCHMARK (from the student's own coursebooks):
${ms.length ? ms.map((m, i) => `Model answer ${i + 1} — ${m.type}: ${m.title}\n"""${m.text}"""`).join('\n\n') + '\nTreat these as top-band (Band 5) exemplars of this genre. Judge the candidate against them for organisation, paragraphing, register, cohesion and range, and make the Upgraded C1 Version follow their conventions.' : 'No model of this exact genre is available; use the phrase bank below for register.'}
Useful phrases by formality (expect formal/neutral choices in essays, reports and proposals; neutral/informal in informal emails):
${W.phrases.slice(0, 3200)}
Spelling traps to check: ${W.spelling.slice(0, 700)}`;
}
function modelsPanelHTML() {
  const W = Store.wmodels; if (!W) return '';
  return `<div class="panel stack"><div class="row between"><h2>Model answers from your books</h2><span class="small muted">Claude marks your writing against these</span></div>
    <div class="tracks">${W.models.map((m, i) => `<button class="trk" data-wmod="${i}"><span class="pn">${esc(m.type.slice(0, 6))}</span><span style="min-width:0"><b>${esc(m.title)}</b><div class="small muted">${m.words} words</div></span><span>→</span></button>`).join('')}
    <button class="trk" data-wmod="ph"><span class="pn">Aa</span><span><b>Useful phrases by formality</b><div class="small muted">Formal · neutral · informal, grouped by purpose</div></span><span>→</span></button></div></div>`;
}
function wireModels() {
  $$('[data-wmod]').forEach(b => b.onclick = () => {
    const W = Store.wmodels, k = b.dataset.wmod, m = k === 'ph' ? null : W.models[+k];
    const o = $('#overlay');
    o.innerHTML = `<div class="modal"><div class="panel stack" style="max-width:760px"><div class="row between"><h2>${esc(m ? m.title : 'Useful phrases')}</h2><button class="btn ghost sm" id="wmx">Close</button></div><div class="upgraded" style="max-height:70vh;overflow:auto">${esc(m ? m.text : W.phrases)}</div></div></div>`;
    $('#wmx', o).onclick = () => o.innerHTML = '';
  });
}
