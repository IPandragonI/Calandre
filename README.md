# Calandre — le quiz auto

A car-guessing game: one photo, one text box, name the make and model.
French by default (English available), light theme by default (dark available),
installable as a PWA and playable offline. No backend, no account: everything
is stored in the browser's `localStorage`.

## Modes

| Mode | Rules |
|---|---|
| Classique | 10 cars, 3 attempts each, hints, difficulty filter (Mixte / Facile / Expert) |
| Défi du jour | 5 cars, identical for everyone on a given local date, once per day, shareable emoji grid |
| Sans fin | One attempt per car, 3 lives, difficulty ramps up |
| Contre-la-montre | 60 s, +5 s per correct answer (capped at 90 s remaining), skip freely |
| Catégories | Classic rules within a category; only categories with ≥ 5 cars are listed |

Scoring: 100 / 70 / 40 points for a correct answer on attempt 1 / 2 / 3+, minus 15 per hint, never below 0.
Skipped or revealed cars score 0.

## Running locally

Requires Node 22+ and pnpm 10.

```bash
pnpm install
pnpm dev            # http://localhost:3000 (the service worker is only registered in production)
pnpm build && pnpm start
```

Quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm test                     # Vitest: validation, scoring, selection, daily seed, engine, stats, storage, dataset
pnpm build && pnpm test:e2e   # Playwright against the production build (incl. offline + mobile)
```

Set `NEXT_PUBLIC_SITE_URL` when deploying so social-preview URLs are absolute.
All routes are static, so any Next.js host works; photos are pre-rendered WebP files
in `public/cars`, so no image-optimisation service is needed.

## Project structure

```
src/
  app/                 routes: / , /play, /categories, /stats, /settings, /credits, manifest.ts
  components/          UI by area (game, home, stats, settings, categories, layout, ui)
  data/cars.json       GENERATED production dataset (do not edit by hand)
  hooks/               use-game (game driver), use-persistent (localStorage stores), use-i18n, use-install-prompt
  lib/game/            pure logic: answer-validation, scoring, question-selection, daily-challenge, engine, session
  lib/stats/           statistics folding + persistence schema
  lib/storage/         versioned { v, data } envelope with migrations, safe localStorage access
  lib/i18n/            fr.ts (reference) and en.ts
  types/               Car, Game types
public/sw.js           hand-written service worker; public/offline.html fallback
scripts/               dataset maintenance + icon generation
data/                  dataset sources and review artefacts
e2e/                   Playwright tests
```

### Answer matching

`src/lib/game/answer-validation.ts` normalises case, accents, punctuation, hyphens and spacing,
expands brand nicknames (VW, Merco, Chevy, Lambo…), ignores word order, and compares against
`make + model`, `make + model + generation` and each car's explicit `acceptedAnswers`.
Typos are tolerated only inside long alphabetic words — never in numbers or short codes — so
"Porsche 912" or "BMW M5" can never pass for "Porsche 911" or "BMW M3". Near misses (right make only,
missing make, slightly worse spelling, extra words) return a hint and don't cost an attempt.
A unit test guarantees no accepted answer belongs to two cars.

## Adding cars (and verifying image licences)

The game never calls an external API. Photos come from Wikimedia Commons through a
two-step, human-reviewed pipeline:

1. **Add a target** to `data/car-targets.json`: an `id`, a Wikidata search string and a Commons search string.
2. **Collect candidates**: `pnpm dataset:import --only my-car-id --sheets`.
   This writes `data/review/candidates.json` (file, author, licence, source page, size) and a numbered
   contact sheet `data/review/sheets/my-car-id.png`. Only landscape photos ≥ 1000 px wide are kept, and
   only public domain / CC0 / CC BY / CC BY-SA licences are marked `licenseAllowed`.
3. **Review by eye.** Pick a photo that clearly shows the right model *and generation*. Reject photos where
   the name is readable (placards, model lettering, plates like "FRD GT"), replicas, concepts, wrong
   generations, and files whose author is "Unknown" (attribution impossible).
4. **Write the editorial entry** in `data/cars.source.json`: make, model, generation, years, region,
   body type, tags, difficulty (1 iconic – 3 expert), extra accepted answers, a French + English clue and
   fun fact, and `"photo": { "file": "File:…jpg" }`. Keep facts verifiable; don't translate model names.
5. **Bundle**: `pnpm dataset:bundle`. It re-fetches each file's licence from Commons, refuses anything not
   allowed, downloads the photo once, writes `public/cars/<opaque-hash>-640.webp` and `-1200.webp`
   (the file name never reveals the answer), and regenerates `src/data/cars.json` with author, licence and
   source page. Then run `pnpm test` — the dataset tests check validity and answer uniqueness.

Every photo is credited on `/credits` (author, licence link, source page) and under the photo in game.
Photos are only resized and re-encoded, and each keeps its original licence.

## Storage

Three versioned keys: `calandre.settings`, `calandre.statistics`, `calandre.session` (the unfinished game,
except time attack). Each is `{ v, data }`; older versions are migrated step by step, malformed or future
data falls back to defaults, and when storage is unavailable (private mode) the game keeps working in memory.
Server rendering and hydration always use the defaults (via `useSyncExternalStore`), and a tiny inline
script applies the saved theme and language before first paint.

## PWA

`app/manifest.ts` (standalone, maskable icon) and `public/sw.js`:
pages are network-first with a cached fallback and `/offline.html`; hashed build assets are cache-first;
car photos are cache-first in a separate cache trimmed to 160 entries (≈ 25 MB max). Only same-origin
requests are cached. Settings offers an install button when the browser exposes `beforeinstallprompt`
(Chromium), and instructions for iOS (Share → Add to Home Screen) otherwise. Icons: `pnpm icons`.

## Known limitations

- 72 cars. European, Japanese and American cars are well covered; Korea has one car (no Korean category).
- The daily challenge is derived from the date and the dataset: adding or removing cars changes the
  sequences. There is no global leaderboard, only local results.
- Offline play covers pages already visited and photos already seen; a photo never displayed on the device
  shows an "unavailable offline" fallback with a "change car" button (except in the daily challenge).
- Production end dates for recent models (Nissan GT-R R35: 2025, Tesla Model S: 2026) reflect
  announcements as understood in late 2026 and may need checking.
- Car photos are bundled (≈ 13 MB in `public/cars`); the app only downloads the photos it shows.
