'use strict';
/* ============================================================
   Ruta C2 — extra AI: Write & Improve-style checks, importing
   mistakes from the Resource Bank, topic vocabulary lists
   ============================================================ */
const SENT_SPEC = '[{"s":"each sentence of the candidate text, copied EXACTLY","r":"strong|ok|weak (Write & Improve style: strong = C1+ and accurate, weak = errors or clumsy)","note":"short comment, empty if fine","fix":[{"from":"exact words in that sentence to change","to":"suggested replacement","why":"short reason"}]}]';

async function aiQuickCheck(task, text) {
  const prompt = `${EXAMINER}
Give Write & Improve-style feedback on this C1 Advanced ${task.type || 'answer'}. Do NOT rewrite the text. For every sentence, rate it and point to the exact words that should change (spelling, grammar, word choice, register, cohesion).
TASK: ${task.prompt}
TEXT:
<<<${text}>>>
${langLine()}
Respond ONLY with JSON: {"cefr":"B1|B2|C1|C2","band":1-5,"headline":"1 sentence: the single most useful thing to improve next","sentences":${SENT_SPEC}}`;
  const r = await ai(prompt, {tier: 'default', cache: false});
  if (!r || !Array.isArray(r.sentences)) throw {code: 'bad_output'};
  return r;
}

async function aiImportMistakes(raw, source) {
  const topicList = TOPICS.filter(t => t.paper === 'uoe' || t.id === 'read').map(t => t.id + ' = ' + t.name).join('; ');
  const prompt = `${EXAMINER}
A student did an outside practice test (${source}) and pasted the questions they got wrong, with their answer and the correct answer. Convert each one into a practice item the app can re-test later, and diagnose the error.
PASTED TEXT:
<<<${raw.slice(0, 8000)}>>>
For each mistake return one item. Choose the closest format: Use of English Part 1 (4 options), Part 2 (one word), Part 3 (word formation), Part 4 (key word transformation) or Reading (p:5, four options). If the pasted text lacks options, write plausible ones yourself so the item works on its own. Tag each with a topic id from: ${topicList}.
${langLine()} (items themselves stay in English)
Respond ONLY with JSON: {"items":[{"p":1,"tp":"topic id","s":"sentence with ___ (p1,p2,p3,p5)","o":["4 options, p1/p5 only"],"a":"index (number) for p1/p5, or array of accepted answers for p2/p3/p4","r":"ROOT for p3","s1":"p4 only","k":"p4 only","s2":"p4 only, with ___","ex":"explanation","student":"what the student answered","dx":{"type":"grammar|collocation|meaning|form|structure|trap|context|careless","pattern":"max 7 words","trap":"1 sentence","why":"1-2 sentences","rule":"short rule","practice":"1 sentence"}}]}`;
  const r = await ai(prompt, {tier: 'default', cache: false});
  const items = (r?.items || []).map(x => ({...x, p: +x.p, a: (+x.p === 1 || +x.p === 5) ? +x.a : (Array.isArray(x.a) ? x.a : [String(x.a || '')])}))
    .filter(x => x.p === 5 ? (x.s && Array.isArray(x.o) && x.o.length === 4 && Number.isInteger(x.a)) : validItem(x));
  if (!items.length) throw {code: 'bad_output'};
  const out = [];
  for (const x of items) {
    const tp = TOP[x.tp] ? x.tp : (x.p === 3 ? 'wf' : x.p === 5 ? 'read' : 'coll');
    const q = {p: x.p, tp, lv: 3, s: x.s, o: x.o, a: x.a, r: x.r, s1: x.s1, k: x.k, s2: x.s2, ex: x.ex || '', src: 'gen', from: source};
    Object.keys(q).forEach(k => (q[k] === undefined || q[k] === null) && delete q[k]);
    if (x.p !== 1 && x.p !== 5) delete q.o;
    q.id = 'g' + hash((q.s || q.s1) + tp);
    if (!Q.has(q.id)) { (Store.gen[tp] = Store.gen[tp] || []).push(q); Q.set(q.id, q); Store.touch('gen/' + tp); }
    const at = {k: uid(), t: Date.now() - 11 * 60e3, q: q.id, tp, p: q.p, paper: q.p === 5 ? 'reading' : 'uoe', src: 'import', lv: 3, ok: false, ch: String(x.student || ''), ms: 0, from: source};
    if (x.dx && x.dx.pattern) at.dx = x.dx;
    Store.addAttempt(at); out.push({q, at});
  }
  computeModel();
  return out;
}

async function aiVocabList(theme) {
  const known = allVocab().flatMap(t => t.words.map(w => w[0]));
  const prompt = `${EXAMINER}
Create a C1 Advanced topic vocabulary list on: ${theme}. 15 useful, exam-relevant words or short phrases (mix nouns, verbs, adjectives; at least 3 less common C1/C2 items). Do NOT include: ${known.slice(-150).join(', ')}.
${langLine()} (words, examples and collocations in English)
Respond ONLY with JSON: {"name":"short topic name","words":[["word","n|v|adj|adv|phrase","clear definition","natural example sentence that contains the word","typical collocation"]]}`;
  const r = await ai(prompt, {tier: 'default', cache: false});
  const words = (r?.words || []).filter(w => Array.isArray(w) && w.length >= 4 && w[0] && w[2]);
  if (words.length < 5) throw {code: 'bad_output'};
  const v = {id: 'v' + hash(theme + Date.now()), name: r.name || theme, words, t: Date.now(), gen: true};
  Store.vlists.push(v); Store.touch('vlists/' + v.id);
  registerVocabCards();
  return v;
}
function allVocab() { return [...VOCAB, ...Store.vlists, ...(Store.plists || [])]; }
function registerVocabCards() {
  for (const t of [...Store.vlists, ...(Store.plists || [])]) for (const w of t.words) {
    const id = 'vc:' + w[0];
    if (w[2] && (!CARDS.has(id) || !CARDS.get(id).back)) CARDS.set(id, {id, deck: 'vc', tp: 'tvoc', front: w[0], back: w[2] + (w[4] ? '  ·  ' + w[4] : ''), ex: w[3] || (w[5] ? w[5] : ''), pos: w[1]});
  }
}

/* fill in meanings for a word list that came without them (e.g. your book's wordlist) */
async function aiDefine(list) {
  const todo = list.words.filter(w => !w[2]).slice(0, 60);
  if (!todo.length) return 0;
  const prompt = `${EXAMINER}
For each English word or phrase below (from a C1 Advanced vocabulary list on "${list.name}"), give: part of speech (n, v, adj, adv or phrase), a clear learner-friendly definition, a natural C1-level example sentence containing it, and one typical collocation. If the item is clearly not a vocabulary item (a stray number or heading), set "skip": true.
${langLine()} (examples and collocations stay in English)
ITEMS: ${JSON.stringify(todo.map(w => w[0]))}
Respond ONLY with JSON: {"items":[{"w":"the item exactly as given","pos":"…","def":"…","ex":"…","coll":"…","skip":false}]}`;
  const r = await ai(prompt, {tier: 'default', cache: false});
  let n = 0;
  for (const it of r?.items || []) {
    const w = todo.find(x => x[0] === it.w && !x[2]); if (!w) continue;
    if (it.skip) { w[2] = '—'; continue; }
    w[1] = w[1] || it.pos || ''; w[2] = it.def || ''; w[3] = it.ex || ''; w[4] = it.coll || ''; n++;
  }
  list.words = list.words.filter(w => w[2] !== '—');
  await savePrivate(list);
  registerVocabCards();
  return n;
}
