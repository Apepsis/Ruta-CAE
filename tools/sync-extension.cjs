#!/usr/bin/env node
/* The extension ships its own copy of the CEFR analyser + word data (extensions
   can't load files from the web app). This keeps them identical.
   --check: fail if they differ (used in CI). */
const fs = require('fs'), path = require('path');
const pairs = [['app/flexi/cefr.js', 'extension/lib/cefr.js'], ['app/data/cefr-words.js', 'extension/lib/cefr-words.js']];
const root = path.join(__dirname, '..'); let diff = 0;
for (const [a, b] of pairs) {
  const A = fs.readFileSync(path.join(root, a)), B = fs.existsSync(path.join(root, b)) ? fs.readFileSync(path.join(root, b)) : null;
  if (!B || !A.equals(B)) { diff++; if (process.argv.includes('--check')) console.error('out of date: ' + b); else { fs.writeFileSync(path.join(root, b), A); console.log('synced ' + b); } }
}
if (process.argv.includes('--check') && diff) process.exit(1);
if (!diff) console.log('extension libs up to date');
