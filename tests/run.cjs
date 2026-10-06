/* Headless smoke test: serves app/, opens every tab, checks the CEFR analyser,
   fails on any page error. Run: npm test */
const http = require('http'), fs = require('fs'), path = require('path');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '../app');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'};
const srv = http.createServer((q, s) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { s.statusCode = 404; return s.end(); }
  s.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(s);
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {}); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForFunction(() => typeof App !== 'undefined' && document.querySelector('.view'), null, {timeout: 15000});
  for (const t of ['practice', 'listening', 'media', 'write', 'tutor', 'cards', 'learn', 'resources', 'progress', 'today']) { await p.click(`nav.tabs button[data-tab="${t}"]`); await p.waitForTimeout(250); }
  const lv = await p.evaluate(() => [CEFR.levelOf('house'), CEFR.levelOf('ubiquitous'), CEFR.levelOf('quixotic'), CEFR.analyze('The cat sat on the mat. It was happy.').level]);
  console.log('levels', lv.join(' '));
  if (lv[0] !== 'A1' || lv[2] !== 'C2') errs.push('CEFR levels unexpected: ' + lv);
  await p.click('#gear'); await p.waitForTimeout(200);
  await b.close(); srv.close();
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log('smoke test passed');
});
