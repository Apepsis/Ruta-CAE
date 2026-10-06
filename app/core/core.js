'use strict';
/* ============================================================
   Ruta C2 — core: content, storage, learner model, AI, question engine
   ============================================================ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const sig = x => 1 / (1 + Math.exp(-x));
const pct = x => Math.round(x * 100) + '%';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fmtTime = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function seeded(seed) { let x = parseInt(hash(String(seed)), 36) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }
function shuffleIdx(n, seed) { const r = seeded(seed), a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2800); }
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
const norm = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[.,!?;:"]/g, '').replace(/\s+/g, ' ').trim();
const LETTERS = 'ABCDEFGH';

/* ---------------- content ---------------- */
const TOP = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const PAPERS = {reading: 'Reading', uoe: 'Use of English', writing: 'Writing', listening: 'Listening', speaking: 'Speaking'};
const PAPER_ORDER = ['reading', 'uoe', 'writing', 'listening', 'speaking'];
const PART_NAME = {1: 'Part 1 · Multiple-choice cloze', 2: 'Part 2 · Open cloze', 3: 'Part 3 · Word formation', 4: 'Part 4 · Key word transformation', 5: 'Reading · Multiple choice'};
const PART_SHORT = {1: 'UoE 1', 2: 'UoE 2', 3: 'UoE 3', 4: 'UoE 4', 5: 'Reading'};
const Q = new Map();
for (const q of BANK) { q.id = 'b' + hash(q.s || q.s1); q.src = 'bank'; Q.set(q.id, q); }
const qType = q => q.p === 4 ? 'kwt' : q.o ? 'mc' : 'gap';
function qPaper(q) { return q.p === 5 ? 'reading' : 'uoe'; }

/* flashcards */
const DECKS = [
  {id: 'pv', name: 'Phrasal verbs', tp: 'pv', list: PV},
  {id: 'co', name: 'Collocations', tp: 'coll', list: COLL},
  {id: 'id', name: 'Idioms & fixed phrases', tp: 'idiom', list: IDIOM},
  {id: 'dp', name: 'Dependent prepositions', tp: 'deppr', list: DEPPR},
  {id: 'cf', name: 'Confusable words', tp: 'confus', list: CONFUS},
  {id: 'wf', name: 'Word families', tp: 'wf', list: WF},
  {id: 'vc', name: 'Topic vocabulary', tp: 'tvoc', list: VOCAB.flatMap(t => t.words.map(w => [w[0], w[2], w[3], w[1], w[4]]))},
];
const CARDS = new Map();
for (const d of DECKS) for (const row of d.list) {
  const id = d.id + ':' + row[0];
  let c = {id, deck: d.id, tp: d.tp, front: row[0], back: row[1], ex: row[2] || ''};
  if (d.id === 'dp') {
    const prep = row[0].split(/[ /]+/).filter(w => !['sb', 'sth', 'someone'].includes(w)).pop();
    const ex = row[2] || '';
    const re = new RegExp('\\b' + prep + '\\b', 'i');
    if (re.test(ex) && prep !== row[0]) c = {...c, front: ex.replace(re, '___'), back: row[0], ex: row[1] === 'phrase' ? 'fixed phrase' : row[1]};
  }
  if (d.id === 'wf') c = {...c, front: row[0].toUpperCase(), back: row[1], ex: 'Word family'};
  if (d.id === 'vc') c = {...c, back: row[1] + (row[4] ? '  ·  ' + row[4] : ''), pos: row[3]};
  CARDS.set(id, c);
}
const BOX_DAYS = [0, 1, 3, 7, 16, 35];

