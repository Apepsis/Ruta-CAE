'use strict';
/* ============================================================
   Ruta CAE — Media Lab (FlexiLingo's podcast/video player, for the CAE).
   Bring a YouTube video, a podcast/audio file or an article:
     · transcript (from the extension, a pasted transcript/subtitle file,
       or Whisper running in your browser for audio files)
     · CEFR estimate of the whole thing (below C1 / C1 / C2) + speech rate
     · every B2/C1/C2 word coloured and tappable → meaning → save
     · AI: CAE Listening/Reading-style questions on it, marked and logged
   ============================================================ */
const MEDIA = {
  IDX: 'rc2_media',                      // light index in localStorage (rc2_ → backed up)
  list() { return lsGet(this.IDX, []); },
  saveIdx(l) { lsSet(this.IDX, l); },
  async get(id) { const d = await RCAE.LocalDB.doc('media/' + id).get(); return d.data(); },
  async put(item) {
    await RCAE.LocalDB.doc('media/' + item.id).set(item);
    const l = this.list().filter(x => x.id !== item.id);
    l.unshift({id: item.id, kind: item.kind, title: item.title, level: item.an?.level || null, score: item.an?.score ?? null, wpm: item.an?.wpm || null, at: item.at, ytId: item.ytId || null, done: item.done || null, qn: item.quiz?.qs?.length || 0, qok: item.quizRes?.ok ?? null});
    this.saveIdx(l.slice(0, 300));
  },
  async del(id) { await RCAE.LocalDB.doc('media/' + id).delete(); this.saveIdx(this.list().filter(x => x.id !== id)); },
};
window.MEDIA = MEDIA;

