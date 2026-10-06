#!/usr/bin/env node
/* Build a PRIVATE content pack for Ruta CAE from private-pack/src/ :
     listening.js     window.LISTENING = [...]   (exam-format listening parts)
     transcripts.js   window.TRANSCRIPTS = {...} (timed transcripts by audio name)
     audio/*.mp3      the recordings referenced as "audio/<name>.mp3"
     backup.json      (optional) progress / book sets exported from Ruta
   Output: private-pack/ruta-cae-pack.zip  →  app ⚙ Settings → Content pack → Import.
   private-pack/ is git-ignored: licensed material never goes to the public repo. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const JSZip = require(path.join(__dirname, '../app/vendor/jszip.min.js'));
const SRC = path.join(__dirname, '../private-pack/src'), OUT = path.join(__dirname, '../private-pack/ruta-cae-pack.zip');
const read = f => fs.existsSync(path.join(SRC, f)) ? fs.readFileSync(path.join(SRC, f), 'utf8') : null;
const ctx = {window: {}}; vm.createContext(ctx);
for (const f of ['listening.js', 'transcripts.js']) { const s = read(f); if (s) vm.runInContext(s, ctx, {filename: f}); }
const pack = {title: process.argv[2] || 'My private CAE pack', listening: ctx.window.LISTENING || [], transcripts: ctx.window.TRANSCRIPTS || {}};
const bk = read('backup.json'); if (bk) pack.backup = JSON.parse(bk);
const zip = new JSZip();
zip.file('pack.json', JSON.stringify(pack));
const adir = path.join(SRC, 'audio'); let n = 0;
if (fs.existsSync(adir)) for (const f of fs.readdirSync(adir)) if (/\.(mp3|m4a|ogg|wav)$/i.test(f)) { zip.file('audio/' + f, fs.readFileSync(path.join(adir, f))); n++; }
const missing = pack.listening.filter(p => p.file && !fs.existsSync(path.join(SRC, p.file))).map(p => p.file);
zip.generateAsync({type: 'nodebuffer', compression: 'STORE'}).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log(`Pack written: ${OUT}\n  ${pack.listening.length} listening parts · ${Object.keys(pack.transcripts).length} transcripts · ${n} audio files · progress backup: ${bk ? 'yes' : 'no'} · ${(buf.length / 1e6).toFixed(1)} MB`);
  if (missing.length) console.warn('  ⚠ audio referenced but missing: ' + missing.join(', '));
});