/* ---------------- storage: db (account) + local backup ---------------- */
const Store = {
  attempts: [], cards: {}, works: [], gen: {}, settings: {examDate: '', lang: 'en', resDone: {}}, reading: [], ext: [], vlists: [],
  db: null, mode: 'local', dirty: new Set(), timer: null, saving: false,
  async init() {
    this.attempts = lsGet('rc2_attempts', []);
    this.cards = lsGet('rc2_cards', {});
    this.works = lsGet('rc2_works', []);
    this.gen = lsGet('rc2_gen', {});
    this.reading = lsGet('rc2_reading', []);
    this.settings = Object.assign(this.settings, lsGet('rc2_settings', {}));
    this.ext = lsGet('rc2_ext', []); this.vlists = lsGet('rc2_vlists', []);
    this.reindexGen();
    try {
      if (!window.claude?.use) return;
      const db = await Promise.race([window.claude.use('db'), new Promise(r => setTimeout(() => r(null), 12000))]);
      if (!db) return;
      this.db = db; this.mode = 'cloud';
      const [log, cards, works, gen, settings, reading, ext, vlists] = await Promise.all([
        db.collection('log').get(), db.doc('cards/state').get(), db.collection('works').get(),
        db.collection('gen').get(), db.doc('settings/main').get(), db.collection('reading').get(),
        db.collection('ext').get(), db.collection('vlists').get()]);
      const mergeList = (key, snap, idk) => { const have = new Set(this[key].map(x => x[idk])); for (const d of snap.docs) { const x = d.data(); if (x && !have.has(x[idk])) { this[key].push(x); have.add(x[idk]); } } };
      mergeList('ext', ext, 'k'); mergeList('vlists', vlists, 'id');
      this.ext.sort((a, b) => a.t - b.t);
      const seen = new Map(this.attempts.map(a => [a.k, a]));
      for (const d of log.docs) for (const a of (d.data()?.items || [])) {
        const mine = seen.get(a.k);
        if (!mine) { this.attempts.push(a); seen.set(a.k, a); } else if (a.dx && !mine.dx) Object.assign(mine, a);
      }
      this.attempts.sort((a, b) => a.t - b.t);
      const cs = cards.data()?.c || {};
      for (const [k, v] of Object.entries(cs)) if (!this.cards[k] || (v[3] || 0) > (this.cards[k][3] || 0)) this.cards[k] = v;
      const wk = new Map(this.works.map(w => [w.k, w]));
      for (const d of works.docs) { const w = d.data(); if (w && !wk.has(w.k)) { this.works.push(w); wk.set(w.k, w); } }
      this.works.sort((a, b) => a.t - b.t);
      for (const d of gen.docs) { const g = d.data(); if (g?.items) { const have = new Set((this.gen[d.id] || []).map(x => x.id)); this.gen[d.id] = [...(this.gen[d.id] || []), ...g.items.filter(x => !have.has(x.id))]; } }
      const rd = new Map(this.reading.map(r => [r.id, r]));
      for (const d of reading.docs) { const r = d.data(); if (r && !rd.has(r.id)) { this.reading.push(r); rd.set(r.id, r); } }
      const sd = settings.data() || {};
      const resDone = {...(this.settings.resDone || {}), ...(sd.resDone || {})};
      const act = {...(this.settings.act || {})}; for (const [d, v] of Object.entries(sd.act || {})) { act[d] = {...(act[d] || {})}; for (const [k, n] of Object.entries(v)) act[d][k] = Math.max(act[d][k] || 0, n); }
      Object.assign(this.settings, sd, {resDone, act});
      this.reindexGen();
      for (const a of this.attempts) this.dirty.add('log/' + dayKey(a.t));
      this.dirty.add('cards'); this.dirty.add('settings');
      for (const w of this.works) this.dirty.add('works/' + w.k);
      for (const k of Object.keys(this.gen)) this.dirty.add('gen/' + k);
      for (const r of this.reading) this.dirty.add('reading/' + r.id);
      for (const x of this.ext) this.dirty.add('ext/' + x.k);
      for (const v of this.vlists) this.dirty.add('vlists/' + v.id);
      this.schedule();
    } catch (e) { console.warn('db', e); }
  },
  reindexGen() { try { registerVocabCards(); } catch (e) {} for (const [tp, items] of Object.entries(this.gen)) for (const q of items) { q.src = 'gen'; q.tp = q.tp || tp; Q.set(q.id, q); } },
  local() {
    lsSet('rc2_attempts', this.attempts); lsSet('rc2_cards', this.cards); lsSet('rc2_works', this.works);
    lsSet('rc2_gen', this.gen); lsSet('rc2_settings', this.settings); lsSet('rc2_reading', this.reading); lsSet('rc2_ext', this.ext); lsSet('rc2_vlists', this.vlists);
  },
  addAttempt(a) { this.attempts.push(a); this.touch('log/' + dayKey(a.t)); },
  touchAttempt(a) { this.touch('log/' + dayKey(a.t)); },
  touch(key) { this.dirty.add(key); this.local(); this.schedule(); },
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 1000); },
  async flush() {
    if (!this.db || this.saving) return;
    this.saving = true;
    try {
      while (this.dirty.size) {
        const key = [...this.dirty][0]; this.dirty.delete(key);
        const [col, id] = key.split('/');
        if (col === 'log') await this.db.doc('log/' + id).set({day: id, items: this.attempts.filter(a => dayKey(a.t) === id)});
        else if (col === 'cards') await this.db.doc('cards/state').set({c: this.cards});
        else if (col === 'settings') await this.db.doc('settings/main').set(this.settings);
        else if (col === 'works') { const w = this.works.find(x => x.k === id); if (w) await this.db.doc('works/' + id).set(w); }
        else if (col === 'gen') await this.db.doc('gen/' + id).set({items: (this.gen[id] || []).map(({src, ...r}) => r)});
        else if (col === 'ext') { const x = this.ext.find(e => e.k === id); if (x) await this.db.doc('ext/' + id).set(x); }
        else if (col === 'vlists') { const v = this.vlists.find(e => e.id === id); if (v) await this.db.doc('vlists/' + id).set(v); }
        else if (col === 'reading') { const r = this.reading.find(x => x.id === id); if (r) await this.db.doc('reading/' + id).set(r); }
      }
    } catch (e) { console.warn('save', e); }
    this.saving = false;
  },
};

/* ---------------- learner model ---------------- */
const TH0 = 0.25;
const BD = {1: -1.2, 2: 0, 3: 1.2};
const mix = th => .25 * sig(th - BD[1]) + .45 * sig(th - BD[2]) + .30 * sig(th - BD[3]);
const SCALE = [[0, 122], [.2, 142], [.4, 160], [.6, 180], [.8, 200], [1, 210]];
function toScale(p) {
  p = clamp(p, 0, 1);
  for (let i = 1; i < SCALE.length; i++) if (p <= SCALE[i][0]) { const [x0, y0] = SCALE[i - 1], [x1, y1] = SCALE[i]; return Math.round(y0 + (y1 - y0) * (p - x0) / (x1 - x0)); }
  return 210;
}
function gradeOf(s) {
  if (s == null) return {k: 'none', label: '—', cefr: ''};
  if (s >= 200) return {k: 'A', label: 'Grade A', cefr: 'C2'};
  if (s >= 193) return {k: 'B', label: 'Grade B', cefr: 'C1'};
  if (s >= 180) return {k: 'C', label: 'Grade C', cefr: 'C1'};
  if (s >= 160) return {k: 'B2', label: 'Level B2', cefr: 'B2'};
  return {k: 'B2', label: 'Below B2', cefr: 'A2/B1'};
}
const gradeChip = s => { const g = gradeOf(s); return `<span class="grade ${g.k}">${g.label}${g.cefr ? ' · ' + g.cefr : ''}</span>`; };
const WCRIT = [['content', 'Content'], ['ca', 'Communicative Achievement'], ['org', 'Organisation'], ['lang', 'Language']];
const SCRIT = [['gr', 'Grammatical Resource'], ['lr', 'Lexical Resource'], ['dm', 'Discourse Management'], ['ic', 'Interactive Communication']];

