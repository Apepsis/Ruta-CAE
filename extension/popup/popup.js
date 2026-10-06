const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
$('#ver').textContent = 'v' + chrome.runtime.getManifest().version;
async function paint() {
  const d = await chrome.storage.local.get(['words', 'media', 'appUrl', 'settings', 'cache']);
  const words = d.words || [];
  $('#cnt').textContent = words.length + (d.media?.length ? ' + ' + d.media.length + ' video' : '');
  $('#words').innerHTML = words.slice().reverse().slice(0, 30).map(w => `<li><span><b>${esc(w.w)}</b> <small>${esc((w.src?.title || '').slice(0, 30))}</small></span>${w.L ? `<span class="lvl ${esc(w.L)}">${esc(w.L)}</span>` : ''}</li>`).join('') || '<li><small>Nothing waiting. Click a coloured word on YouTube, or select a word on any site → right-click → Save to Ruta CAE.</small></li>';
  $('#appurl').textContent = d.appUrl ? 'App: ' + d.appUrl : 'Open your Ruta CAE app once and the extension will remember it.';
  const s = {captions: true, thumbs: true, minLevel: 'C1', ...(d.settings || {})};
  $('#s-captions').checked = s.captions; $('#s-thumbs').checked = s.thumbs; $('#s-min').value = s.minLevel; $('#s-url').value = d.appUrl || '';
  // current tab rating
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const v = tab?.url && new URL(tab.url).hostname.endsWith('youtube.com') && new URL(tab.url).searchParams.get('v');
  const c = v && d.cache?.[v];
  $('#rate').innerHTML = c?.an ? `<div class="row between"><div><h2>This video</h2><div class="muted">${esc((c.title || '').slice(0, 60))}</div></div><span class="lvl ${c.an.level} big" style="padding:4px 10px">${c.an.level}</span></div><div class="muted">${Math.round(c.an.c1p * 100)}% C1+ words · ${Math.round(c.an.b2p * 100)}% B2+${c.an.wpm ? ' · ' + c.an.wpm + ' wpm' : ''}</div>`
    : v ? '<h2>This video</h2><p class="muted">Not rated yet. Play it with English captions available.</p>' : '<h2>Ruta CAE</h2><p class="muted">Open a YouTube video to see its CAE level.</p>';
}
const save = async () => {
  const settings = {captions: $('#s-captions').checked, thumbs: $('#s-thumbs').checked, minLevel: $('#s-min').value};
  const url = $('#s-url').value.trim();
  await chrome.storage.local.set({settings, ...(url ? {appUrl: url.endsWith('/') || url.includes('#') ? url : url + '/'} : {})});
};
['#s-captions', '#s-thumbs', '#s-min', '#s-url'].forEach(id => $(id).onchange = save);
$('#open').onclick = async () => { const r = await chrome.runtime.sendMessage({type: 'open-app'}); if (!r?.opened) $('#appurl').textContent = 'Type the app address above first.'; else window.close(); };
paint();
