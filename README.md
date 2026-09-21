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
  │           └─ Authorization Code + PKCE (optional) — create a playlist of matched tracks
  │
  └─ Play
        ├─ Spotify embed of a matched track (or of a playlist you just created)
        ├─ 30s `preview_url` audio when Spotify returns one (no Premium)
        └─ “Open in Spotify” / search deep link (Free and Premium)
```

Open Opus is unauthenticated. Spotify’s **client secret never leaves the server**. The Web Playback SDK is not used: it requires user OAuth and **Spotify Premium**. Embeds and deep links work without that.

Work pages search **tracks only**. Matching recordings are grouped into movement sets from the same album (consecutive tracks that belong to the selected work). Full albums are not listed, so a Beethoven 5 result does not start playing Beethoven 7 from the same disc.

Open Opus work detail currently has **no movements/parts** field. If `parts` or `movements` is present, Classical Portal uses those titles when scoring Spotify tracks and lists them on the work page. Until then, catalogue numbers and common movement naming (`Symphony No. 5 … : I. Allegro con brio`) drive the grouping.

## Genres

Open Opus does not publish a form field. Each work’s `genre` is one of **Chamber, Keyboard, Orchestral, Stage, Vocal**. The Genres pages use a curated set of forms (symphony, sonata, opera, concerto, quartet, nocturne, mass, and others) derived from title text, falling back to the subtitle when the title names no form. Patterns live in `lib/forms.ts` and were checked against the public dump at `https://api.openopus.org/work/dump.json`.

That dump has no work ids, so `data/form-works.json` is built from each composer’s work list (`/work/list/composer/{id}/genre/all.json`), which does. Rebuild it with:

```bash
node --experimental-strip-types scripts/build-form-index.ts
```

A work is listed under one form. The title wins over the subtitle. Suites taken from an opera stay suites. Stage works with an empty subtitle and no other form (Carmen, Il barbiere di Siviglia) are listed as operas; Open Opus usually labels ballets and film scores in the subtitle, and a few unlabeled ones are still filed with operas. On a genre page, works use the same popularity order as a composer’s catalog: popular and essential first, then popular, then essential, then title.

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
| `SPOTIFY_REDIRECT_URI` | For “Create playlist on Spotify” | Must match a Redirect URI registered in the Spotify Dashboard |

Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).

**Search / matching** uses Client Credentials and does not need a redirect URI.

**Playlists** use Authorization Code + PKCE with scopes `playlist-modify-private` and `playlist-modify-public`. Register every environment’s callback exactly:

- Local: `http://127.0.0.1:3000/api/spotify/callback` (Spotify rejects `localhost`)
- Production / preview: `https://<your-domain>/api/spotify/callback`

Set `SPOTIFY_REDIRECT_URI` to the URI for that environment. If it is unset, the app falls back to `{origin}/api/spotify/callback`, which still has to be allow-listed in the Dashboard.

Without `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` the work page still offers **Search on Spotify**, which opens Spotify’s own search for the composer + work.

## Routes

- `/` — title, and banners for periods and genres (search stays in the header)
- `/periods` — Open Opus epochs
- `/periods/[epoch]` — composers in that period, popular first (`baroque`, `early-romantic`, …)
- `/genres` — forms such as symphonies, sonatas, and operas
- `/genres/[slug]` — works of that form, popular first
- `/composers/[id]` — works, filterable by essential / popular / genre
- `/works/[id]` — work detail and Spotify track matches
- `/search?q=` — Open Opus omnisearch (the search box also typeaheads via `/api/search`)
- `/api/spotify/login` — start Spotify login (playlist flow)
- `/api/spotify/callback` — OAuth redirect target
- `/api/spotify/session` — whether the visitor is connected
- `/api/spotify/playlist` — create a private playlist of matched tracks
- `/api/spotify/logout` — clear Spotify cookies

Supabase and YouTube are no longer used. Old `/admin`, `/blog`, and `/piece/:id` URLs redirect home.

## Playback notes

- **Open in Spotify** — works for Free and Premium; each listed item is a single track.
- **Create playlist on Spotify** — signs the visitor in (once), then saves only the matched movements. The embed switches to that playlist.
- **Embed** — ~30s preview unless the visitor is logged into Spotify in that browser; full playback often needs Premium.
- **Web Playback SDK** — not implemented. It needs Authorization Code plus the `streaming` scope, and **Premium is required**.

## Matching quality checks

`npm test` scores realistic track titles for:

- Beethoven Symphony no. 5, op. 67 (`/works/16406`) vs other Beethoven symphonies
- Bach Cantata BWV 140 (`/works/9334`) vs BWV 147 and chorale BWV 645
- Chopin Nocturnes op. 9 (`/works/17109`) vs B.49 and op. 27
