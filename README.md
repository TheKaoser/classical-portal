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
  │           └─ Authorization Code + PKCE (optional) — Web Playback SDK, and a private playlist when asked
  │
  └─ Play
        ├─ Web Playback SDK — in-page player for a movement or the whole group (Premium)
        ├─ Save playlist — separate action; private Spotify playlist, not the player
        ├─ 30s `preview_url` audio when Spotify returns one (no Premium)
        └─ “Open in Spotify” / search deep link (Free and Premium)
```

Open Opus is unauthenticated. Spotify’s **client secret never leaves the server**. Playback uses the Web Playback SDK, which requires user OAuth and **Spotify Premium**. Deep links and 30-second previews work without that login. The Spotify embed iframe is not the player.

Open Opus work lists have no composition date. Classical Portal fills that in from [Wikidata](https://query.wikidata.org): English labels and aliases of works whose composer (P86) matches, using the inception date (P571) as the composition year. A year is shown only when the catalogue number (opus, BWV, K., Hoboken, and the same style of identifier on both sides), or otherwise a unique title, matches exactly one year. If Wikidata has no unambiguous year, the row shows an em dash — the app does not guess. The composer **All** list is chronological (undated titles A–Z at the end). Popular and genre filters use Spotify popularity order. There is no Essential chip. Resolved indexes are stored in `data/composition-dates.json` (refresh with `node --experimental-strip-types scripts/refresh-composition-dates.ts`); composers missing from that file are looked up live and cached.

Work pages search **tracks only**. Matching recordings are grouped into movement sets from the same album (consecutive tracks that belong to the selected work). Full albums are not listed, so a Beethoven 5 result does not start playing Beethoven 7 from the same disc.

Open Opus work detail currently has **no movements/parts** field. If `parts` or `movements` is present, Classical Portal uses those titles when scoring Spotify tracks and lists them on the work page. Until then, catalogue numbers and common movement naming (`Symphony No. 5 … : I. Allegro con brio`) drive the grouping.

## Genres

Open Opus does not publish a form field. Each work’s `genre` is one of **Chamber, Keyboard, Orchestral, Stage, Vocal**. The Genres pages use a curated set of forms (symphony, sonata, opera, concerto, quartet, nocturne, mass, and others) derived from title text, falling back to the subtitle when the title names no form. Patterns live in `lib/forms.ts` and were checked against the public dump at `https://api.openopus.org/work/dump.json`.

That dump has no work ids, so `data/form-works.json` is built from each composer’s work list (`/work/list/composer/{id}/genre/all.json`), which does. Rebuild it with:

```bash
node --experimental-strip-types scripts/build-form-index.ts
```

A work is listed under one form. The title wins over the subtitle. Suites taken from an opera stay suites. Stage works with an empty subtitle and no other form (Carmen, Il barbiere di Siviglia) are listed as operas; Open Opus usually labels ballets and film scores in the subtitle, and a few unlabeled ones are still filed with operas.

Open Opus stores two flags, `popular` and `recommended`. Classical Portal treats either flag as **Popular**. There is no separate Essential filter or badge. A work that carries both flags is listed once. The star on a work row is that flag. List order is separate from the flag.

Genre pages, and a composer's Popular and genre filters, are ordered by Spotify popularity (highest first, then name). The composer **All** filter stays chronological. The popular-composers page and each period page order composers the same way. Spotify's own 0–100 popularity is cached in `data/spotify-popularity.json`, so those pages do not call Spotify.

A composer's score is the higher of the matched Spotify artist's popularity and the highest popularity among tracks matched to that composer's works. A work's score is the highest popularity among tracks the work-page matcher assigns to it (album popularity is included when Spotify sends it). Open Opus popular/recommended flags are not the rank. A row the cache has not matched is listed after every scored row; those unmatched rows keep the previous Open Opus order among themselves (pop list, then essential list, then the rest for composers; the Popular flag, then title, for works).

