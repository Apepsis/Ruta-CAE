'use strict';
/* ============================================================
   Ruta CAE — bridge with the browser extension.
   The extension's content script runs on this page (it recognises the
   <meta name="ruta-cae-app"> tag), and the two talk with postMessage:
     ext → app  {source:'ruta-cae-ext', type:'hello'|'words'|'media', items}
     app → ext  {source:'ruta-cae-app', type:'hello'|'ack'|'known', …}
   Words and videos you saved on YouTube or other sites arrive here.
   ============================================================ */
const BRIDGE = window.BRIDGE = {connected: false, version: null};
function toExt(msg) { window.postMessage({source: 'ruta-cae-app', ...msg}, location.origin === 'null' ? '*' : location.origin); }
window.addEventListener('message', async e => {
  const m = e.data;
  if (e.source !== window || !m || m.source !== 'ruta-cae-ext') return;
  if (!BRIDGE.connected) { BRIDGE.connected = true; BRIDGE.version = m.version || null; const st = $('#extStat'); if (st) st.textContent = 'connected ✓'; }
  if (m.type === 'hello') {
    BRIDGE.connected = true; BRIDGE.version = m.version;
    toExt({type: 'hello', app: 'ruta-cae', version: RCAE.VERSION, url: location.href.split('#')[0]});
    toExt({type: 'known', words: CW.all().map(x => x.k)});
    const st = $('#extStat'); if (st) st.textContent = 'connected ✓ (v' + (m.version || '?') + ')';
  }
  if (m.type === 'words' && Array.isArray(m.items)) {
    const ids = [];
    for (const it of m.items) { CW.add({w: it.w, ctx: it.ctx, src: it.src, L: it.L, def: it.def, t: it.t, from: 'extension'}, {quiet: true}); ids.push(it.id); }
    toExt({type: 'ack', kind: 'words', ids});
    toExt({type: 'known', words: CW.all().map(x => x.k)});
    if (ids.length) { toast(ids.length + ' word' + (ids.length > 1 ? 's' : '') + ' arrived from the extension'); if (App.tab === 'cards' || App.tab === 'today') render(); }
  }
  if (m.type === 'media' && Array.isArray(m.items)) {
    const ids = []; let lastId = null;
    for (const it of m.items) {
      const item = {id: 'm' + hash(it.ytId || it.url || it.title) + uid().slice(-3), kind: it.ytId ? 'yt' : it.kind || 'text', ytId: it.ytId || null, url: it.url || null, title: it.title || 'From the extension', at: it.t || Date.now(), segs: mergeSegs(it.segs || [])};
      const dup = MEDIA.list().find(x => x.ytId && x.ytId === item.ytId);
      if (dup) item.id = dup.id;
      if (item.segs.length) item.an = summariseAnalysis(CEFR.analyze(item.segs.map(s => [s[0] ?? 0, s[1]]), {spoken: item.kind !== 'text'}));
      await MEDIA.put(item); ids.push(it.id); lastId = item.id;
    }
    toExt({type: 'ack', kind: 'media', ids});
    if (lastId && (m.open || /open=media/.test(location.hash))) { App.media = {id: lastId}; history.replaceState(null, '', location.pathname); setTab('media'); }
    else if (ids.length) toast(ids.length + ' video' + (ids.length > 1 ? 's' : '') + ' added to the Media Lab');
  }
});
// announce ourselves in case the extension loaded first
toExt({type: 'hello', app: 'ruta-cae', version: RCAE.VERSION, url: location.href.split('#')[0]});
