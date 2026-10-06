/* Runs in the YouTube page itself (MAIN world).
   YouTube now protects caption files with a proof-of-origin token, so the
   extension cannot simply download them. Instead we (1) watch the captions
   the player itself downloads, and (2) when asked, briefly switch English
   captions on through the player API so the player fetches them for us.
   Results go to the extension's content script with window.postMessage. */
(function () {
  if (window.__rcaeHook) return; window.__rcaeHook = true;
  const post = (type, data) => window.postMessage({source: 'rcae-page', type, ...data}, '*');
  const isTT = u => /\/api\/timedtext/.test(u);
  const capture = (url, text) => {
    try {
      const u = new URL(url, location.href); const v = u.searchParams.get('v');
      const lang = u.searchParams.get('lang') || ''; const tlang = u.searchParams.get('tlang');
      if (!text || tlang) return;
      post('captions', {v, lang, kind: u.searchParams.get('kind') || '', fmt: u.searchParams.get('fmt') || '', text, pot: u.searchParams.get('pot') || null, url: u.href});
    } catch (e) {}
  };
  const F = window.fetch;
  window.fetch = async function (input, init) {
    const r = await F.apply(this, arguments);
    try { const url = typeof input === 'string' ? input : input?.url; if (url && isTT(url)) r.clone().text().then(t => capture(url, t)).catch(() => {}); } catch (e) {}
    return r;
  };
  const O = XMLHttpRequest.prototype.open, S = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__rcaeUrl = url; return O.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (this.__rcaeUrl && isTT(String(this.__rcaeUrl))) this.addEventListener('load', () => { try { capture(String(this.__rcaeUrl), typeof this.response === 'string' ? this.response : this.responseText); } catch (e) {} });
    return S.apply(this, arguments);
  };
  const player = () => document.getElementById('movie_player');
  function tracks() {
    const want = new URLSearchParams(location.search).get('v');
    const cands = [player()?.getPlayerResponse?.(), window.ytInitialPlayerResponse, document.querySelector('ytd-watch-flexy')?.playerData].filter(Boolean);
    const pr = cands.find(x => x?.videoDetails?.videoId === want && x?.captions) || cands.find(x => x?.videoDetails?.videoId === want) || cands[0];
    return {v: pr?.videoDetails?.videoId, title: pr?.videoDetails?.title, lengthSeconds: +(pr?.videoDetails?.lengthSeconds || 0), tracks: (pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []).map(t => ({lang: t.languageCode, kind: t.kind || '', name: t.name?.simpleText || t.name?.runs?.[0]?.text || '', url: t.baseUrl}))};
  }
  window.addEventListener('message', async e => {
    const m = e.data; if (e.source !== window || !m || m.source !== 'rcae-ext') return;
    if (m.type === 'tracks') post('tracks', {req: m.req, ...tracks()});
    if (m.type === 'fetch') { // try a direct fetch (works on some videos / when a token is known)
      try { const r = await F(m.url, {credentials: 'include'}); const t = await r.text(); post('fetched', {req: m.req, ok: r.ok && t.length > 20, text: t}); }
      catch (err) { post('fetched', {req: m.req, ok: false}); }
    }
    if (m.type === 'cc') { // make the player download English captions
      const p = player(); if (!p) return post('cc-done', {req: m.req, ok: false});
      try {
        const wasOn = !!(p.getOption && p.getOption('captions', 'track')?.languageCode);
        p.loadModule?.('captions');
        const list = p.getOption?.('captions', 'tracklist') || [];
        const en = list.find(t => /^en/.test(t.languageCode) && !t.kind) || list.find(t => /^en/.test(t.languageCode)) || {languageCode: 'en'};
        p.setOption?.('captions', 'track', en);
        setTimeout(() => { if (!wasOn && m.restore) { try { p.setOption('captions', 'track', {}); p.unloadModule?.('captions'); } catch (er) {} } post('cc-done', {req: m.req, ok: true}); }, 2500);
      } catch (err) { post('cc-done', {req: m.req, ok: false}); }
    }
    if (m.type === 'pause') player()?.pauseVideo?.();
    if (m.type === 'time') post('time', {req: m.req, t: player()?.getCurrentTime?.() || 0});
  });
  post('ready', {});
})();