Refresh the cache when the catalog changes or you want newer Spotify numbers. Put `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in the environment or `.env.local` (the same client-credentials pair used to match recordings). From the repo root:

```bash
node --experimental-strip-types scripts/refresh-spotify-popularity.ts
```

The script skips composers already marked complete, so it is safe to interrupt and run again. Pass `--refresh` to recompute every score. `--composer=<open-opus-id>` refreshes one composer. `--limit=20` processes that many composers who are not yet complete. Commit the updated `data/spotify-popularity.json`.

`data/spotify-popularity.json` in the repo has empty `composers` and `works` maps until that script has been run with credentials and the JSON is committed. Pages do not invent scores. Until the file has numbers, every row is unmatched and lists keep the previous Open Opus order.

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
| `SPOTIFY_REDIRECT_URI` | For in-page play and Save playlist | Must match a Redirect URI registered in the Spotify Dashboard |

Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).

**Search / matching** uses Client Credentials and does not need a redirect URI.

**Play** and **Save playlist** sit on each album row. They use Authorization Code + PKCE. Scopes are `streaming`, `user-modify-playback-state`, `user-read-private`, `user-read-email`, `playlist-modify-private`, and `playlist-modify-public`. The page loads the [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk) and creates a player named Classical Portal. That player is the only device playback starts: `PUT /v1/me/player/play?device_id=…` with `{ uris, offset: { position } }`. The `device_id` always comes from that in-page player. The app does not list other devices or transfer playback to the Spotify app. Play does not create a playlist. Save playlist is a separate control on the same album that creates a private playlist and does not start the player. The selected album lists its movements underneath; choosing one starts at that track. The player is a bar fixed to the bottom of the page. It offers play/pause, a seek handle, the current movement, and Save track. Save track adds only that movement to a private playlist named Classical Portal · Saved tracks. It uses the same playlist scopes as Save playlist and does not save the whole recording.

**Spotify Premium** is required for that in-app player. Free (`free` / `open`) accounts get a clear message and can still use the 30-second preview and “Open in Spotify”.

In the Spotify Dashboard, Redirect URIs must include exactly:

- Production: `https://classical-portal.vercel.app/api/spotify/callback`
- Local: `http://127.0.0.1:3000/api/spotify/callback` (Spotify rejects `localhost`)

Set `SPOTIFY_REDIRECT_URI` to the URI for that environment. If it is unset, the app falls back to `{origin}/api/spotify/callback`, which still has to be allow-listed in the Dashboard. Listeners who signed in before these scopes were requested need to reconnect once.

Without `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` the work page still offers **Search on Spotify**, which opens Spotify’s own search for the composer + work.

## Routes

- `/` — title, and banners for periods and genres (search stays in the header)
- `/periods` — Open Opus epochs
- `/periods/[epoch]` — composers in that period, by Spotify popularity (`baroque`, `early-romantic`, …)
- `/genres` — forms such as symphonies, sonatas, and operas
- `/genres/[slug]` — works of that form, by Spotify popularity
- `/composers` — the Open Opus popular composers, by Spotify popularity
- `/composers/[id]` — works; All is chronological, Popular and genre filters are by Spotify popularity
- `/works/[id]` — work detail and Spotify track matches
- `/search?q=` — Open Opus omnisearch (the search box also typeaheads via `/api/search`)
- `/api/spotify/login` — start Spotify login (Play or Save playlist). `reconnect=1` shows the consent screen again
- `/api/spotify/callback` — OAuth redirect target
- `/api/spotify/session` — whether the visitor is connected, and whether the account is Premium
- `/api/spotify/token` — access token for the Web Playback SDK (`getOAuthToken`)
- `/api/spotify/play` — `PUT /v1/me/player/play?device_id=…` for this page’s SDK player only, with the movement track URIs
- `/api/spotify/playlist` — create a private playlist of two or more matched tracks, in order (`POST /v1/me/playlists`, then `POST /v1/playlists/{id}/items`)
- `/api/spotify/save-track` — add the current movement to a private saved-tracks playlist (same Spotify write path)
- `/api/spotify/logout` — clear Spotify cookies

Supabase and YouTube are no longer used. Old `/admin`, `/blog`, and `/piece/:id` URLs redirect home.

## Playback notes

- **Play** — on the album row. One click starts that recording’s track URIs in the player bar fixed to the bottom of the page, from the first movement. Audio is the Web Playback SDK in the browser, not remote control of another Spotify device. If Spotify is not connected yet, the same click signs the listener in and starts playback when they return.
- **Movements** — listed under the selected album, expanded. Choosing a movement starts playback at that track in the same bottom player. The row uses a pointer cursor.
- **Save playlist** — on the album row, separate from Play, for a group of two or more movements. Creates a private playlist of those movements and does not replace the in-page player.
- **Save track** — on the player bar, in place of previous/next. Adds only the current movement to Classical Portal · Saved tracks. It does not save the rest of the recording.
- **Search on Spotify** — works for Free and Premium and opens Spotify’s own search.
- **Preview** — 30-second `preview_url` when Spotify returns one. No Premium required. Not the main player.
- **Web Playback SDK** — the default player, fixed to the bottom of the viewport. It needs the `streaming` scope and **Spotify Premium**. Free accounts see that Premium is required. The seek bar scrubs the current track in this page.

## Matching quality checks

`npm test` scores realistic track titles for:

- Beethoven Symphony no. 5, op. 67 (`/works/16406`) vs other Beethoven symphonies
- Bach Cantata BWV 140 (`/works/9334`) vs BWV 147 and chorale BWV 645
- Chopin Nocturnes op. 9 (`/works/17109`) vs B.49 and op. 27
