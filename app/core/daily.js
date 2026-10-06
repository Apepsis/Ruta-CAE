'use strict';
/* ============================================================
   Ruta C2 — daily tasks: a fixed daily routine that ticks itself
   from what you actually do, with a streak and a 3-week calendar.
   ============================================================ */
function bumpAct(key) {
  const d = dayKey(Date.now());
  const act = Store.settings.act = Store.settings.act || {};
  act[d] = act[d] || {}; act[d][key] = (act[d][key] || 0) + 1;
  Store.touch('settings');
}
const DAILY = [
  {id: 'sess', label: 'Study sessions (STUDY NOW)', goal: 2, why: 'learn + drill your weakest topic', go: () => startSession()},
  {id: 'qs', label: 'Use of English / Reading questions', goal: 20, why: 'exam-format items, all parts', go: () => setTab('practice')},
  {id: 'cards', label: 'Flashcards reviewed', goal: 25, why: 'or clear everything that is due', go: () => { App.cardRun = null; App.vt = null; const due = dueCards(); if (due.length) App.cardRun = {title: 'All due cards', list: due.slice(0, 40)}; setTab('cards'); }},
  {id: 'vocab', label: 'New topic words', goal: 10, why: 'learn or quiz a C1 word list', go: () => { App.cardRun = null; setTab('cards'); }},
  {id: 'lis', label: 'Listening part', goal: 1, why: 'a full part, both plays', go: () => { if (!LISTENING.length) return setTab('media'); const done = new Set(Store.attempts.filter(a => a.paper === 'listening').map(a => a.q.split(':')[1])); App.lisPart = (LISTENING.find(p => !done.has(p.id)) || worstListening()).id; setTab('listening'); }},
  {id: 'write', label: 'Writing or Speaking', goal: 1, why: 'a check or a marked task', go: () => { App.ws.task = null; App.ws.view = null; setTab('write'); }},
];
function dailyCounts(day) {
  const at = Store.attempts.filter(a => dayKey(a.t) === day);
  const act = (Store.settings.act || {})[day] || {};
  const runs = new Set(at.filter(a => a.paper === 'listening').map(a => a.run || a.q.split(':')[1]));
  const vocabWords = new Set(at.filter(a => a.src === 'card' && String(a.q).startsWith('vc:')).map(a => a.q));
  return {
    sess: act.sess || 0,
    qs: at.filter(a => (a.src === 'bank' || a.src === 'gen' || a.src === 'imp') && a.paper !== 'listening').length,
    cards: at.filter(a => a.src === 'card' && !String(a.q).startsWith('vc:')).length,
    vocab: vocabWords.size,
    lis: runs.size,
    write: (act.chk || 0) + Store.works.filter(w => dayKey(w.t) === day).length,
  };
}
function dailyStatus(day = dayKey(Date.now())) {
  const c = dailyCounts(day);
  const isToday = day === dayKey(Date.now());
  const rows = DAILY.map(t => {
    let have = c[t.id], goal = t.goal;
    if (t.id === 'cards' && isToday && have > 0 && !dueCards().length) goal = Math.min(goal, have); // due pile cleared
    return {...t, have, goal, done: have >= goal};
  });
  return {rows, all: rows.every(r => r.done), n: rows.filter(r => r.done).length};
}
function streak() {
  let s = 0; const d = new Date();
  if (!dailyStatus(dayKey(d)).all) d.setDate(d.getDate() - 1); // today still in progress
  for (let i = 0; i < 400; i++) { if (dailyStatus(dayKey(d)).all) { s++; d.setDate(d.getDate() - 1); } else break; }
  return s;
}
function weeklyOutside() {
  const since = Date.now() - 7 * 864e5;
  return Store.ext.filter(x => x.t >= since).length;
}
function dailyPanelHTML() {
  const st = dailyStatus(), sk = streak();
  const cal = [...Array(21).keys()].reverse().map(i => { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d); const s = dailyStatus(k); return {k, n: s.n, all: s.all, today: i === 0}; });
  const wk = weeklyOutside();
  return `<section class="panel stack" id="daily">
    <div class="row between"><div><div class="eyebrow">Daily tasks · the C2 routine</div><h2 style="font-size:21px;margin-top:2px">${st.all ? 'All done today. That\'s how C2 is built.' : st.n + ' of ' + st.rows.length + ' done today'}</h2></div>
      <div class="row"><span class="streak"><b class="num">${sk}</b> day streak</span></div></div>
    <div class="dtasks">${st.rows.map(r => `<button class="dtask ${r.done ? 'done' : ''}" data-dt="${r.id}"><span class="tick" aria-hidden="true">${r.done ? '✓' : ''}</span><span style="min-width:0"><b>${esc(r.label)}</b><span class="small muted">${esc(r.why)}</span><span class="meter"><i style="width:${Math.min(100, r.have / r.goal * 100)}%;background:var(--${r.done ? 'good' : 'gA'})"></i></span></span><span class="num small">${Math.min(r.have, r.goal)}/${r.goal}</span></button>`).join('')}</div>
    <div class="row between small"><span class="muted">Weekly: one outside test or part from the Resource Bank (answer sheet) · <b style="color:var(--${wk ? 'good' : 'warn'})">${wk ? 'done this week ✓' : 'not yet this week'}</b>${wk ? '' : ' <button class="btn sm" id="dwk">Pick one</button>'}</span>
      <span class="cal" aria-label="Last 21 days">${cal.map(d => `<i class="${d.all ? 'full' : d.n ? 'part' : ''} ${d.today ? 'today' : ''}" title="${d.k}: ${d.n}/${DAILY.length}"></i>`).join('')}</span></div>
  </section>`;
}
function wireDaily() {
  $$('[data-dt]').forEach(b => b.onclick = () => DAILY.find(t => t.id === b.dataset.dt).go());
  if ($('#dwk')) $('#dwk').onclick = () => setTab('resources');
}