function outcome(a) { if (!a.ok) return 0; if (a.ms && a.ms < 2500 && a.src !== 'card') return .9; return 1; }
let M = null;
function computeModel() {
  const S = {};
  for (const t of TOPICS) S[t.id] = {th: TH0, n: 0, hist: [], errs: [], dx: [], cardN: 0};
  const daily = []; let cur = null;
  const atts = [...Store.attempts].sort((a, b) => a.t - b.t);
  const lisHist = [], readHist = [];
  const works = [...Store.works].sort((a, b) => a.t - b.t);
  let wi = 0;
  const snap = (day) => {
    while (wi < works.length && dayKey(works[wi].t) <= day) wi++;
    return {day, ...predict(S, lisHist, readHist, works.slice(0, wi), extUoe)};
  };
  const ext = [...Store.ext].sort((a, b) => a.t - b.t); let ei = 0;
  const extUoe = [];
  const pushExt = upto => { while (ei < ext.length && ext[ei].t <= upto) { const x = ext[ei++];
      if (x.listening) for (let i = 0; i < x.listening[1]; i++) lisHist.push(i < x.listening[0] ? 1 : 0);
      if (x.reading) for (let i = 0; i < x.reading[1]; i++) readHist.push(i < x.reading[0] ? 1 : 0);
      if (x.uoe) extUoe.push(x.uoe); } };
  for (const a of atts) {
    const d = dayKey(a.t);
    if (cur && d !== cur) { pushExt(new Date(d + 'T00:00:00').getTime() - 1); daily.push(snap(cur)); }
    pushExt(a.t);
    cur = d;
    if (a.paper === 'listening') lisHist.push(a.ok ? 1 : 0);
    if (a.paper === 'reading') readHist.push(a.ok ? 1 : 0);
    const st = S[a.tp]; if (!st) continue;
    const w = a.src === 'card' ? .35 : 1;
    const p = sig(st.th - BD[a.lv || 2]);
    const K = Math.max(.12, .55 / Math.sqrt(1 + st.n / 6)) * w;
    st.th += K * (outcome(a) - p);
    if (a.src === 'card') st.cardN++; else { st.n++; st.hist.push(a); if (!a.ok) st.errs.push(a); if (a.dx) st.dx.push(a); }
  }
  const lastExtDay = ext.length ? dayKey(ext[ext.length - 1].t) : null;
  if (cur && lastExtDay && lastExtDay > cur) { pushExt(new Date(lastExtDay + 'T00:00:00').getTime() - 1); daily.push(snap(cur)); cur = lastExtDay; }
  else if (!cur && lastExtDay) cur = lastExtDay;
  pushExt(Infinity);
  if (cur) daily.push(snap(cur));
  // writing errors tagged with topics raise priority
  const wErr = {};
  for (const w of Store.works) for (const e of (w.res?.errors || [])) if (e.topic && S[e.topic]) wErr[e.topic] = (wErr[e.topic] || 0) + 1;
  for (const [id, st] of Object.entries(S)) {
    st.m = mix(st.th);
    const h = st.hist.map(a => a.ok ? 1 : 0);
    const avg = x => x.reduce((s, v) => s + v, 0) / x.length;
    const last = h.slice(-6), prev = h.slice(-12, -6);
    st.trend = (last.length >= 4 && prev.length >= 4) ? avg(last) - avg(prev) : 0;
    st.recentWrong = st.hist.slice(-6).filter(a => !a.ok).length;
    st.wErr = wErr[id] || 0;
    const t = TOP[id];
    const explore = st.n < 3 ? 1.5 : 1;
    st.prio = t.w * (1 - st.m) * explore * (st.trend < -.15 ? 1.3 : 1) * (1 + .15 * st.recentWrong + .1 * Math.min(5, st.wErr));
  }
  M = {S, daily, ...predict(S, lisHist, readHist, works, extUoe)};
  return M;
}
function predict(S, lisHist, readHist, works, extUoe = []) {
  const out = {};
  let acc = 0, wsum = 0, n = 0;
  for (const t of TOPICS) if (t.paper === 'uoe') { acc += t.w * mix(S[t.id].th); wsum += t.w; n += S[t.id].n; }
  const eu = extUoe.slice(-3), euM = eu.reduce((s, v) => s + v[1], 0), euAvg = euM ? eu.reduce((s, v) => s + v[0], 0) / euM : null;
  const w = euM ? Math.min(.5, euM / 80) : 0;
  const uraw = euAvg == null ? acc / wsum : n >= 12 ? (1 - w) * (acc / wsum) + w * euAvg : euAvg;
  out.uoe = {score: n >= 12 || euM >= 20 ? toScale(uraw) : null, n: n + euM, raw: uraw};
  const shrink = arr => { const x = arr.slice(-40); const c = x.reduce((s, v) => s + v, 0); return (c + 2.4) / (x.length + 4); };
  const rn = readHist.length + (S.read?.n || 0) * 0;
  out.reading = {score: readHist.length >= 6 ? toScale(.5 * shrink(readHist) + .5 * mix(S.read.th)) : null, n: readHist.length};
  out.listening = {score: lisHist.length >= 6 ? toScale(shrink(lisHist)) : null, n: lisHist.length};
  const wk = kind => works.filter(w => w.kind === kind && w.res?.total != null).slice(-3);
  const ws = wk('W'), ss = wk('S');
  out.writing = {score: ws.length ? toScale(ws.reduce((s, w) => s + w.res.total / 20, 0) / ws.length) : null, n: ws.length};
  out.speaking = {score: ss.length ? toScale(ss.reduce((s, w) => s + w.res.total / 20, 0) / ss.length) : null, n: ss.length};
  const have = PAPER_ORDER.map(p => out[p].score).filter(x => x != null);
  out.overall = have.length ? Math.round(have.reduce((s, v) => s + v, 0) / have.length) : null;
  out.complete = have.length === 5;
  return out;
}
const scoreOf = (m, p) => m?.[p]?.score ?? null;

