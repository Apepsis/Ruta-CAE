'use strict';
/* ============================================================
   Ruta CAE — shell: new tabs (Media Lab, Tutor), the settings centre
   (AI provider, backups, content pack, extension), and small hooks that
   let the FlexiLingo-style modules plug into the Ruta views.
   ============================================================ */
const FLEXI_VIEWS = {};             // tab id -> view fn (filled by media.js, tutor.js…)
const VIEW_HOOKS = {};              // tab id -> [fn after the original view rendered]
function hookView(tab, fn) { (VIEW_HOOKS[tab] = VIEW_HOOKS[tab] || []).push(fn); }

if (!LISTENING.length) SKIP_AUTO.add('listen');
/* while a backup/pack import runs, the page must not save its old in-memory state */
for (const fn of ['flush', 'local']) { const f0 = Store[fn].bind(Store); Store[fn] = function (...a) { if (window.__rcaeImporting) return; return f0(...a); }; }

const _render0 = render;
render = function () {
  const v = FLEXI_VIEWS[App.tab];
  if (v) { computeModel(); updateCountdown(); mountQuestion._key = null; v(); }
  else _render0();
  for (const fn of VIEW_HOOKS[App.tab] || []) { try { fn(); } catch (e) { console.warn('hook', App.tab, e); } }
  $$('[data-goto]').forEach(b => b.onclick = () => setTab(b.dataset.goto));
};

function viewListeningEmpty() {
  $('#app').innerHTML = `<div class="view fade">
    <div class="panel stack"><h2>Listening</h2>
      <p>Exam-format listening (Parts 1–4, played twice, with evidence and transcript) uses recordings from your own books. They are licensed, so they are not part of the public app: import your <b>private content pack</b> once and they appear here.</p>
      <div class="row"><button class="btn accent" id="lpack">Import content pack</button><button class="btn" data-goto="media">Open the Media Lab</button></div>
      <p class="small muted" style="margin:0">Meanwhile, the Media Lab turns any YouTube video, podcast or audio file into C1 listening practice: transcript with CEFR colours, hard words, and CAE-style questions.</p></div>
    ${Store.sets.some(s => s.audio) ? `<div class="panel stack"><h2>Your imported listening sets</h2>${setListHTML()}</div>` : ''}</div>`;
  $('#lpack').onclick = () => openSettings('pack');
  wireSetList();
}

