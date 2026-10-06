'use strict';
/* ============================================================
   Ruta CAE — CEFR text analyser (shared by the app and the browser extension).
   Word level = frequency band (wordfreq Zipf, like Flexi-Desk's nlp.rs), with
   light lemmatisation. Text level = lexical profile (share of B2+/C1+ words)
   combined with speech rate when timings exist. It is an ESTIMATE: good for
   sorting videos into "below C1 / C1 / C2", not a Cambridge rating.
   ============================================================ */
(function (root) {
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const RANK = {A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5};
  let MAP = null;
  function build() {
    if (MAP) return MAP;
    MAP = new Map();
    const B = root.CEFR_BANDS || {};
    for (const L of LEVELS) for (const w of (B[L] || '').split(' ')) if (w && !MAP.has(w)) MAP.set(w, L);
    return MAP;
  }
  const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been being am do does did have has had i you he she it we they me him her us them my your his its our their this that these those there here what which who whom whose not no yes so than then too very just can could will would shall should may might must'.split(' '));
  const FILLER = /^(m+|h+m+|u+h+|u+m+|a+h+|o+h+|e+r+m*|uh-huh|mm-hmm|yeah|yep|yup|nope|okay|ok|wow|hey|huh|hmm+|whoa|oops|gonna|wanna|gotta)$/;
  function lemmas(w) {
    const out = [w];
    const add = x => { if (x && x.length > 1) out.push(x); };
    if (w.endsWith("'s")) add(w.slice(0, -2));
    if (/ies$/.test(w)) add(w.slice(0, -3) + 'y');
    if (/(ches|shes|sses|xes|zes|oes)$/.test(w)) add(w.slice(0, -2));
    if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
    if (/ied$/.test(w)) add(w.slice(0, -3) + 'y');
    if (/ed$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); if (/(.)\1ed$/.test(w)) add(w.slice(0, -3)); }
    if (/ing$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); if (/(.)\1ing$/.test(w)) add(w.slice(0, -4)); }
    if (/ily$/.test(w)) add(w.slice(0, -3) + 'y');
    if (/ly$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -2) + 'e'); }
    if (/er$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
    if (/est$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
    return out;
  }
  /* level of one word, or null if it should not count (numbers, names, 1 letter) */
  function levelOf(raw, opts = {}) {
    const m = build();
    const w = String(raw || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/^[^a-z]+|[^a-z']+$/g, '').replace(/'$/, '');
    if (!w || w.length < 2 || /\d/.test(w)) return null;
    if (opts.capitalised && !opts.sentenceStart) return null; // a name or title word, not vocabulary
    if (FILLER.test(w)) return null;
    if (w.includes("'")) { const base = ({"won't": 'will', "can't": 'can', "shan't": 'shall'})[w] || w.replace(/(n't|'s|'re|'ve|'ll|'d|'m)$/, ''); if (base !== w) return levelOf(base); }
    let best = null;
    for (const x of lemmas(w)) { const L = m.get(x); if (L && (best == null || RANK[L] < RANK[best])) best = L; }
    if (best) return best;
    if (w.includes('-')) { const parts = w.split('-').map(p => levelOf(p)).filter(Boolean); if (parts.length) return parts.sort((a, b) => RANK[b] - RANK[a])[0]; }
    if (w.includes("'")) return levelOf(w.split("'")[0]);
    return 'C2';
  }
  /* tokenise keeping positions so the UI can colour words in place */
  function tokens(text) {
    const out = [], re = /[A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z]/g;
    let m, prevEnd = 0;
    while ((m = re.exec(text))) {
      const before = text.slice(Math.max(0, prevEnd - 3), m.index);
      const sentenceStart = prevEnd === 0 || /[.!?…]["”')\]]?\s*$/.test(text.slice(0, m.index).trimEnd().slice(-3)) || /\n\s*$/.test(before);
      const capitalised = /^[A-Z]/.test(m[0]) && m[0] !== 'I';
      out.push({w: m[0], i: m.index, j: m.index + m[0].length, L: levelOf(m[0], {capitalised, sentenceStart}), stop: STOP.has(m[0].toLowerCase())});
      prevEnd = m.index + m[0].length;
    }
    return out;
  }
  /* analyse a text (string) or timed segments [[t, text], …] */
  function analyze(input, opts = {}) {
    const segs = typeof input === 'string' ? [[0, input]] : input;
    const text = segs.map(s => s[1]).join(' ');
    const tk = tokens(text);
    const counted = tk.filter(t => t.L);
    const content = counted.filter(t => !t.stop);
    const dist = Object.fromEntries(LEVELS.map(L => [L, 0]));
    for (const t of content) dist[t.L]++;
    const n = content.length || 1;
    const share = L => content.filter(t => RANK[t.L] >= RANK[L]).length / n;
    const b2p = share('B2'), c1p = share('C1'), c2p = share('C2');
    // coverage: level at which 95% of all running words (incl. function words) are known
    let cov = 'C2', cum = 0; const all = counted.length || 1;
    const distAll = Object.fromEntries(LEVELS.map(L => [L, 0])); for (const t of counted) distAll[t.L]++;
    for (const L of LEVELS) { cum += distAll[L]; if (cum / all >= 0.95) { cov = L; break; } }
    // speech rate
    let wpm = null;
    if (typeof input !== 'string' && segs.length > 2) {
      const dur = (segs[segs.length - 1][0] - segs[0][0]) || 0;
      if (dur > 30) wpm = Math.round(tk.length / (dur / 60));
    }
    // Lexical sophistication S = %B2+ + 2·%C1+ + 3·%C2 (content words). Speech is lexically far lighter than
    // writing, so it has its own scale. Calibrated on CAE listening recordings (≈C1) and graded/authentic texts.
    const spoken = opts.spoken ?? (typeof input !== 'string');
    let score = 100 * (b2p + 2 * c1p + 3 * c2p);
    if (spoken && wpm && wpm > 90) score += clamp((wpm - 140) / 5, -6, 8);
    if (opts.extra) score += opts.extra;
    const T = spoken ? [22, 9, 5, 2.5, 1] : [110, 50, 28, 12, 3];
    const level = score >= T[0] ? 'C2' : score >= T[1] ? 'C1' : score >= T[2] ? 'B2' : score >= T[3] ? 'B1' : score >= T[4] ? 'A2' : 'A1';
    const freq = new Map();
    for (const t of content) { if (RANK[t.L] < 3) continue; const k = t.w.toLowerCase(); const f = freq.get(k) || {w: k, L: t.L, n: 0}; f.n++; freq.set(k, f); }
    const hard = [...freq.values()].sort((a, b) => RANK[b.L] - RANK[a.L] || b.n - a.n);
    return {level, spoken, score: Math.round(score), words: tk.length, content: content.length, dist, b2p, c1p, c2p, coverage: cov, wpm,
      hard: {C2: hard.filter(x => x.L === 'C2'), C1: hard.filter(x => x.L === 'C1'), B2: hard.filter(x => x.L === 'B2')}};
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  /* verdict in CAE terms */
  function caeVerdict(a) {
    if (!a) return '';
    if (a.level === 'C2') return 'C2 — above the exam: great stretch listening';
    if (a.level === 'C1') return 'C1 — exam level';
    if (a.level === 'B2') return 'B2 — comfortable, good for fluency';
    return a.level + ' — below the exam';
  }
  root.CEFR = {LEVELS, RANK, levelOf, tokens, analyze, caeVerdict, lemmas};
})(typeof window !== 'undefined' ? window : globalThis);
