'use strict';
/* ============================================================
   Ruta CAE — Speaking Tutor (FlexiLingo Desk's AI Tutor, rebuilt for the CAE).
   Voice in (browser speech recognition) and voice out (speech synthesis), or
   typing. Modes: exam simulation (Parts 1–4), free conversation, role-play,
   deck practice (your captured / due words) and a paraphrase challenge.
   Every turn gets a quiet correction; the session ends with an estimated
   Cambridge score (Grammatical Resource, Lexical Resource, Discourse
   Management, Interactive Communication) and an Upgraded C1 Version.
   ============================================================ */
const TUTOR_MODES = [
  {id: 'exam', name: 'Exam simulation', icon: '🎓', desc: 'An examiner runs Speaking Parts 1–4 with real CAE timing and prompts.'},
  {id: 'free', name: 'Free conversation', icon: '💬', desc: 'A natural chat at C1 on a topic you choose, with corrections and new vocabulary.'},
  {id: 'role', name: 'Role-play', icon: '🎭', desc: 'Real-world scenarios that need C1 functions: persuading, negotiating, hedging.'},
  {id: 'deck', name: 'Deck practice', icon: '🗂', desc: 'The tutor steers the talk so you must use your captured and due words.'},
  {id: 'para', name: 'Paraphrase challenge', icon: '⚡', desc: 'Say it another way: Key Word Transformation thinking, out loud.'},
];
const TUTOR_SCENARIOS = [
  ['Job interview for a graduate scheme', 'You are an interviewer at a consultancy. Ask probing competency questions.'],
  ['University seminar debate', 'You are a seminar leader. The topic: should universities abolish lectures? Challenge the student.'],
  ['Complaint to a hotel manager', 'You are a polite but defensive hotel manager. The student has a complaint.'],
  ['Persuading the student council', 'You are a sceptical council member. The student wants funding for a project.'],
  ['Negotiating with a landlord', 'You are a landlord who wants to raise the rent. The student is the tenant.'],
  ['Radio phone-in on city traffic', 'You are a radio host. Ask the caller for their view and push back.'],
  ['Planning a group trip', 'You are a friend with different preferences. Reach a decision together (Part 3 skills).'],
  ['Explaining a news story', 'You are curious and ask the student to explain and evaluate a recent news story of their choice.'],
];
const TUTOR_TOPICS = ['Technology and privacy', 'Work–life balance', 'The environment and personal responsibility', 'Education systems', 'Tourism and local culture', 'Social media and identity', 'Cities of the future', 'Art and public money', 'Health and lifestyle', 'Ambition and success'];
const TUTOR_KEY = 'rc2_tutor';

App.tutor = App.tutor || {s: null};
const Tutor = {
  sessions() { return lsGet(TUTOR_KEY, []); },
  saveSession(s) { const l = this.sessions().filter(x => x.id !== s.id); l.push(s); lsSet(TUTOR_KEY, l.slice(-60)); },
};

