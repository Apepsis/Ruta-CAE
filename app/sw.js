/* Ruta CAE service worker: offline app shell. Network-first for the app files
   (so updates arrive), cache fallback when offline. AI calls and media are never cached. */
const CACHE = 'ruta-cae-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'flexi/flexi.css', 'runtime.js', 'manifest.webmanifest', 'icons/icon.svg',
  'content/theory.js', 'content/lexicon.js', 'content/bank.js', 'content/listening.js', 'content/transcripts.js', 'content/tasks.js', 'content/vocab.js', 'content/resources.js', 'data/cefr-words.js',
  'core/core.js', 'core/ai2.js', 'core/views.js', 'core/importset.js', 'core/sheet.js', 'core/daily.js', 'core/views2.js',
  'flexi/cefr.js', 'flexi/shell.js', 'flexi/words.js', 'flexi/media.js', 'flexi/tutor.js', 'flexi/deckhub.js', 'flexi/bridge.js', 'vendor/jszip.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
