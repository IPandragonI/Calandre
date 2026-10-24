# Calandre — le quiz auto

A car-guessing game: one photo, one text box, name the make and model (and the generation, for purists).
French by default (English available), light theme by default (dark available), installable as a PWA.
No backend, no account: preferences, statistics and the garage live in the browser's `localStorage`.

The emblem is a chrome swan mascot redrawn as vectors from the reference artwork `swann.png`: S-curved
neck with the head bowed, a layered wing swept back like a hood ornament's, a long streamlined hull. It is
defined once in `src/lib/brand/ornament.ts` (full mark, plus a simplified two-feather symbol for small sizes)
and used for the header logo with its spaced-capitals wordmark, loaders, favicon and PWA icons (`pnpm icons`,
chrome gradient on ink). The palette follows it: ivory and ink, coachbuilder's bordeaux, chrome steel-blue.

## Modes

| Mode | Rules |
|---|---|
| Classique | 10 cars, 3 attempts each, hints, difficulty filter (Mixte / Facile / Moyen / Difficile / Expert) |
| Défi du jour | 5 cars, identical for everyone on a given local date, once per day, shareable emoji grid |
| Sans fin | One attempt per car, 3 lives, difficulty ramps from easy to expert |
| Contre-la-montre | 60 s, +5 s per correct answer (capped at 90 s remaining), skip freely |
| Générations | Models with several generations in the catalogue; the exact generation must be named |
| Zoom | Classic rules, but the photo starts as a close-up and widens with each attempt or hint |
| Défis | By origin (countries, regions), by style (supercars, hot hatches, electric, rally…) or by brand. In a brand challenge the make is implied: "F40" is enough in a Ferrari quiz (the answer is judged as typed and with the make prepended, with the same strict rules) |

Scoring: 100 / 70 / 40 points for a correct answer on attempt 1 / 2 / 3+, minus 15 per hint, never below 0.
Skipped or revealed cars score 0. Near misses (right make only, missing make, small spelling slip, right model
but generation missing in Générations) give a hint and don't use an attempt; naming another generation of the
right model is called out ("bon modèle, mais pas cette génération").