/* ---------- speech ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let REC = null;
function speak(text, onEnd) {
  if (!('speechSynthesis' in window) || lsGet('rcae_tts', true) === false) { onEnd?.(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_#]/g, ''));
  const vs = speechSynthesis.getVoices();
  u.voice = vs.find(v => /en-GB/i.test(v.lang) && /natural|neural|google|serena|daniel|libby|sonia/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  u.lang = u.voice?.lang || 'en-GB'; u.rate = lsGet('rcae_ttsrate', 1);
  u.onend = () => onEnd?.(); u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}
function listen(onInterim, onFinal, onEnd) {
  if (!SR) return null;
  const r = new SR(); r.lang = 'en-GB'; r.interimResults = true; r.continuous = true;
  let finalText = '';
  r.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t + ' '; else interim += t; }
    onInterim(finalText + interim);
  };
  r.onend = () => { onFinal(finalText.trim()); onEnd?.(); };
  r.onerror = () => {};
  r.start(); return r;
}

/* ---------- prompts ---------- */
function tutorSystem(s) {
  const base = `You are "Ruta", a warm but demanding Cambridge C1 Advanced speaking tutor. Speak natural British English at C1–C2 level. Keep each reply SHORT (1–3 sentences, max ~55 words) because it will be read aloud, and usually end with a question or task so the student keeps talking. Never switch to Spanish unless the student explicitly asks.`;
  const modeTxt = {
    exam: `Act as the CAE Speaking examiner (interlocutor) for this task, following the real exam script and timing. TASK:\n${s.task?.prompt || ''}\nPart ${s.task?.part}. In Part 1 ask the listed questions one at a time with brief natural follow-ups. In Part 2 give the instructions, then let the student talk for about 1 minute, then ask a short follow-up question as if to the other candidate. In Part 3 act as the OTHER CANDIDATE too: discuss the prompts with the student, agree/disagree, and reach a decision. In Part 4 ask the discussion questions, probing for justification. Do not correct during the exam simulation (corrections go in the JSON field only).`,
    free: `Free conversation on: ${s.topic}. Let it evolve naturally, ask follow-ups, and introduce 1–2 C1/C2 words or expressions per exchange (natural, not forced).`,
    role: `Role-play. Scenario: ${s.scenario?.[0]}. Your role: ${s.scenario?.[1]} Stay in character; make the student use C1 functions (persuading, hedging, conceding, clarifying).`,
    deck: `Deck practice. Target words the student must use: ${(s.words || []).join(', ')}. Steer the conversation so each word becomes natural to use; when the student uses one correctly, acknowledge it briefly; track which are still unused.`,
    para: `Paraphrase challenge (like Key Word Transformations, spoken). Each turn give ONE sentence and ONE key word in CAPITALS; the student must say a sentence with the same meaning using that word. Judge it briefly, give the best answer, then give the next item. Use typical CAE structures (inversion, passive reporting, wish/would rather, causative, cleft, phrasal verbs, collocations).`,
  }[s.mode];
  return `${base}\n\n${modeTxt}`;
}
async function tutorTurn(s, userText) {
  const hist = s.turns.slice(-14).map(t => (t.r === 'u' ? 'STUDENT: ' : 'TUTOR: ') + t.x).join('\n');
  const prompt = `${tutorSystem(s)}

CONVERSATION SO FAR:
${hist || '(start)'}
${userText ? 'STUDENT: ' + userText : '(Start the session now: greet the student briefly and begin.)'}

Respond ONLY with JSON:
{"reply":"your next spoken turn","correction":${userText ? '{"original":"the student\'s words that should change, copied exactly (or empty if none)","better":"a corrected / more C1 version","note":"short rule or nuance (≤20 words)"}' : 'null'},"vocab":[{"x":"a C1/C2 word or expression you used or that would have helped","m":"meaning"}],"used":["target words the student used correctly in this turn (deck mode only)"],"done":false}`;
  return SAMPLE.json(prompt, {modelTier: 'default', cache: false});
}
async function tutorScore(s) {
  const stud = s.turns.filter(t => t.r === 'u').map(t => t.x).join('\n');
  return aiJSON(`${EXAMINER}
Assess this C1 Advanced speaking performance (transcribed by speech recognition, so ignore punctuation and minor recognition errors; you cannot judge pronunciation). Mode: ${s.mode}${s.task ? ', Part ' + s.task.part + ': ' + s.task.title : ''}.
FULL CONVERSATION:
${s.turns.map(t => (t.r === 'u' ? 'CANDIDATE: ' : 'TUTOR: ') + t.x).join('\n').slice(0, 12000)}
Use the Cambridge C1 Advanced speaking scales (0–5 each). ${langLine()}
Respond ONLY with JSON: {"gr":0-5,"lr":0-5,"dm":0-5,"ic":0-5,"band":1-5,"cefr":"B2|C1|C2","summary":"2 sentences","strengths":["…"],"fix":[{"said":"exact student words","better":"upgrade","why":"short"}],"upgraded":"an Upgraded C1 Version of the candidate's longest turn (keep their ideas)","phrases":["3-5 useful C1 phrases for this task"],"next":"what to practise next (1 sentence)"}`, {tier: 'complex'});
}

