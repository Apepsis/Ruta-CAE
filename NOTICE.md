# Notices

Ruta CAE is licensed under the GNU Affero General Public License v3.0 or later (see LICENSE).

## Derived work
- **FlexiLingo Desk** — https://github.com/flexilingo/Flexi-Desk — AGPL-3.0.
  Ruta CAE adapts from it: the frequency-based word→CEFR method (`src-tauri/src/podcast/nlp.rs`),
  the AI-tutor modes (free conversation, role-play, deck practice, vocabulary challenge →
  paraphrase challenge), the tap-a-word → save → SRS flow, the Deck Hub (text/image → deck,
  Anki export) and the browser-extension concept. Code was rewritten for the web/CAE.
- **Ruta C2** — the original CAE study artifact this repository grew from (by the repository owner).

## Third-party components
- wordfreq data (CC BY-SA 4.0) — https://github.com/rspeer/wordfreq — used to build `app/data/cefr-words.js`.
- JSZip 3.10.1 (MIT or GPLv3) — `app/vendor/jszip.min.js`.
- transformers.js (Apache-2.0) and Whisper models (MIT), loaded from a CDN on demand.
- Free Dictionary API — https://dictionaryapi.dev.
- Tauri 2 (MIT / Apache-2.0).

## Content
Questions, theory, word lists and writing/speaking tasks in `app/content/` were written for this
project. Cambridge English and C1 Advanced are trademarks of Cambridge University Press & Assessment;
this project is not affiliated with or endorsed by them. Licensed coursebook material (audio,
transcripts, book exercises) is NOT distributed here: users load their own copies through a
private content pack that stays on their device.
