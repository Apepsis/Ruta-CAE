'use strict';
/* ============================================================
   Ruta CAE — Deck Hub (FlexiLingo Desk's Deck Hub for the CAE).
   Paste a text or snap a photo of a page (a book, a newspaper, your notes):
   the AI picks out the C1/C2 vocabulary worth learning, with meanings,
   examples and collocations, and it becomes a word list + flashcards.
   Any list can be exported to Anki.
   ============================================================ */
async function fileToB64(f) {
  // downscale big photos so they travel fast
  const img = await createImageBitmap(f).catch(() => null);
  if (img && Math.max(img.width, img.height) > 1600) {
    const k = 1600 / Math.max(img.width, img.height), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85)); f = blob;
  }
  const buf = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return {mime: f.type || 'image/jpeg', data: btoa(s)};
}
async function aiDeckFrom({text, image, name, n = 20}) {
  const known = allVocab().flatMap(t => t.words.map(w => w[0])).slice(-200);
  const ask = `${EXAMINER}
Build a C1 Advanced vocabulary list from the ${image ? 'photographed page' : 'text below'}. Choose the ${n} most useful items for a candidate aiming at Grade A: C1/C2 words, phrasal verbs, collocations and fixed expressions exactly as they appear, not basic words. Skip: ${known.join(', ')}.
${text ? 'TEXT:\n<<<' + text.slice(0, 12000) + '>>>' : ''}
${langLine()} (words, examples and collocations in English)
Respond ONLY with JSON: {"name":"short list name${name ? ' (use: ' + name + ')' : ''}","words":[["word or chunk","n|v|adj|adv|phrase","clear definition","the sentence from the source where it appears (or a natural example)","typical collocation","B2|C1|C2"]]}`;
  let r;
  if (image) { const raw = await RCAE.complete([{type: 'image', ...image}, {type: 'text', text: ask}], {tier: 'default', json: true}); r = RCAE.extractJSON(raw); }
  else r = await aiJSON(ask, {tier: 'default'});
  const words = (r?.words || []).filter(w => Array.isArray(w) && w[0] && w[2]);
  if (words.length < 3) throw {code: 'bad_output'};
  const v = {id: 'v' + hash((name || r.name || 'deck') + Date.now()), name: name || r.name || 'My deck', words: words.map(w => w.slice(0, 5)), t: Date.now(), gen: true, hub: true};
  Store.vlists.push(v); Store.touch('vlists/' + v.id); registerVocabCards();
  return v;
}
function deckHubHTML() {
  return `<div class="panel stack" id="dhub"><div class="row between"><div><h2>Deck Hub</h2><p class="small muted" style="margin:4px 0 0">Make a flashcard deck from anything you read: paste a text or take a photo of a page. The AI keeps only the C1–C2 vocabulary worth learning.</p></div></div>
    <div class="seg"><button data-dh="text" aria-pressed="true">From text</button><button data-dh="image" aria-pressed="false">From a photo</button></div>
    <div data-dhs="text"><textarea id="dhtext" rows="5" placeholder="Paste an article, a reading text from your book, your notes…"></textarea></div>
    <div data-dhs="image" hidden><label class="small">Photo or screenshot <input type="file" id="dhimg" accept="image/*" capture="environment"></label><p class="small muted" style="margin:4px 0 0">Needs a model that can read images (Claude, GPT-4o, Gemini).</p></div>
    <div class="row"><input type="text" id="dhname" placeholder="Deck name (optional)" style="flex:1;min-width:160px"><select id="dhn"><option>10</option><option selected>20</option><option>30</option></select><button class="btn accent" id="dhgo" ${SAMPLE ? '' : 'disabled'}>Build deck</button><span class="small" id="dhmsg"></span></div>
    ${SAMPLE ? '' : '<p class="small muted" style="margin:0">Connect an AI in ⚙ Settings to use the Deck Hub.</p>'}
    <div class="row small"><span class="muted">Export to Anki:</span><select id="dhexp"><option value="">choose a list…</option>${allVocab().map(t => `<option value="${esc(t.id)}">${esc(t.name)} (${t.words.length})</option>`).join('')}<option value="__decks">All built-in flashcard decks</option></select><button class="btn sm" id="dhexpb">Download</button></div>
  </div>`;
}
function wireDeckHub() {
  if (!$('#dhub')) return;
  let mode = 'text';
  $$('[data-dh]').forEach(b => b.onclick = () => { mode = b.dataset.dh; $$('[data-dh]').forEach(x => x.setAttribute('aria-pressed', x === b)); $$('[data-dhs]').forEach(s => s.hidden = s.dataset.dhs !== mode); });
  $('#dhgo').onclick = async () => {
    const msg = t => $('#dhmsg').innerHTML = t;
    try {
      let args = {name: $('#dhname').value.trim(), n: +$('#dhn').value};
      if (mode === 'text') { const t = $('#dhtext').value.trim(); if (t.length < 80) return msg('Paste a longer text.'); args.text = t; }
      else { const f = $('#dhimg').files[0]; if (!f) return msg('Choose a photo.'); args.image = await fileToB64(f); }
      $('#dhgo').disabled = true; msg('<span class="thinking">Picking the C1–C2 vocabulary</span>');
      const v = await aiDeckFrom(args);
      toast(v.words.length + ' words → “' + v.name + '”'); App.vt = {id: v.id, mode: 'learn', i: 0}; render();
    } catch (e) { $('#dhgo').disabled = false; msg(esc(aiErrText(e))); }
  };
  $('#dhexpb').onclick = () => {
    const id = $('#dhexp').value; if (!id) return toast('Choose a list');
    if (id === '__decks') return exportAnki('Ruta CAE — Decks', [...CARDS.values()].filter(c => c.deck !== 'cw').map(c => [c.front, c.back, c.ex, c.deck]));
    const t = allVocab().find(x => x.id === id); exportAnki('Ruta CAE — ' + t.name, t.words.map(w => [w[0], (w[1] ? '<i>' + w[1] + '</i> ' : '') + (w[2] || '') + (w[4] ? '<br>' + w[4] : ''), w[3] || '', 'list']));
  };
}
hookView('cards', () => {
  if (App.cardRun || App.vt) return;
  const p = $('#cwpanel'); if (!p) return;
  p.insertAdjacentHTML('afterend', deckHubHTML()); wireDeckHub();
});