/* due / relearn queues */
function wrongQueue(tp) {
  const lastOk = new Map(), res = [];
  for (const a of Store.attempts) if (a.ok) lastOk.set(a.q, a.t);
  const seenQ = new Set();
  for (let i = Store.attempts.length - 1; i >= 0; i--) {
    const a = Store.attempts[i];
    if (a.ok || a.src === 'card' || a.paper === 'listening' || seenQ.has(a.q)) continue;
    seenQ.add(a.q);
    if (lastOk.get(a.q) > a.t) continue;
    if (tp && a.tp !== tp) continue;
    if (Date.now() - a.t < 10 * 60 * 1000) continue;
    if (Q.has(a.q)) res.push(a);
  }
  return res;
}
function cardState(id) { return Store.cards[id] || null; } // [box, due, reviews, lastT, lapses]
function dueCards(tp) {
  const now = Date.now(), out = [];
  for (const [id, s] of Object.entries(Store.cards)) { const c = CARDS.get(id); if (!c || (tp && c.tp !== tp)) continue; if (s[1] <= now) out.push(c); }
  return out.sort((a, b) => Store.cards[a.id][1] - Store.cards[b.id][1]);
}
function newCards(tp, n) { const out = []; for (const c of CARDS.values()) { if (tp && c.tp !== tp) continue; if (!Store.cards[c.id]) out.push(c); if (out.length >= n) break; } return out; }
function rateCard(c, r) { // r: 0 again, 1 hard, 2 good, 3 easy
  const s = Store.cards[c.id] || [0, 0, 0, 0, 0];
  let box = s[0];
  if (r === 0) { box = 0; s[4] = (s[4] || 0) + 1; } else if (r === 1) box = Math.max(1, box); else if (r === 2) box = Math.min(5, box + 1); else box = Math.min(5, box + 2);
  const due = r === 0 ? Date.now() + 5 * 60 * 1000 : Date.now() + BOX_DAYS[box] * 864e5 * (r === 1 ? .6 : 1) + (box === 0 ? 10 * 60e3 : 0);
  Store.cards[c.id] = [box, Math.round(due), (s[2] || 0) + 1, Date.now(), s[4] || 0];
  Store.touch('cards');
  Store.addAttempt({k: uid(), t: Date.now(), q: c.id, tp: c.tp, paper: 'uoe', src: 'card', ok: r >= 2, lv: 1, ch: String(r)});
}