function ytIdOf(u) {
  const m = String(u || '').match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(u) ? u : null);
}
/* transcript parsers: YouTube "Show transcript" copy, SRT, VTT, plain text */
function parseTranscript(raw) {
  const txt = String(raw || '').replace(/\r/g, '').trim();
  if (!txt) return [];
  const ts = s => { const p = s.replace(',', '.').split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
  if (/-->/.test(txt)) { // SRT / VTT
    const out = [];
    for (const block of txt.split(/\n\s*\n/)) {
      const lines = block.split('\n').filter(Boolean); const i = lines.findIndex(l => l.includes('-->')); if (i < 0) continue;
      const t = ts(lines[i].split('-->')[0].trim().split(' ')[0]);
      const text = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim(); if (text) out.push([t, text]);
    }
    return dedupeSegs(out);
  }
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);
  const tsRe = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;
  if (lines.filter(l => tsRe.test(l)).length >= 3) { // YouTube transcript copy: time line, text line(s)
    const out = []; let cur = null;
    for (const l of lines) { if (tsRe.test(l)) { if (cur && cur[1]) out.push(cur); cur = [ts(l), '']; } else if (cur) cur[1] = (cur[1] + ' ' + l).trim(); }
    if (cur && cur[1]) out.push(cur); return out;
  }
  const inl = /^((?:\d{1,2}:)?\d{1,2}:\d{2})\s+(.+)$/;
  if (lines.filter(l => inl.test(l)).length >= 3) return lines.map(l => l.match(inl)).filter(Boolean).map(m => [ts(m[1]), m[2]]);
  // plain text: split into sentences, no timings
  return txt.split(/(?<=[.!?])\s+(?=[A-Z"“])/).map(s => [null, s.trim()]).filter(s => s[1]);
}
function dedupeSegs(segs) { const out = []; for (const s of segs) if (!out.length || out[out.length - 1][1] !== s[1]) out.push(s); return out; }
/* merge tiny caption fragments into readable sentences (keeps the first timing) */
function mergeSegs(segs) {
  if (!segs.length || segs[0][0] == null) return segs;
  const out = []; let cur = null;
  for (const [t, x] of segs) {
    if (!cur) { cur = [t, x]; continue; }
    if (cur[1].length < 60 || (!/[.!?]["”]?$/.test(cur[1]) && cur[1].length < 220)) cur[1] += ' ' + x; else { out.push(cur); cur = [t, x]; }
  }
  if (cur) out.push(cur); return out;
}

/* ---------- Whisper in the browser (transformers.js, downloaded on first use) ---------- */
const WHISPER = {model: 'onnx-community/whisper-base.en', worker: null};
function whisperWorker() {
  if (WHISPER.worker) return WHISPER.worker;
  const code = `
    let pipe = null;
    self.onmessage = async (e) => {
      const {cmd, audio, model} = e.data;
      try {
        if (!pipe) {
          const T = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5');
          T.env.allowLocalModels = false;
          pipe = await T.pipeline('automatic-speech-recognition', model, {dtype: 'q8', progress_callback: p => self.postMessage({type: 'load', p})});
        }
        const out = await pipe(audio, {chunk_length_s: 30, stride_length_s: 5, return_timestamps: true});
        self.postMessage({type: 'done', out});
      } catch (err) { self.postMessage({type: 'error', message: String(err && err.message || err)}); }
    };`;
  WHISPER.worker = new Worker(URL.createObjectURL(new Blob([code], {type: 'text/javascript'})), {type: 'module'});
  return WHISPER.worker;
}
async function decodeTo16k(blob) {
  const buf = await blob.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const dec = await ac.decodeAudioData(buf); ac.close?.();
  const len = Math.ceil(dec.duration * 16000);
  const off = new OfflineAudioContext(1, len, 16000);
  const src = off.createBufferSource(); src.buffer = dec; src.connect(off.destination); src.start();
  const r = await off.startRendering(); return r.getChannelData(0);
}
function transcribe(blob, onStatus) {
  return new Promise(async (res, rej) => {
    try {
      onStatus('Preparing audio…');
      const audio = await decodeTo16k(blob);
      const w = whisperWorker();
      w.onmessage = e => {
        const m = e.data;
        if (m.type === 'load') { if (m.p.status === 'progress' && m.p.total) onStatus(`Downloading the speech model (first time only): ${Math.round(m.p.loaded / m.p.total * 100)}%`); else if (m.p.status === 'ready') onStatus('Transcribing… (about 1–3× the audio length on a laptop)'); }
        else if (m.type === 'done') res((m.out.chunks || []).map(c => [c.timestamp?.[0] ?? 0, String(c.text || '').trim()]).filter(c => c[1]));
        else if (m.type === 'error') rej(new Error(m.message));
      };
      onStatus('Loading the speech model…');
      w.postMessage({cmd: 'run', audio, model: WHISPER.model}, [audio.buffer]);
    } catch (e) { rej(e); }
  });
}

/* ---------- AI: CAE-style questions ---------- */
async function aiMediaQuiz(item, kind) {
  const text = item.segs.map(s => s[1]).join(' ').slice(0, 14000);
  const isRead = item.kind === 'text';
  const fmt = kind === 'gap'
    ? `Listening Part 2 style: 8 sentence-completion items. Each item: {"type":"gap","q":"a sentence that paraphrases the text with ___ for 1–3 words heard EXACTLY in the recording","a":["accepted answer","variants"],"ev":"the exact words from the text"}`
    : `${isRead ? 'Reading Part 5' : 'Listening Part 3'} style: 6 four-option multiple-choice items testing attitude, opinion, purpose, inference and detail (not simple word matching), with plausible distractors that use words from the text. Each item: {"type":"mc","q":"question","o":["A text","B text","C text","D text"],"a":index,"ev":"the exact words from the text that justify the key","why":"why the main distractor is wrong"}`;
  return aiJSON(`${EXAMINER}
Write C1 Advanced ${fmt}
Base everything strictly on this ${isRead ? 'text' : 'transcript'} ("${item.title}"):
<<<${text}>>>
Order the items as they appear in the text. ${langLine()} (questions and options in English; "why" may follow the language setting)
Respond ONLY with JSON: {"title":"short title","items":[...]}`, {tier: 'complex'});
}
async function aiMediaSummary(item) {
  const text = item.segs.map(s => s[1]).join(' ').slice(0, 12000);
  return aiJSON(`${EXAMINER}
A C1 Advanced candidate studied this ${item.kind === 'text' ? 'text' : 'recording'} ("${item.title}"). Prepare a short study brief.
<<<${text}>>>
${langLine()}
Respond ONLY with JSON: {"gist":"2-3 sentence summary","speakers":"who is speaking / register","chunks":[{"x":"useful C1/C2 phrase or collocation exactly as in the text","m":"meaning"}],"grammar":[{"x":"a notable advanced structure from the text (inversion, cleft, participle clause…)","m":"what it is"}],"speaking":"one CAE Speaking Part 4 style question to discuss it"}`, {tier: 'default'});
}

/* ---------- views ---------- */
App.media = App.media || {id: null, add: null};
FLEXI_VIEWS.media = function viewMedia() {
  if (App.media.id) return viewMediaItem(App.media.id);
  const list = MEDIA.list();
  const lvlCount = L => list.filter(x => x.level === L).length;
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel stack"><div class="row between"><div><h2>Media Lab</h2><p class="small muted" style="margin:4px 0 0">Turn real English into CAE practice: YouTube videos, podcasts, audio files and articles. You get the CEFR level, a transcript where C1–C2 words are coloured and tappable, and exam-style questions.</p></div>
      <div class="row small">${['C2', 'C1', 'B2'].map(L => `<span class="lvl lvl-${L}">${L} ${lvlCount(L)}</span>`).join('')}</div></div>
      <div class="seg" role="tablist">${[['yt', 'YouTube'], ['audio', 'Audio / podcast file'], ['url', 'Audio link'], ['text', 'Article / text']].map(([k, l]) => `<button data-add="${k}" aria-pressed="${App.media.add === k}">${l}</button>`).join('')}</div>
      <div id="madd"></div>
      <div class="legend2"><span><i style="background:var(--lv-B2)"></i>B2</span><span><i style="background:var(--lv-C1)"></i>C1</span><span><i style="background:var(--lv-C2)"></i>C2 / rare</span><span class="muted">Levels are frequency-based estimates (like FlexiLingo); use them to pick material, not as a grade.</span></div>
    </div>
    ${list.length ? `<div class="panel stack"><h2>Your library</h2><div class="tracks">${list.map(x => `<button class="trk" data-mid="${x.id}"><span class="pn lvlbig lvl-${esc(x.level || 'na')}">${esc(x.level || '—')}</span><span style="min-width:0"><b>${esc(x.title)}</b><div class="small muted">${x.kind === 'yt' ? 'YouTube' : x.kind === 'text' ? 'Text' : 'Audio'}${x.wpm ? ' · ' + x.wpm + ' wpm' : ''} · ${new Date(x.at).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}${x.qn ? ` · quiz ${x.qok != null ? x.qok + '/' + x.qn : 'ready'}` : ''}</div></span><span>→</span></button>`).join('')}</div></div>`
      : `<div class="panel stack"><h2>Where to find C1–C2 material</h2><ul class="small" style="margin:0">
        <li>Podcasts: BBC 6 Minute English (B2), BBC Radio 4 <i>The Infinite Monkey Cage</i>, <i>In Our Time</i>, <i>TED Radio Hour</i> (C1–C2)</li>
        <li>YouTube: TED talks, The Economist, Vox, RSA Animate, university lectures (C1–C2)</li>
        <li>With the extension installed, YouTube shows the level on each video and a “Send to Ruta CAE” button.</li></ul></div>`}
  </div>`;
  $$('[data-add]').forEach(b => b.onclick = () => { App.media.add = App.media.add === b.dataset.add ? null : b.dataset.add; render(); });
  $$('[data-mid]').forEach(b => b.onclick = () => { App.media.id = b.dataset.mid; render(); });
  mountMediaAdd($('#madd'));
};
function mountMediaAdd(host) {
  const k = App.media.add; if (!k) { host.innerHTML = ''; return; }
  const tsBox = `<details ${k === 'yt' ? 'open' : ''}><summary class="small">Paste a transcript or subtitles (optional)</summary><textarea id="mtr" rows="6" placeholder="${k === 'yt' ? 'On YouTube: … → Show transcript → select all → copy, and paste here. Or install the extension and press “Send to Ruta CAE”.' : 'Paste the transcript, or an .srt / .vtt subtitle file’s text'}"></textarea><label class="small muted">or load a subtitle file <input type="file" id="msub" accept=".srt,.vtt,.txt"></label></details>`;
  host.innerHTML = `<div class="stack" style="gap:10px">
    ${k === 'yt' ? '<input type="text" id="murl" placeholder="YouTube link, e.g. https://www.youtube.com/watch?v=…">' : ''}
    ${k === 'url' ? '<input type="text" id="murl" placeholder="Direct link to an .mp3 (podcast episode)">' : ''}
    ${k === 'audio' ? '<label class="small">Audio or video file (mp3, m4a, wav, mp4) <input type="file" id="mfile" accept="audio/*,video/*"></label>' : ''}
    <input type="text" id="mtitle" placeholder="Title (optional)">
    ${k === 'text' ? '<textarea id="mtext" rows="10" placeholder="Paste an article, essay or any text…"></textarea>' : tsBox}
    ${k === 'audio' || k === 'url' ? '<label class="row small"><input type="checkbox" id="mwhisper" checked> No transcript? Transcribe it here with Whisper (runs in your browser; first use downloads ~80 MB)</label>' : ''}
    <div class="row"><button class="btn accent" id="mgo">Analyse</button><span class="small" id="mmsg"></span></div></div>`;
  if ($('#msub')) $('#msub').onchange = async e => { const f = e.target.files[0]; if (f) $('#mtr').value = await f.text(); };
  $('#mgo').onclick = async () => {
    const msg = t => $('#mmsg').innerHTML = t;
    const item = {id: 'm' + uid(), kind: k === 'url' ? 'audio' : k, title: $('#mtitle').value.trim(), at: Date.now(), segs: []};
    try {
      if (k === 'yt') {
        item.ytId = ytIdOf($('#murl').value.trim()); if (!item.ytId) return msg('That doesn\'t look like a YouTube link.');
        item.url = 'https://www.youtube.com/watch?v=' + item.ytId;
        item.title = item.title || await ytTitle(item.ytId) || 'YouTube video';
      }
      if (k === 'url') { item.url = $('#murl').value.trim(); if (!/^https?:\/\//.test(item.url)) return msg('Paste a full https:// link.'); item.title = item.title || decodeURIComponent(item.url.split('/').pop().split('?')[0]); }
      if (k === 'audio') {
        const f = $('#mfile').files[0]; if (!f) return msg('Choose a file.');
        msg('<span class="thinking">Saving the file</span>');
        const up = await (await window.claude.use('assets')).upload(f); item.blobId = up.id; item.title = item.title || f.name.replace(/\.[^.]+$/, '');
      }
      if (k === 'text') { item.segs = parseTranscript($('#mtext').value); item.title = item.title || (item.segs[0]?.[1] || 'Text').slice(0, 60); }
      else if ($('#mtr')?.value.trim()) item.segs = mergeSegs(parseTranscript($('#mtr').value));
      if (!item.segs.length && (k === 'audio' || k === 'url') && $('#mwhisper')?.checked) {
        let blob;
        if (k === 'audio') blob = await RCAE.IDB.get('blobs', item.blobId);
        else { msg('<span class="thinking">Downloading the audio</span>'); const r = await fetch(item.url).catch(() => null); if (!r || !r.ok) return msg('The site doesn\'t allow downloading this file from the browser. Download it and use “Audio / podcast file”.'); blob = await r.blob(); }
        item.segs = mergeSegs(await transcribe(blob, s => msg(`<span class="thinking">${esc(s)}</span>`)));
      }
      if (item.segs.length) item.an = summariseAnalysis(CEFR.analyze(item.segs.map(s => [s[0] ?? 0, s[1]]), {spoken: item.kind !== 'text'}));
      await MEDIA.put(item);
      App.media = {id: item.id, add: null}; render();
    } catch (e) { console.warn(e); msg('<span style="color:var(--bad)">' + esc(e.message || 'Something went wrong') + '</span>'); }
  };
}
async function ytTitle(id) {
  try { const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id)); if (r.ok) return (await r.json()).title; } catch (e) {}
  return null;
}
function summariseAnalysis(a) { return {level: a.level, score: a.score, wpm: a.wpm, dist: a.dist, b2p: a.b2p, c1p: a.c1p, c2p: a.c2p, words: a.words, coverage: a.coverage, hard: {C2: a.hard.C2.slice(0, 40), C1: a.hard.C1.slice(0, 40)}}; }

/* ---------- one item ---------- */
let YT_API = null;
function loadYT() {
  if (YT_API) return YT_API;
  YT_API = new Promise(res => { if (window.YT?.Player) return res(window.YT); window.onYouTubeIframeAPIReady = () => res(window.YT); const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); });
  return YT_API;
}
async function viewMediaItem(id) {
  const item = await MEDIA.get(id);
  if (!item) { App.media.id = null; return render(); }
  const an = item.an;
  const audioSrc = item.blobId ? BLOB_URLS[item.blobId] : item.url && item.kind === 'audio' ? item.url : null;
  const timed = item.segs.length && item.segs[0][0] != null;
  $('#app').innerHTML = `<div class="view fade">
    <div class="row between"><button class="btn ghost sm" id="mback">← Media Lab</button><span class="row"><button class="btn sm ghost" id="mren">Rename</button><button class="btn sm ghost" id="mdel">Delete</button></span></div>
    <div class="panel stack"><div class="row between" style="align-items:flex-start"><div style="min-width:0"><div class="eyebrow">${item.kind === 'yt' ? 'YouTube' : item.kind === 'text' ? 'Text' : 'Audio'}</div><h2 style="font-size:22px">${esc(item.title)}</h2>${item.url ? `<a class="small" href="${esc(item.url)}" target="_blank" rel="noopener">Open original ↗</a>` : ''}</div>
      ${an ? `<div class="lvlcard lvl-${an.level}"><b>${an.level}</b><span>${esc(CEFR.caeVerdict(an))}</span></div>` : ''}</div>
      ${an ? `<div class="grid3">
        <div class="stat"><span class="small muted">Words</span><b>${an.words}</b></div>
        <div class="stat"><span class="small muted">B2+ / C1+ words</span><b>${pct(an.b2p)} / ${pct(an.c1p)}</b></div>
        ${an.wpm ? `<div class="stat"><span class="small muted">Speech rate</span><b>${an.wpm} wpm</b><span class="small muted">${an.wpm >= 170 ? 'fast' : an.wpm >= 140 ? 'exam-like' : 'slow'}</span></div>` : `<div class="stat"><span class="small muted">95% coverage at</span><b>${an.coverage}</b></div>`}</div>
        <div class="distbar">${CEFR.LEVELS.map(L => { const n = an.dist[L], tot = Object.values(an.dist).reduce((a, b) => a + b, 0) || 1; return n ? `<i class="lvbg-${L}" style="flex:${n / tot}" title="${L}: ${n}"><span>${n / tot > .06 ? L : ''}</span></i>` : ''; }).join('')}</div>` : ''}
    </div>
    <div class="mlay">
      <div class="stack" style="min-width:0">
        ${item.kind === 'yt' ? `<div class="ytbox"><div id="ytp"></div></div>` : ''}
        ${audioSrc ? `<audio id="mau" controls preload="metadata" src="${esc(audioSrc)}" style="width:100%"></audio>` : ''}
        <div class="panel stack"><div class="row between"><h2>Transcript</h2><div class="row small">${timed ? '<label class="row"><input type="checkbox" id="mfollow" checked> follow</label>' : ''}<div class="seg">${['B2', 'C1', 'C2', 'off'].map(m => `<button data-hl="${m}" aria-pressed="${(App.media.min || 'B2') === m}">${m === 'off' ? 'No colours' : m + '+'}</button>`).join('')}</div></div></div>
          ${item.segs.length ? `<div class="mtr" id="mtr">${item.segs.map((s, i) => `<p data-si="${i}">${s[0] != null ? `<button class="ts" data-seek="${s[0]}">${fmtTime(s[0] * 1000)}</button>` : ''}<span class="tx">${App.media.min === 'off' ? esc(s[1]) : cefrHTML(s[1], {min: App.media.min || 'B2'})}</span></p>`).join('')}</div>`
            : `<p class="small muted">No transcript yet.</p><textarea id="mtrin" rows="6" placeholder="Paste the transcript or subtitles here"></textarea><div class="row"><button class="btn" id="mtrsave">Add transcript</button>${item.blobId ? '<button class="btn" id="mwh">Transcribe with Whisper</button>' : ''}<span class="small" id="mtrmsg"></span></div>`}
        </div>
      </div>
      <div class="stack" style="min-width:0">
        ${an ? `<div class="panel stack"><div class="row between"><h2>Hard words</h2><span class="small muted">tap to look up</span></div>
          ${['C2', 'C1'].map(L => an.hard[L]?.length ? `<div><div class="eyebrow" style="margin-bottom:6px">${L}${L === 'C2' ? ' / rare' : ''}</div><div class="hw">${an.hard[L].slice(0, 24).map(h => `<button class="tw chipw lv-${L}${CW.find(h.w) ? ' saved' : ''}" data-w="${esc(h.w)}">${esc(h.w)}${h.n > 1 ? `<small>${h.n}</small>` : ''}</button>`).join('')}</div></div>` : '').join('')}
          <button class="btn sm" id="msaveall">Save all C1 + C2 words</button></div>` : ''}
        <div class="panel stack"><h2>Practise it</h2>
          ${SAMPLE && item.segs.length ? `<div class="row"><button class="btn accent sm" data-quiz="mc">${item.kind === 'text' ? 'Reading Part 5 questions' : 'Listening Part 3 questions'}</button>${item.kind !== 'text' ? '<button class="btn sm" data-quiz="gap">Part 2 sentence completion</button>' : ''}<button class="btn sm" id="mbrief">Study brief</button></div><div id="mquiz"></div>` : !item.segs.length ? '<p class="small muted">Add a transcript to unlock questions.</p>' : noAIPanel('Exam-style questions')}
          ${item.brief ? briefHTML(item.brief) : ''}
        </div>
      </div>
    </div></div>`;
  $('#mback').onclick = () => { App.media.id = null; render(); };
  $('#mdel').onclick = async () => { if (confirm('Delete this item?')) { await MEDIA.del(id); App.media.id = null; render(); } };
  $('#mren').onclick = async () => { const t = prompt('Title', item.title); if (t) { item.title = t; await MEDIA.put(item); render(); } };
  $$('[data-hl]').forEach(b => b.onclick = () => { App.media.min = b.dataset.hl; render(); });
  const src = {type: item.kind, title: item.title, url: item.url || null, mid: item.id};
  const box = $('#mtr');
  if (box) wireWords(box, s => s.closest('p')?.querySelector('.tx')?.textContent || '', src);
  $$('.hw').forEach(h => wireWords(h, s => { const k = s.dataset.w.toLowerCase(); const seg = item.segs.find(x => x[1].toLowerCase().includes(k)); return seg ? seg[1] : ''; }, src));
  if ($('#msaveall')) $('#msaveall').onclick = () => {
    let n = 0; for (const L of ['C2', 'C1']) for (const h of an.hard[L] || []) { if (CW.find(h.w)) continue; const seg = item.segs.find(x => x[1].toLowerCase().includes(h.w)); CW.add({w: h.w, ctx: seg?.[1] || '', src, L}, {quiet: true}); n++; }
    toast(n + ' words saved to Captured words'); render();
  };
  // player
  let getT = null, seek = null;
  if (item.kind === 'yt') {
    loadYT().then(YT => {
      const p = new YT.Player('ytp', {videoId: item.ytId, width: '100%', height: '100%', playerVars: {rel: 0, cc_load_policy: 0, modestbranding: 1}});
      getT = () => p.getCurrentTime?.() || 0; seek = t => { p.seekTo?.(t, true); p.playVideo?.(); };
    });
  } else if ($('#mau')) { const au = $('#mau'); getT = () => au.currentTime; seek = t => { au.currentTime = t; au.play().catch(() => {}); }; }
  $$('[data-seek]').forEach(b => b.onclick = e => { e.stopPropagation(); seek?.(+b.dataset.seek); });
  if (timed && box) {
    let last = -1;
    clearInterval(viewMediaItem._tick);
    viewMediaItem._tick = setInterval(() => {
      if (!document.body.contains(box)) return clearInterval(viewMediaItem._tick);
      if (!getT) return; const t = getT();
      let i = item.segs.findIndex((s, k) => s[0] <= t && (k === item.segs.length - 1 || item.segs[k + 1][0] > t));
      if (i !== last && i >= 0) { $$('p.now', box).forEach(p => p.classList.remove('now')); const p = $(`p[data-si="${i}"]`, box); p?.classList.add('now'); if ($('#mfollow')?.checked && p) p.scrollIntoView({block: 'nearest', behavior: 'smooth'}); last = i; }
    }, 400);
  }
  // add transcript later
  const finish = async segs => { item.segs = segs; item.an = summariseAnalysis(CEFR.analyze(segs.map(s => [s[0] ?? 0, s[1]]), {spoken: item.kind !== 'text'})); await MEDIA.put(item); render(); };
  if ($('#mtrsave')) $('#mtrsave').onclick = () => { const s = mergeSegs(parseTranscript($('#mtrin').value)); if (!s.length) return toast('Paste a transcript first'); finish(s); };
  if ($('#mwh')) $('#mwh').onclick = async () => { $('#mwh').disabled = true; try { finish(mergeSegs(await transcribe(await RCAE.IDB.get('blobs', item.blobId), s => $('#mtrmsg').innerHTML = `<span class="thinking">${esc(s)}</span>`))); } catch (e) { $('#mtrmsg').textContent = 'Transcription failed: ' + e.message; $('#mwh').disabled = false; } };
  // AI
  $$('[data-quiz]').forEach(b => b.onclick = async () => {
    const host = $('#mquiz'); host.innerHTML = '<p class="thinking small">Writing exam questions on this ' + (item.kind === 'text' ? 'text' : 'recording') + '</p>';
    try { const q = await aiMediaQuiz(item, b.dataset.quiz); item.quiz = {kind: b.dataset.quiz, ...q, qs: q.items || []}; await MEDIA.put(item); mountMediaQuiz(host, item); }
    catch (e) { host.innerHTML = `<p class="small" style="color:var(--bad)">${esc(aiErrText(e))}</p>`; }
  });
  if ($('#mbrief')) $('#mbrief').onclick = async () => { $('#mbrief').disabled = true; $('#mbrief').textContent = 'Writing…'; try { item.brief = await aiMediaSummary(item); await MEDIA.put(item); render(); } catch (e) { toast(aiErrText(e)); $('#mbrief').disabled = false; } };
  if (item.quiz?.qs?.length && $('#mquiz')) mountMediaQuiz($('#mquiz'), item);
}
function briefHTML(b) {
  return `<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:10px"><div class="eyebrow">Study brief</div><p style="margin:0">${esc(b.gist)}</p><p class="small muted" style="margin:0">${esc(b.speakers || '')}</p>
    ${b.chunks?.length ? `<table class="t lex"><tbody>${b.chunks.map(c => `<tr><td>${esc(c.x)}</td><td>${esc(c.m)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${b.grammar?.length ? `<div class="small">${b.grammar.map(g => `<div><b>${esc(g.x)}</b> — ${esc(g.m)}</div>`).join('')}</div>` : ''}
    ${b.speaking ? `<div class="chip why">Speaking Part 4: ${esc(b.speaking)}</div>` : ''}</div>`;
}
function mountMediaQuiz(host, item) {
  const Z = item.quiz; const qs = Z.qs.filter(q => q && q.q);
  const ans = {}; let checked = false;
  const paint = () => {
    host.innerHTML = `<div class="stack" style="gap:4px"><div class="eyebrow">${esc(Z.kind === 'gap' ? 'Listening Part 2 · sentence completion' : item.kind === 'text' ? 'Reading Part 5 · multiple choice' : 'Listening Part 3 · multiple choice')}</div>
      ${qs.map((q, i) => `<div class="lq"><div class="qq">${i + 1}. ${esc(q.q)}</div>
        ${q.type === 'gap' || !q.o ? `<input type="text" data-gi="${i}" value="${esc(ans[i] || '')}" ${checked ? 'disabled' : ''} class="${checked ? (gapOk(q, ans[i]) ? 'ok' : 'no') : ''}" style="max-width:320px" autocomplete="off">${checked && !gapOk(q, ans[i]) ? ` <span class="small">→ <b>${esc((q.a || [])[0])}</b></span>` : ''}`
          : `<div class="opts">${q.o.map((o, k) => `<button class="opt ${checked ? (k === +q.a ? 'right' : ans[i] === k ? 'wrong' : '') : ans[i] === k ? 'sel' : ''}" data-qi="${i}" data-k="${k}" ${checked ? 'disabled' : ''}>${LETTERS[k]} ${esc(String(o).replace(/^[A-D][).:]\s*/, ''))}</button>`).join('')}</div>`}
        ${checked ? `<div class="ev">“${esc(q.ev || '')}”${q.why ? `<div class="small muted">${esc(q.why)}</div>` : ''}</div>` : ''}</div>`).join('')}
      <div class="row">${checked ? `<b>${qs.filter((q, i) => isOk(q, i)).length}/${qs.length}</b><button class="btn sm" id="mqre">Try again</button>` : '<button class="btn accent sm" id="mqchk">Check answers</button>'}</div></div>`;
    $$('[data-qi]', host).forEach(b => b.onclick = () => { ans[+b.dataset.qi] = +b.dataset.k; paint(); });
    $$('[data-gi]', host).forEach(inp => inp.oninput = () => { ans[+inp.dataset.gi] = inp.value; });
    if ($('#mqchk', host)) $('#mqchk', host).onclick = async () => {
      checked = true;
      const now = Date.now(), run = uid();
      const atts = qs.map((q, i) => ({k: uid(), t: now, q: 'm:' + item.id + ':' + (i + 1), run, tp: item.kind === 'text' ? 'read' : 'listen', p: item.kind === 'text' ? 5 : (Z.kind === 'gap' ? 'L2' : 'L3'), paper: item.kind === 'text' ? 'reading' : 'listening', src: 'media', lv: 2, ok: isOk(q, i), ch: String(ans[i] ?? ''), label: `${item.title.slice(0, 40)} Q${i + 1}: ${q.q}`}));
      atts.forEach(a => Store.addAttempt(a));
      item.quizRes = {ok: atts.filter(a => a.ok).length, n: atts.length, t: now}; item.done = now; await MEDIA.put(item);
      computeModel(); paint();
    };
    if ($('#mqre', host)) $('#mqre', host).onclick = () => { checked = false; for (const k in ans) delete ans[k]; paint(); };
  };
  const gapOk = (q, v) => (q.a || []).some(a => norm(a) === norm(v));
  const isOk = (q, i) => q.type === 'gap' || !q.o ? gapOk(q, ans[i]) : ans[i] === +q.a;
  paint();
}

/* the Today page gets a small Media Lab nudge */
hookView('today', () => {
  const list = MEDIA.list(); const v = $('#app .view'); if (!v) return;
  const wk = CW.week(0).length;
  const html = `<section class="panel row between" id="medianudge"><div><div class="eyebrow">FlexiLingo routine</div><b>${list.length ? `Last in the Media Lab: ${esc(list[0].title.slice(0, 60))}` : 'Watch something at C1 today'}</b><div class="small muted">${wk} words captured this week${wk ? ' · your Weekly Word Sheet is ready' : ''}</div></div>
    <div class="row"><button class="btn sm" data-goto="media">Media Lab →</button>${wk ? '<button class="btn sm" id="tdsheet">Word Sheet PDF</button>' : ''}</div></section>`;
  const daily = $('#daily', v); (daily || v.firstElementChild).insertAdjacentHTML('afterend', html);
  if ($('#tdsheet')) $('#tdsheet').onclick = () => openWeeklySheet();
});
