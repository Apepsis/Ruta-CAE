'use strict';
/* ============================================================
   Ruta CAE — standalone runtime.
   Ruta C2 was born as a claude.ai artifact and talks to `window.claude`
   (AI sampling, a database, the signed-in user, file uploads).
   This file provides the same interface locally so the app runs as a
   normal website / PWA / desktop app:
     · AI  → your own provider (Anthropic API key, any OpenAI-compatible
             endpoint such as OpenAI, OpenRouter, Groq, or a local Ollama)
     · db  → IndexedDB in this browser (export/import from Settings)
     · assets → audio/images stored as blobs in IndexedDB
   It then loads the app scripts in order, injecting the private content
   pack (licensed book audio, transcripts) if you imported one.
   ============================================================ */
(function () {
  const VERSION = '1.0.0';
  /* ---------- IndexedDB ---------- */
  const IDB = {
    _db: null,
    open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((res, rej) => {
        const r = indexedDB.open('ruta-cae', 1);
        r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs'); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
        r.onsuccess = () => { this._db = r.result; res(this._db); };
        r.onerror = () => rej(r.error);
      });
    },
    async tx(store, mode, fn) {
      const d = await this.open();
      return new Promise((res, rej) => {
        const t = d.transaction(store, mode), s = t.objectStore(store);
        let out; const req = fn(s);
        if (req) req.onsuccess = () => { out = req.result; };
        t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    },
    get(store, k) { return this.tx(store, 'readonly', s => s.get(k)); },
    put(store, k, v) { return this.tx(store, 'readwrite', s => s.put(v, k)); },
    del(store, k) { return this.tx(store, 'readwrite', s => s.delete(k)); },
    async entries(store, prefix = '') {
      const d = await this.open();
      return new Promise((res, rej) => {
        const out = [], t = d.transaction(store, 'readonly');
        const range = prefix ? IDBKeyRange.bound(prefix, prefix + '￿') : undefined;
        const c = t.objectStore(store).openCursor(range);
        c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } };
        t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
      });
    },
    clear(store) { return this.tx(store, 'readwrite', s => s.clear()); },
  };

  /* ---------- local database with the same shape as the artifact db ---------- */
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  const snapDoc = (id, v) => ({id, exists: v != null, data: () => clone(v)});
  const LocalDB = {
    doc(path) {
      return {
        id: path.split('/').pop(),
        async get() { return snapDoc(path.split('/').pop(), await IDB.get('docs', path)); },
        async set(v) { await IDB.put('docs', path, clone(v)); },
        async update(v) { const cur = (await IDB.get('docs', path)) || {}; await IDB.put('docs', path, {...cur, ...clone(v)}); },
        async delete() { await IDB.del('docs', path); },
      };
    },
    collection(path) {
      const depth = path.split('/').length + 1;
      return {
        async get() {
          const rows = (await IDB.entries('docs', path + '/')).filter(([k]) => k.split('/').length === depth);
          return {docs: rows.map(([k, v]) => snapDoc(k.split('/').pop(), v)), size: rows.length};
        },
        doc(id) { return LocalDB.doc(path + '/' + id); },
      };
    },
  };

  /* ---------- blobs (uploaded audio, pack audio) ---------- */
  const BLOB_URLS = window.BLOB_URLS = {};
  async function loadBlobUrls() {
    try { for (const [k, b] of await IDB.entries('blobs')) if (b instanceof Blob) BLOB_URLS[k] = URL.createObjectURL(b); } catch (e) { console.warn('blobs', e); }
  }
  const Assets = {
    async upload(file) {
      if (file.size > 60 * 1024 * 1024) throw {code: 'too_large'};
      const id = 'up_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await IDB.put('blobs', id, file);
      BLOB_URLS[id] = URL.createObjectURL(file);
      return {id, url: null, name: file.name, size: file.size};
    },
  };

  /* ---------- AI providers ---------- */
  const AI_KEY = 'rcae_ai';
  const AIConf = {
    get() { try { return Object.assign({provider: 'none', key: '', base: '', model: '', modelQuick: '', modelComplex: ''}, JSON.parse(localStorage.getItem(AI_KEY) || '{}')); } catch (e) { return {provider: 'none'}; } },
    set(c) { try { localStorage.setItem(AI_KEY, JSON.stringify(c)); } catch (e) {} },
  };
  const PRESETS = {
    anthropic: {label: 'Claude (Anthropic API key)', base: 'https://api.anthropic.com', model: 'claude-sonnet-4-5', needsKey: true},
    openai: {label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true},
    openrouter: {label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4.5', needsKey: true},
    gemini: {label: 'Google Gemini (OpenAI-compatible)', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', needsKey: true},
    ollama: {label: 'Ollama on this computer (free, offline)', base: 'http://localhost:11434/v1', model: 'llama3.1', needsKey: false},
    custom: {label: 'Other OpenAI-compatible endpoint', base: '', model: '', needsKey: false},
  };
  function pickModel(c, tier) {
    const p = PRESETS[c.provider] || {};
    if (tier === 'quick' && c.modelQuick) return c.modelQuick;
    if (tier === 'complex' && c.modelComplex) return c.modelComplex;
    return c.model || p.model;
  }
  function extractJSON(text) {
    if (text == null) throw {code: 'bad_output'};
    let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) {}
    const starts = [t.indexOf('{'), t.indexOf('[')].filter(i => i >= 0);
    if (!starts.length) throw {code: 'bad_output', text};
    const s = Math.min(...starts), open = t[s], close = open === '{' ? '}' : ']';
    const e = t.lastIndexOf(close);
    try { return JSON.parse(t.slice(s, e + 1)); } catch (err) { throw {code: 'bad_output', text}; }
  }
  /* parts: string | [{type:'text', text} | {type:'image', mime, data(base64)}] */
  async function complete(parts, opts = {}) {
    const c = AIConf.get();
    if (!c.provider || c.provider === 'none') throw {code: 'unavailable'};
    const p = PRESETS[c.provider] || PRESETS.custom;
    const base = (c.base || p.base || '').replace(/\/$/, '');
    const model = pickModel(c, opts.tier);
    const content = typeof parts === 'string' ? [{type: 'text', text: parts}] : parts;
    const sys = opts.system || 'You are a precise assistant inside a Cambridge C1 Advanced study app. When asked for JSON, reply with valid JSON only — no prose, no code fences.';
    const maxTok = opts.maxTokens || (opts.tier === 'complex' ? 16000 : 6000);
    let r, j;
    if (c.provider === 'anthropic') {
      r = await fetch(base + '/v1/messages', {method: 'POST', signal: opts.signal, headers: {'content-type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'},
        body: JSON.stringify({model, max_tokens: maxTok, system: sys, messages: [{role: 'user', content: content.map(x => x.type === 'image' ? {type: 'image', source: {type: 'base64', media_type: x.mime, data: x.data}} : {type: 'text', text: x.text})}]})});
      j = await r.json().catch(() => ({}));
      if (!r.ok) throw {code: 'provider_error', status: r.status, message: j?.error?.message || r.statusText};
      return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    }
    const headers = {'content-type': 'application/json'};
    if (c.key) headers.authorization = 'Bearer ' + c.key;
    const body = {model, messages: [{role: 'system', content: sys}, {role: 'user', content: content.map(x => x.type === 'image' ? {type: 'image_url', image_url: {url: 'data:' + x.mime + ';base64,' + x.data}} : {type: 'text', text: x.text})}], max_tokens: maxTok};
    if (opts.json) body.response_format = {type: 'json_object'};
    r = await fetch(base + '/chat/completions', {method: 'POST', headers, signal: opts.signal, body: JSON.stringify(body)});
    j = await r.json().catch(() => ({}));
    if (!r.ok && opts.json && r.status === 400) { delete body.response_format; r = await fetch(base + '/chat/completions', {method: 'POST', headers, signal: opts.signal, body: JSON.stringify(body)}); j = await r.json().catch(() => ({})); }
    if (!r.ok) throw {code: 'provider_error', status: r.status, message: j?.error?.message || r.statusText};
    return j.choices?.[0]?.message?.content || '';
  }
  const cache = new Map();
  const Sample = {
    async json(prompt, o = {}) {
      const key = o.cache ? prompt : null;
      if (key && cache.has(key)) return clone(cache.get(key));
      const txt = await complete(prompt, {tier: o.modelTier, signal: o.signal, json: true});
      let out;
      try { out = extractJSON(txt); }
      catch (e) { // one repair attempt
        const fixed = await complete('Return ONLY the corrected, valid JSON for the following (no comments):\n' + String(txt).slice(0, 20000), {tier: 'quick', json: true});
        out = extractJSON(fixed);
      }
      if (key) cache.set(key, out);
      return clone(out);
    },
    async text(prompt, o = {}) { return complete(prompt, {tier: o.modelTier, signal: o.signal, system: o.system}); },
    complete,
  };
  async function testAI() { const t0 = Date.now(); const r = await Sample.json('Reply with {"ok":true,"level":"C1"}', {modelTier: 'quick'}); return {ok: !!r.ok, ms: Date.now() - t0}; }
  async function listAnthropicModels(key) {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=50', {headers: {'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}});
    if (!r.ok) throw new Error('models ' + r.status);
    return ((await r.json()).data || []).map(m => m.id);
  }

  /* ---------- window.claude shim ---------- */
  const aiOn = () => { const c = AIConf.get(); return c.provider && c.provider !== 'none' && (!(PRESETS[c.provider] || {}).needsKey || c.key); };
  if (!window.claude) {
    window.claude = {
      standalone: true,
      async use(cap) {
        if (cap === 'sample') return aiOn() ? Sample : null;
        if (cap === 'db') { await IDB.open(); return LocalDB; }
        if (cap === 'user') return {id: async () => 'local', name: async () => 'You'};
        if (cap === 'assets') return Assets;
        return null;
      },
    };
  }

  /* ---------- private content pack ---------- */
  async function applyPack() {
    try {
      const pack = await IDB.get('docs', 'pack/main');
      if (!pack) return;
      if (Array.isArray(pack.listening) && pack.listening.length) {
        window.LISTENING = pack.listening.map(p => ({...p, file: BLOB_URLS['pack:' + p.file] || p.file}));
        window.LISTENING.forEach(p => { p._key = (p.file0 || '').split('/').pop().replace('.mp3', ''); });
      }
      if (pack.transcripts) window.TRANSCRIPTS = pack.transcripts;
      window.PACK_INFO = {title: pack.title || 'Private content pack', at: pack.at, parts: (pack.listening || []).length};
    } catch (e) { console.warn('pack', e); }
  }

  /* ---------- export / import everything ---------- */
  async function exportAll() {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^(rc2_|rcae_)/.test(k) && k !== AI_KEY) ls[k] = localStorage.getItem(k); }
    const docs = (await IDB.entries('docs')).filter(([k]) => !k.startsWith('pack/'));
    return {app: 'ruta-cae', version: VERSION, at: new Date().toISOString(), localStorage: ls, docs};
  }
  async function importAll(data, {merge = true} = {}) {
    if (!data || (data.app !== 'ruta-cae' && data.app !== 'ruta-c2')) throw new Error('Not a Ruta backup file');
    window.__rcaeImporting = true; // the running page must not write its old state over the import
    for (const [k, v] of Object.entries(data.localStorage || {})) {
      if (merge && /^rc2_(attempts|works|ext|vlists|reading|sets|capwords|media|tutor)$/.test(k)) {
        const cur = JSON.parse(localStorage.getItem(k) || '[]'), add = JSON.parse(v || '[]');
        const idk = x => x.k || x.id || JSON.stringify(x).slice(0, 80);
        const have = new Set(cur.map(idk)); for (const x of add) if (!have.has(idk(x))) cur.push(x);
        if (k === 'rc2_attempts') cur.sort((a, b) => a.t - b.t);
        localStorage.setItem(k, JSON.stringify(cur));
      } else if (merge && k === 'rc2_cards') {
        const cur = JSON.parse(localStorage.getItem(k) || '{}'), add = JSON.parse(v || '{}');
        for (const [id, s] of Object.entries(add)) if (!cur[id] || (s[3] || 0) > (cur[id][3] || 0)) cur[id] = s;
        localStorage.setItem(k, JSON.stringify(cur));
      } else localStorage.setItem(k, v);
    }
    for (const [k, v] of data.docs || []) await IDB.put('docs', k, v);
    // Store merges the db over localStorage at start-up: align the synced docs with the imported values
    try { const st = JSON.parse(localStorage.getItem('rc2_settings') || 'null'); if (st) await IDB.put('docs', 'settings/main', st); } catch (e) {}
    try { const c = JSON.parse(localStorage.getItem('rc2_cards') || 'null'); if (c) await IDB.put('docs', 'cards/state', {c}); } catch (e) {}
  }
  /* zip pack: pack.json (+ audio/*.mp3). Uses JSZip from vendor/. */
  async function importPackZip(file, onProgress = () => {}) {
    await loadScript('vendor/jszip.min.js');
    const zip = await window.JSZip.loadAsync(file);
    const pj = zip.file('pack.json'); if (!pj) throw new Error('pack.json missing in the zip');
    const pack = JSON.parse(await pj.async('string'));
    const audio = Object.values(zip.files).filter(f => !f.dir && /\.(mp3|m4a|ogg|wav)$/i.test(f.name));
    let i = 0;
    for (const f of audio) {
      const blob = await f.async('blob');
      const mime = /\.mp3$/i.test(f.name) ? 'audio/mpeg' : /\.m4a$/i.test(f.name) ? 'audio/mp4' : /\.ogg$/i.test(f.name) ? 'audio/ogg' : 'audio/wav';
      await IDB.put('blobs', 'pack:' + f.name, new Blob([blob], {type: mime}));
      onProgress(++i, audio.length);
    }
    (pack.listening || []).forEach(p => { p.file0 = p.file; });
    await IDB.put('docs', 'pack/main', {title: pack.title, at: Date.now(), listening: pack.listening || [], transcripts: pack.transcripts || {}});
    if (pack.backup) await importAll(pack.backup, {merge: true});
    return {audio: audio.length, parts: (pack.listening || []).length, progress: !!pack.backup};
  }
  async function removePack() {
    await IDB.del('docs', 'pack/main');
    for (const [k] of await IDB.entries('blobs', 'pack:')) await IDB.del('blobs', k);
  }

  window.RCAE = {VERSION, IDB, LocalDB, AIConf, PRESETS, Sample, complete, extractJSON, aiOn, testAI, listAnthropicModels, exportAll, importAll, importPackZip, removePack, BLOB_URLS};

  /* ---------- loader ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector('script[data-src="' + src + '"]')) return res();
      const s = document.createElement('script'); s.src = src; s.async = false; s.dataset.src = src;
      s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
      document.body.appendChild(s);
    });
  }
  window.RCAE.loadScript = loadScript;
  const CONTENT = ['content/theory.js', 'content/lexicon.js', 'content/bank.js', 'content/listening.js', 'content/transcripts.js', 'content/tasks.js', 'content/vocab.js', 'content/resources.js', 'data/cefr-words.js'];
  const APP = ['core/core.js', 'core/ai2.js', 'core/views.js', 'core/importset.js', 'core/sheet.js', 'core/daily.js',
    'flexi/cefr.js', 'flexi/shell.js', 'flexi/words.js', 'flexi/media.js', 'flexi/tutor.js', 'flexi/deckhub.js', 'flexi/bridge.js',
    'core/views2.js'];
  (async function boot() {
    try {
      await IDB.open().catch(e => console.warn('IndexedDB unavailable', e));
      await loadBlobUrls();
      for (const s of CONTENT) await loadScript(s);
      await applyPack();
      for (const s of APP) await loadScript(s);
    } catch (e) {
      console.error(e);
      document.getElementById('app').innerHTML = '<div class="panel"><h2>Ruta CAE could not start</h2><p class="small muted">' + String(e.message || e) + '</p></div>';
    }
  })();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