/* ---------------- AI (sample capability) ---------------- */
let SAMPLE = null;
async function initSample() {
  try { if (!window.claude?.use) return; SAMPLE = await Promise.race([window.claude.use('sample'), new Promise(r => setTimeout(() => r(null), 12000))]); }
  catch (e) { SAMPLE = null; }
}
const langLine = () => Store.settings.lang === 'es' ? 'Write every explanation value in Spanish (keep English examples and quoted words in English).' : 'Write every explanation value in clear C1-level British English.';
const EXAMINER = 'You are an experienced Cambridge English examiner for C1 Advanced (CAE). You use standard British/international English valid for the exam and never invent obsolete idioms. Explain the exact grammar rule or C1 vocabulary nuance behind every error; never just give the answer.';
async function ai(prompt, opts = {}) {
  if (!SAMPLE) throw {code: 'unavailable'};
  return SAMPLE.json(prompt, {modelTier: opts.tier, cache: opts.cache ?? true, signal: opts.signal});
}
function qText(q) {
  const t = qType(q);
  if (t === 'kwt') return `Sentence 1: ${q.s1}\nKey word: ${q.k}\nSentence 2: ${q.s2}\nAccepted answers: ${q.a.join(' | ')}`;
  if (t === 'mc') return `Sentence: ${q.s}\nOptions: ${q.o.map((o, i) => LETTERS[i] + ') ' + o).join('  ')}\nCorrect: ${LETTERS[q.a]}) ${q.o[q.a]}`;
  return `Sentence: ${q.s}${q.r ? '\nRoot word: ' + q.r : ''}\nAccepted answers: ${q.a.join(' | ')}`;
}
const _qText0 = qText;
qText = function (q) { return _qText0(q) + (q.ctx ? '\nFull text (excerpt): ' + q.ctx.slice(0, 3500) : ''); };
const ERRT = {grammar: 'Grammar rule', collocation: 'Collocation / fixed phrase', meaning: 'Meaning nuance', form: 'Word form / spelling', structure: 'Sentence structure', trap: 'Fell for a distractor', context: 'Missed a context clue', careless: 'Careless slip'};
async function aiDiagnose(a, q, note) {
  const st = M.S[q.tp];
  const prev = (st?.dx || []).filter(x => x !== a).slice(-5).map(x => '- ' + (x.dx.pattern || '') + ' (' + (x.dx.type || '') + ')').join('\n') || '(none)';
  const chosen = qType(q) === 'mc' ? `${LETTERS[+a.ch]}) ${q.o[+a.ch]}` : a.ch;
  const prompt = `${EXAMINER}
A student aiming for Grade A (C2) in C1 Advanced answered this ${PART_NAME[q.p]} item wrongly. Diagnose WHY, automatically, from the evidence.
Topic: ${TOP[q.tp]?.name || q.tp}
${qText(q)}
Model explanation: ${q.ex || '(none)'}
Student's answer: ${chosen}
Time taken: ${Math.round((a.ms || 0) / 1000)} s
${note ? "Student's own reasoning: " + note : ''}
Student's previous error patterns on this topic:
${prev}

Infer what reasoning leads to the student's answer (e.g. a Spanish false friend, confusing two structures, wrong part of speech, a collocation that sounds right, ignoring the word after the gap). If it repeats a previous pattern, say so.
${langLine()}
Respond ONLY with JSON:
{"type":"grammar|collocation|meaning|form|structure|trap|context|careless","severity":"high|medium|low","pattern":"short label of the error pattern (max 7 words)","trap":"what made the student's answer feel right (1 sentence)","why":"the rule or nuance that makes the correct answer right (1-2 sentences)","rule":"one short memorable rule to never repeat it","practice":"exactly what to practise next (1 sentence)","repeated":true}`;
  const r = await ai(prompt, {cache: !note});
  if (!r || !r.type) throw {code: 'bad_output'};
  return r;
}
async function aiJudge(q, answer) {
  const t = qType(q);
  const prompt = `${EXAMINER}
Decide whether a student's answer is acceptable in Cambridge C1 Advanced ${PART_NAME[q.p]} marking.
${qText(q)}
Student's answer: "${answer}"
${t === 'kwt' ? 'Rules: 3–6 words including the key word, key word unchanged, same meaning as sentence 1, grammatically correct. Give marks out of 2 like Cambridge (1 mark per correct half).' : 'Rules: one word only, must be grammatically and semantically correct in context; spelling must be correct.'}
${langLine()}
Respond ONLY with JSON: {"acceptable":true|false,"marks":${t === 'kwt' ? '0|1|2' : '0|1'},"reason":"1 sentence"}`;
  return await ai(prompt, {tier: 'quick'});
}
const GEN_PARTS = {inv: [2, 4], cleft: [2, 4], cond: [2, 4], wish: [4, 2], pass: [4, 2], modal: [4, 2], verbpat: [4, 1], rel: [2], rep: [4], comp: [2, 4], quant: [2], link: [2, 1], pv: [1, 2, 4], coll: [1, 4], idiom: [1, 4], deppr: [2, 1], confus: [1], wf: [3]};
async function aiGenerate(tp, n = 6, parts) {
  parts = parts || GEN_PARTS[tp] || [1, 2];
  const weak = (M.S[tp]?.dx || []).slice(-6).map(a => a.dx.pattern).filter(Boolean);
  const seen = Store.attempts.filter(a => a.tp === tp && Q.has(a.q)).slice(-15).map(a => { const q = Q.get(a.q); return '- ' + (q.s || q.s1); }).join('\n');
  const prompt = `${EXAMINER}
Write ${n} NEW, original Cambridge C1 Advanced Use of English items that test: ${TOP[tp].name}.
Use these exam parts (spread them): ${parts.map(p => PART_NAME[p]).join('; ')}.
Difficulty: C1 to C2 (the student aims for Grade A). ${weak.length ? 'Target these weaknesses the student has shown: ' + weak.join('; ') + '.' : ''}
Do NOT reuse these sentences:
${seen || '(none)'}
Formats (every sentence is ONE natural sentence, gap shown as ___):
Part 1: {"p":1,"s":"sentence with ___","o":["4 options"],"a":index_of_correct,"ex":"why correct + why the others fail"}
Part 2: {"p":2,"s":"sentence with ___","a":["every acceptable single word"],"ex":"..."}
Part 3: {"p":3,"s":"sentence with ___","r":"ROOT WORD IN CAPITALS","a":["acceptable forms"],"ex":"..."}
Part 4: {"p":4,"s1":"first sentence","k":"KEYWORD","s2":"second sentence with ___ for the missing 3-6 words","a":["all acceptable gap fills, 3-6 words incl. the key word, lowercase"],"ex":"..."}
Add "lv": 2 or 3 to each. ${langLine()} (the sentences themselves are always in English)
Respond ONLY with a JSON array of ${n} items.`;
  const arr = await ai(prompt, {tier: 'default', cache: false});
  const items = (Array.isArray(arr) ? arr : arr?.items || []).filter(validItem).map(x => ({...x, tp, lv: x.lv === 3 ? 3 : 2, id: 'g' + hash((x.s || x.s1) + tp), src: 'gen'}));
  if (!items.length) throw {code: 'bad_output'};
  const list = Store.gen[tp] = Store.gen[tp] || [];
  for (const q of items) if (!Q.has(q.id)) { list.push(q); Q.set(q.id, q); }
  Store.touch('gen/' + tp);
  return items;
}
function validItem(x) {
  if (!x || ![1, 2, 3, 4].includes(x.p)) return false;
  if (x.p === 1) return typeof x.s === 'string' && x.s.includes('___') && Array.isArray(x.o) && x.o.length === 4 && Number.isInteger(x.a) && x.a >= 0 && x.a < 4;
  if (x.p === 4) return x.s1 && x.k && typeof x.s2 === 'string' && x.s2.includes('___') && Array.isArray(x.a) && x.a.length;
  return typeof x.s === 'string' && x.s.includes('___') && Array.isArray(x.a) && x.a.length && (x.p !== 3 || x.r);
}
async function aiReading() {
  const weak = Object.entries(M.S).filter(([k]) => k === 'read').flatMap(([, s]) => s.dx.slice(-4).map(a => a.dx.pattern)).filter(Boolean);
  const themes = ['science and society', 'psychology', 'the arts', 'work and careers', 'nature and the environment', 'history', 'technology and ethics', 'travel writing', 'education', 'language and communication'];
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const prompt = `${EXAMINER}
Write an ORIGINAL C1 Advanced Reading Part 5 task: a 500–600 word text (magazine feature, book extract or review) on ${theme}, written at C1/C2 level with opinion, nuance and some less common vocabulary, in 5–6 paragraphs, followed by 6 four-option multiple-choice questions in text order. Questions should test: inference, writer's attitude/opinion, reference (what 'it/this' refers to), meaning of a phrase in context, purpose of a paragraph, and detail. Distractors must be plausible (words from the text used misleadingly, true-but-irrelevant, too strong).
${weak.length ? 'The student has struggled with: ' + weak.join('; ') + ' — include at least two questions of that kind.' : ''}
${langLine()} (the text and questions are in English; only explanations follow the language rule)
Respond ONLY with JSON: {"title":"...","source":"e.g. Adapted magazine article","text":"paragraphs separated by \\n\\n","questions":[{"q":"question stem","o":["A","B","C","D"],"a":0,"skill":"inference|attitude|reference|vocabulary|purpose|detail","ex":"why correct, quoting the text, and why each distractor fails"}]}`;
  const r = await ai(prompt, {tier: 'default', cache: false});
  if (!r?.text || !Array.isArray(r.questions) || r.questions.length < 4) throw {code: 'bad_output'};
  const rd = {id: 'r' + hash(r.text.slice(0, 120)), t: Date.now(), title: r.title || 'Reading', source: r.source || '', text: r.text, questions: r.questions.filter(x => Array.isArray(x.o) && x.o.length === 4 && Number.isInteger(x.a))};
  Store.reading.push(rd); Store.touch('reading/' + rd.id);
  return rd;
}
async function aiGradeWriting(task, text, kind) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const topicList = TOPICS.filter(t => t.paper === 'uoe').map(t => t.id + ' = ' + t.name).join('; ');
  const crit = kind === 'W'
    ? `Mark it like a Cambridge C1 Advanced Writing examiner on the four subscales, each 0–5:
- content: all content points covered and relevant; target reader fully informed.
- ca (Communicative Achievement): conventions of the genre (${task.type}) used effectively; register appropriate; holds reader's attention; communicates straightforward and complex ideas.
- org (Organisation): well organised and coherent; variety of cohesive devices and organisational patterns.
- lang (Language): range of vocabulary including less common lexis; range of simple and complex grammatical forms with control and flexibility; errors only occasional slips.
Band 5 = C2 performance, band 3 = solid C1, band 1 = B2 or below. Word limit 220–260 (${words} words written).`
    : `This is a TRANSCRIBED/typed speaking answer for C1 Advanced Speaking (${task.title}, Part ${task.part}). Assess it on the analytic scales, each 0–5:
- gr (Grammatical Resource): range and control of simple and complex forms.
- lr (Lexical Resource): range and appropriacy of vocabulary for opinions and abstract topics.
- dm (Discourse Management): extended stretches, relevance, coherence, cohesive devices; for Part 2, comparing and speculating rather than describing.
- ic (Interactive Communication): initiating, responding, developing ideas, inviting the partner/examiner (judge from the text how well it would interact).
Pronunciation cannot be judged from text; do not score it. Band 5 = C2, band 3 = solid C1.`;
  const keys = kind === 'W' ? '"content":0-5,"ca":0-5,"org":0-5,"lang":0-5' : '"gr":0-5,"lr":0-5,"dm":0-5,"ic":0-5';
  const prompt = `${EXAMINER}
${crit}

TASK:
${task.prompt}

CANDIDATE'S ANSWER:
"""${text}"""

${typeof exemplarBlock === 'function' ? exemplarBlock(task, kind) : ''}
Be strict and realistic, as in the real exam. Then write an "Upgraded C1 Version": the same ideas rewritten to Band 5 level, keeping the candidate's structure where possible${kind === 'W' ? ' and staying within 220–260 words' : ''}.
List the most important language errors (max 8) and tag each with one topic id from: ${topicList} (or "" if none fits).
${langLine()} (the upgraded version is always in English)
Respond ONLY with JSON:
{"scores":{${keys}},"band":1-5,"cefr":"B1|B2|C1|C2 (overall level of this text)","sentences":${SENT_SPEC},"summary":"2 sentences: overall verdict","feedback":{${(kind === 'W' ? WCRIT : SCRIT).map(([k]) => `"${k}":"1-2 sentences of specific feedback"`).join(',')}},"strengths":["..."],"errors":[{"original":"exact words","correction":"fixed","explanation":"rule/nuance","topic":"topic id"}],"focus":["3 concrete things to work on next"],"model_comparison":"1-2 sentences: how this answer compares with the benchmark model answers (organisation, register, range)","upgraded":"the full upgraded text"}`;
  const r = await ai(prompt, {tier: 'complex', cache: false});
  if (!r?.scores) throw {code: 'bad_output'};
  const vals = Object.values(r.scores).map(Number).filter(x => isFinite(x));
  r.total = vals.reduce((s, v) => s + clamp(v, 0, 5), 0) * (4 / Math.max(1, vals.length));
  return r;
}
async function aiListeningDx(part, wrong) {
  const tr = (TRANSCRIPTS[part.file.split('/').pop().replace('.mp3', '')]?.tr || []).map(x => x[1]).join(' ');
  const prompt = `${EXAMINER}
A student did C1 Advanced Listening Part ${part.part} ("${part.title}") and got these items wrong:
${wrong.map(w => `- Q${w.n}: ${w.q}\n  Student answered: ${w.chosen}\n  Correct: ${w.correct}\n  Evidence: ${w.ev}`).join('\n')}
Transcript (automatic, may contain small errors):
"""${tr.slice(0, 9000)}"""
For EACH item explain why the student's answer was a trap (what in the recording made it sound right — mentioned-then-rejected, paraphrase, wrong speaker, etc.) and what signal to listen for.
${langLine()}
Respond ONLY with JSON: {"items":[{"n":number,"type":"distractor|paraphrase|missed detail|wrong speaker|spelling|careless","trap":"1 sentence","signal":"1 sentence: what to listen for"}],"overall":"1-2 sentences on the student's listening pattern","practice":"1 sentence"}`;
  return await ai(prompt, {cache: true});
}
async function aiCoach() {
  const errStats = {};
  for (const a of Store.attempts) if (!a.ok && a.src !== 'card') { const k = TOP[a.tp]?.name || a.tp; errStats[k] = (errStats[k] || 0) + 1; }
  const patterns = Store.attempts.filter(a => a.dx).slice(-25).map(a => `${TOP[a.tp]?.name}: ${a.dx.pattern}`).join('\n');
  const wr = Store.works.slice(-4).map(w => `${w.kind === 'W' ? 'Writing' : 'Speaking'} ${w.type}: ${w.res?.total?.toFixed?.(1)}/20; focus: ${(w.res?.focus || []).join('; ')}`).join('\n');
  const prompt = `${EXAMINER}
Act as the student's personal coach. Estimated scores (Cambridge English Scale): ${PAPER_ORDER.map(p => PAPERS[p] + ' ' + (M[p].score ?? 'n/a')).join(', ')}; overall ${M.overall ?? 'n/a'}. Target: Grade A (200+).
Errors by topic: ${JSON.stringify(errStats)}
Recent diagnosed error patterns:
${patterns || '(none)'}
Recent writing/speaking:
${wr || '(none)'}
${langLine()}
Respond ONLY with JSON: {"headline":"one sentence verdict","priorities":[{"topic":"topic name","why":"evidence-based reason","how":"concrete study action"}],"habit":"one bad habit you can see in the data and how to fix it","next_week":"a short plan for the next 7 days"}`;
  return await ai(prompt, {tier: 'default', cache: false});
}

