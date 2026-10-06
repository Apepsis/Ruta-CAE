'use strict';
/* ============================================================
   Ruta C2 — views
   ============================================================ */
const App = {tab: 'today', sess: null, prac: {mode: 'mix', part: 1, tp: 'inv'}, learn: 'exam', ws: {mode: 'W'}, lisPart: null, cardRun: null};
const DECK_TP = Object.fromEntries(DECKS.map(d => [d.tp, d]));
const SKIP_AUTO = new Set(['write', 'speak']);

function setTab(tab, keep) {
  App.tab = tab;
  $$('nav.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  if (!keep) window.scrollTo(0, 0);
  render();
}
function render() {
  computeModel(); updateCountdown();
  mountQuestion._key = null;
  ({today: viewToday, session: viewSession, practice: viewPractice, listening: viewListening, write: viewWrite, cards: viewVocab, learn: viewLearn, progress: viewProgress, resources: viewResources})[App.tab]();
}
function daysLeft() {
  if (!Store.settings.examDate) return null;
  const t = new Date(Store.settings.examDate + 'T09:00:00'), n = new Date();
  return Math.ceil((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
}
function updateCountdown() {
  const d = daysLeft(), el = $('#countdown');
  el.textContent = d == null ? 'Set exam date' : d > 1 ? d + ' days to C1 Advanced' : d === 1 ? 'Exam tomorrow' : d === 0 ? 'Exam day' : 'Exam done';
}
function openSettings() {
  const o = $('#overlay');
  o.innerHTML = `<div class="launch" style="background:rgba(10,12,16,.6)"><div class="panel stack" style="max-width:420px;width:100%;color:var(--ink)">
    <h2>Settings</h2>
    <label class="small muted" for="setDate">Exam date</label><input type="date" id="setDate" value="${esc(Store.settings.examDate || '')}">
    <label class="small muted">Language of explanations</label>
    <div class="seg"><button data-l="en" aria-pressed="${Store.settings.lang !== 'es'}">English (immersion)</button><button data-l="es" aria-pressed="${Store.settings.lang === 'es'}">Español</button></div>
    <p class="small muted">Progress is saved on this device (back it up or move it from ⚙ Settings). ${SAMPLE ? 'AI is connected for diagnoses, marking and new questions.' : 'AI features are off: add a provider in ⚙ Settings.'}</p>
    <div class="row"><button class="btn primary" id="setSave">Save</button><button class="btn ghost" id="setX">Close</button></div></div></div>`;
  let lang = Store.settings.lang || 'en';
  $$('[data-l]', o).forEach(b => b.onclick = () => { lang = b.dataset.l; $$('[data-l]', o).forEach(x => x.setAttribute('aria-pressed', x.dataset.l === lang)); });
  $('#setX', o).onclick = () => o.innerHTML = '';
  $('#setSave', o).onclick = () => { Store.settings.examDate = $('#setDate', o).value; Store.settings.lang = lang; Store.touch('settings'); o.innerHTML = ''; render(); toast('Settings saved'); };
}

/* ---------------- study plan ---------------- */
function planSession(exclude) {
  const ex = new Set([exclude, Store.settings.lastTp].filter(Boolean));
  let best = null;
  for (const t of TOPICS) {
    if (SKIP_AUTO.has(t.id) || ex.has(t.id)) continue;
    const w = wrongQueue(t.id).length, dc = dueCards(t.id).length;
    const score = w + dc * .5;
    if (score >= 3 && (!best || score > best.score)) best = {score, w, dc, tp: t.id};
  }
  if (best) return {mode: 'relearn', tp: best.tp, reason: [best.w ? best.w + ' question' + (best.w > 1 ? 's' : '') + ' you got wrong' : '', best.dc ? best.dc + ' flashcards due' : ''].filter(Boolean).join(' · ')};
  const fresh = TOPICS.filter(t => !SKIP_AUTO.has(t.id) && !ex.has(t.id) && M.S[t.id].n === 0 && M.S[t.id].cardN === 0).sort((a, b) => b.w - a.w);
  if (fresh.length) return {mode: 'new', tp: fresh[0].id, reason: 'Not studied yet · ' + (TOP[fresh[0].id].paper === 'uoe' ? 'Use of English' : PAPERS[TOP[fresh[0].id].paper])};
  const c = Object.entries(M.S).filter(([k]) => !SKIP_AUTO.has(k) && !ex.has(k)).sort((a, b) => b[1].prio - a[1].prio)[0];
  const st = c[1];
  return {mode: 'level', tp: c[0], reason: 'Mastery ' + pct(st.m) + (st.recentWrong ? ' · ' + st.recentWrong + ' recent errors' : '') + (st.wErr ? ' · ' + st.wErr + ' errors in your writing' : '')};
}
const MODE_WORD = {new: ['NEW', 'TOPIC'], relearn: ['RE', 'LEARNING'], level: ['LEVEL', 'UP']};
const MODE_KICK = {new: 'Starting something new', relearn: 'Back to what you missed', level: 'Raising your weakest score'};
function recommendations() {
  return Object.entries(M.S).filter(([k]) => !SKIP_AUTO.has(k)).sort((a, b) => b[1].prio - a[1].prio).slice(0, 4).map(([tp, st]) => {
    const pats = st.dx.slice(-3).map(a => a.dx.pattern);
    let why = st.n < 3 ? 'No data yet: diagnose it' : 'Mastery ' + pct(st.m) + (st.errs.length ? ' · ' + st.errs.length + ' errors' : '');
    if (pats.length) why += ' · e.g. “' + pats[pats.length - 1] + '”';
    if (st.wErr) why += ' · ' + st.wErr + ' slips in your writing';
    return {tp, st, why};
  });
}
function launch(plan, then) {
  const o = $('#overlay');
  const [w1, w2] = MODE_WORD[plan.mode];
  const letters = s => [...s].map((c, i) => `<span style="animation-delay:${i * 45}ms">${c}</span>`).join('');
  o.innerHTML = `<div class="launch" role="status" aria-live="polite"><div class="inner">
    <div class="kick">${esc(MODE_KICK[plan.mode])}</div>
    <div class="word">${letters(w1)}<span class="o" style="animation-delay:${w1.length * 45}ms">&nbsp;</span>${[...w2].map((c, i) => `<span class="o" style="animation-delay:${(w1.length + i + 1) * 45}ms">${c}</span>`).join('')}</div>
    <div class="topic">${esc(TOP[plan.tp].name)}</div>
    <div class="meta">${esc(plan.reason || '')}</div>
    <div class="bar"><i></i></div></div>
    <div class="ruler">${'<i></i>'.repeat(160)}</div></div>`;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => { const l = $('.launch', o); if (l) l.classList.add('out'); setTimeout(() => { o.innerHTML = ''; then(); }, 330); }, reduce ? 900 : 2350);
}
function snapshotFor(tp) { const p = TOP[tp].paper; return {m: M.S[tp].m, paper: p, score: scoreOf(M, p), overall: M.overall}; }
function startSession(plan) {
  plan = plan || planSession();
  const tp = plan.tp;
  const steps = ['lesson'];
  if (DECK_TP[tp]) steps.push('cards');
  steps.push('practice', 'wrap');
  App.sess = {plan, steps, i: 0, before: snapshotFor(tp), results: [], cards: null, qs: null, qi: 0, cardsDone: 0};
  Store.settings.lastTp = tp; Store.touch('settings');
  launch(plan, () => setTab('session'));
}

/* ---------------- TODAY ---------------- */
function viewToday() {
  const plan = planSession();
  const today = dayKey(Date.now());
  const todays = Store.attempts.filter(a => dayKey(a.t) === today);
  const qs = todays.filter(a => a.src !== 'card'), cardsT = todays.filter(a => a.src === 'card');
  const dl = daysLeft();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 19 ? 'Good afternoon' : 'Good evening';
  const recs = recommendations();
  const dueAll = dueCards().length;
  const lastW = Store.works.filter(w => w.kind === 'W').pop();
  const lisDone = new Set(Store.attempts.filter(a => a.paper === 'listening').map(a => a.q.split(':')[1]));
  const nextLis = LISTENING.find(p => !lisDone.has(p.id)) || LISTENING[0];
  $('#app').innerHTML = `<div class="view fade">
    ${dailyPanelHTML()}
    <section class="hero">
      <div class="panel hello">
        <div class="eyebrow">${dl != null && dl >= 0 ? dl + ' days left · ' : ''}Target: Grade A (C2)</div>
        <h1>${greet}${Store.settings.name ? ', ' + esc(Store.settings.name) : ''}</h1>
        <p class="muted" style="margin:6px 0 0">${Store.attempts.length ? 'One button. The app picks the topic, teaches it, drills it and checks your progress.' : 'Press the button. The first sessions diagnose you; after that every session targets what you get wrong.'}</p>
        <button class="studybtn" id="go">
          <span class="mode">${esc(MODE_KICK[plan.mode])}</span>
          <span class="lbl">STUDY <b>NOW</b></span>
          <span class="what">${esc(TOP[plan.tp].name)} · ${esc(plan.reason)}</span>
        </button>
        <div class="eyebrow" style="margin-top:22px">What you should study</div>
        <ol class="recs">${recs.map((r, i) => `<li><span class="n">${i + 1}</span><span style="min-width:0"><div class="t">${esc(TOP[r.tp].name)}</div><div class="w">${esc(r.why)}</div></span>
          <span class="row" style="gap:6px"><button class="btn sm ghost" data-learn="${r.tp}">Theory</button><button class="btn sm" data-study="${r.tp}">Study</button></span></li>`).join('')}</ol>
      </div>
      <div class="panel">
        <div class="row between"><div class="eyebrow">Estimated result</div><button class="btn sm ghost" data-go="progress">Details</button></div>
        <div class="row" style="margin-top:8px;align-items:flex-end;gap:14px">
          <span class="bigscore">${M.overall ?? '<span class="muted" style="font-size:32px">n/a</span>'}</span>
          <span style="display:grid;gap:4px">${gradeChip(M.overall)}<span class="small muted">${M.complete ? 'Overall · Cambridge English Scale' : 'Overall so far · ' + PAPER_ORDER.filter(p => M[p].score == null).length + ' paper(s) still calibrating'}</span></span>
        </div>
        <div class="minisor">${PAPER_ORDER.map(p => { const s = M[p].score; return `<div class="r"><span>${PAPERS[p]}</span><span class="meter"><i style="width:${s ? (s - 140) / 70 * 100 : 0}%;background:var(--${s ? 'g' + gradeOf(s).k : 'line'})"></i></span><span class="num">${s ?? '—'}</span><span class="small muted">${s ? gradeOf(s).cefr : calibNote(p)}</span></div>`; }).join('')}</div>
        <div class="eyebrow" style="margin-top:18px">Today</div>
        <div class="stat-row" style="margin-top:8px">
          <div class="stat"><b>${qs.length}</b><span class="small muted">questions</span></div>
          <div class="stat"><b>${qs.length ? pct(qs.filter(a => a.ok).length / qs.length) : '—'}</b><span class="small muted">accuracy</span></div>
          <div class="stat"><b>${cardsT.length}</b><span class="small muted">cards</span></div>
        </div>
        <div class="stack" style="margin-top:14px">
          ${dueAll ? `<button class="btn" data-go="cards">${dueAll} flashcards due →</button>` : ''}
          ${nextLis ? `<button class="btn" data-lis="${nextLis.id}">Listening: ${esc(nextLis.test)} Part ${nextLis.part} →</button>` : '<button class="btn" data-goto="media">Media Lab: a real video at C1 →</button>'}
          ${(() => { const r = nextResources(1)[0]; return r ? `<button class="btn" data-go="resources">Resource Bank: ${esc(r.t.length > 46 ? r.t.slice(0, 44) + '…' : r.t)} →</button>` : ''; })()}
          <button class="btn" data-go="write">${lastW ? 'Writing: last mark ' + lastW.res?.total?.toFixed(1) + '/20 →' : 'Writing: get your first mark →'}</button>
        </div>
      </div>
    </section></div>`;
  $('#go').onclick = () => startSession(plan);
  wireDaily();
  $$('[data-study]').forEach(b => b.onclick = () => { const tp = b.dataset.study; const w = wrongQueue(tp).length + dueCards(tp).length * .5; startSession({mode: M.S[tp].n === 0 ? 'new' : w >= 2 ? 'relearn' : 'level', tp, reason: recommendations().find(r => r.tp === tp)?.why || ''}); });
  $$('[data-learn]').forEach(b => b.onclick = () => openLearn(b.dataset.learn));
  $$('[data-go]').forEach(b => b.onclick = () => setTab(b.dataset.go));
  $$('[data-lis]').forEach(b => b.onclick = () => { App.lisPart = b.dataset.lis; setTab('listening'); });
}
function calibNote(p) { return p === 'writing' || p === 'speaking' ? 'no task' : p === 'uoe' ? (12 - M.uoe.n) + ' more' : (6 - M[p].n) + ' more'; }
function openLearn(id) { App.learn = THEORY.find(t => t.id === id) ? id : (DECK_TP[id] ? 'lib:' + DECK_TP[id].id : 'lesson:' + id); setTab('learn'); }

/* ---------------- SESSION ---------------- */
function viewSession() {
  const S = App.sess;
  if (!S) return setTab('today');
  const tp = S.plan.tp, step = S.steps[S.i];
  const names = {lesson: 'Learn', cards: 'Flashcards', practice: tp === 'listen' ? 'Listen' : 'Practice', wrap: 'Results'};
  $('#app').innerHTML = `<div class="view fade">
    <div class="sesshead"><div><div class="eyebrow">${esc(MODE_KICK[S.plan.mode])}</div><h1>${esc(TOP[tp].name)}</h1></div>
      <div class="steps">${S.steps.map((s, i) => `<span class="s ${i < S.i ? 'done' : i === S.i ? 'on' : ''}">${i < S.i ? '✓' : i + 1} ${names[s]}</span>`).join('')}<button class="btn sm ghost" id="sx">End session</button></div></div>
    <div class="panel" id="sbody"></div></div>`;
  $('#sx').onclick = () => { App.sess = null; setTab('today'); };
  const body = $('#sbody');
  const next = () => { S.i++; viewSession(); window.scrollTo(0, 0); };
  if (step === 'lesson') {
    const L = LESSONS[tp] || [];
    body.innerHTML = `<div class="stack"><div class="eyebrow">The essentials · 1 minute</div><ul class="lesson">${L.map(x => `<li>${x}</li>`).join('')}</ul>
      ${S.plan.mode === 'relearn' ? `<div class="chip why" style="justify-self:start;padding:8px 12px;border-radius:10px">You're coming back to this because: ${esc(S.plan.reason)}. ${M.S[tp].dx.slice(-1)[0] ? 'Your last pattern: “' + esc(M.S[tp].dx.slice(-1)[0].dx.pattern) + '”.' : ''}</div>` : ''}
      <div class="row"><button class="btn accent" id="snext">Got it, ${DECK_TP[tp] ? 'flashcards' : 'practise'} →</button><button class="btn ghost" id="sth">Read the full theory</button></div></div>`;
    $('#snext').onclick = next;
    $('#sth').onclick = () => openLearn(tp);
  } else if (step === 'cards') {
    if (!S.cards) { const due = dueCards(tp).slice(0, 8); S.cards = [...due, ...(tp === 'tvoc' ? nextVocabCards(8 - due.length) : newCards(tp, 8 - due.length))]; S.ci = 0; }
    runCards(body, S.cards, () => next(), {startAt: S.ci, onIndex: i => S.ci = i});
  } else if (step === 'practice') {
    if (tp === 'tvoc') {
      const pool = (S.cards || []).map(c => vocabRow(c.front)).filter(Boolean);
      const extra = dueCards('tvoc').map(c => vocabRow(c.front)).filter(Boolean);
      const words = [...pool, ...extra.filter(w => !pool.includes(w))].slice(0, 8);
      mountVocabQuiz(body, words.length >= 4 ? words : VOCAB[0].words.slice(0, 8), res => S.results.push(...res), {onNext: next, nextLabel: 'See results →'});
      return;
    }
    if (tp === 'listen' && !LISTENING.length) { body.innerHTML = '<p>No exam listening recordings yet. Import your content pack (⚙ Settings) or use the Media Lab.</p>'; return; }
    if (tp === 'listen') {
      const done = new Set(Store.attempts.filter(a => a.paper === 'listening').map(a => a.q.split(':')[1]));
      const part = LISTENING.find(p => !done.has(p.id)) || worstListening();
      mountListening(body, part, res => { S.results.push(...res); }, {onNext: next, nextLabel: 'See results →'});
      return;
    }
    if (!S.qs) {
      const relearn = S.plan.mode === 'relearn';
      S.qs = pickQuestions(tp, tp === 'read' ? 4 : 6, {relearn, part: tp === 'read' ? 5 : undefined});
      S.qi = 0;
    }
    if (S.qi >= S.qs.length) {
      if (S.qs.length < 6 && SAMPLE && tp !== 'read' && !S.genTried) {
        S.genTried = true;
        body.innerHTML = `<div class="loading"><span class="thinking">Claude is writing fresh ${esc(TOP[tp].name.toLowerCase())} questions for you</span></div>`;
        aiGenerate(tp, 6 - S.qs.length).then(items => { S.qs.push(...items); viewSession(); }).catch(() => { next(); });
        return;
      }
      if (tp === 'read' && SAMPLE && !S.genTried) {
        S.genTried = true;
        body.innerHTML = `<div class="stack"><p>Bank items done. Want a full Part 5 text written for you?</p><div class="row"><button class="btn accent" id="rgen">Generate a reading text</button><button class="btn" id="rskip">See results</button></div></div>`;
        $('#rskip').onclick = next;
        $('#rgen').onclick = () => { body.innerHTML = `<div class="loading"><span class="thinking">Claude is writing a C1 reading text</span></div>`; aiReading().then(rd => mountReading(body, rd, r => S.results.push(...r), {onNext: next})).catch(() => { toast('Generation failed. Try again later.'); next(); }); };
        return;
      }
      return next();
    }
    const q = S.qs[S.qi];
    const why = S.plan.mode === 'relearn' && wrongQueue(tp).some(a => a.q === q.id) ? 'Review: you got this wrong before. Try it without looking at the rule.' : null;
    body.innerHTML = `<div class="row between" style="margin-bottom:10px"><span class="small muted">Question ${S.qi + 1} of ${S.qs.length}</span><span class="meter" style="width:160px"><i style="width:${S.qi / S.qs.length * 100}%"></i></span></div><div id="qhost"></div>`;
    mountQuestion($('#qhost'), q, {why, onDone: a => S.results.push(a), onNext: () => { S.qi++; viewSession(); window.scrollTo(0, 0); }, nextLabel: S.qi + 1 < S.qs.length ? 'Next' : 'Finish'});
  } else if (step === 'wrap') {
    renderWrap(body);
  }
}
function worstListening() {
  const by = {};
  for (const a of Store.attempts) if (a.paper === 'listening') { const id = a.q.split(':')[1]; (by[id] ||= []).push(a.ok ? 1 : 0); }
  return LISTENING.slice().sort((a, b) => avgOf(by[a.id]) - avgOf(by[b.id]))[0];
}
const avgOf = x => x && x.length ? x.reduce((s, v) => s + v, 0) / x.length : 1;
function renderWrap(body) {
  const S = App.sess, tp = S.plan.tp;
  if (!S.counted) { S.counted = true; bumpAct('sess'); }
  computeModel();
  const after = snapshotFor(tp);
  const res = S.results;
  const ok = res.filter(a => a.ok).length;
  const dM = after.m - S.before.m;
  const d = (after.score ?? 0) - (S.before.score ?? 0);
  const nextPlan = planSession(tp);
  const arrow = x => x > 0 ? `<span class="up">▲ +${x}</span>` : x < 0 ? `<span class="down">▼ ${x}</span>` : `<span class="flat">▬ 0</span>`;
  body.innerHTML = `<div class="wrapup">
    <div class="eyebrow">Session complete</div>
    <div class="grid3">
      <div class="stat"><span class="small muted">Score</span><b>${ok}/${res.length || 0}</b></div>
      <div class="stat"><span class="small muted">${esc(TOP[tp].name)} mastery</span><b><span id="mcount">${Math.round(S.before.m * 100)}</span>%</b><span class="small">${dM >= 0 ? '<span class="up">▲' : '<span class="down">▼'} ${Math.abs(Math.round(dM * 100))} pts</span></span></div>
      <div class="stat"><span class="small muted">${PAPERS[after.paper]}</span><b><span id="scount">${S.before.score ?? '—'}</span></b><span class="small">${after.score != null && S.before.score != null ? arrow(d) : after.score != null ? 'now calibrated' : 'still calibrating'} ${after.score != null ? gradeChip(after.score) : ''}</span></div>
    </div>
    <div class="meter" style="height:12px"><i id="mbar" style="width:${S.before.m * 100}%"></i></div>
    ${res.filter(a => !a.ok).length ? `<div><div class="eyebrow" style="margin-bottom:6px">Will come back for review</div><div class="loglist">${res.filter(a => !a.ok).map(a => `<div class="logi"><span class="s">${esc(attemptLabel(a))}</span><span class="chip bad">${esc(a.dx?.pattern || ERRT[a.et] || 'review')}</span></div>`).join('')}</div></div>` : '<p class="chip good" style="justify-self:start;padding:8px 12px">Clean sheet. This topic will come back later to make it stick.</p>'}
    <div class="row"><button class="btn accent" id="again">Keep going: ${esc(TOP[nextPlan.tp].name)} →</button><button class="btn" id="home">Back to Today</button></div></div>`;
  requestAnimationFrame(() => setTimeout(() => {
    $('#mbar').style.width = after.m * 100 + '%';
    tween($('#mcount'), Math.round(S.before.m * 100), Math.round(after.m * 100));
    if (after.score != null) tween($('#scount'), S.before.score ?? after.score - 5, after.score);
  }, 120));
  $('#again').onclick = () => startSession(nextPlan);
  $('#home').onclick = () => { App.sess = null; setTab('today'); };
}
function tween(el, a, b, ms = 900) {
  if (!el) return; const t0 = performance.now();
  const f = t => { const k = Math.min(1, (t - t0) / ms); el.textContent = Math.round(a + (b - a) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function attemptLabel(a) {
  const q = Q.get(a.q);
  if (q) return (q.s || q.s2 || '').replace('___', '[' + a.ch + ']').slice(0, 140);
  if (a.paper === 'listening') return a.label || 'Listening item';
  if (a.label) return a.label;
  if (a.paper === 'reading') return a.label || 'Reading item';
  return a.q;
}

/* ---------------- flashcards ---------------- */
function runCards(el, list, onDone, opts = {}) {
  let i = opts.startAt || 0, flipped = false, rev = !!App.cardRev;
  const counts = [0, 0, 0, 0];
  const paint = () => {
    if (i >= list.length) {
      el.innerHTML = `<div class="stack" style="text-align:center;justify-items:center"><div class="eyebrow">Cards done</div><div class="bigdelta">${list.length}</div><p class="muted">Again ${counts[0]} · Hard ${counts[1]} · Good ${counts[2]} · Easy ${counts[3]}</p><button class="btn accent" id="cdone">${opts.doneLabel || 'Continue →'}</button></div>`;
      $('#cdone', el).onclick = onDone; return;
    }
    if (!list.length) { onDone(); return; }
    const c = list[i];
    const st = cardState(c.id);
    const front = rev ? `<div class="mean">${esc(c.back)}</div>` : `<div class="term">${esc(c.front)}</div>`;
    const back = rev ? `<div class="term">${esc(c.front)}</div><div class="ex">${esc(c.ex)}</div>` : `<div class="term" style="font-size:22px">${esc(c.front)}</div><div class="mean">${esc(c.back)}</div><div class="ex">${esc(c.ex)}</div>`;
    el.innerHTML = `<div class="stack">
      <div class="row between"><span class="small muted">${i + 1} / ${list.length} · ${esc(DECKS.find(d => d.id === c.deck).name)} · ${st ? 'box ' + st[0] : 'new'}</span>
      <div class="seg"><button data-rev="0" aria-pressed="${!rev}">Term → meaning</button><button data-rev="1" aria-pressed="${rev}">Meaning → term</button></div></div>
      <div class="card3d"><div class="flip ${flipped ? 'on' : ''}" id="flip" tabindex="0" role="button" aria-label="Flip card"><div class="face">${front}<div class="small muted">Tap or press Space to flip</div></div><div class="face back">${back}</div></div></div>
      <div class="rate" ${flipped ? '' : 'hidden'}>${[['again', 'Again', '<5 min'], ['hard', 'Hard', 'soon'], ['good', 'Good', BOX_DAYS[Math.min(5, (st?.[0] || 0) + 1)] + 'd'], ['easy', 'Easy', BOX_DAYS[Math.min(5, (st?.[0] || 0) + 2)] + 'd']].map(([k, l, s], r) => `<button class="${k}" data-r="${r}">${l}<small>${s} · ${r + 1}</small></button>`).join('')}</div></div>`;
    $('#flip', el).onclick = () => { flipped = !flipped; paint(); };
    $$('[data-rev]', el).forEach(b => b.onclick = () => { rev = App.cardRev = b.dataset.rev === '1'; flipped = false; paint(); });
    $$('[data-r]', el).forEach(b => b.onclick = () => rate(+b.dataset.r));
  };
  const rate = r => { const c = list[i]; rateCard(c, r); counts[r]++; if (r === 0 && list.length < 40) list.push(c); i++; flipped = false; opts.onIndex?.(i); paint(); };
  mountQuestion._key = e => {
    if (!el.isConnected || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ' && i < list.length) { e.preventDefault(); flipped = !flipped; paint(); }
    else if (flipped && /^[1-4]$/.test(e.key)) rate(+e.key - 1);
  };
  paint();
}
function viewCards() {
  if (App.cardRun) {
    $('#app').innerHTML = `<div class="view fade"><div class="row between"><h2 style="font-size:24px">${esc(App.cardRun.title)}</h2><button class="btn ghost sm" id="cx">Stop</button></div><div class="panel" id="cbody"></div></div>`;
    $('#cx').onclick = () => { App.cardRun = null; render(); };
    runCards($('#cbody'), App.cardRun.list, () => { App.cardRun = null; render(); }, {doneLabel: 'Back to decks'});
    return;
  }
  const due = dueCards();
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel row between"><div><h2>Flashcards</h2><p class="muted small" style="margin:4px 0 0">Spaced repetition: cards you miss come back in minutes; cards you know move to longer intervals (1, 3, 7, 16, 35 days). Keys: Space flips, 1–4 rate.</p></div>
      <button class="btn accent" id="alldue" ${due.length ? '' : 'disabled'}>Review ${due.length} due</button></div>
    <div class="decks">${DECKS.map(d => {
      const ids = d.list.map(r => d.id + ':' + r[0]);
      const boxes = [0, 0, 0, 0, 0, 0]; let seen = 0;
      for (const id of ids) { const s = Store.cards[id]; if (s) { boxes[s[0]]++; seen++; } }
      const dd = due.filter(c => c.deck === d.id).length;
      const mx = Math.max(1, ...boxes);
      return `<button class="deck" data-deck="${d.id}"><b>${esc(d.name)}</b><span class="small muted">${ids.length} cards · ${seen} started · ${dd} due</span>
        <span class="boxes" title="Cards per box (0 = learning … 5 = long-term)">${boxes.map(b => `<i style="height:${4 + b / mx * 18}px;opacity:${b ? .9 : .2}"></i>`).join('')}</span>
        <span class="small" style="color:var(--gA);font-weight:700">Study ${dd ? dd + ' due + ' : ''}new →</span></button>`;
    }).join('')}</div></div>`;
  $('#alldue').onclick = () => { App.cardRun = {title: 'All due cards', list: due.slice(0, 40)}; render(); };
  $$('[data-deck]').forEach(b => b.onclick = () => {
    const d = DECKS.find(x => x.id === b.dataset.deck);
    const dd = dueCards(d.tp).filter(c => c.deck === d.id).slice(0, 20);
    App.cardRun = {title: d.name, list: [...dd, ...newCards(d.tp, 20 - dd.length).filter(c => c.deck === d.id)]};
    render();
  });
}

/* ---------------- PRACTICE ---------------- */
function nextPractice() {
  const P = App.prac;
  if (P.mode === 'set') return P.setId ? nextSetItem() : null;
  if (P.mode === 'part') { const q = pickQuestions(null, 1, {part: P.part})[0]; return q ? {q, why: 'Mixed ' + PART_NAME[P.part] + ' items.'} : null; }
  if (P.mode === 'topic') { const q = pickQuestions(P.tp, 1, {relearn: Math.random() < .3})[0]; return q ? {q, why: 'Focused practice: ' + TOP[P.tp].name + '.'} : null; }
  const prac = Store.attempts.filter(a => a.src !== 'card' && a.paper !== 'listening');
  const last = prac[prac.length - 1];
  if (last && !last.ok && !P.followed?.has(last.k)) {
    (P.followed ||= new Set()).add(last.k);
    const q = pickQuestions(last.tp, 1)[0];
    if (q) return {q, why: 'Same pattern: you just missed ' + TOP[last.tp].name + '. Have you fixed it?'};
  }
  if (Math.random() < .25) { const w = wrongQueue(); if (w.length) { const a = w[w.length - 1]; return {q: Q.get(a.q), why: 'Review: you missed this on ' + new Date(a.t).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}) + '. Try again without the rule.'}; } }
  const cands = Object.entries(M.S).filter(([k]) => !SKIP_AUTO.has(k) && k !== 'listen' && poolFor(k).some(q => !Store.attempts.some(a => a.q === q.id))).sort((a, b) => b[1].prio - a[1].prio).slice(0, 5);
  if (!cands.length) return null;
  const w = cands.map(([, s]) => s.prio ** 2), tot = w.reduce((s, v) => s + v, 0);
  let r = Math.random() * tot, i = 0; while (i < cands.length - 1 && (r -= w[i]) > 0) i++;
  const [tp, st] = cands[i];
  const q = pickQuestions(tp, 1)[0];
  return q ? {q, why: st.n < 3 ? 'Calibrating: little data on ' + TOP[tp].name + ' yet.' : TOP[tp].name + ': mastery ' + pct(st.m) + (st.recentWrong ? ', recent errors' : '') + '.'} : null;
}
function viewPractice() {
  const P = App.prac;
  const topics = TOPICS.filter(t => t.paper === 'uoe' || t.id === 'read');
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel stack">
      <div class="row between"><h2>Practice</h2><span class="small muted">${Q.size} questions available · Claude writes more when you run out</span></div>
      <div class="row">
        <div class="seg"><button data-m="mix" aria-pressed="${P.mode === 'mix'}">Adaptive mix</button><button data-m="part" aria-pressed="${P.mode === 'part'}">By exam part</button><button data-m="topic" aria-pressed="${P.mode === 'topic'}">By topic</button><button data-m="set" aria-pressed="${P.mode === 'set'}">Imported tests (${Store.sets.length})</button></div>
        ${P.mode === 'set' && P.setId ? `<button class="btn sm ghost" id="psets">← All imported tests</button>` : ''}
        ${P.mode === 'part' ? `<div class="seg">${[1, 2, 3, 4, 5].map(p => `<button data-p="${p}" aria-pressed="${P.part === p}">${PART_SHORT[p]}</button>`).join('')}</div>` : ''}
        ${P.mode === 'topic' ? `<select id="ptp" aria-label="Topic">${topics.map(t => `<option value="${t.id}" ${t.id === P.tp ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : ''}
      </div>
      <div class="row">${SAMPLE ? `<button class="btn sm" id="pgen">Claude: write 6 new questions${P.mode === 'topic' ? ' on this topic' : ' on my weakest topic'}</button><button class="btn sm" id="prd">Reading lab: generate a Part 5 text</button>` : ''}${Store.reading.length ? `<button class="btn sm ghost" id="prdold">Past reading texts (${Store.reading.length})</button>` : ''}</div>
    </div>
    <div class="panel" id="phost"></div></div>`;
  $$('[data-m]').forEach(b => b.onclick = () => { P.mode = b.dataset.m; P.cur = null; P.setId = null; P.setDone = null; render(); });
  if ($('#psets')) $('#psets').onclick = () => { P.setId = null; P.cur = null; P.setDone = null; render(); };
  $$('[data-p]').forEach(b => b.onclick = () => { P.part = +b.dataset.p; P.cur = null; render(); });
  if ($('#ptp')) $('#ptp').onchange = e => { P.tp = e.target.value; P.cur = null; render(); };
  const host = $('#phost');
  if ($('#pgen')) $('#pgen').onclick = () => {
    const tp = P.mode === 'topic' ? P.tp : (Object.entries(M.S).filter(([k]) => GEN_PARTS[k]).sort((a, b) => b[1].prio - a[1].prio)[0][0]);
    host.innerHTML = `<div class="loading"><span class="thinking">Claude is writing 6 ${esc(TOP[tp].name.toLowerCase())} questions</span></div>`;
    aiGenerate(tp, 6, P.mode === 'part' && P.part < 5 ? [P.part] : undefined).then(items => { toast(items.length + ' new questions added'); P.mode = 'topic'; P.tp = tp; P.cur = {q: items[0], why: 'New Claude-written item on ' + TOP[tp].name + '.'}; render(); }).catch(() => { toast('Generation failed. Try again.'); render(); });
  };
  if ($('#prd')) $('#prd').onclick = () => { host.innerHTML = `<div class="loading"><span class="thinking">Claude is writing a C1 reading text</span></div>`; aiReading().then(rd => mountReading(host, rd, () => {}, {onNext: () => { P.cur = null; render(); }})).catch(() => { toast('Generation failed. Try again.'); render(); }); };
  if ($('#prdold')) $('#prdold').onclick = () => {
    host.innerHTML = `<div class="stack"><h2>Past reading texts</h2>${Store.reading.slice().reverse().map(r => `<button class="trk" data-rid="${r.id}"><span class="pn">R5</span><span><b>${esc(r.title)}</b><div class="small muted">${new Date(r.t).toLocaleDateString('en-GB')} · ${r.questions.length} questions</div></span><span>→</span></button>`).join('')}</div>`;
    $$('[data-rid]', host).forEach(b => b.onclick = () => mountReading(host, Store.reading.find(r => r.id === b.dataset.rid), () => {}, {onNext: () => { P.cur = null; render(); }}));
  };
  if (P.mode === 'set' && !P.setId) {
    host.innerHTML = `<div class="stack"><h2>Imported tests</h2><p class="small muted" style="margin:0">Tests from your Resource Bank, turned into Ruta questions. Bring one in from Resources → “Practise it here”.</p>${Store.sets.length ? setListHTML() : ''}<div><button class="btn accent" id="pimp">Bring a test in →</button></div></div>`;
    wireSetList(); $('#pimp').onclick = () => openImport(null); return;
  }
  if (!P.cur) P.cur = nextPractice();
  if (!P.cur && P.mode === 'set') { host.innerHTML = `<div class="stack"><p>You've been through the whole set.</p><div class="row"><button class="btn accent" id="pagain">Do it again (misses first)</button><button class="btn" id="pback">All imported tests</button></div></div>`; $('#pagain').onclick = () => { P.setDone = null; render(); }; $('#pback').onclick = () => { P.setId = null; render(); }; return; }
  if (!P.cur) {
    host.innerHTML = `<div class="stack"><p>You've answered every question in this selection.</p>${SAMPLE ? '<p class="muted">Use the button above to have Claude write new ones.</p>' : ''}</div>`;
    return;
  }
  mountQuestion(host, P.cur.q, {why: P.cur.why, skip: true, onNext: () => { P.cur = null; viewPractice(); window.scrollTo(0, 0); }});
}

/* ---------------- READING (generated Part 5) ---------------- */
function mountReading(el, rd, onResults, opts = {}) {
  const ans = {}; let done = false; const t0 = Date.now();
  const paint = () => {
    el.innerHTML = `<div class="reading fade"><div class="stack"><div class="eyebrow">Reading Part 5 · ${esc(rd.source || 'C1 text')}</div><h2 style="font-size:22px">${esc(rd.title)}</h2><div class="passage">${esc(rd.text)}</div></div>
      <div class="stack">${rd.questions.map((q, i) => {
        const ord = shuffleIdx(4, rd.id + i);
        return `<div class="lq"><div class="qq">${i + 1}. ${esc(q.q)}</div><div class="choices">${ord.map((oi, j) => { let c = ''; if (done) { if (oi === q.a) c = 'right'; else if (ans[i] === oi) c = 'wrong'; } else if (ans[i] === oi) c = 'sel'; return `<button class="choice ${c}" data-i="${i}" data-oi="${oi}"><span class="b">${LETTERS[j]}</span><span>${esc(q.o[oi])}</span></button>`; }).join('')}</div>
        ${done ? `<div class="expl small">${esc(q.ex)}</div>` : ''}</div>`;
      }).join('')}
      <div class="row">${done ? `<button class="btn accent" id="rnext">${opts.nextLabel || 'Continue'}</button>` : `<button class="btn primary" id="rsub" ${Object.keys(ans).length === rd.questions.length ? '' : 'disabled'}>Check answers</button><span class="small muted">${Object.keys(ans).length}/${rd.questions.length} answered</span>`}</div></div></div>`;
    $$('[data-oi]', el).forEach(b => b.onclick = () => { if (done) return; ans[b.dataset.i] = +b.dataset.oi; paint(); });
    if ($('#rsub', el)) $('#rsub', el).onclick = submit;
    if ($('#rnext', el)) $('#rnext', el).onclick = () => opts.onNext?.();
  };
  const submit = () => {
    done = true;
    const res = rd.questions.map((q, i) => ({k: uid(), t: Date.now(), q: 'r:' + rd.id + ':' + i, tp: 'read', p: 5, paper: 'reading', src: 'gen', lv: 3, ok: ans[i] === q.a, ch: String(ans[i]), ms: Math.round((Date.now() - t0) / rd.questions.length), label: q.q, dx: ans[i] === q.a ? undefined : {type: 'context', pattern: (q.skill || 'reading') + ' question', why: q.ex, rule: '', practice: ''}}));
    res.forEach(a => Store.addAttempt(a));
    computeModel(); onResults(res); paint();
    toast(res.filter(a => a.ok).length + '/' + res.length + ' correct');
  };
  paint();
}

/* ---------------- LISTENING ---------------- */
function viewListening() {
  if (!LISTENING.length) return viewListeningEmpty();
  if (App.lisPart) {
    const part = LISTENING.find(p => p.id === App.lisPart);
    $('#app').innerHTML = `<div class="view fade"><div class="row between"><button class="btn ghost sm" id="lback">← All recordings</button></div><div class="panel" id="lhost"></div></div>`;
    $('#lback').onclick = () => { App.lisPart = null; render(); };
    mountListening($('#lhost'), part, () => {}, {onNext: () => { App.lisPart = null; render(); }, nextLabel: 'Back to recordings'});
    return;
  }
  const by = {};
  for (const a of Store.attempts) if (a.paper === 'listening') { const [, id, , run] = a.q.split(':'); (by[id] ||= {}); (by[id][a.run] ||= []).push(a.ok ? 1 : 0); }
  const groups = [...new Set(LISTENING.map(p => p.test))];
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel"><div class="row between"><h2>Listening</h2><span class="small">${M.listening.score ? `<span class="num">${M.listening.score}</span> ${gradeChip(M.listening.score)}` : '<span class="muted">Score appears after 6 items</span>'}</span></div>
    <p class="small muted" style="margin:6px 0 0">${esc(window.PACK_INFO?.title || 'Recordings from your content pack')}. Each recording plays both times, exactly as in the exam. Answer, check, then read the evidence and the transcript; Claude explains every trap you fell for.</p></div>
    ${groups.map(g => `<div class="panel stack"><h2>${esc(g)}</h2><div class="tracks">${LISTENING.filter(p => p.test === g).map(p => {
      const runs = Object.values(by[p.id] || {}); const last = runs[runs.length - 1];
      const n = p.kind === 'match' ? 10 : p.qs.length;
      return `<button class="trk" data-pid="${p.id}"><span class="pn">P${p.part}</span><span style="min-width:0"><b>${esc(p.title)}</b><div class="small muted">${n} questions · ${p.kind === 'mc3' ? 'multiple choice A–C' : p.kind === 'mc4' ? 'multiple choice A–D' : p.kind === 'gap' ? 'sentence completion' : 'multiple matching, 2 tasks'}</div></span>
        <span class="small">${last ? `<span class="chip ${avgOf(last) >= .8 ? 'good' : avgOf(last) >= .6 ? 'warn' : 'bad'}">${last.reduce((s, v) => s + v, 0)}/${last.length}</span>` : '<span class="chip">New</span>'}</span></button>`;
    }).join('')}</div></div>`).join('')}</div>`;
  $$('[data-pid]').forEach(b => b.onclick = () => { App.lisPart = b.dataset.pid; render(); });
}
function mountListening(el, part, onResults, opts = {}) {
  const key = part.file.split('/').pop().replace('.mp3', '');
  const TR = TRANSCRIPTS[key]?.tr || [];
  const st = {ans: {}, done: false, res: null, dx: null, run: uid()};
  const items = part.kind === 'match'
    ? part.tasks.flatMap((t, ti) => [0, 1, 2, 3, 4].map(s => ({n: (part.part === 4 ? 21 : 1) + ti * 5 + s, ti, s, task: t})))
    : part.qs;
  const ordOf = ti => shuffleIdx(8, part.id + 't' + ti);
  el.innerHTML = `<div class="stack fade">
    <div class="row between"><div><div class="eyebrow">${esc(part.test)} · Listening Part ${part.part}</div><h2 style="font-size:22px">${esc(part.title)}</h2></div></div>
    <div class="player" id="pl"><audio id="au" preload="metadata" src="${esc(window.BLOB_URLS?.['pack:' + part.file] || part.file)}"></audio>
      <div class="ctl"><button class="play" id="pp" aria-label="Play">▶</button><button id="bk">−5 s</button><button id="fw">+5 s</button>
      <button id="sp">1.0×</button><span class="track" id="trk"><i id="tri"></i></span><span class="tm" id="tm">0:00 / 0:00</span></div>
      <div class="small" style="opacity:.75">${esc(part.intro)}</div></div>
    <div id="lqs"></div><div id="lctl"></div><div id="lfb"></div></div>`;
  const au = $('#au', el);
  const speeds = [1, 1.1, .9]; let si = 0;
  $('#pp', el).onclick = () => au.paused ? au.play().catch(() => toast('Tap play again to start audio')) : au.pause();
  $('#bk', el).onclick = () => au.currentTime = Math.max(0, au.currentTime - 5);
  $('#fw', el).onclick = () => au.currentTime = Math.min(au.duration || 0, au.currentTime + 5);
  $('#sp', el).onclick = () => { si = (si + 1) % speeds.length; au.playbackRate = speeds[si]; $('#sp', el).textContent = speeds[si].toFixed(1) + '×'; };
  $('#trk', el).onclick = e => { const r = e.currentTarget.getBoundingClientRect(); if (au.duration) au.currentTime = (e.clientX - r.left) / r.width * au.duration; };
  const upd = () => {
    $('#pp', el).textContent = au.paused ? '▶' : '❚❚';
    $('#tri', el).style.width = (au.duration ? au.currentTime / au.duration * 100 : 0) + '%';
    $('#tm', el).textContent = fmtTime(au.currentTime * 1000) + ' / ' + fmtTime((au.duration || 0) * 1000);
    if (st.done) { const now = $$('.tr button', el); let idx = -1; TR.forEach((x, i) => { if (x[0] <= au.currentTime) idx = i; }); now.forEach((b, i) => b.classList.toggle('now', i === idx)); }
  };
  ['timeupdate', 'play', 'pause', 'loadedmetadata'].forEach(ev => au.addEventListener(ev, upd));
  const paintQs = () => {
    const box = $('#lqs', el);
    if (part.kind === 'match') {
      box.innerHTML = part.tasks.map((t, ti) => {
        const ord = ordOf(ti);
        return `<div class="stack" style="margin-bottom:18px"><div class="eyebrow">${esc(t.label)}</div>
          <div class="legend">${ord.map((oi, j) => `<div><b>${LETTERS[j]}</b> ${esc(t.opts[oi])}</div>`).join('')}</div>
          <div class="matchgrid">${[0, 1, 2, 3, 4].map(s => {
            const k = ti + ':' + s, my = st.ans[k];
            return `<div class="matchrow"><b>Speaker ${s + 1}</b><div class="opts">${ord.map((oi, j) => { let c = ''; if (st.done) { if (oi === t.ans[s]) c = 'right'; else if (my === oi) c = 'wrong'; } else if (my === oi) c = 'sel'; return `<button class="opt ${c}" data-k="${k}" data-oi="${oi}" aria-label="Speaker ${s + 1}: ${LETTERS[j]}">${LETTERS[j]}</button>`; }).join('')}</div></div>
            ${st.done && my !== t.ans[s] ? `<div class="ev">${esc(t.ev[s])}</div>` : ''}`;
          }).join('')}</div></div>`;
      }).join('');
    } else {
      box.innerHTML = part.qs.map(q => {
        const my = st.ans[q.n];
        const dx = st.dx?.items?.find(x => x.n === q.n);
        const res = st.res?.find(r => r.n === q.n);
        let inner;
        if (part.kind === 'gap') inner = `<div class="ans"><input data-n="${q.n}" value="${esc(my || '')}" ${st.done ? 'disabled' : ''} class="${st.done ? (res.ok ? 'ok' : 'no') : ''}" aria-label="Answer ${q.n}" autocomplete="off" spellcheck="false"></div>`;
        else inner = `<div class="choices">${q.o.map((o, i) => { let c = ''; if (st.done) { if (i === q.a) c = 'right'; else if (my === i) c = 'wrong'; } else if (my === i) c = 'sel'; return `<button class="choice ${c}" data-n="${q.n}" data-i="${i}"><span class="b">${LETTERS[i]}</span><span>${esc(o)}</span></button>`; }).join('')}</div>`;
        return `<div class="lq">${q.ctx ? `<div class="ctx">${esc(q.ctx)}</div>` : ''}<div class="qq">${q.n}. ${part.kind === 'gap' ? esc(q.q).replace('____', '<span class="gap" style="min-width:60px;display:inline-block;border-bottom:2px solid var(--ink)">&nbsp;</span>') : esc(q.q)}</div>${inner}
          ${st.done && !res.ok ? `<div class="ev">${part.kind === 'gap' ? 'Answer: <b>' + esc(q.a[0]) + '</b> · ' : ''}${esc(q.ev)}</div>${dx ? `<div class="dx"><div class="row"><span class="chip bad">${esc(dx.type)}</span></div><dl><dt>The trap</dt><dd>${esc(dx.trap)}</dd><dt>Listen for</dt><dd>${esc(dx.signal)}</dd></dl></div>` : ''}` : ''}
          ${st.done && res.ok ? `<div class="ev">${esc(q.ev)}</div>` : ''}</div>`;
      }).join('');
    }
    $$('[data-k]', box).forEach(b => b.onclick = () => { if (st.done) return; st.ans[b.dataset.k] = +b.dataset.oi; paintQs(); paintCtl(); });
    $$('button[data-n]', box).forEach(b => b.onclick = () => { if (st.done) return; st.ans[b.dataset.n] = +b.dataset.i; paintQs(); paintCtl(); });
    $$('input[data-n]', box).forEach(inp => inp.oninput = () => { st.ans[inp.dataset.n] = inp.value; paintCtl(); });
  };
  const answered = () => part.kind === 'match' ? Object.keys(st.ans).length : part.qs.filter(q => st.ans[q.n] != null && String(st.ans[q.n]).trim() !== '').length;
  const total = items.length;
  const paintCtl = () => {
    const c = $('#lctl', el);
    if (st.done) { c.innerHTML = ''; return; }
    c.innerHTML = `<div class="row"><button class="btn primary" id="lsub" ${answered() ? '' : 'disabled'}>Check answers</button><span class="small muted">${answered()}/${total} answered${answered() < total ? ' · blanks count as wrong' : ''}</span></div>`;
    $('#lsub', c).onclick = submit;
  };
  const gapOk = (q, v) => { const n = norm(v).replace(/^(a|an|the) /, ''); return q.a.some(x => norm(x).replace(/^(a|an|the) /, '') === n); };
  const submit = async () => {
    st.done = true;
    const now = Date.now(); const res = [];
    if (part.kind === 'match') {
      part.tasks.forEach((t, ti) => [0, 1, 2, 3, 4].forEach(s => { const my = st.ans[ti + ':' + s]; res.push({n: 21 + ti * 5 + s, ok: my === t.ans[s], chosen: my != null ? t.opts[my] : '(blank)', correct: t.opts[t.ans[s]], q: t.label + ' – Speaker ' + (s + 1), ev: t.ev[s]}); }));
    } else part.qs.forEach(q => {
      const my = st.ans[q.n];
      const ok = part.kind === 'gap' ? gapOk(q, my) : my === q.a;
      res.push({n: q.n, ok, chosen: part.kind === 'gap' ? (my || '(blank)') : my != null ? q.o[my] : '(blank)', correct: part.kind === 'gap' ? q.a[0] : q.o[q.a], q: q.q, ev: q.ev});
    });
    st.res = res;
    const atts = res.map(r => ({k: uid(), t: now, q: 'l:' + part.id + ':' + r.n, run: st.run, tp: 'listen', p: 'L' + part.part, paper: 'listening', src: 'lis', lv: 2, ok: r.ok, ch: String(r.chosen), label: `${part.test} P${part.part} Q${r.n}: ${r.q}`}));
    atts.forEach(a => Store.addAttempt(a));
    computeModel(); onResults(atts);
    paintQs(); paintCtl(); paintFb();
    const wrong = res.filter(r => !r.ok);
    if (wrong.length && SAMPLE) {
      $('#ldx', el).innerHTML = '<span class="thinking">Claude is analysing the traps you fell for</span>';
      try {
        st.dx = await aiListeningDx(part, wrong);
        for (const it of st.dx.items || []) { const a = atts.find(x => x.q.endsWith(':' + it.n)); if (a) { a.dx = {type: 'trap', pattern: it.type, trap: it.trap, why: it.signal, rule: it.signal, practice: st.dx.practice || ''}; Store.touchAttempt(a); } }
        paintQs(); paintFb();
      } catch (e) { $('#ldx', el).innerHTML = '<span class="small muted">The analysis didn\'t come through. The evidence lines above show why each answer is right.</span>'; }
    }
  };
  const paintFb = () => {
    const f = $('#lfb', el); if (!st.done) { f.innerHTML = ''; return; }
    const ok = st.res.filter(r => r.ok).length;
    f.innerHTML = `<div class="stack"><div class="verdict ${ok / st.res.length >= .6 ? 'ok' : 'no'}">${ok}/${st.res.length} correct<span class="meta">${pct(ok / st.res.length)} · about ${toScale(ok / st.res.length)} on the scale for this part</span></div>
      <div id="ldx">${st.dx ? `<div class="dx"><h3>Your listening pattern</h3><p style="margin:0">${esc(st.dx.overall || '')}</p><div class="rule">${esc(st.dx.practice || '')}</div></div>` : ''}</div>
      <details><summary style="cursor:pointer;font-weight:700">Transcript (tap a line to jump there)</summary><div class="tr" id="trl">${TR.map(x => `<button data-t="${x[0]}"><span class="ts">${fmtTime(x[0] * 1000)}</span><span>${esc(x[1])}</span></button>`).join('')}</div></details>
      <div class="row"><button class="btn accent" id="lnext">${opts.nextLabel || 'Continue'}</button><button class="btn ghost" id="lredo">Try again</button></div></div>`;
    $$('[data-t]', f).forEach(b => b.onclick = () => { au.currentTime = +b.dataset.t; au.play().catch(() => {}); });
    $('#lnext', f).onclick = () => { au.pause(); opts.onNext?.(); };
    $('#lredo', f).onclick = () => { au.pause(); mountListening(el, part, onResults, opts); };
  };
  mountQuestion._key = null;
  paintQs(); paintCtl();
}

/* ---------------- WRITING & SPEAKING ---------------- */
function viewWrite() {
  const W = App.ws;
  if (W.task) return viewEditor();
  if (W.view) return viewWork(W.view);
  const list = W.mode === 'W' ? WRITING : SPEAKING;
  const mine = Store.works.filter(w => w.kind === W.mode).slice().reverse();
  const crit = W.mode === 'W' ? WCRIT : SCRIT;
  const recent = mine.slice(0, 3);
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel stack"><div class="row between"><h2>${W.mode === 'W' ? 'Writing' : 'Speaking'}</h2>
      <div class="seg"><button data-wm="W" aria-pressed="${W.mode === 'W'}">Writing</button><button data-wm="S" aria-pressed="${W.mode === 'S'}">Speaking</button></div></div>
      <p class="small muted" style="margin:0">${W.mode === 'W' ? 'Write 220–260 words. Claude marks it like an examiner on the four Cambridge criteria (0–5 each), gives a band, lists your errors and writes an Upgraded C1 Version.' : 'Type (or dictate with your keyboard\'s microphone) what you would say. Claude marks Grammar, Vocabulary, Discourse and Interaction (0–5 each). Pronunciation can\'t be judged from text.'}</p>
      ${recent.length ? `<div class="grid2">${crit.map(([k, l]) => { const v = recent.reduce((s, w) => s + (+w.res?.scores?.[k] || 0), 0) / recent.length; return `<div class="crit"><span>${l}</span><span class="dots5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.round(v) ? 'on' : ''}"></i>`).join('')}</span><span class="num">${v.toFixed(1)}</span></div>`; }).join('')}</div>` : ''}
      ${M[W.mode === 'W' ? 'writing' : 'speaking'].score ? `<div class="row"><span class="num" style="font-size:22px">${M[W.mode === 'W' ? 'writing' : 'speaking'].score}</span>${gradeChip(M[W.mode === 'W' ? 'writing' : 'speaking'].score)}<span class="small muted">average of your last ${recent.length}</span></div>` : ''}
    </div>
    <div class="grid2">
      <div class="panel stack"><h2>Tasks</h2><div class="tracks">${list.map(t => { const done = mine.filter(w => w.taskId === t.id); return `<button class="trk" data-tid="${t.id}"><span class="pn">${W.mode === 'W' ? (t.part === 1 ? 'P1' : 'P2') : 'P' + t.part}</span><span style="min-width:0"><b>${esc(t.type || t.title)}</b><div class="small muted">${esc(t.type ? t.title : t.time)}</div></span><span>${done.length ? `<span class="chip">${done[done.length - 1].res?.total?.toFixed(1)}/20</span>` : '→'}</span></button>`; }).join('')}</div></div>
      <div class="panel stack"><h2>Your marked work</h2>${mine.length ? `<div class="loglist">${mine.map(w => `<button class="logi" style="border:0;text-align:left;cursor:pointer" data-wk="${w.k}"><span><b>${esc(w.type || w.title)}</b> <span class="small muted">${new Date(w.t).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}</span><div class="small muted">${esc(w.res?.summary || '').slice(0, 110)}</div></span><span class="chip ${w.res?.band >= 4 ? 'good' : w.res?.band >= 3 ? 'warn' : 'bad'}">Band ${w.res?.band ?? '—'} · ${w.res?.total?.toFixed(1)}/20</span></button>`).join('')}</div>` : '<p class="muted">Nothing marked yet. Pick a task to get your first estimate.</p>'}</div>
    </div>${W.mode === 'W' && typeof modelsPanelHTML === 'function' ? modelsPanelHTML() : ''}</div>`;
  $$('[data-wm]').forEach(b => { if (b.closest('.seg')) b.onclick = () => { W.mode = b.dataset.wm; render(); }; });
  if (typeof wireModels === 'function') wireModels();
  $$('[data-tid]').forEach(b => b.onclick = () => { W.task = list.find(t => t.id === b.dataset.tid); W.t0 = Date.now(); render(); });
  $$('[data-wk]').forEach(b => b.onclick = () => { W.view = b.dataset.wk; render(); });
}
function viewEditor() {
  const W = App.ws, task = W.task, kind = W.mode;
  const dkey = 'rc2_draft_' + task.id;
  $('#app').innerHTML = `<div class="view fade"><div class="row between"><button class="btn ghost sm" id="eback">← Tasks</button><span class="small muted" id="etime"></span></div>
    <div class="panel stack"><div class="eyebrow">${kind === 'W' ? 'Writing ' + (task.part === 1 ? 'Part 1 · compulsory' : 'Part 2') + ' · ' + esc(task.type) : 'Speaking Part ' + task.part + ' · ' + esc(task.time)}</div>
      <h2 style="font-size:22px">${esc(task.title)}</h2><div class="prompt">${esc(task.prompt)}</div>
      <label for="etext" class="small muted">${kind === 'W' ? 'Your answer' : 'What you would say'}</label>
      <textarea id="etext" class="essay" spellcheck="false" placeholder="${kind === 'W' ? 'Plan for 5 minutes, then write…' : 'Type your answer as you would say it…'}">${esc(lsGet(dkey, ''))}</textarea>
      <div class="row between"><span class="wc" id="ewc"></span><button class="btn accent" id="esub" ${SAMPLE ? '' : 'disabled'}>Submit for marking</button></div>
      ${SAMPLE ? '' : '<p class="small muted">Marking needs Claude, which isn\'t available in this view. Your draft is kept in this browser.</p>'}
      <div id="eres"></div></div></div>`;
  const ta = $('#etext');
  const wc = () => { const n = ta.value.trim().split(/\s+/).filter(Boolean).length; $('#ewc').innerHTML = kind === 'W' ? `${n} words <span class="${n < 220 ? 'down' : n > 260 ? 'down' : 'up'}">· target 220–260</span>` : `${n} words`; };
  ta.oninput = () => { wc(); lsSet(dkey, ta.value); };
  wc();
  clearInterval(App.etick);
  App.etick = setInterval(() => { const e = $('#etime'); if (!e) return clearInterval(App.etick); e.textContent = fmtTime(Date.now() - W.t0) + (kind === 'W' ? ' · aim for 45:00' : ''); }, 1000);
  $('#eback').onclick = () => { W.task = null; render(); };
  $('#esub').onclick = async () => {
    const text = ta.value.trim();
    if (text.split(/\s+/).length < 40) return toast('Write at least 40 words first.');
    $('#esub').disabled = true;
    $('#eres').innerHTML = `<div class="loading"><span class="thinking">Claude is marking your ${kind === 'W' ? task.type.toLowerCase() : 'answer'} against the Cambridge criteria</span></div>`;
    try {
      const res = await aiGradeWriting(task, text, kind);
      const w = {k: uid(), t: Date.now(), kind, taskId: task.id, type: task.type || 'Speaking P' + task.part, title: task.title, text, ms: Date.now() - W.t0, res};
      Store.works.push(w); Store.touch('works/' + w.k);
      lsSet(dkey, '');
      W.task = null; W.view = w.k; render();
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
  $('#app').innerHTML = `<div class="view fade"><div class="row between"><button class="btn ghost sm" id="vback">← ${w.kind === 'W' ? 'Writing' : 'Speaking'}</button><span class="small muted">${new Date(w.t).toLocaleString('en-GB')}</span></div>
    <div class="panel stack"><div class="eyebrow">${esc(w.type)} · ${esc(w.title)}</div>
      <div class="row" style="gap:18px;align-items:flex-end"><span class="bigscore">${(r.total || 0).toFixed(1)}<span style="font-size:22px" class="muted">/20</span></span><span style="display:grid;gap:4px"><span class="chip dark">Band ${r.band ?? '—'} / 5</span><span>≈ <span class="num">${sc}</span> ${gradeChip(sc)}</span></span></div>
      <p style="margin:0;font-family:var(--f-read);font-size:17px">${esc(r.summary || '')}</p>
      <div class="stack">${crit.map(([k, l]) => `<div><div class="crit"><b>${l}</b><span class="dots5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= (+r.scores?.[k] || 0) ? 'on' : ''}"></i>`).join('')}</span><span class="num">${r.scores?.[k] ?? '—'}/5</span></div><div class="small muted">${esc(r.feedback?.[k] || '')}</div></div>`).join('')}</div>
    </div>
    <div class="grid2">
      <div class="panel stack"><h2>Errors to fix</h2><div class="errs">${(r.errors || []).map(e => `<div class="err"><s>${esc(e.original)}</s> → <b>${esc(e.correction)}</b><div class="small muted" style="margin-top:4px">${esc(e.explanation)}${TOP[e.topic] ? ` · <a href="#" data-lt="${e.topic}">${esc(TOP[e.topic].name)}</a>` : ''}</div></div>`).join('') || '<p class="muted">No significant errors.</p>'}</div></div>
      <div class="panel stack"><h2>Strengths & next steps</h2><ul style="margin:0;padding-left:20px;display:grid;gap:6px">${(r.strengths || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul><div class="eyebrow">Work on next</div><ol style="margin:0;padding-left:20px;display:grid;gap:6px">${(r.focus || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
    </div>
    <div class="panel stack"><div class="row between"><h2>Upgraded C1 Version</h2><div class="seg"><button data-v="u" aria-pressed="true">Upgraded</button><button data-v="o" aria-pressed="false">Your text</button></div></div><div class="upgraded" id="vtext">${esc(r.upgraded || '')}</div></div></div>`;
  $('#vback').onclick = () => { App.ws.view = null; render(); };
  $$('[data-v]').forEach(b => b.onclick = () => { $$('[data-v]').forEach(x => x.setAttribute('aria-pressed', x === b)); const u = b.dataset.v === 'u'; $('#vtext').textContent = u ? r.upgraded || '' : w.text; $('#vtext').style.borderColor = u ? '' : 'var(--line)'; $('#vtext').style.background = u ? '' : 'var(--surface)'; });
  $$('[data-lt]').forEach(a => a.onclick = e => { e.preventDefault(); openLearn(a.dataset.lt); });
}

/* ---------------- LEARN ---------------- */
const LIB = [
  {id: 'lib:pv', title: 'Phrasal verbs', tp: 'pv', rows: PV, cols: ['Phrasal verb', 'Meaning', 'Example']},
  {id: 'lib:co', title: 'Collocations', tp: 'coll', rows: COLL, cols: ['Collocation', 'Meaning', 'Example']},
  {id: 'lib:id', title: 'Idioms & fixed phrases', tp: 'idiom', rows: IDIOM, cols: ['Expression', 'Meaning', 'Example']},
  {id: 'lib:dp', title: 'Dependent prepositions', tp: 'deppr', rows: DEPPR, cols: ['Pattern', 'Type', 'Example']},
  {id: 'lib:cf', title: 'Confusable words', tp: 'confus', rows: CONFUS, cols: ['Words', 'Difference', 'Example']},
  {id: 'lib:wf', title: 'Word families', tp: 'wf', rows: WF, cols: ['Root', 'Family', '']},
];
function viewLearn() {
  const sec = App.learn;
  const grammar = THEORY.filter(t => TOP[t.id]?.grp === 'Grammar');
  const skills = THEORY.filter(t => TOP[t.id]?.grp === 'Skills');
  const noTheory = TOPICS.filter(t => !THEORY.find(x => x.id === t.id) && !LIB.find(l => l.tp === t.id));
  const b = (id, label) => `<button data-sec="${id}" class="${sec === id ? 'on' : ''}">${esc(label)}</button>`;
  $('#app').innerHTML = `<div class="view fade"><div class="learn">
    <nav class="toc" aria-label="Theory sections">
      <div class="g">Exam</div>${b('exam', 'The exam at a glance')}
      <div class="g">Grammar</div>${grammar.map(t => b(t.id, t.title)).join('')}${noTheory.filter(t => t.grp === 'Grammar').map(t => b('lesson:' + t.id, t.name)).join('')}
      <div class="g">Vocabulary</div>${b('pv', 'Phrasal verbs: how they work')}${b('coll', 'Collocations: how they work')}${b('wf', 'Word formation rules')}${LIB.map(l => b(l.id, l.title + ' (' + l.rows.length + ')')).join('')}
      <div class="g">Skills</div>${skills.map(t => b(t.id, t.title)).join('')}
    </nav><article class="doc panel" id="doc"></article></div></div>`;
  $$('[data-sec]').forEach(x => x.onclick = () => { App.learn = x.dataset.sec; viewLearn(); if (innerWidth < 860) $('#doc').scrollIntoView({behavior: 'smooth'}); });
  const doc = $('#doc');
  const actions = tp => tp && TOP[tp] && !SKIP_AUTO.has(tp) ? `<div class="row" style="margin:-4px 0 16px"><button class="btn accent sm" data-st="${tp}">Study this now</button>${tp !== 'listen' && tp !== 'read' ? `<button class="btn sm" data-pr="${tp}">Practise questions</button>` : ''}${DECK_TP[tp] ? `<button class="btn sm" data-fc="${tp}">Flashcards</button>` : ''}<span class="small muted">${M.S[tp].n ? 'Your mastery: ' + pct(M.S[tp].m) : 'Not practised yet'}</span></div>` : '';
  if (sec.startsWith('lib:')) {
    const L = LIB.find(l => l.id === sec);
    doc.innerHTML = `<h2>${esc(L.title)}</h2>${actions(L.tp)}<input type="text" class="search" id="lq" placeholder="Search ${L.rows.length} entries…" aria-label="Search"><div class="tablewrap"><table class="t lex"><thead><tr>${L.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody id="lrows"></tbody></table></div>`;
    const fill = f => { $('#lrows').innerHTML = L.rows.filter(r => !f || r.join(' ').toLowerCase().includes(f)).map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2] || '')}</td></tr>`).join(''); };
    $('#lq').oninput = e => fill(e.target.value.toLowerCase().trim()); fill('');
  } else if (sec.startsWith('lesson:')) {
    const tp = sec.slice(7);
    doc.innerHTML = `<h2>${esc(TOP[tp].name)}</h2>${actions(tp)}<ul>${(LESSONS[tp] || []).map(x => `<li>${x}</li>`).join('')}</ul>`;
  } else {
    const T = THEORY.find(t => t.id === sec) || THEORY[0];
    doc.innerHTML = `<h2>${esc(T.title)}</h2>${actions(TOP[T.id] ? T.id : null)}${T.html}`;
  }
  $$('[data-st]', doc).forEach(x => x.onclick = () => { const tp = x.dataset.st; startSession({mode: M.S[tp].n ? 'level' : 'new', tp, reason: 'You chose this topic'}); });
  $$('[data-pr]', doc).forEach(x => x.onclick = () => { App.prac = {...App.prac, mode: 'topic', tp: x.dataset.pr, cur: null}; setTab('practice'); });
  $$('[data-fc]', doc).forEach(x => x.onclick = () => { const d = DECK_TP[x.dataset.fc]; App.cardRun = {title: d.name, list: [...dueCards(d.tp).slice(0, 15), ...newCards(d.tp, 10)]}; setTab('cards'); });
}

/* ---------------- PROGRESS ---------------- */
function statementSVG(cur, prev) {
  const cols = [...PAPER_ORDER.map(p => [PAPERS[p], cur[p]?.score, prev?.[p]?.score]), ['Overall', cur.overall, prev?.overall]];
  const W = 760, H = 330, L = 64, T = 34, B = 40, top = 212, bot = 140;
  const colW = (W - L - 10) / cols.length;
  const y = v => T + (top - v) / (top - bot) * (H - T - B);
  const bands = [[200, 212, 'gA', 'C2 · A'], [193, 200, 'gB', 'C1 · B'], [180, 193, 'gC', 'C1 · C'], [160, 180, 'gB2', 'B2'], [bot, 160, 'line', '']];
  let s = `<svg class="sor" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated scores on the Cambridge English Scale">`;
  for (const [a, b2, c, lab] of bands) { s += `<rect x="${L}" y="${y(b2)}" width="${W - L - 10}" height="${y(a) - y(b2)}" fill="var(--${c})" opacity=".09"/>`; if (lab) s += `<text x="${L - 8}" y="${(y(a) + y(b2)) / 2 + 4}" text-anchor="end" font-size="11" font-family="var(--f-mono)" fill="var(--ink-2)">${lab}</text>`; }
  for (const v of [160, 180, 200, 210]) s += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="${v === 180 ? '0' : '3 4'}"/><text x="${L + 4}" y="${y(v) - 3}" font-size="10" fill="var(--ink-3)" font-family="var(--f-mono)">${v}</text>`;
  cols.forEach(([name, v, pv], i) => {
    const cx = L + colW * i + colW / 2;
    s += `<rect x="${cx - colW * .32}" y="${T}" width="${colW * .64}" height="${H - T - B}" fill="var(--surface-2)" opacity=".55" rx="4"/>`;
    s += `<text x="${cx}" y="${H - 16}" text-anchor="middle" font-size="12" font-weight="${i === cols.length - 1 ? 700 : 600}" fill="var(--ink)">${name}</text>`;
    if (pv != null && v != null && pv !== v) s += `<line x1="${cx - colW * .3}" x2="${cx + colW * .3}" y1="${y(pv)}" y2="${y(pv)}" stroke="var(--ink-3)" stroke-width="2" stroke-dasharray="2 3"/>`;
    if (v != null) {
      const yy = y(clamp(v, bot, top));
      s += `<g><path d="M${cx - colW * .3} ${yy - 11} h${colW * .6 - 10} l10 11 l-10 11 h-${colW * .6 - 10} z" fill="var(--accent)"/><text x="${cx - 4}" y="${yy + 4}" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--accent-ink)" font-family="var(--f-mono)">${v}</text></g>`;
      if (pv != null && pv !== v) s += `<text x="${cx}" y="${T - 10}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--${v > pv ? 'good' : 'bad'})">${v > pv ? '▲' : '▼'} ${Math.abs(v - pv)}</text>`;
    } else s += `<text x="${cx}" y="${y(170)}" text-anchor="middle" font-size="11" fill="var(--ink-3)">calibrating</text>`;
  });
  return s + '</svg>';
}
function lineChart(points, key) {
  const pts = points.filter(p => p[key] != null);
  if (pts.length < 2) return `<p class="small muted">The trend line appears after your second day of study.</p>`;
  const W = 700, H = 200, P = {l: 40, r: 14, t: 12, b: 26};
  const ys = pts.map(p => p[key]);
  const lo = Math.min(160, Math.floor((Math.min(...ys) - 5) / 10) * 10), hi = Math.max(210, Math.ceil(Math.max(...ys) / 10) * 10);
  const x = i => P.l + i * (W - P.l - P.r) / (pts.length - 1), y = v => P.t + (hi - v) * (H - P.t - P.b) / (hi - lo);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[key]).toFixed(1)).join(' ');
  const ticks = []; for (let v = lo; v <= hi; v += 10) ticks.push(v);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score by day">
    ${ticks.map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="${[180, 200].includes(v) ? 1.5 : .8}"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--ink-3)" font-family="var(--f-mono)">${v}</text>`).join('')}
    <path d="${path} L${x(pts.length - 1)} ${y(lo)} L${x(0)} ${y(lo)} Z" fill="var(--gA)" opacity=".1"/>
    <path d="${path}" fill="none" stroke="var(--gA)" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p[key])}" r="${i === pts.length - 1 ? 5 : 3}" fill="var(--gA)"/>`).join('')}
    ${pts.map((p, i) => (pts.length <= 8 || i % Math.ceil(pts.length / 7) === 0 || i === pts.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--ink-3)">${p.day.slice(8)}/${p.day.slice(5, 7)}</text>` : '').join('')}</svg>`;
}
function viewProgress() {
  const daily = M.daily;
  const weekAgo = dayKey(Date.now() - 7 * 864e5);
  const prevSnap = daily.filter(d => d.day <= weekAgo).pop() || (daily.length > 1 ? daily[0] : null);
  const prev = prevSnap ? {reading: prevSnap.reading, uoe: prevSnap.uoe, writing: prevSnap.writing, listening: prevSnap.listening, speaking: prevSnap.speaking, overall: prevSnap.overall} : null;
  const flat = daily.map(d => ({day: d.day, overall: d.overall, reading: d.reading.score, uoe: d.uoe.score, writing: d.writing.score, listening: d.listening.score, speaking: d.speaking.score}));
  App.pkey = App.pkey || 'overall';
  const errs = Store.attempts.filter(a => !a.ok && a.src !== 'card');
  const byType = {}; for (const a of errs) { const t = a.dx?.type && ERRT[a.dx.type] ? a.dx.type : a.et || 'grammar'; byType[t] = (byType[t] || 0) + 1; }
  const maxT = Math.max(1, ...Object.values(byType));
  const rules = Store.attempts.filter(a => a.dx?.rule).slice().reverse().slice(0, 30);
  const critBlock = (kind, crit) => {
    const ws = Store.works.filter(w => w.kind === kind && w.res?.scores);
    if (!ws.length) return `<p class="small muted">No ${kind === 'W' ? 'writing' : 'speaking'} marked yet.</p>`;
    const last = ws.slice(-3), before = ws.slice(-6, -3);
    return crit.map(([k, l]) => {
      const a = last.reduce((s, w) => s + (+w.res.scores[k] || 0), 0) / last.length;
      const b = before.length ? before.reduce((s, w) => s + (+w.res.scores[k] || 0), 0) / before.length : null;
      const tr = b == null ? ['·', 'trend-flat'] : a - b > .2 ? ['▲', 'trend-up'] : a - b < -.2 ? ['▼', 'trend-down'] : ['▬', 'trend-flat'];
      const g = toScale(a / 5);
      return `<div class="crit" style="grid-template-columns:minmax(0,1fr) 110px 40px 70px 18px"><span>${l}</span><span class="dots5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.round(a) ? 'on' : ''}"></i>`).join('')}</span><span class="num">${a.toFixed(1)}</span><span class="grade ${gradeOf(g).k}">${gradeOf(g).k === 'B2' ? 'B2' : gradeOf(g).label.replace('Grade ', '')}</span><span class="${tr[1]}">${tr[0]}</span></div>`;
    }).join('');
  };
  const groups = ['Grammar', 'Vocabulary'];
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel stack"><div class="row between"><div><div class="eyebrow">Statement of results · estimate</div><h2 style="font-size:22px;margin-top:2px">Where you are on the Cambridge English Scale</h2></div><div class="row"><span class="bigscore" style="font-size:40px">${M.overall ?? ''}</span>${gradeChip(M.overall)}</div></div>
      ${statementSVG(M, prev)}
      <p class="small muted" style="margin:0">Each marker moves after every session. Dashed lines show where you were a week ago. Grade bands: 200–210 Grade A (C2) · 193–199 Grade B · 180–192 Grade C (C1) · 160–179 B2. This is a study estimate, not an official Cambridge result.</p></div>
    <div class="panel stack"><div class="row between"><h2>Trend</h2><div class="seg">${[['overall', 'Overall'], ...PAPER_ORDER.map(p => [p, PAPERS[p]])].map(([k, l]) => `<button data-pk="${k}" aria-pressed="${App.pkey === k}">${l}</button>`).join('')}</div></div>${lineChart(flat, App.pkey)}</div>
    <div class="grid2">
      <div class="panel stack"><h2>Writing criteria</h2>${critBlock('W', WCRIT)}<h2 style="margin-top:8px">Speaking criteria</h2>${critBlock('S', SCRIT)}<p class="small muted" style="margin:0">Average of your last 3 marked tasks; arrows compare with the 3 before. Grade shown per criterion on the same scale.</p></div>
      <div class="panel stack"><div class="row between"><h2>Coach's analysis</h2>${SAMPLE ? '<button class="btn sm accent" id="coach">Analyse my data</button>' : ''}</div><div id="coachbox">${App.coach ? coachHTML(App.coach) : '<p class="small muted">Claude reads all your errors, patterns and marks, and tells you what to change.</p>'}</div></div>
    </div>
    <div class="panel stack"><h2>Accuracy by exam part</h2><p class="small muted" style="margin:0">Everything you answer here plus the outside tests you mark with the answer sheet.</p>${partAccuracyHTML()}</div>
    <div class="grid2">${groups.map(g => `<div class="panel"><h2>${g}</h2>${TOPICS.filter(t => t.grp === g).sort((a, b) => M.S[a.id].m - M.S[b.id].m).map(t => { const st = M.S[t.id]; const tr = st.n < 8 ? ['·', 'trend-flat'] : st.trend > .12 ? ['▲', 'trend-up'] : st.trend < -.12 ? ['▼', 'trend-down'] : ['▬', 'trend-flat'];
      return `<button class="sk" data-stp="${t.id}" title="Study ${esc(t.name)}"><span class="name">${esc(t.name)} <span class="small muted">${st.n ? '(' + st.n + ')' : ''}</span></span><span class="meter"><i style="width:${Math.round(st.m * 100)}%;background:${st.n < 3 ? 'var(--ink-3)' : st.m < .6 ? 'var(--bad)' : st.m < .8 ? 'var(--warn)' : 'var(--good)'}"></i></span><span class="num small" style="text-align:right">${st.n < 3 ? '?' : pct(st.m)}</span><span class="${tr[1]}">${tr[0]}</span></button>`; }).join('')}</div>`).join('')}</div>
    <div class="grid2">
      <div class="panel stack"><h2>Why you fail</h2><p class="small muted" style="margin:0">${errs.length} errors · ${errs.filter(a => a.dx).length} diagnosed by Claude</p><div class="bars">${Object.keys(ERRT).filter(k => byType[k]).sort((a, b) => byType[b] - byType[a]).map(k => `<div class="bar"><span>${ERRT[k]}</span><span class="meter"><i style="width:${byType[k] / maxT * 100}%;background:var(--bad)"></i></span><span class="num">${byType[k]}</span></div>`).join('') || '<p class="small muted">No errors yet.</p>'}</div></div>
      <div class="panel stack"><h2>Your rule notebook</h2><div class="loglist" style="max-height:380px;overflow:auto">${rules.map(a => `<div class="logi" style="grid-template-columns:1fr"><span class="small muted">${esc(TOP[a.tp]?.name || '')} · ${esc(a.dx.pattern || '')}</span><span class="s">${esc(a.dx.rule)}</span></div>`).join('') || '<p class="small muted">Rules from your diagnosed errors collect here.</p>'}</div></div>
    </div>
    <div class="panel stack"><h2>Error log</h2><p class="small muted" style="margin:0">Tap “Why?” and Claude explains the mistake. You don't need to describe it.</p><div class="loglist">${errs.slice().reverse().slice(0, 40).map(a => `<div class="logi"><span style="min-width:0"><span class="s">${esc(attemptLabel(a))}</span><div class="small muted">${esc(TOP[a.tp]?.name || '')} · ${new Date(a.t).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}${a.dx ? ' · <b>' + esc(a.dx.pattern) + '</b>' : ''}</div><div class="small" id="dx-${a.k}">${a.dx?.why ? esc(a.dx.why) : ''}</div></span>${!a.dx && Q.has(a.q) && SAMPLE ? `<button class="btn sm" data-why="${a.k}">Why?</button>` : `<span class="chip bad">${esc(ERRT[a.dx?.type] || ERRT[a.et] || 'error')}</span>`}</div>`).join('') || '<p class="small muted">Nothing here yet.</p>'}</div></div>
  </div>`;
  $$('[data-pk]').forEach(b => b.onclick = () => { App.pkey = b.dataset.pk; viewProgress(); });
  $$('[data-stp]').forEach(b => b.onclick = () => { const tp = b.dataset.stp; startSession({mode: M.S[tp].n ? (wrongQueue(tp).length >= 2 ? 'relearn' : 'level') : 'new', tp, reason: 'Chosen from your progress'}); });
  $$('[data-why]').forEach(b => b.onclick = async () => {
    const a = Store.attempts.find(x => x.k === b.dataset.why), q = Q.get(a.q);
    b.disabled = true; b.textContent = 'Thinking…';
    try { const d = await aiDiagnose(a, q); a.dx = {type: d.type, severity: d.severity, pattern: d.pattern, trap: d.trap, why: d.why, rule: d.rule, practice: d.practice, repeated: !!d.repeated}; Store.touchAttempt(a); $('#dx-' + a.k).innerHTML = `<b>${esc(d.pattern)}</b>: ${esc(d.trap)} ${esc(d.why)}<div class="rule" style="font-size:15px;margin-top:6px">${esc(d.rule)}</div>`; b.replaceWith(Object.assign(document.createElement('span'), {className: 'chip bad', textContent: ERRT[d.type] || d.type})); }
    catch (e) { b.disabled = false; b.textContent = 'Retry'; }
  });
  if ($('#coach')) $('#coach').onclick = async () => {
    $('#coachbox').innerHTML = '<span class="thinking">Claude is reading your data</span>';
    try { App.coach = await aiCoach(); $('#coachbox').innerHTML = coachHTML(App.coach); } catch (e) { $('#coachbox').innerHTML = '<p class="small muted">The analysis didn\'t come through. Try again.</p>'; }
  };
}
function coachHTML(c) {
  return `<div class="stack"><p style="margin:0;font-family:var(--f-read);font-size:17px">${esc(c.headline)}</p>
    <ol style="margin:0;padding-left:20px;display:grid;gap:8px">${(c.priorities || []).map(p => `<li><b>${esc(p.topic)}</b>: ${esc(p.why)} <div class="small muted">${esc(p.how)}</div></li>`).join('')}</ol>
    ${c.habit ? `<div class="rule">${esc(c.habit)}</div>` : ''}${c.next_week ? `<div class="small"><b>Next 7 days:</b> ${esc(c.next_week)}</div>` : ''}</div>`;
}

