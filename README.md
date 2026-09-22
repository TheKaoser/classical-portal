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
  │           ├─ Client Credentials (server-only) — search tracks, expand albums
  │           └─ Authorization Code + PKCE (optional) — Web Playback SDK for Play all
  │
  └─ Play
        ├─ Web Playback SDK — Play all streams the movement group in order (Premium)
        ├─ Spotify embed of one track, for browsing without in-app playback
        ├─ 30s `preview_url` audio when Spotify returns one (no Premium)
        └─ “Open in Spotify” / search deep link (Free and Premium)
```

Open Opus is unauthenticated. Spotify’s **client secret never leaves the server**. Play all uses the Web Playback SDK, which requires user OAuth and **Spotify Premium**. Embeds and deep links still work without that login.

Open Opus work lists have no composition date. Classical Portal fills that in from [Wikidata](https://query.wikidata.org): English labels and aliases of works whose composer (P86) matches, using the inception date (P571) as the composition year. A year is shown only when the catalogue number (opus, BWV, K., Hoboken, and the same style of identifier on both sides), or otherwise a unique title, matches exactly one year. If Wikidata has no unambiguous year, the row shows an em dash — the app does not guess. The composer **All** list is chronological (undated titles A–Z at the end). Popular keeps popularity order. There is no Essential chip. Resolved indexes are stored in `data/composition-dates.json` (refresh with `node --experimental-strip-types scripts/refresh-composition-dates.ts`); composers missing from that file are looked up live and cached.

Work pages search **tracks only**. Matching recordings are grouped into movement sets from the same album (consecutive tracks that belong to the selected work). Full albums are not listed, so a Beethoven 5 result does not start playing Beethoven 7 from the same disc.

Open Opus work detail currently has **no movements/parts** field. If `parts` or `movements` is present, Classical Portal uses those titles when scoring Spotify tracks and lists them on the work page. Until then, catalogue numbers and common movement naming (`Symphony No. 5 … : I. Allegro con brio`) drive the grouping.

## Genres

Open Opus does not publish a form field. Each work’s `genre` is one of **Chamber, Keyboard, Orchestral, Stage, Vocal**. The Genres pages use a curated set of forms (symphony, sonata, opera, concerto, quartet, nocturne, mass, and others) derived from title text, falling back to the subtitle when the title names no form. Patterns live in `lib/forms.ts` and were checked against the public dump at `https://api.openopus.org/work/dump.json`.

That dump has no work ids, so `data/form-works.json` is built from each composer’s work list (`/work/list/composer/{id}/genre/all.json`), which does. Rebuild it with:

```bash
node --experimental-strip-types scripts/build-form-index.ts
```

A work is listed under one form. The title wins over the subtitle. Suites taken from an opera stay suites. Stage works with an empty subtitle and no other form (Carmen, Il barbiere di Siviglia) are listed as operas; Open Opus usually labels ballets and film scores in the subtitle, and a few unlabeled ones are still filed with operas.

Open Opus stores two flags, `popular` and `recommended`. Classical Portal treats either flag as **Popular**. There is no separate Essential filter or badge. A work that carries both flags is listed once. Genre pages and composer work lists put popular works first, then the rest by title.

Composer lists on a period page are ranked separately, by Open Opus list membership: `/composer/list/pop.json`, then `/composer/list/rec.json`, then everyone else. Names stay alphabetical inside each tier.

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
| `SPOTIFY_MARKET` | No (default `US`) | ISO 3166-1 alpha-2 market for search |
| `SPOTIFY_REDIRECT_URI` | For “Play all” | Must match a Redirect URI registered in the Spotify Dashboard |

Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).

**Search / matching** uses Client Credentials and does not need a redirect URI.

**Play all** uses Authorization Code + PKCE and the [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk). Scopes are `streaming`, `user-modify-playback-state`, `user-read-private`, and `user-read-email`. Playlist-modify scopes are not requested. The page loads the SDK and creates a player named Classical Portal. That player is the only device Play all starts: `PUT /v1/me/player/play?device_id=…` with `{ uris, offset: { position: 0 } }`. The `device_id` always comes from that in-page player. The app does not list other devices or transfer playback to the Spotify app. No temporary playlist is created. A bar in the page offers play/pause, progress, the current movement, and previous/next.

**Spotify Premium** is required for that in-app player. Free (`free` / `open`) accounts get a clear message and can still use the track embed, the 30-second preview, and “Open in Spotify”.

In the Spotify Dashboard, Redirect URIs must include exactly:

- Production: `https://classical-portal.vercel.app/api/spotify/callback`
- Local: `http://127.0.0.1:3000/api/spotify/callback` (Spotify rejects `localhost`)

Set `SPOTIFY_REDIRECT_URI` to the URI for that environment. If it is unset, the app falls back to `{origin}/api/spotify/callback`, which still has to be allow-listed in the Dashboard. Listeners who signed in before these scopes were requested need to reconnect once.

Without `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` the work page still offers **Search on Spotify**, which opens Spotify’s own search for the composer + work.

## Routes

- `/` — title, and banners for periods and genres (search stays in the header)
- `/periods` — Open Opus epochs
- `/periods/[epoch]` — composers in that period, popular list, then essential list, then the rest (`baroque`, `early-romantic`, …)
- `/genres` — forms such as symphonies, sonatas, and operas
- `/genres/[slug]` — works of that form, popular first
- `/composers/[id]` — works, filterable by popular / genre
- `/works/[id]` — work detail and Spotify track matches
- `/search?q=` — Open Opus omnisearch (the search box also typeaheads via `/api/search`)
- `/api/spotify/login` — start Spotify login (Play all). `reconnect=1` shows the consent screen again
- `/api/spotify/callback` — OAuth redirect target
- `/api/spotify/session` — whether the visitor is connected, and whether the account is Premium
- `/api/spotify/token` — access token for the Web Playback SDK (`getOAuthToken`)
- `/api/spotify/play` — `PUT /v1/me/player/play?device_id=…` for this page’s SDK player only, with the movement track URIs
- `/api/spotify/logout` — clear Spotify cookies

Supabase and YouTube are no longer used. Old `/admin`, `/blog`, and `/piece/:id` URLs redirect home.

## Playback notes

- **Play all** — for a group of two or more movements. One click starts those track URIs in the player bar on this page. Audio is the Web Playback SDK in the browser, not remote control of another Spotify device. If Spotify is not connected yet, the same click signs the listener in and starts playback when they return. Choosing one row pauses the in-page player and shows that track’s embed. A single matched track stays on the embed.
- **Open in Spotify** — works for Free and Premium; each listed item is a single track.
- **Embed** — fallback for browsing one movement. ~30s preview unless the visitor is logged into Spotify in that browser; full playback in the embed often needs Premium.
- **Web Playback SDK** — used for Play all. It needs the `streaming` scope and **Spotify Premium**. Free accounts see that Premium is required and are not offered a temporary playlist.

## Matching quality checks

`npm test` scores realistic track titles for:

- Beethoven Symphony no. 5, op. 67 (`/works/16406`) vs other Beethoven symphonies
- Bach Cantata BWV 140 (`/works/9334`) vs BWV 147 and chorale BWV 645
- Chopin Nocturnes op. 9 (`/works/17109`) vs B.49 and op. 27