/* ---------------- answer checking ---------------- */
function checkAnswer(q, ch) {
  const t = qType(q);
  if (t === 'mc') return +ch === q.a;
  const n = norm(ch);
  if (!n) return false;
  if (t === 'kwt') return q.a.some(x => norm(x) === n || norm(x).replace(/'/g, '') === n.replace(/'/g, ''));
  return q.a.some(x => norm(x) === n);
}
function heuristicType(a, q) {
  if (a.ok) return null;
  if (a.ms && a.ms < 5000) return 'careless';
  if (q.p === 3) return 'form';
  if (q.p === 4) return 'structure';
  if (q.p >= 5 || String(q.p).startsWith('L')) return 'context';
  if (['coll', 'idiom', 'pv', 'deppr'].includes(q.tp)) return 'collocation';
  if (q.tp === 'confus') return 'meaning';
  return 'grammar';
}

/* ---------------- question widget ----------------
   mountQuestion(el, q, {why, onDone(attempt), onNext}) renders a question with
   answer, verdict, explanation and automatic AI diagnosis on errors. */
function stemHTML(q, filled, cls) {
  const t = qType(q);
  const gap = `<span class="gap ${cls || ''}">${filled ? esc(filled) : '&nbsp;'}</span>`;
  if (t === 'kwt') return `<div class="stem">${esc(q.s1)}</div><div><span class="kw">${esc(q.k)}</span></div><div class="stem">${esc(q.s2).replace('___', gap)}</div>`;
  return `<div class="stem">${esc(q.s).replace('___', gap)}${q.r ? ` &nbsp;<span class="kw">${esc(q.r)}</span>` : ''}</div>`;
}
function mountQuestion(el, q, opts = {}) {
  const st = {q, start: Date.now(), choice: null, done: false, attempt: null, order: q.o ? (q.noShuffle ? [...q.o.keys()] : shuffleIdx(q.o.length, q.id)) : null};
  const t = qType(q);
  const paint = () => {
    el.innerHTML = `<div class="q fade">
      <div class="qhead"><span class="chip dark">${PART_SHORT[q.p]}</span><span class="chip">${esc(TOP[q.tp]?.name || '')}</span>${q.src === 'gen' ? '<span class="chip">Claude-written</span>' : ''}<span class="chip">${'●'.repeat(q.lv || 2)}${'○'.repeat(3 - (q.lv || 2))}</span><span class="timer" id="qt"></span></div>
      ${opts.why ? `<div class="chip why" style="justify-self:start;border-radius:10px;padding:6px 10px">${esc(opts.why)}</div>` : ''}
      <div class="eyebrow">${esc(PART_NAME[q.p] || '')}</div>
      ${q.audio ? `<audio controls preload="metadata" src="${esc(q.audio)}" style="width:100%"></audio>` : ''}
      ${q.script && !q.audio ? `<div class="row"><button class="btn sm" data-tts>▶ Listen (computer voice)</button><button class="btn sm ghost" data-ttsstop>■ Stop</button><span class="small muted">The book file has no audio: a synthetic voice reads the script.</span></div><details><summary class="small" style="cursor:pointer">Audioscript (read it after answering)</summary><div class="passage" style="margin-top:8px;max-height:360px;overflow:auto;padding:12px;border-radius:10px;background:var(--surface-2)">${esc(q.script)}</div></details>` : ''}
      ${q.ctx ? `<details class="ctxbox" ${q.p === 1 || q.p === 2 || q.p === 3 ? '' : 'open'}><summary class="small" style="cursor:pointer;font-weight:700">Show the full text</summary><div class="passage" style="margin-top:8px;max-height:420px;overflow:auto;padding:12px;border-radius:10px;background:var(--surface-2)">${esc(q.ctx)}</div></details>` : ''}
      <div id="qstem">${stemHTML(q)}</div>
      <div id="qans"></div><div id="qctl"></div><div id="qfb"></div></div>`;
    renderAns(); renderCtl();
    const tb = $('[data-tts]', el); if (tb) tb.onclick = () => window.speakLong?.(q.script);
    const ts = $('[data-ttsstop]', el); if (ts) ts.onclick = () => { try { speechSynthesis.cancel(); } catch (e) {} };
  };
  const renderAns = () => {
    const box = $('#qans', el);
    if (t === 'mc') {
      box.innerHTML = `<div class="choices">${st.order.map((oi, i) => {
        let c = '';
        if (st.done) { if (oi === q.a) c = 'right'; else if (String(oi) === st.choice) c = 'wrong'; } else if (String(oi) === st.choice) c = 'sel';
        return `<button class="choice ${c}" data-oi="${oi}"><span class="b">${LETTERS[i]}</span><span>${esc(q.o[oi])}</span></button>`;
      }).join('')}</div>`;
      $$('[data-oi]', box).forEach(b => b.onclick = () => { if (st.done) return; st.choice = b.dataset.oi; renderAns(); renderCtl(); });
    } else {
      box.innerHTML = `<div class="ans"><label class="small muted" for="qin">${t === 'kwt' ? 'Your answer (3–6 words, including the key word)' : 'Your answer'}</label>
        <input id="qin" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(st.choice || '')}" ${st.done ? 'disabled' : ''} class="${st.done ? (st.attempt.ok ? 'ok' : 'no') : ''}"></div>`;
      const inp = $('#qin', box);
      inp.oninput = () => { st.choice = inp.value; renderCtl(); };
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (!st.done) submit(); } };
      if (!st.done) setTimeout(() => inp.focus({preventScroll: true}), 30);
    }
  };
  const renderCtl = () => {
    const c = $('#qctl', el); if (!c) return;
    if (st.done) { c.innerHTML = ''; return; }
    const has = st.choice != null && String(st.choice).trim();
    c.innerHTML = `<div class="row"><button class="btn primary" id="qsub" ${has ? '' : 'disabled'}>Check<span class="kbd">Enter</span></button>${opts.skip ? '<button class="btn ghost sm" id="qskip">Skip</button>' : ''}</div>`;
    $('#qsub', c).onclick = submit;
    if ($('#qskip', c)) $('#qskip', c).onclick = () => opts.onNext?.(null);
  };
  const submit = async () => {
    if (st.done || !(st.choice != null && String(st.choice).trim())) return;
    const ms = Date.now() - st.start;
    let ok = checkAnswer(q, st.choice);
    st.done = true;
    const a = {k: uid(), t: Date.now(), q: q.id, tp: q.tp, p: q.p, paper: qPaper(q), src: q.src, lv: q.lv || 2, ok, ch: String(st.choice).trim(), ms};
    st.attempt = a;
    if (!ok && t !== 'mc' && q.p !== 3 && SAMPLE) {
      $('#qctl', el).innerHTML = '<span class="thinking">Checking whether your answer is also acceptable</span>';
      try {
        const j = await aiJudge(q, a.ch);
        if (j?.acceptable && (t !== 'kwt' || j.marks === 2)) { ok = a.ok = true; a.judged = j.reason; q.a.push(a.ch.toLowerCase()); if (q.src === 'gen') Store.touch('gen/' + q.tp); }
        else if (t === 'kwt' && j?.marks === 1) a.half = j.reason;
      } catch (e) {}
    }
    a.et = heuristicType(a, q);
    Store.addAttempt(a);
    computeModel();
    renderAns(); renderCtl();
    if (t !== 'mc') $('#qstem', el).innerHTML = stemHTML(q, a.ch, ok ? 'ok' : 'no');
    feedback();
    opts.onDone?.(a);
    if (!ok) runDx();
  };
  const feedback = () => {
    const a = st.attempt, f = $('#qfb', el);
    const correct = t === 'mc' ? q.o[q.a] : q.a.slice(0, 3).join(' / ');
    f.innerHTML = `<div class="stack">
      <div class="verdict ${a.ok ? 'ok' : 'no'}">${a.ok ? 'Correct' : a.half ? 'Half marks (1/2)' : 'Not quite'}<span class="meta">${a.ok ? (a.judged ? 'Accepted: ' + esc(a.judged) : fmtTime(a.ms)) : 'Answer: <b>' + esc(correct) + '</b>' + (a.half ? ' · ' + esc(a.half) : '')}</span></div>
      <div class="expl">${esc(q.ex || '')}</div>
      ${a.ok ? '' : '<div class="dx" id="qdx"></div>'}
      <div class="row"><button class="btn accent" id="qnext">${opts.nextLabel || 'Next'}<span class="kbd">Enter</span></button>${opts.extra || ''}</div></div>`;
    $('#qnext', f).onclick = () => opts.onNext?.(a);
    if (!a.ok) renderDx();
    setTimeout(() => $('#qnext', f)?.focus({preventScroll: true}), 40);
  };
  const renderDx = (state) => {
    const a = st.attempt, box = $('#qdx', el); if (!box) return;
    const d = a.dx;
    let body;
    if (d) body = `<div class="row"><span class="chip bad">${esc(ERRT[d.type] || d.type)}</span><span class="small muted">Severity ${esc(d.severity || '')}${d.repeated ? ' · <b>repeated pattern</b>' : ''}</span></div>
      <dl><dt>Pattern</dt><dd><b>${esc(d.pattern)}</b></dd><dt>Why you chose it</dt><dd>${esc(d.trap)}</dd><dt>The rule</dt><dd>${esc(d.why)}</dd><dt>Practise next</dt><dd>${esc(d.practice)}</dd></dl>
      <div class="rule">${esc(d.rule)}</div>`;
    else if (state === 'loading') body = `<span class="thinking">Claude is working out why you missed it</span>`;
    else if (state === 'na') body = `<div class="small muted">Automatic AI diagnosis isn't available in this view. Likely cause: <b>${esc(ERRT[a.et] || a.et)}</b>. The error is saved and will come back for review.</div>`;
    else if (state === 'err') body = `<div class="row small muted">The diagnosis didn't come through this time.<button class="btn sm" id="dxre">Try again</button></div>`;
    else body = '';
    box.innerHTML = `<h3>Why you missed it</h3>${body}
      <details ${a.note ? 'open' : ''}><summary class="small muted" style="cursor:pointer">Add what you were thinking (optional, refines the diagnosis)</summary>
      <div class="stack" style="margin-top:8px"><textarea id="dxnote" placeholder="e.g. I thought 'lack' worked because…">${esc(a.note || '')}</textarea><div><button class="btn sm" id="dxredo">Re-diagnose</button></div></div></details>`;
    $('#dxredo', box).onclick = () => { a.note = $('#dxnote', box).value.trim(); Store.touchAttempt(a); runDx(a.note); };
    if ($('#dxre', box)) $('#dxre', box).onclick = () => runDx(a.note);
  };
  const runDx = async (note) => {
    if (!SAMPLE) return renderDx('na');
    renderDx('loading');
    try {
      const d = await aiDiagnose(st.attempt, q, note);
      st.attempt.dx = {type: d.type, severity: d.severity, pattern: d.pattern, trap: d.trap, why: d.why, rule: d.rule, practice: d.practice, repeated: !!d.repeated};
      if (ERRT[d.type]) st.attempt.et = d.type;
      Store.touchAttempt(st.attempt); computeModel();
      renderDx();
    } catch (e) { renderDx(e?.code === 'not_granted' || e?.code === 'unavailable' ? 'na' : 'err'); }
  };
  paint();
  clearInterval(mountQuestion._tick);
  mountQuestion._tick = setInterval(() => { const e = $('#qt', el); if (!e) return clearInterval(mountQuestion._tick); e.textContent = fmtTime(st.done ? st.attempt.ms : Date.now() - st.start); }, 500);
  mountQuestion._key = e => {
    if (!el.isConnected || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Enter' && st.done && e.target.id !== 'dxnote') { e.preventDefault(); opts.onNext?.(st.attempt); }
    else if (t === 'mc' && !st.done && /^[a-dA-D]$/.test(e.key) && e.target.tagName !== 'INPUT') { st.choice = String(st.order['abcd'.indexOf(e.key.toLowerCase())]); renderAns(); renderCtl(); }
    else if (t === 'mc' && !st.done && e.key === 'Enter' && st.choice != null) { e.preventDefault(); submit(); }
  };
  return st;
}
document.addEventListener('keydown', e => mountQuestion._key?.(e));

/* ---------------- picking questions ---------------- */
function poolFor(tp, part) { return [...Q.values()].filter(q => (!tp || q.tp === tp) && (!part || q.p === part)); }
function pickQuestions(tp, n, {part, relearn} = {}) {
  const seen = new Set(Store.attempts.map(a => a.q));
  const out = [];
  if (relearn) for (const a of wrongQueue(tp)) { const q = Q.get(a.q); if (q && (!part || q.p === part) && !out.includes(q)) out.push(q); if (out.length >= Math.ceil(n / 2)) break; }
  const fresh = poolFor(tp, part).filter(q => !seen.has(q.id) && !out.includes(q));
  const th = tp ? M.S[tp].th : TH0;
  fresh.sort((a, b) => Math.abs(sig(th - BD[a.lv || 2]) - .65) - Math.abs(sig(th - BD[b.lv || 2]) - .65) + (Math.random() - .5) * .3);
  out.push(...fresh.slice(0, n - out.length));
  return out;
}
