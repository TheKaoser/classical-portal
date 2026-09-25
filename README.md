# Classical Portal

A minimal classical-music browser: composers and works from [Open Opus](https://openopus.org), recordings from [Spotify](https://developer.spotify.com/documentation/web-api).

Live path: **home → period or genre / search → composer → work → Spotify**.

## How it works

```
Browser
  │
  ├─ Next.js App Router (server components)
  │     ├─ Open Opus REST API (no auth) — periods, composers, works, search
  │     └─ Spotify Web API
  │           └─ Client Credentials (server-only) — search tracks, expand albums
  │
  └─ Play
        ├─ Spotify Embed iFrame API — in-page player, no login through this app
        └─ “Search on Spotify” deep link
```

Open Opus is unauthenticated. Spotify’s **client secret never leaves the server** and is used only to match recordings. Playback uses the [Spotify Embed iFrame API](https://developer.spotify.com/documentation/embeds/references/iframe-api). Anyone can listen: a visitor already signed in to Spotify in the browser gets full tracks, and everyone else gets Spotify’s 30-second previews. This app does not collect a Spotify login.

Open Opus work lists and work detail do not include a composition year. Detail does include `catalogue` and `catalogue_number` (for example `op` / `67`), which are used when the title itself has no catalogue number. Classical Portal fills dates from two sources, in order:

1. [Wikidata](https://query.wikidata.org) inception (`P571`) on a work whose composer (`P86`) is the same person, when the precision is a year or finer. A decade that is not a round century is kept as a range (`1720s` → `1720–29`). When the inception value itself is only a century-like decade, the statement's start and end (`P580`, `P582`) are kept if both are years at most 30 apart (`1703–1708`). Two or more exact years on the same work become a range when they fall within 30 years (`1831` and `1835` → `1831–35`). A wider split is left blank.
2. The IMSLP field **Year/Date of Composition**. The page is the one Wikidata links with `P839`, or, when that link is missing, a page in the composer's IMSLP category (the person's `P839`) whose title credits that composer. An arrangement or a namesake in the same category is skipped. A catalogue key that already has a year is not replaced.

A date is shown only when a catalogue number (opus, BWV, K. including `K.252/240a` and `K.Anh.206a`, Hoboken including `Hob.VIIb:1`, `Hob.II, nos. 13–14`, and `H.3/57–59`, Warburton `CW C65` / `W.G3`, and the same style of identifier), or otherwise a unique title, matches exactly one date. A span written in the title (`BWV 841–843`, `BWV 933–38`) is dated only when every number in that span has a date. A set such as Chopin's Etudes op. 10 stays blank when the numbered pieces do not all share one year; it is dated only when every piece has that same year or range. Bach titles of the form `Cantata no. 147` use BWV 147 when that catalogue entry is dated. If the Open Opus title already has a catalogue number and that number is not in the index, the row stays undated instead of borrowing another work's form or title. IMSLP wording such as `1740 ca.` is shown as `c. 1740`. A span such as `1724–25` is shown as a range. Vague phrases (`early 1720s`, `before 1740`, `?`) are skipped. First-performance dates (`P1191`), publication dates (`P577`), and MusicBrainz first-release dates are not used: a MusicBrainz work has no composition date distinct from a release. The app does not guess a year. Undated rows show an em dash. Works whose sources give no year-precision composition date stay blank.

The composer **All** list is chronological (undated titles A–Z at the end). Popular and genre filters use Spotify popularity order. There is no Essential chip. The same year is shown on composer lists, genre lists, search results, and the work page.

Resolved indexes are stored in `data/composition-dates.json`. Refresh them from the repo root when you want newer Wikidata or IMSLP values:

```bash
npm run dates -- --refresh
```

The script is safe to interrupt. Continue a stopped refresh with `npm run dates -- --refresh --resume`. Without `--refresh`, composers already in the file are skipped. `--composer=87,145` limits the run to those Open Opus ids. A refresh keeps a catalogue key that already has a year and fills keys that were blank. A full run writes `stats` (works, dated, exact, ranged, circa) into the JSON file. Commit the updated `data/composition-dates.json`. Composers missing from that file are looked up live and cached.

Work pages search **tracks only**. Matching recordings are grouped into movement sets from the same album (consecutive tracks that belong to the selected work). Full albums are not listed, so a Beethoven 5 result does not start playing Beethoven 7 from the same disc.

Open Opus work detail currently has **no movements/parts** field. If `parts` or `movements` is present, Classical Portal uses those titles when scoring Spotify tracks and lists them on the work page. Until then, catalogue numbers and common movement naming (`Symphony No. 5 … : I. Allegro con brio`) drive the grouping.

## Genres

Open Opus does not publish a form field. Each work’s `genre` is one of **Chamber, Keyboard, Orchestral, Stage, Vocal**. The Genres pages use a shorter set of important forms derived from title text, falling back to the subtitle when the title names no form. Several of those forms share one page and stay available as filter chips:

- Chamber — trios, quartets, quintets, and sextets. Trio sonatas are trios, not sonatas
- Choral — requiems, masses, oratorios, motets, and cantatas
- Keyboard — nocturnes, etudes, mazurkas, waltzes, polonaises, impromptus, ballades, rhapsodies, scherzos, preludes, fugues, toccatas, partitas, fantasias, and variations. Piano, harpsichord, and organ are not chips and not separate genres; those works stay on the form chip named in the title
- Stage — operas, ballets, and overtures
- Orchestral — symphonies, suites, serenades, and divertimenti

Concertos, sonatas, and songs stay their own pages. Patterns live in `lib/forms.ts` and were checked against the public dump at `https://api.openopus.org/work/dump.json`.

That dump has no work ids, so `data/form-works.json` is built from each composer’s work list (`/work/list/composer/{id}/genre/all.json`), which does. Rebuild it with:

```bash
node --experimental-strip-types scripts/build-form-index.ts
```

A work is listed under one form. The title wins over the subtitle. Suites taken from an opera stay suites. Stage works with an empty subtitle and no other form (Carmen, Il barbiere di Siviglia) are listed as operas; Open Opus usually labels ballets and film scores in the subtitle, and a few unlabeled ones are still filed with operas.

Open Opus also has no instrument field. Where titles follow its style guide (`Piano Concerto`, `String Quartet`, `Trio Sonata`) or a subtitle says `for violin, viola and orchestra`, the genre page adds chips in the same style as the composer filters. **All** is the default. Choosing a chip filters the list in place and keeps Spotify popularity order, and the chip is written with `history.replaceState`, so Back leaves the page instead of stepping through chips. Concertos split by solo instrument, plus Concerto grosso, Chamber, String, and Multiple when more than one soloist is named. Sonatas split by instrument. A title that only says keyboard or clavier, and a sonata with no instrument whose Open Opus genre is Keyboard, use an era split: organ when the title names the organ, harpsichord for Medieval, Renaissance, and Baroque, and piano after that. Those pages do not show a Keyboard chip. Open Opus still stores Keyboard, Chamber, Orchestral, Stage, and Vocal on the work itself, and composer pages still filter by those five names. Trio sonatas, including “sonata en trio” and “sonata a 3”, are Chamber trios. The folded genres above split into their forms (Trios, Symphonies, Nocturnes, Preludes, and so on). Keyboard does not add Piano, Harpsichord, or Organ beside those form chips. One chip is selected at a time. A form or instrument chip needs eight or more works, and a folded genre needs at least two form groups of that size, or the page stays a single list. Songs do not get a selector. Composer eras used for unlabeled keyboard pieces are in `data/composer-epochs.json`.

Open Opus stores two flags, `popular` and `recommended`. Classical Portal treats either flag as **Popular**. There is no separate Essential filter or badge. A work that carries both flags is listed once. The star on a work row is that flag. List order is separate from the flag.

Genre pages, and a composer's Popular and genre filters, are ordered by Spotify popularity (highest first, then name). The composer **All** filter stays chronological. The popular-composers page and each period page order composers the same way. Spotify's own 0–100 popularity is cached in `data/spotify-popularity.json`, so those pages do not call Spotify.

A composer's score is the higher of the matched Spotify artist's popularity and the highest popularity among tracks matched to that composer's works. A work's score is the highest popularity among tracks the work-page matcher assigns to it (album popularity is included when Spotify sends it). Open Opus popular/recommended flags are not the rank. A row the cache has not matched is listed after every scored row; those unmatched rows keep the previous Open Opus order among themselves (pop list, then essential list, then the rest for composers; the Popular flag, then title, for works).

Refresh the cache when the catalog changes or you want newer Spotify numbers. Put `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the environment or `.env.local` (the same client-credentials pair used to match recordings). From the repo root:

```bash
node --experimental-strip-types scripts/refresh-spotify-popularity.ts
```

The script skips composers already marked complete, so it is safe to interrupt and run again. Pass `--refresh` to recompute every score. `--composer=<open-opus-id>` refreshes one composer. `--limit=20` processes that many composers who are not yet complete. Commit the updated `data/spotify-popularity.json`.

The committed `data/spotify-popularity.json` is filled from a Spotify client-credentials pass over the Open Opus catalog. Pages do not invent scores. A composer or work missing from the file is unmatched and sorts after every scored row.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The catalog works with no env vars. Matching recordings on a work page need Spotify credentials.

## Environment variables

Set these in `.env.local` and in the Vercel project (Settings → Environment Variables):

| Name | Required | Purpose |
| --- | --- | --- |
| `SPOTIFY_CLIENT_ID` | For matching recordings | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | For matching recordings | Spotify app secret (server only) |
| `SPOTIFY_MARKET` | No (default `US`) | ISO 3166-1 alpha-2 market for search. Also the market half of the durable match key |
| `STORAGE_CLASSICAL_POSTGRES_URL` | No | Direct `postgres://` URL for the durable Spotify match cache. Preferred |
| `STORAGE_CLASSICAL_DATABASE_URL` | No | Fallback direct `postgres://` URL when `STORAGE_CLASSICAL_POSTGRES_URL` is unset |
| `NEXT_PUBLIC_DONATE_URL` | No | Stripe Payment Link for the footer Donate control. Leave unset to hide it |

Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).

**Search / matching** uses Client Credentials. It does not need a redirect URI or a user login.

**Play** loads the matched movement URIs into the official Spotify embed (iFrame API) fixed to the bottom of the page. The embed does not use this app’s Spotify Web API quota. Listeners signed in to Spotify in the browser hear full tracks; others hear 30-second previews. Play all and Random on composer and genre lists use the same embed and the same server-side match lookup.

Without `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` the work page still offers **Search on Spotify**, which opens Spotify’s own search for the composer + work.

## Durable Spotify match cache

A finished catalog search is stored once per work and market in Postgres table `public.spotify_work_matches`. The server reads `STORAGE_CLASSICAL_POSTGRES_URL`, then `STORAGE_CLASSICAL_DATABASE_URL`. Both have to be a `postgres://` or `postgresql://` URL. `STORAGE_CLASSICAL_PRISMA_DATABASE_URL` (Prisma Accelerate) is not used. On Vercel these are set for Production and Preview. The app creates the table on first use. `db/spotify_work_matches.sql` is the same statement, for reference.

`market` is `SPOTIFY_MARKET` (default `US`), trimmed and uppercased. The row holds the recordings plus the public search query and URL.

When neither URL is set, or Postgres cannot be reached, the search still runs. Nothing is written to the table. Those requests still pass through the in-memory layer and the Next.js data cache (14 days for a payload, 6 hours for an empty payload), keyed by the search text rather than the work id. That cache is not the permanent record.

Lifetime:

- One or more recordings: `expires_at` is null. The row does not expire.
- Empty catalog search: `expires_at` is seven days out. After that the row is a miss and the work may be searched once more.
- Not stored: quota or upstream failure, a crawler skip, or missing Spotify credentials.

Crawlers never read or write the table.

Clear one entry. `market` has to match `SPOTIFY_MARKET` for that deployment:

```sql
delete from public.spotify_work_matches
where work_id = '17109' and market = 'ES';
```

The next request treats that work as unseen. A warm Next.js data cache for the same search text can still answer for up to 14 days, so deleting the row does not by itself call the Spotify Web API.

To drop every stored match:

```sql
delete from public.spotify_work_matches;
```

## Routes

- `/` — title, Periods / Genres / Composers as text links, and a separate **Discovery of the day** button (search stays in the header)
- `/discover` — redirects to one Spotify-matched work (`/works/[id]`). The pool is every Open Opus work id in `data/spotify-popularity.json` with a Spotify score of at least 1. A hash of the UTC date (`YYYY-MM-DD`) picks the index, so every visitor gets the same work until the next UTC day
- `/periods` — six periods. Romantic covers Open Opus Early Romantic, Romantic, and Late Romantic. Modern covers 20th Century, Post-War, and 21st Century
- `/periods/[epoch]` — composers in that period, by Spotify popularity (`baroque`, `romantic`, `modern`, …). `/periods/romantic` adds Early / Romantic / Late chips. `/periods/modern` adds 20th / Post-War / 21st chips. `/periods/early-romantic`, `/periods/late-romantic`, `/periods/20th-century`, `/periods/post-war`, and `/periods/21st-century` redirect to the unified page with the matching chip
- `/genres` — concertos, sonatas, songs, and the folded genres (keyboard, chamber, choral, stage, orchestral). Piano, harpsichord, and organ are not separate genres
- `/genres/[slug]` — works of that genre, by Spotify popularity. Concertos, sonatas, and the folded genres filter in place with `?filter=` (piano, violin, quartet, mass, nocturne, opera, symphony, prelude, …). Old fine-form URLs such as `/genres/quartet`, `/genres/opera`, `/genres/symphony`, `/genres/nocturne`, and `/genres/prelude` redirect to the parent genre with that chip selected. `/genres/baroque-keyboard` redirects to `/genres/keyboard` and keeps a current form chip. `/genres/piano`, `/genres/harpsichord`, and `/genres/organ` (and older instrument slugs such as `/genres/pianoforte`, `/genres/cembalo`, and `/genres/orgue`) redirect to `/genres/keyboard`. A Keyboard form chip already in the query, such as `?filter=nocturne`, is kept. `?filter=piano`, `?filter=harpsichord`, and `?filter=organ` on Keyboard open the unfiltered list. Changing a chip replaces the current history entry
- `/composers` — the Open Opus popular composers, by Spotify popularity
- `/composers/[id]` — works; All is chronological, Popular and genre filters are by Spotify popularity
- `/works/[id]` — work detail and Spotify track matches, including the destination of Discovery of the day
- `/search?q=` — Open Opus omnisearch (the search box also typeaheads via `/api/search`)
- `/api/spotify/recordings` — client-triggered catalog match for a work page
- `/api/spotify/work-playback` — primary recording URIs for list playback (Play all / Random)

YouTube is no longer used. The match cache uses Postgres and does not read Supabase. Old `/admin`, `/blog`, and `/piece/:id` URLs redirect home.

## Playback notes

- **Play / Pause** — on the album row. While that recording is playing, the control shows **Pause**; when paused, it shows **Play** and resumes. Starting a different album begins that recording from the first movement. The embed at the bottom of the page is the player.
- **Movements** — listed under the selected album. Choosing a movement loads that track. When a track ends, the next movement loads. After the last movement, the work ends.
- **Play all / Random** — on composer and genre lists. The order is fixed when the control is pressed. Works without a match are skipped. Playback stops at the end of the list, or after a run of misses. Pausing, or choosing another play control, cancels the advance.
- **Search on Spotify** — opens Spotify’s own search.
- **Autoplay** — if the browser blocks `play()` (for example iOS Safari), the embed stays on screen with its own play button and a “Tap play to continue” control.

## Matching quality checks

`npm test` scores realistic track titles for:

- Beethoven Symphony no. 5, op. 67 (`/works/16406`) vs other Beethoven symphonies
- Bach Cantata BWV 140 (`/works/9334`) vs BWV 147 and chorale BWV 645
- Chopin Nocturnes op. 9 (`/works/17109`) vs B.49 and op. 27