Local extras: a **garage** of every car identified — searchable, filterable by make, category and decade,
sortable by name, make, year or body style, switchable to the whole catalogue — where each car opens a
shareable page (`/garage/<id>`: large photo, Wikipedia description, key facts); **achievements** derived from
the statistics, a daily streak, personal bests, and native sharing where supported. Nothing is sent anywhere.

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
pnpm test                     # Vitest: validation, scoring, selection, engine, stats, storage, catalogue rules & output
pnpm build && pnpm test:e2e   # Playwright against the production build (needs network for the remote photos)
```

Set `NEXT_PUBLIC_SITE_URL` when deploying so social-preview URLs are absolute. All routes are static.

## The catalogue

`public/catalogue.json` is generated — never edit it by hand. It is fetched by the app at runtime
(not bundled into the JavaScript) and kept available offline by the service worker.

### Sources

- **Wikidata** — car model items (`instance of` automobile model / concept car) that have a main image (P18) and
  at least 5 Wikipedia articles: brand (P1716) or manufacturer (P176), model family (P179), classes (body style,
  segment), designer (P287), assembly site (P1071), production dates when stated, Wikipedia links.
- **Wikimedia Commons** — for every photo: author, licence short name and URL, file page, dimensions.
- **Curated entries** — `data/catalogue/curated.json`: hand-written cars with editorial clues and fun facts,
  each with a reviewed Commons photo. They take precedence over imported duplicates.

### Rebuilding

```bash
pnpm catalogue            # uses the cache in data/catalogue/cache/ (gitignored) when present
pnpm catalogue --refresh  # refetch everything from Wikidata/Commons
pnpm catalogue --verify   # also HEAD-check every image URL (cached 30 days); broken ones are rejected
```

The script is idempotent: same inputs → same output, entries keyed by Wikidata id (curated ids for curated cars).
It respects the Wikimedia APIs (descriptive User-Agent, batching, `maxlag`, Retry-After, ≤ 4 parallel HEADs).

Every candidate gets a decision with a reason in `data/catalogue/decisions.json`; counts are in
`data/catalogue/report.json` and printed at the end:

- **rejected** — licence not allowed (anything but public domain / CC0 / CC BY / CC BY-SA), too small, portrait or
  extreme framing, non-raster, detail shot or non-car picture by file name (interior, engine, logo, scale model…),
  excluded class (trucks, buses, military, single-seaters…), broken image URL.
- **review** — identity not confirmed automatically: the file name doesn't name the model, the label can't be tied
  to the brand, unknown country. These never enter the game until approved. Open
  `data/catalogue/review.html` (remote thumbnails, nothing downloaded) and record decisions in
  `data/catalogue/overrides.json`:
  ```json
  { "Q123456": { "status": "accept" }, "Q654321": { "status": "reject", "note": "interior shot" },
    "Q111": { "status": "accept", "model": "Golf", "generation": "Mk4", "position": "center 60%" } }
  ```
- **duplicate** — same photo or same car as another entry, a model family covered by its generations, or a car
  already curated.
- **accepted** — written to `public/catalogue.json`.

### Difficulty rule

Difficulty comes from notability: the number of Wikipedia editions describing the model (or its model family, for
a generation). 40+ → Facile, 20–39 → Moyen, 10–19 → Difficile, fewer → Expert; concepts and race cars are at least
Difficile. Curated cars keep their editorial level. "Mixte" games draw 35 % / 30 % / 20 % / 15 % from the four tiers.

### Car pages: descriptions and key facts

The catalogue build also writes `public/details/{0..31}.json` (sharded by car id, loaded only by the car page):

- **Description** — the opening sentences of the car's French and English Wikipedia articles (MediaWiki extracts
  API), credited "Extrait de Wikipédia, CC BY-SA 4.0" with a link. Cars without an article show "no verified
  description" instead of generic text. Curated cars also keep their hand-written fun fact.
- **Key facts** — only what Wikidata states: designer, engine, assembly site, units built, mass, length, top
  speed. Units are converted only when known (mm/m/in, kg/lb, km/h/mph) and implausible values are dropped.

### Hints

Only what the data supports, never invented: make (always), production years (when Wikidata states them),
body style (from Wikidata classes), and a distinctive clue — curated text, or the designer / assembly site
from Wikidata. A car may therefore offer 1 to 4 hints.

### Photos, licences and attribution

- Photos are **hotlinked** from `upload.wikimedia.org` (1280 px thumbnail, with 500/960 px `srcset` candidates);
  nothing is downloaded or proxied. Wikimedia permits hotlinking with attribution.
- Each entry stores `image.url`, `width`, `height`, `sourcePage`, `author`, `license`, `licenseUrl`. The game
  credits author and licence under every photo, an ⓘ panel links the licence (and the file page once the answer
  is revealed, since the page names the car), and `/credits` lists every photo with search.
- Failed or slow photos show a fallback with *Retry* and *Change car (no penalty)*; there are no automatic retry loops.
- Offline: the app shell and catalogue work; photos only appear if the browser still has them in its own HTTP
  cache. The service worker never caches remote photos.

## Project structure

```
src/
  app/                 routes: / , /play, /categories, /garage, /stats, /settings, /credits, manifest.ts
  components/          UI by area (game, home, garage, stats, settings, categories, layout, ui)
  hooks/               use-catalogue (runtime catalogue), use-game, use-persistent, use-i18n, use-install-prompt
  lib/brand/           the emblem's vector geometry
  lib/game/            answer-validation, scoring, question-selection, daily-challenge, engine, categories, routes
  lib/stats/           statistics (schema v2 with migration), achievements
  lib/storage/         versioned { v, data } envelope with migrations, safe localStorage access
  lib/i18n/            fr.ts (reference) and en.ts
scripts/
  build-catalogue.ts   catalogue pipeline (fetch → verify → build → report)
  catalogue/           fetch, pure classification rules (+ tests), build
  lib/                 Wikidata and Commons API helpers
  generate-icons.ts    PWA icons and favicon from the emblem
data/catalogue/        curated.json, overrides.json, decisions/report/review outputs
public/sw.js           service worker; public/offline.html fallback
e2e/                   Playwright tests
```

## Storage

Three versioned keys: `calandre.settings`, `calandre.statistics` (v2 added the garage; v1 data is migrated),
`calandre.session` (the unfinished game, except time attack). Malformed or future data falls back to defaults,
and when storage is unavailable (private mode) the game keeps working in memory.

## Known limitations

- Remote photos depend on Wikimedia Commons being reachable; offline, unseen photos can't be shown.
- A determined player can read the photo's file name (it is a remote URL) in the page source.
- Imported cars have years only when Wikidata records them, and generic clues (designer / assembly site);
  only curated cars have fun facts.
- Automatic acceptance relies on the Wikidata item ↔ main image link plus a file-name check: it is not a human
  review of every photo. Entries failing the check wait in the review queue.
- The daily challenge depends on the catalogue: rebuilding it changes future sequences.