/* ---------- settings centre ---------- */
openSettings = function (section) {
  const o = $('#overlay');
  const c = RCAE.AIConf.get();
  const P = RCAE.PRESETS;
  o.innerHTML = `<div class="modal" role="dialog" aria-label="Settings"><div class="panel stack settings" style="max-width:720px">
    <div class="row between"><h2>Settings</h2><button class="btn ghost sm" id="setX">Close</button></div>
    <div class="seg" role="tablist">${[['study', 'Study'], ['ai', 'AI'], ['data', 'Backup & sync'], ['pack', 'Content pack'], ['ext', 'Extension & app']].map(([k, l]) => `<button data-sec="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
    <section data-s="study" class="stack">
      <label class="small muted" for="setName">Your name</label><input type="text" id="setName" value="${esc(Store.settings.name || '')}" placeholder="for the greeting">
      <label class="small muted" for="setDate">Exam date</label><input type="date" id="setDate" value="${esc(Store.settings.examDate || '')}">
      <label class="small muted">Language of explanations</label>
      <div class="seg"><button data-l="en" aria-pressed="${Store.settings.lang !== 'es'}">English (immersion)</button><button data-l="es" aria-pressed="${Store.settings.lang === 'es'}">Español</button></div>
      <label class="small muted">Theme</label>
      <div class="seg">${['auto', 'light', 'dark'].map(t => `<button data-theme-btn="${t}" aria-pressed="${(lsGet('rcae_theme', 'auto')) === t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <div class="row"><button class="btn primary" id="setSave">Save</button></div>
    </section>
    <section data-s="ai" class="stack">
      <p class="small muted" style="margin:0">Marking, diagnoses, new questions, the tutor and the Media Lab quizzes need an AI model. Your key stays in this browser and is sent only to the provider you choose.</p>
      <label class="small muted" for="aiProv">Provider</label>
      <select id="aiProv"><option value="none">Off</option>${Object.entries(P).map(([k, p]) => `<option value="${k}" ${c.provider === k ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
      <div class="grid2" style="gap:10px">
        <label class="stack" style="gap:4px"><span class="small muted">API key</span><input type="password" id="aiKey" value="${esc(c.key || '')}" autocomplete="off" placeholder="sk-… / sk-ant-…"></label>
        <label class="stack" style="gap:4px"><span class="small muted">Base URL</span><input type="text" id="aiBase" value="${esc(c.base || '')}" placeholder="default for the provider"></label>
        <label class="stack" style="gap:4px"><span class="small muted">Model</span><input type="text" id="aiModel" value="${esc(c.model || '')}" list="aiModels" placeholder="default"><datalist id="aiModels"></datalist></label>
        <label class="stack" style="gap:4px"><span class="small muted">Model for long jobs (optional)</span><input type="text" id="aiModelC" value="${esc(c.modelComplex || '')}" list="aiModels" placeholder="same as above"></label>
      </div>
      <div class="row"><button class="btn primary" id="aiSave">Save & test</button><button class="btn sm" id="aiList">List models</button><span class="small" id="aiMsg"></span></div>
      <details class="small muted"><summary>Which one should I use?</summary><ul>
        <li><b>Claude (Anthropic)</b>: best marking quality; create a key at console.anthropic.com (pay per use; a full writing mark costs a few cents).</li>
        <li><b>Ollama</b>: free and offline. Install it, run <code>ollama pull llama3.1</code>, and start it with <code>OLLAMA_ORIGINS=*</code> so the browser may call it. Quality is lower for marking.</li>
        <li><b>OpenRouter / Gemini / OpenAI</b>: any OpenAI-compatible endpoint works.</li></ul></details>
    </section>
    <section data-s="data" class="stack">
      <p class="small muted" style="margin:0">Everything (attempts, cards, writing, imported sets, captured words) lives on this device. Export a backup to move it to another browser, the desktop app or your phone, and import it there. Imports merge, they never delete.</p>
      <p class="small muted" style="margin:0">Coming from <b>Ruta C2 on claude.ai</b>? There, click the exam countdown → <i>Export my progress (.json)</i>, then import that file here. <a href="https://claude.ai/artifact/KFEAm6NUy6ZYK7j2R4Zz7B" target="_blank" rel="noopener">Open Ruta C2 ↗</a></p>
      <div class="row"><button class="btn primary" id="dExp">Export backup (.json)</button><label class="btn" style="cursor:pointer">Import backup<input type="file" id="dImp" accept=".json,application/json" hidden></label><span class="small" id="dMsg"></span></div>
      <p class="small muted" style="margin:0">Stored now: <span class="num">${Store.attempts.length}</span> answers · <span class="num">${Object.keys(Store.cards).length}</span> cards · <span class="num">${Store.works.length}</span> marked tasks · <span class="num">${Store.sets.length}</span> imported sets · <span class="num">${(window.CW ? CW.all().length : 0)}</span> captured words.</p>
    </section>
    <section data-s="pack" class="stack">
      <p class="small muted" style="margin:0">A content pack is a .zip with <code>pack.json</code> (listening parts, transcripts, your book sets, word lists and progress) plus the audio. It is for your own licensed material and never leaves this device. Build one with <code>npm run pack</code> (see docs/CONTENT-PACK.md).</p>
      <p class="small muted" style="margin:0">Import the .zip as it is, without unzipping it (it must contain <code>pack.json</code> and the <code>audio/</code> folder). The Listening tab lights up as soon as it is in.</p>
      <p style="margin:0">${window.PACK_INFO ? `Installed: <b>${esc(PACK_INFO.title)}</b> · ${PACK_INFO.parts} listening parts` : 'No pack installed.'}</p>
      <div class="row"><label class="btn primary" style="cursor:pointer">Import pack (.zip)<input type="file" id="pImp" accept=".zip,application/zip" hidden></label>${window.PACK_INFO ? '<button class="btn" id="pDel">Remove pack</button>' : ''}<span class="small" id="pMsg"></span></div>
    </section>
    <section data-s="ext" class="stack">
      <p style="margin:0">The <b>Ruta CAE browser extension</b> rates YouTube videos as B2 / C1 / C2, colours C1–C2 words in the captions, and saves any word you click (or select on any website) to your Captured words here, with its sentence.</p>
      <p class="small" style="margin:0">Status: <b id="extStat">${window.BRIDGE?.connected ? 'connected ✓' : 'not detected on this page'}</b></p>
      <ol class="small muted" style="margin:0;padding-left:20px"><li>Download <code>ruta-cae-extension.zip</code> from the latest GitHub release and unzip it.</li><li>Chrome → <code>chrome://extensions</code> → Developer mode → Load unpacked → choose the folder.</li><li>Open this app once: the extension remembers its address and syncs words when it is open.</li></ol>
      <p style="margin:0"><b>Desktop app</b>: Windows, macOS and Linux installers are attached to every GitHub release. On a phone, use your browser's “Add to Home screen”.</p>
      <p class="small muted" style="margin:0">Ruta CAE ${esc(RCAE.VERSION)} · built on Ruta C2 + ideas and algorithms from FlexiLingo Desk (AGPL-3.0).</p>
    </section></div></div>`;
  const show = k => { $$('[data-sec]', o).forEach(b => b.setAttribute('aria-pressed', b.dataset.sec === k)); $$('[data-s]', o).forEach(s => s.hidden = s.dataset.s !== k); };
  $$('[data-sec]', o).forEach(b => b.onclick = () => show(b.dataset.sec));
  show(typeof section === 'string' ? section : 'study');
  $('#setX', o).onclick = () => o.innerHTML = '';
  let lang = Store.settings.lang || 'en';
  $$('[data-l]', o).forEach(b => b.onclick = () => { lang = b.dataset.l; $$('[data-l]', o).forEach(x => x.setAttribute('aria-pressed', x.dataset.l === lang)); });
  $$('[data-theme-btn]', o).forEach(b => b.onclick = () => { lsSet('rcae_theme', b.dataset.themeBtn); applyTheme(); $$('[data-theme-btn]', o).forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $('#setSave', o).onclick = () => { Store.settings.examDate = $('#setDate', o).value; Store.settings.name = $('#setName', o).value.trim(); Store.settings.lang = lang; Store.touch('settings'); o.innerHTML = ''; render(); toast('Settings saved'); };
  // AI
  const fillDefaults = () => { const p = P[$('#aiProv', o).value]; $('#aiBase', o).placeholder = p?.base || ''; $('#aiModel', o).placeholder = p?.model || 'model name'; };
  $('#aiProv', o).onchange = fillDefaults; fillDefaults();
  const readAI = () => ({provider: $('#aiProv', o).value, key: $('#aiKey', o).value.trim(), base: $('#aiBase', o).value.trim(), model: $('#aiModel', o).value.trim(), modelComplex: $('#aiModelC', o).value.trim()});
  $('#aiSave', o).onclick = async () => {
    const conf = readAI(); RCAE.AIConf.set(conf);
    SAMPLE = RCAE.aiOn() ? RCAE.Sample : null;
    if (!SAMPLE) { $('#aiMsg', o).textContent = conf.provider === 'none' ? 'AI is off.' : 'Add the API key.'; return; }
    $('#aiMsg', o).innerHTML = '<span class="thinking">Testing</span>';
    try { const r = await RCAE.testAI(); $('#aiMsg', o).innerHTML = `<span style="color:var(--good)">Connected ✓ (${(r.ms / 1000).toFixed(1)} s)</span>`; render(); }
    catch (e) { $('#aiMsg', o).innerHTML = `<span style="color:var(--bad)">${esc(e.message || e.code || 'Failed')}${e.status ? ' (' + e.status + ')' : ''}</span>`; }
  };
  $('#aiList', o).onclick = async () => {
    const conf = readAI();
    try {
      let ids = [];
      if (conf.provider === 'anthropic') ids = await RCAE.listAnthropicModels(conf.key);
      else { const base = (conf.base || P[conf.provider]?.base || '').replace(/\/$/, ''); const r = await fetch(base + '/models', {headers: conf.key ? {authorization: 'Bearer ' + conf.key} : {}}); ids = ((await r.json()).data || []).map(m => m.id); }
      $('#aiModels', o).innerHTML = ids.map(i => `<option value="${esc(i)}">`).join('');
      $('#aiMsg', o).textContent = ids.length + ' models: click the Model box to choose.';
    } catch (e) { $('#aiMsg', o).textContent = 'Could not list models: ' + (e.message || e); }
  };
  // backup
  $('#dExp', o).onclick = async () => {
    const data = await RCAE.exportAll();
    downloadFile('ruta-cae-backup-' + dayKey(Date.now()) + '.json', JSON.stringify(data), 'application/json');
  };
  $('#dImp', o).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await RCAE.importAll(JSON.parse(await f.text())); $('#dMsg', o).textContent = 'Imported. Reloading…'; setTimeout(() => location.reload(), 600); }
    catch (err) { $('#dMsg', o).textContent = 'Import failed: ' + (err.message || err); }
  };
  // pack
  $('#pImp', o).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#pMsg', o).innerHTML = '<span class="thinking">Reading the pack</span>';
    try {
      const r = await RCAE.importPackZip(f, (i, n) => $('#pMsg', o).textContent = `Audio ${i}/${n}…`);
      $('#pMsg', o).textContent = `Done: ${r.parts} listening parts, ${r.audio} audio files${r.progress ? ', progress merged' : ''}. Reloading…`;
      setTimeout(() => location.reload(), 900);
    } catch (err) { $('#pMsg', o).textContent = 'Import failed: ' + (err.message || err); }
  };
  if ($('#pDel', o)) $('#pDel', o).onclick = async () => { await RCAE.removePack(); location.reload(); };
};
function downloadFile(name, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], {type}));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function applyTheme() {
  const t = lsGet('rcae_theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
applyTheme();
$('#gear').onclick = () => openSettings();

/* AI helper for the new modules: JSON with a friendly error */
async function aiJSON(prompt, opts = {}) {
  if (!SAMPLE) throw {code: 'unavailable'};
  return SAMPLE.json(prompt, {modelTier: opts.tier || 'default', cache: opts.cache ?? false, signal: opts.signal});
}
function aiErrText(e) {
  if (e?.code === 'unavailable') return 'Connect an AI provider in ⚙ Settings → AI.';
  if (e?.code === 'provider_error') return 'The AI provider said: ' + (e.message || e.status);
  if (e?.name === 'TypeError') return 'Network error: check your connection (or that Ollama is running).';
  return 'That didn\'t work. Try again.';
}
function noAIPanel(what) {
  return `<div class="panel row between"><span class="small">${esc(what)} needs an AI model.</span><button class="btn sm accent" onclick="openSettings('ai')">Connect AI</button></div>`;
}
