/* Ruta CAE extension — background service worker.
   Stores saved words / videos until the Ruta CAE app picks them up,
   caches video ratings, looks words up, and adds a context menu to save
   a selected word (with its sentence) from any website. */
const get = k => chrome.storage.local.get(k);
const set = o => chrome.storage.local.set(o);
const DEFAULT_APP_URL = 'https://apepsis.github.io/Ruta-CAE/'; // replaced by whichever Ruta CAE you open
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({id: 'rcae-save', title: 'Save “%s” to Ruta CAE', contexts: ['selection']});
  get('settings').then(d => { if (!d.settings) set({settings: {captions: true, thumbs: true, minLevel: 'C1'}}); });
  get('appUrl').then(d => { if (!d.appUrl) set({appUrl: DEFAULT_APP_URL}); });
});
async function addWords(items) {
  const {words = [], known = []} = await get(['words', 'known']);
  const kn = new Set(known);
  for (const it of items) { if (!it.w) continue; words.push({id: uid(), t: Date.now(), ...it}); kn.add(String(it.w).toLowerCase()); }
  await set({words: words.slice(-2000), known: [...kn].slice(-20000)});
  badgeCount(words.length);
  return words.length;
}
function badgeCount(n) { chrome.action.setBadgeText({text: n ? String(Math.min(n, 999)) : ''}); chrome.action.setBadgeBackgroundColor({color: '#E0533D'}); }
async function addMedia(item) {
  const {media = []} = await get('media');
  const i = media.findIndex(m => m.ytId && m.ytId === item.ytId);
  const rec = {id: uid(), t: Date.now(), ...item};
  if (i >= 0) media[i] = rec; else media.push(rec);
  await set({media: media.slice(-50)});
}
async function openApp(hash) {
  const {appUrl} = await get('appUrl');
  if (!appUrl) return false;
  const tabs = await chrome.tabs.query({});
  const t = tabs.find(x => x.url && x.url.startsWith(appUrl));
  if (t) { await chrome.tabs.update(t.id, {active: true, url: appUrl + (hash || '')}); await chrome.windows.update(t.windowId, {focused: true}); }
  else await chrome.tabs.create({url: appUrl + (hash || '')});
  return true;
}
const DICT = new Map();
async function lookup(w) {
  const k = String(w).toLowerCase().trim();
  if (DICT.has(k)) return DICT.get(k);
  try {
    const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(k));
    if (!r.ok) { DICT.set(k, null); return null; }
    const e = (await r.json())[0]; const m = e?.meanings?.[0];
    const d = {def: m?.definitions?.[0]?.definition || '', pos: m?.partOfSpeech || '', ipa: e?.phonetic || e?.phonetics?.find(x => x.text)?.text || ''};
    DICT.set(k, d); return d;
  } catch (err) { return null; }
}
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  (async () => {
    if (m.type === 'save-words') return reply({n: await addWords(m.items || [])});
    if (m.type === 'save-media') { await addMedia(m.item); const opened = m.open ? await openApp('#open=media') : false; return reply({ok: true, opened}); }
    if (m.type === 'lookup') return reply(await lookup(m.w));
    if (m.type === 'cache-get') { const {cache = {}} = await get('cache'); return reply(Object.fromEntries((m.ids || []).filter(id => cache[id]).map(id => [id, cache[id]]))); }
    if (m.type === 'cache-set') { const {cache = {}} = await get('cache'); cache[m.id] = m.data; const keys = Object.keys(cache); if (keys.length > 3000) for (const k of keys.sort((a, b) => (cache[a].t || 0) - (cache[b].t || 0)).slice(0, keys.length - 3000)) delete cache[k]; await set({cache}); return reply({ok: true}); }
    // from the app bridge
    if (m.type === 'app-hello') { await set({appUrl: m.url, appSeen: Date.now()}); const {words = [], media = []} = await get(['words', 'media']); return reply({words, media}); }
    if (m.type === 'app-ack') { const d = await get(m.kind); const keep = (d[m.kind] || []).filter(x => !(m.ids || []).includes(x.id)); await set({[m.kind]: keep}); if (m.kind === 'words') badgeCount(keep.length); return reply({ok: true}); }
    if (m.type === 'app-known') { await set({known: m.words || []}); return reply({ok: true}); }
    if (m.type === 'open-app') return reply({opened: await openApp(m.hash || '')});
    reply(null);
  })();
  return true;
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'rcae-save' || !info.selectionText) return;
  let ctx = '';
  try {
    const [res] = await chrome.scripting.executeScript({target: {tabId: tab.id}, func: () => {
      const sel = getSelection(); if (!sel.rangeCount) return '';
      const node = sel.anchorNode?.parentElement?.closest('p, li, td, div, span') || sel.anchorNode?.parentElement;
      const text = (node?.innerText || '').replace(/\s+/g, ' '); const w = sel.toString().trim(); const i = text.indexOf(w);
      if (i < 0) return '';
      const s = Math.max(text.lastIndexOf('. ', i) + 2, 0); let e = text.indexOf('. ', i + w.length); e = e < 0 ? text.length : e + 1;
      return text.slice(s, e).slice(0, 400);
    }});
    ctx = res?.result || '';
  } catch (e) {}
  await addWords([{w: info.selectionText.trim().slice(0, 60), ctx, src: {type: 'web', title: tab.title, url: tab.url}}]);
});
get('words').then(d => badgeCount((d.words || []).length));
