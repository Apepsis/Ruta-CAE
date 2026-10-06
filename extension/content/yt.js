'use strict';
/* ============================================================
   Ruta CAE extension — YouTube.
   · Watch page: rates the video (B2 / C1 / C2 for the CAE) from its English
     captions, shows the hard words, and sends the transcript to the app.
   · Live captions: C1/C2 words are coloured; click one → meaning → save.
   · Thumbnails: videos you (or the extension) rated before show a level badge;
     visible thumbnails are rated in the background when YouTube allows it.
   ============================================================ */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const send = (msg) => new Promise(res => { try { chrome.runtime.sendMessage(msg, r => { void chrome.runtime.lastError; res(r); }); } catch (e) { res(null); } });
  let SET = {captions: true, thumbs: true, minLevel: 'C1', badge: true};
  let KNOWN = new Set();
  chrome.storage.local.get(['settings', 'known'], d => { SET = {...SET, ...(d.settings || {})}; KNOWN = new Set(d.known || []); });
  chrome.storage.onChanged.addListener(ch => { if (ch.settings) SET = {...SET, ...ch.settings.newValue}; if (ch.known) KNOWN = new Set(ch.known.newValue || []); });

  /* ---------- talk to the page hook ---------- */
  let reqN = 0; const waiting = new Map(); const capturedByVideo = new Map();
  window.addEventListener('message', e => {
    const m = e.data; if (e.source !== window || !m || m.source !== 'rcae-page') return;
    if (m.type === 'captions' && m.v) {
      const segs = parseCaptions(m.text);
      if (segs.length) {
        const prev = capturedByVideo.get(m.v);
        const isEn = /^en/.test(m.lang);
        if (!prev || (isEn && !prev.isEn) || (isEn && prev.kind === 'asr' && m.kind !== 'asr')) capturedByVideo.set(m.v, {segs, lang: m.lang, kind: m.kind, isEn});
        if (m.pot) chrome.storage.local.set({pot: m.pot});
        for (const [k, w] of waiting) if (w.type === 'cap' && w.v === m.v && isEn) { waiting.delete(k); w.res(true); }
        // captions arrived later (e.g. you switched CC on): rate now
        if (isEn && m.v === current && !document.querySelector('#rcae-card .rc-w') && ![...waiting.values()].some(w => w.type === 'cap')) { current = null; setTimeout(onWatch, 50); }
      }
    }
    if (m.req != null && waiting.has(m.req)) { const w = waiting.get(m.req); waiting.delete(m.req); w.res(m); }
  });
  function ask(type, data = {}, timeout = 6000) {
    const req = ++reqN;
    return new Promise(res => { waiting.set(req, {res, type}); window.postMessage({source: 'rcae-ext', type, req, ...data}, '*'); setTimeout(() => { if (waiting.has(req)) { waiting.delete(req); res(null); } }, timeout); });
  }
  function waitCaptions(v, timeout) { return new Promise(res => { const k = 'c' + (++reqN); waiting.set(k, {type: 'cap', v, res}); setTimeout(() => { if (waiting.has(k)) { waiting.delete(k); res(false); } }, timeout); }); }

  /* captions: json3, srv3/xml or vtt → [[seconds, text], …] */
  function parseCaptions(t) {
    if (!t) return [];
    t = String(t).trim();
    try {
      if (t[0] === '{') {
        const j = JSON.parse(t);
        return merge((j.events || []).filter(ev => ev.segs).map(ev => [(ev.tStartMs || 0) / 1000, ev.segs.map(s => s.utf8).join('').replace(/\s+/g, ' ').trim()]).filter(x => x[1] && x[1] !== '\n'));
      }
      if (t.startsWith('<')) {
        const doc = new DOMParser().parseFromString(t, 'text/xml'); const out = [];
        doc.querySelectorAll('text, p').forEach(n => { const st = n.getAttribute('start') ?? (+(n.getAttribute('t') || 0) / 1000); const tx = n.textContent.replace(/\s+/g, ' ').trim(); if (tx) out.push([+st, decodeEntities(tx)]); });
        return merge(out);
      }
    } catch (e) {}
    return [];
  }
  function decodeEntities(s) { const d = document.createElement('textarea'); d.innerHTML = s; return d.value; }
  function merge(segs) { // join caption fragments into sentence-ish chunks
    const out = []; let cur = null;
    for (const [t, x] of segs) { if (!cur) { cur = [t, x]; continue; } if (cur[1].length < 70 || (!/[.!?]["”]?$/.test(cur[1]) && cur[1].length < 220)) cur[1] += ' ' + x; else { out.push(cur); cur = [t, x]; } }
    if (cur) out.push(cur); return out;
  }

  /* ---------- get the transcript of the video on screen ---------- */
  async function transcriptForCurrent(v) {
    if (capturedByVideo.get(v)?.isEn) return capturedByVideo.get(v);
    const info = await ask('tracks');
    if (!info || info.v !== v) return null;
    const tr = info.tracks || [];
    const en = tr.find(t => /^en/.test(t.lang) && t.kind !== 'asr') || tr.find(t => /^en/.test(t.lang));
    if (!en) return {none: true, title: info.title};
    // 1) direct fetch (sometimes allowed), with a known token if we have one
    const pot = (await chrome.storage.local.get('pot'))?.pot;
    for (const url of [en.url + '&fmt=json3', pot ? en.url + '&fmt=json3&c=WEB&pot=' + encodeURIComponent(pot) : null].filter(Boolean)) {
      const r = await ask('fetch', {url}, 8000);
      if (r?.ok) { const segs = parseCaptions(r.text); if (segs.length) { const x = {segs, lang: en.lang, kind: en.kind, isEn: true}; capturedByVideo.set(v, x); return x; } }
    }
    // 2) let the player fetch them (switch English captions on briefly)
    const wait = waitCaptions(v, 9000);
    await ask('cc', {restore: !SET.keepCC}, 5000);
    if (await wait) return capturedByVideo.get(v);
    // 3) the transcript panel
    const dom = await transcriptFromPanel();
    if (dom?.length) { const x = {segs: merge(dom), lang: 'en', kind: 'panel', isEn: true}; capturedByVideo.set(v, x); return x; }
    return capturedByVideo.get(v) || null;
  }
  async function transcriptFromPanel() {
    try {
      let segs = document.querySelectorAll('ytd-transcript-segment-renderer');
      if (!segs.length) {
        const more = $('tp-yt-paper-button#expand, #description-inline-expander #expand'); more?.click();
        await sleep(400);
        const btn = $('ytd-video-description-transcript-section-renderer button') || [...document.querySelectorAll('button')].find(b => /transcript/i.test(b.textContent || b.getAttribute('aria-label') || ''));
        if (!btn) return null; btn.click();
        for (let i = 0; i < 20 && !(segs = document.querySelectorAll('ytd-transcript-segment-renderer')).length; i++) await sleep(300);
      }
      const ts = s => s.trim().split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
      return [...segs].map(s => [ts(s.querySelector('.segment-timestamp')?.textContent || '0'), (s.querySelector('.segment-text')?.textContent || '').trim()]).filter(x => x[1]);
    } catch (e) { return null; }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- watch page badge ---------- */
  let current = null;
  async function onWatch() {
    const v = new URL(location.href).searchParams.get('v');
    if (!v || location.pathname !== '/watch') { $('#rcae-card')?.remove(); current = null; return; }
    if (current === v && $('#rcae-card')) return; current = v;
    const card = mountCard();
    const cached = (await send({type: 'cache-get', ids: [v]}))?.[v];
    if (cached?.an) paintCard(card, cached.an, cached.title, v, null);
    else card.querySelector('.rc-body').innerHTML = '<span class="rc-muted">Rating this video for the CAE…</span>';
    const tr = await transcriptForCurrent(v);
    if (current !== v) return;
    const title = document.title.replace(/ - YouTube$/, '');
    if (!tr || tr.none || !tr.segs?.length) { if (!cached?.an) card.querySelector('.rc-body').innerHTML = `<span class="rc-muted">${tr?.none ? 'No English captions on this video, so it can’t be rated.' : 'Couldn’t read the captions. Turn on English subtitles (CC) and it will rate itself.'}</span>`; return; }
    const an = CEFR.analyze(tr.segs, {spoken: true});
    const slim = slimAn(an);
    send({type: 'cache-set', id: v, data: {an: slim, title, t: Date.now(), kind: tr.kind}});
    paintCard(card, slim, title, v, tr.segs);
  }
  function slimAn(a) { return {level: a.level, score: a.score, wpm: a.wpm, b2p: a.b2p, c1p: a.c1p, c2p: a.c2p, words: a.words, hard: {C2: a.hard.C2.slice(0, 30), C1: a.hard.C1.slice(0, 30)}}; }
  function mountCard() {
    let card = $('#rcae-card');
    if (!card) {
      card = document.createElement('div'); card.id = 'rcae-card';
      card.innerHTML = '<div class="rc-head"><b class="rc-brand">Ruta CAE</b><span class="rc-lvl">…</span><button class="rc-x" title="Hide">✕</button></div><div class="rc-body"></div>';
      card.querySelector('.rc-x').onclick = () => card.classList.toggle('rc-min');
    }
    const anchor = $('#above-the-fold #title') || $('ytd-watch-metadata #title') || $('#info-contents');
    if (anchor && card.parentElement !== anchor.parentElement) anchor.insertAdjacentElement('afterend', card);
    else if (!anchor && !card.isConnected) document.body.appendChild(card).classList.add('rc-float');
    return card;
  }
  const VERDICT = {C2: 'Above the exam — great stretch', C1: 'Exam level', B2: 'Comfortable — fluency practice', B1: 'Below the exam', A2: 'Below the exam', A1: 'Below the exam'};
  function paintCard(card, an, title, v, segs) {
    card.querySelector('.rc-lvl').className = 'rc-lvl rc-' + an.level;
    card.querySelector('.rc-lvl').textContent = an.level;
    const hard = [...(an.hard.C2 || []).slice(0, 10), ...(an.hard.C1 || []).slice(0, 14)];
    card.querySelector('.rc-body').innerHTML = `<div class="rc-row"><b>${VERDICT[an.level]}</b><span class="rc-muted">${Math.round(an.c1p * 100)}% C1+ words · ${Math.round(an.b2p * 100)}% B2+${an.wpm ? ' · ' + an.wpm + ' wpm' : ''}</span></div>
      <div class="rc-words">${hard.map(h => `<button class="rc-w rc-${h.L}${KNOWN.has(h.w) ? ' rc-saved' : ''}" data-w="${esc(h.w)}">${esc(h.w)}</button>`).join('')}</div>
      <div class="rc-row"><button class="rc-btn rc-primary" data-send ${segs ? '' : 'disabled title="Play the video once with captions to capture the transcript"'}>Send to Ruta CAE</button><button class="rc-btn" data-saveall>Save all C1–C2 words</button><span class="rc-muted rc-msg"></span></div>`;
    const ctxOf = w => (segs || []).find(s => s[1].toLowerCase().includes(w))?.[1] || '';
    card.querySelectorAll('.rc-w').forEach(b => b.onclick = e => { e.stopPropagation(); wordPop(b, b.dataset.w, ctxOf(b.dataset.w), {type: 'yt', title, url: 'https://www.youtube.com/watch?v=' + v}); });
    card.querySelector('[data-saveall]').onclick = async () => {
      const items = hard.map(h => ({w: h.w, L: h.L, ctx: ctxOf(h.w), src: {type: 'yt', title, url: location.href}}));
      await send({type: 'save-words', items}); card.querySelectorAll('.rc-w').forEach(b => b.classList.add('rc-saved'));
      card.querySelector('.rc-msg').textContent = items.length + ' words saved';
    };
    card.querySelector('[data-send]').onclick = async () => {
      const r = await send({type: 'save-media', item: {ytId: v, title, url: 'https://www.youtube.com/watch?v=' + v, segs}, open: true});
      card.querySelector('.rc-msg').textContent = r?.opened ? 'Opening Ruta CAE…' : 'Saved. Open the Ruta CAE app once so the extension learns its address.';
    };
  }

  /* ---------- word popup ---------- */
  function wordPop(anchor, w, ctx, src) {
    document.querySelector('.rcae-pop')?.remove();
    const L = CEFR.levelOf(w) || '—';
    const pop = document.createElement('div'); pop.className = 'rcae-pop';
    pop.innerHTML = `<div class="rc-row"><b class="rc-pw">${esc(w)}</b><span class="rc-lvl rc-${L}">${L}</span><button class="rc-x">✕</button></div><div class="rc-def rc-muted">Looking it up…</div>${ctx ? `<div class="rc-ctx">${esc(ctx.slice(0, 200))}</div>` : ''}<button class="rc-btn rc-primary" data-save>${KNOWN.has(w.toLowerCase()) ? 'Saved ✓' : 'Save to Ruta CAE'}</button>`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 330, r.left)) + 'px';
    pop.style.top = (r.bottom + 6 + 300 > window.innerHeight ? Math.max(8, r.top - 220) : r.bottom + 6) + 'px';
    pop.querySelector('.rc-x').onclick = () => pop.remove();
    let def = null;
    send({type: 'lookup', w}).then(d => { def = d; const box = pop.querySelector('.rc-def'); if (!box) return; box.className = 'rc-def'; box.innerHTML = d ? `${d.ipa ? `<span class="rc-muted">${esc(d.ipa)}</span> ` : ''}<i>${esc(d.pos)}</i> ${esc(d.def)}` : '<span class="rc-muted">No dictionary entry — saved words get a meaning in the app.</span>'; });
    pop.querySelector('[data-save]').onclick = async () => { await send({type: 'save-words', items: [{w, L, ctx, src, def: def?.def || ''}]}); pop.querySelector('[data-save]').textContent = 'Saved ✓'; anchor.classList?.add('rc-saved'); };
    setTimeout(() => document.addEventListener('mousedown', function h(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', h, true); } }, true), 0);
  }

  /* ---------- live captions: colour + click ---------- */
  const RANK = CEFR.RANK;
  function colourCaptions() {
    if (!SET.captions) return;
    document.querySelectorAll('.ytp-caption-segment:not([data-rc])').forEach(seg => {
      const text = seg.textContent; seg.dataset.rc = '1';
      const tk = CEFR.tokens(text); if (!tk.some(t => t.L && !t.stop && RANK[t.L] >= RANK[SET.minLevel])) return;
      let html = '', p = 0;
      for (const t of tk) { html += esc(text.slice(p, t.i)); const hl = t.L && !t.stop && RANK[t.L] >= RANK[SET.minLevel]; html += hl ? `<span class="rc-cw rc-${t.L}" data-w="${esc(t.w)}">${esc(t.w)}</span>` : esc(t.w); p = t.j; }
      seg.innerHTML = html + esc(text.slice(p));
    });
  }
  document.addEventListener('click', e => {
    const s = e.target.closest?.('.rc-cw'); if (!s) return;
    e.stopPropagation(); e.preventDefault();
    window.postMessage({source: 'rcae-ext', type: 'pause'}, '*');
    const line = s.closest('.caption-window')?.textContent || s.parentElement.textContent;
    wordPop(s, s.dataset.w, line, {type: 'yt', title: document.title.replace(/ - YouTube$/, ''), url: location.href});
  }, true);

  /* ---------- thumbnails ---------- */
  const queue = [], inflight = new Set(); let fails = 0;
  const io = new IntersectionObserver(ents => { for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); queueThumb(en.target); } }, {rootMargin: '200px'});
  async function scanThumbs() {
    if (!SET.thumbs) return;
    const items = [...document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model')].filter(el => !el.dataset.rcSeen);
    if (!items.length) return;
    const ids = [];
    for (const el of items) { el.dataset.rcSeen = '1'; const a = el.querySelector('a[href*="/watch?v="]'); const v = a && new URL(a.href, location.href).searchParams.get('v'); if (v) { el.dataset.rcV = v; ids.push(v); } }
    const cache = (await send({type: 'cache-get', ids})) || {};
    for (const el of items) { const v = el.dataset.rcV; if (!v) continue; if (cache[v]?.an || cache[v]?.na) badge(el, cache[v]); else io.observe(el); }
  }
  function badge(el, c) {
    const host = el.querySelector('ytd-thumbnail, a#thumbnail, yt-thumbnail-view-model, .yt-lockup-view-model-wiz__content-image') || el;
    if (host.querySelector('.rc-badge')) return;
    const b = document.createElement('span'); b.className = 'rc-badge ' + (c.an ? 'rc-' + c.an.level : 'rc-na');
    b.textContent = c.an ? c.an.level : '—'; b.title = c.an ? `Ruta CAE: ${c.an.level} · ${Math.round(c.an.c1p * 100)}% C1+ words${c.an.wpm ? ' · ' + c.an.wpm + ' wpm' : ''}` : 'No English captions';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(b);
  }
  function queueThumb(el) { if (fails >= 4) return; queue.push(el); pump(); }
  async function pump() {
    while (queue.length && inflight.size < 2 && fails < 4) {
      const el = queue.shift(); const v = el.dataset.rcV; if (!v || inflight.has(v)) continue;
      inflight.add(v);
      rateRemote(v).then(c => { if (c) { badge(el, c); fails = 0; } else fails++; }).finally(() => { inflight.delete(v); pump(); });
    }
  }
  /* rate a video we are not watching: read its caption list from the watch page, then try to download captions */
  async function rateRemote(v) {
    try {
      const html = await (await fetch('/watch?v=' + v, {credentials: 'include'})).text();
      const m = html.match(/"captionTracks":(\[.*?\])/); const title = (html.match(/<title>([^<]*)<\/title>/)?.[1] || '').replace(/ - YouTube$/, '');
      if (!m) { send({type: 'cache-set', id: v, data: {na: true, t: Date.now()}}); return {na: true}; }
      const tracks = JSON.parse(m[1]);
      const en = tracks.find(t => /^en/.test(t.languageCode) && t.kind !== 'asr') || tracks.find(t => /^en/.test(t.languageCode));
      if (!en) { send({type: 'cache-set', id: v, data: {na: true, t: Date.now()}}); return {na: true}; }
      const pot = (await chrome.storage.local.get('pot'))?.pot;
      const urls = [en.baseUrl + '&fmt=json3', pot ? en.baseUrl + '&fmt=json3&c=WEB&pot=' + encodeURIComponent(pot) : null].filter(Boolean);
      for (const u of urls) {
        const r = await ask('fetch', {url: u}, 8000);
        const segs = r?.ok ? parseCaptions(r.text) : [];
        if (segs.length > 3) { const an = slimAn(CEFR.analyze(segs, {spoken: true})); const data = {an, title: decodeEntities(title), t: Date.now(), kind: en.kind || 'manual'}; send({type: 'cache-set', id: v, data}); return data; }
      }
      return null; // YouTube refused (token needed): it will be rated when you open it
    } catch (e) { return null; }
  }

  /* ---------- lifecycle (YouTube is a single-page app) ---------- */
  let t = null;
  const tick = () => { clearTimeout(t); t = setTimeout(() => { onWatch(); scanThumbs(); }, 600); };
  document.addEventListener('yt-navigate-finish', tick);
  window.addEventListener('popstate', tick);
  let raf = 0;
  new MutationObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; colourCaptions(); }); }).observe(document.documentElement, {childList: true, subtree: true});
  setInterval(scanThumbs, 4000);
  tick();
  chrome.runtime.onMessage.addListener((m, s, reply) => { if (m.type === 'rate-now') { current = null; onWatch(); reply({ok: true}); } });
})();