/* ---------- view ---------- */
FLEXI_VIEWS.tutor = function viewTutor() {
  const T = App.tutor;
  if (T.s?.result) return viewTutorResult(T.s);
  if (T.s) return viewTutorSession(T.s);
  const past = Tutor.sessions().slice().reverse();
  const cwDue = [...dueCards('tvoc').filter(c => c.deck === 'cw' || c.deck === 'vc')].slice(0, 10).map(c => c.front);
  const cwNew = CW.all().slice(-10).map(x => x.w);
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel stack"><div class="row between"><div><h2>Speaking Tutor</h2><p class="small muted" style="margin:4px 0 0">Talk out loud (or type). The tutor answers with its voice, quietly corrects you, and gives a Cambridge-style score at the end.</p></div>
      <span class="small muted">${SR ? '🎙 Voice input available' : 'Voice input needs Chrome or Edge; you can type'}</span></div>
      ${SAMPLE ? '' : noAIPanel('The tutor')}
      <div class="decks">${TUTOR_MODES.map(m => `<button class="deck tmode" data-tm="${m.id}" aria-pressed="${App.tutor.pick === m.id}"><b>${m.icon} ${esc(m.name)}</b><span class="small muted">${esc(m.desc)}</span></button>`).join('')}</div>
      <div id="tsetup"></div></div>
    ${past.length ? `<div class="panel stack"><h2>Past sessions</h2><div class="loglist">${past.slice(0, 15).map(p => `<div class="logi"><span><b>${esc(p.title)}</b> <span class="small muted">${new Date(p.t).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})} · ${p.turns?.filter(t => t.r === 'u').length || 0} turns</span></span>${p.result ? `<span class="row" style="gap:6px"><span class="chip">${esc(p.result.cefr || '')}</span><span class="grade ${p.result.band >= 5 ? 'A' : p.result.band >= 4 ? 'B' : p.result.band >= 3 ? 'C' : 'B2'}">Band ${esc(p.result.band)}</span><button class="btn sm ghost" data-tres="${p.id}">Open</button></span>` : '<span class="chip">no score</span>'}</div>`).join('')}</div></div>` : ''}
  </div>`;
  $$('[data-tm]').forEach(b => b.onclick = () => { App.tutor.pick = b.dataset.tm; render(); });
  $$('[data-tres]').forEach(b => b.onclick = () => { App.tutor.s = Tutor.sessions().find(x => x.id === b.dataset.tres); render(); });
  const host = $('#tsetup'), pick = App.tutor.pick; if (!pick) return;
  let html = '';
  if (pick === 'exam') html = `<label class="small muted">Task</label><select id="tsel">${SPEAKING.map((t, i) => `<option value="${i}">Part ${t.part} · ${esc(t.title)}</option>`).join('')}</select><div class="prompt small" id="tprev"></div>`;
  if (pick === 'free') html = `<label class="small muted">Topic</label><div class="row"><select id="tsel">${TUTOR_TOPICS.map(t => `<option>${esc(t)}</option>`).join('')}</select><input type="text" id="tcustom" placeholder="…or your own topic" style="flex:1;min-width:160px"></div>`;
  if (pick === 'role') html = `<label class="small muted">Scenario</label><select id="tsel">${TUTOR_SCENARIOS.map((s, i) => `<option value="${i}">${esc(s[0])}</option>`).join('')}</select>`;
  if (pick === 'deck') html = `<label class="small muted">Words to use (edit freely)</label><textarea id="twords" rows="2">${esc([...new Set([...cwDue, ...cwNew])].slice(0, 10).join(', ') || 'notwithstanding, to be at odds with, unprecedented, to shed light on, detrimental')}</textarea>`;
  if (pick === 'para') html = `<p class="small muted" style="margin:0">Ten quick transformations. Say your answer; the tutor judges it and gives the model.</p>`;
  host.innerHTML = `<div class="stack" style="margin-top:6px">${html}<div class="row"><button class="btn accent" id="tgo" ${SAMPLE ? '' : 'disabled'}>Start</button><label class="row small"><input type="checkbox" id="ttts" ${lsGet('rcae_tts', true) ? 'checked' : ''}> Tutor speaks aloud</label></div></div>`;
  if ($('#tprev')) { const pv = () => $('#tprev').textContent = SPEAKING[+$('#tsel').value].prompt; $('#tsel').onchange = pv; pv(); }
  $('#ttts').onchange = e => lsSet('rcae_tts', e.target.checked);
  $('#tgo').onclick = () => {
    const s = {id: 't' + uid(), t: Date.now(), mode: pick, turns: [], vocab: [], corr: []};
    if (pick === 'exam') { s.task = SPEAKING[+$('#tsel').value]; s.title = 'Exam · Part ' + s.task.part + ' · ' + s.task.title; }
    if (pick === 'free') { s.topic = $('#tcustom').value.trim() || $('#tsel').value; s.title = 'Conversation · ' + s.topic; }
    if (pick === 'role') { s.scenario = TUTOR_SCENARIOS[+$('#tsel').value]; s.title = 'Role-play · ' + s.scenario[0]; }
    if (pick === 'deck') { s.words = $('#twords').value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean).slice(0, 15); s.used = []; s.title = 'Deck practice · ' + s.words.length + ' words'; }
    if (pick === 'para') s.title = 'Paraphrase challenge';
    App.tutor.s = s; render(); tutorSend(s, null);
  };
};
function viewTutorSession(s) {
  const left = s.mode === 'deck' ? s.words.filter(w => !(s.used || []).includes(w)) : [];
  $('#app').innerHTML = `<div class="view fade">
    <div class="row between"><button class="btn ghost sm" id="tquit">← End without score</button><span class="timer" id="tclock">0:00</span></div>
    <div class="tlay">
      <div class="panel stack" style="min-width:0"><div class="row between"><h2>${esc(s.title)}</h2>${s.task ? '<button class="btn sm ghost" id="ttask">Task card</button>' : ''}</div>
        ${s.task ? `<div class="prompt small" id="tcard" hidden>${esc(s.task.prompt)}</div>` : ''}
        <div class="chat" id="tchat">${s.turns.map(t => turnHTML(t)).join('')}</div>
        <div class="interim small muted" id="tint"></div>
        <div class="row"><button class="mic" id="tmic" ${SR ? '' : 'disabled'} aria-label="Hold to talk">🎙</button><textarea id="ttype" rows="2" placeholder="${SR ? 'Tap the mic and speak — or type here' : 'Type your answer'}" style="flex:1;min-width:0"></textarea><button class="btn primary" id="tsend">Send</button></div>
        <div class="row"><button class="btn accent" id="tend" ${s.turns.filter(t => t.r === 'u').length ? '' : 'disabled'}>Finish & get my score</button><span class="small" id="tmsg"></span></div>
      </div>
      <div class="stack" style="min-width:0">
        ${s.mode === 'deck' ? `<div class="panel stack"><h2>Target words</h2><div class="hw">${s.words.map(w => `<span class="chipw ${(s.used || []).includes(w) ? 'lv-ok' : ''}">${esc(w)}</span>`).join('')}</div><p class="small muted" style="margin:0">${left.length} still to use</p></div>` : ''}
        <div class="panel stack"><h2>Corrections</h2><div class="loglist" id="tcorr">${s.corr.length ? s.corr.slice().reverse().map(corrHTML).join('') : '<p class="small muted" style="margin:0">They appear here as you talk.</p>'}</div></div>
        <div class="panel stack"><h2>New vocabulary</h2><div class="hw" id="tvoc">${s.vocab.map(v => `<button class="tw chipw" data-w="${esc(v.x)}" title="${esc(v.m)}">${esc(v.x)}</button>`).join('') || '<p class="small muted" style="margin:0">—</p>'}</div></div>
      </div></div></div>`;
  const chat = $('#tchat'); chat.scrollTop = chat.scrollHeight;
  wireWords($('#tvoc'), sp => s.vocab.find(v => v.x === sp.dataset.w)?.m || '', {type: 'tutor', title: s.title});
  wireWords(chat, sp => sp.closest('.turn')?.textContent || '', {type: 'tutor', title: s.title});
  $('#tquit').onclick = () => { speechSynthesis?.cancel(); REC?.stop(); if (s.turns.length > 1) Tutor.saveSession(s); App.tutor.s = null; render(); };
  if ($('#ttask')) $('#ttask').onclick = () => { $('#tcard').hidden = !$('#tcard').hidden; };
  const t0 = s.t; clearInterval(viewTutorSession._c); viewTutorSession._c = setInterval(() => { const c = $('#tclock'); if (!c) return clearInterval(viewTutorSession._c); c.textContent = fmtTime(Date.now() - t0); }, 1000);
  const send = () => { const v = $('#ttype').value.trim(); if (!v) return; $('#ttype').value = ''; tutorSend(s, v); };
  $('#tsend').onclick = send;
  $('#ttype').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  $('#tmic').onclick = () => {
    if (REC) { REC.stop(); return; }
    speechSynthesis?.cancel();
    $('#tmic').classList.add('on');
    REC = listen(t => $('#tint').textContent = t, t => { if (t) tutorSend(s, t); }, () => { REC = null; $('#tmic')?.classList.remove('on'); $('#tint') && ($('#tint').textContent = ''); });
  };
  $('#tend').onclick = async () => {
    speechSynthesis?.cancel(); REC?.stop();
    $('#tend').disabled = true; $('#tmsg').innerHTML = '<span class="thinking">The examiner is marking your performance</span>';
    try { s.result = await tutorScore(s); s.dur = Date.now() - s.t; Tutor.saveSession(s); bumpAct('chk'); render(); }
    catch (e) { $('#tmsg').textContent = aiErrText(e); $('#tend').disabled = false; }
  };
}
const turnHTML = t => `<div class="turn ${t.r === 'u' ? 'me' : 'ai'}">${t.r === 'ai' ? cefrHTML(t.x, {min: 'C1'}) : esc(t.x)}</div>`;
const corrHTML = c => `<div class="err"><s>${esc(c.original)}</s> → <b>${esc(c.better)}</b><div class="small muted">${esc(c.note || '')}</div></div>`;
async function tutorSend(s, text) {
  if (text) s.turns.push({r: 'u', x: text, t: Date.now()});
  if (App.tab === 'tutor' && App.tutor.s === s) { render(); $('#tmsg') && ($('#tmsg').innerHTML = '<span class="thinking">…</span>'); }
  try {
    const r = await tutorTurn(s, text);
    s.turns.push({r: 'ai', x: r.reply || '…', t: Date.now()});
    if (r.correction && r.correction.original && r.correction.better && norm(r.correction.original) !== norm(r.correction.better)) s.corr.push(r.correction);
    for (const v of r.vocab || []) if (v?.x && !s.vocab.some(y => y.x === v.x)) s.vocab.push(v);
    if (s.mode === 'deck') s.used = [...new Set([...(s.used || []), ...(r.used || []).filter(w => s.words.includes(w))])];
    if (App.tab === 'tutor' && App.tutor.s === s) { render(); speak(r.reply); }
  } catch (e) { $('#tmsg') && ($('#tmsg').textContent = aiErrText(e)); }
}
function viewTutorResult(s) {
  const R = s.result;
  const crit = [['gr', 'Grammatical Resource'], ['lr', 'Lexical Resource'], ['dm', 'Discourse Management'], ['ic', 'Interactive Communication']];
  $('#app').innerHTML = `<div class="view fade">
    <div class="row between"><button class="btn ghost sm" id="tback">← Tutor</button><button class="btn sm" id="tagain">Practise again</button></div>
    <div class="panel stack"><div class="eyebrow">${esc(s.title)} · ${fmtTime(s.dur || 0)}</div>
      <div class="row" style="gap:18px;align-items:center"><div class="bigscore">${esc(R.band)}<span class="small muted" style="font-size:16px">/5</span></div><div><span class="chip dark">${esc(R.cefr || '')}</span><p style="margin:6px 0 0">${esc(R.summary || '')}</p></div></div>
      ${crit.map(([k, l]) => `<div class="crit"><span>${l}</span><span class="dots5">${[1, 2, 3, 4, 5].map(i => `<i class="${(+R[k] || 0) >= i ? 'on' : ''}"></i>`).join('')}</span><b class="num">${esc(R[k])}</b></div>`).join('')}
      <p class="small muted" style="margin:0">Pronunciation isn't scored (the tutor only sees the transcript).</p></div>
    <div class="grid2">
      <div class="panel stack"><h2>Fix these</h2><div class="errs">${(R.fix || []).map(f => `<div class="err"><s>${esc(f.said)}</s> → <b>${esc(f.better)}</b><div class="small muted">${esc(f.why)}</div></div>`).join('') || '<p class="small muted">Nothing major.</p>'}</div>
        ${(R.strengths || []).length ? `<div class="eyebrow">Strengths</div><ul class="small" style="margin:0">${R.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>
      <div class="panel stack"><h2>Upgraded C1 Version</h2><div class="upgraded">${esc(R.upgraded || '')}</div>
        ${(R.phrases || []).length ? `<div class="hw" id="tph">${R.phrases.map(p => `<button class="tw chipw" data-w="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
        ${R.next ? `<div class="chip why">Next: ${esc(R.next)}</div>` : ''}</div></div>
    <details class="panel"><summary><b>Transcript</b></summary><div class="chat" style="max-height:none">${s.turns.map(turnHTML).join('')}</div></details></div>`;
  if ($('#tph')) wireWords($('#tph'), sp => sp.dataset.w, {type: 'tutor', title: s.title});
  $('#tback').onclick = () => { App.tutor.s = null; render(); };
  $('#tagain').onclick = () => { App.tutor.pick = s.mode; App.tutor.s = null; render(); };
}
