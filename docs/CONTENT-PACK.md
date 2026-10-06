# Private content pack

Licensed material (coursebook audio, transcripts, exercises from your books) and your personal
progress never go into the public repository. You put them in `private-pack/src/` (git-ignored),
run `npm run pack`, and import the zip in the app: **⚙ Settings → Content pack → Import**.

## Files in `private-pack/src/`

| File | Required | What it is |
| :-- | :-- | :-- |
| `listening.js` | no | `window.LISTENING = [...]` — exam-format listening parts (see below) |
| `transcripts.js` | no | `window.TRANSCRIPTS = {"2.01": {"tr": [[seconds, "line"], ...]}, ...}` |
| `audio/*.mp3` | with listening | the recordings referenced as `audio/<name>.mp3` |
| `backup.json` | no | a Ruta backup (⚙ Settings → Backup → Export) to merge: progress, cards, imported book sets, word lists |

### A listening part

```js
{id: "t3p1", file: "audio/2.01.mp3", test: "Test 3", part: 1, title: "Three short extracts", kind: "mc3",   // mc3 | mc4 | gap | match
 intro: "You will hear three different extracts…",
 qs: [{n: 1, ctx: "Extract 1 · …", q: "What does the woman say…?", o: ["…", "…", "…"], a: 1, ev: "“…evidence from the script…”"}]}
```

The transcript key is the audio file name without `.mp3`.

## Build and import

```bash
npm run pack -- "Advanced Trainer Tests 3–4"
# → private-pack/ruta-cae-pack.zip
```

Importing stores the audio in the browser (IndexedDB) and merges the backup. Re-importing replaces
the listening parts; your progress is merged, never deleted. **Remove pack** deletes only the pack.

## Moving from the claude.ai version of Ruta C2

Your progress there (answers, cards, marked writing, book sets, word lists, model answers) can be
exported into `backup.json` and imported here; the pack builder includes it automatically.
