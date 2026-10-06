/* Runs on pages that might be the Ruta CAE app. If the page carries
   <meta name="ruta-cae-app">, hand over the words and videos saved on
   YouTube / other sites, and learn the app's address for "Send to Ruta CAE". */
(function () {
  if (!document.querySelector('meta[name="ruta-cae-app"]')) return;
  const send = msg => new Promise(res => chrome.runtime.sendMessage(msg, r => { void chrome.runtime.lastError; res(r); }));
  const toApp = msg => window.postMessage({source: 'ruta-cae-ext', version: chrome.runtime.getManifest().version, ...msg}, location.origin === 'null' ? '*' : location.origin);
  let synced = false;
  async function sync(appUrl) {
    const d = await send({type: 'app-hello', url: appUrl || location.href.split('#')[0]});
    if (!d) return;
    if (d.words?.length) toApp({type: 'words', items: d.words});
    if (d.media?.length) toApp({type: 'media', items: d.media, open: /open=media/.test(location.hash)});
    synced = true;
  }
  window.addEventListener('message', e => {
    const m = e.data; if (e.source !== window || !m || m.source !== 'ruta-cae-app') return;
    if (m.type === 'hello') sync(m.url);
    if (m.type === 'ack') send({type: 'app-ack', kind: m.kind, ids: m.ids});
    if (m.type === 'known') send({type: 'app-known', words: m.words});
  });
  toApp({type: 'hello'});
  // new words saved while the app is open arrive live
  chrome.storage.onChanged.addListener(ch => { if (synced && (ch.words?.newValue?.length > (ch.words?.oldValue?.length || 0) || ch.media?.newValue?.length > (ch.media?.oldValue?.length || 0))) sync(); });
})();
