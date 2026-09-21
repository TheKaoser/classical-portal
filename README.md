# Classical Portal

A minimal classical-music browser: composers and works from [Open Opus](https://openopus.org), recordings from [Spotify](https://developer.spotify.com/documentation/web-api).

Live path: **home → period / search → composer → work → Spotify**.

## How it works

```
Browser
  │
  ├─ Next.js App Router (server components)
  │     ├─ Open Opus REST API (no auth) — periods, composers, works, search
  │     └─ Spotify Web API
  │           ├─ Client Credentials (server-only) — search tracks, expand albums
  │           └─ Authorization Code + PKCE (optional) — private playlist of a movement group
  │
  └─ Play
        ├─ Spotify embed of one track, or of a private playlist of the whole movement group
        ├─ 30s `preview_url` audio when Spotify returns one (no Premium)
        └─ “Open in Spotify” / search deep link (Free and Premium)
```

Open Opus is unauthenticated. Spotify’s **client secret never leaves the server**. The Web Playback SDK is not used: it requires user OAuth and **Spotify Premium**. Embeds and deep links work without that.

Work pages search **tracks only**. Matching recordings are grouped into movement sets from the same album (consecutive tracks that belong to the selected work). Full albums are not listed, so a Beethoven 5 result does not start playing Beethoven 7 from the same disc.

Open Opus work detail currently has **no movements/parts** field. If `parts` or `movements` is present, Classical Portal uses those titles when scoring Spotify tracks and lists them on the work page. Until then, catalogue numbers and common movement naming (`Symphony No. 5 … : I. Allegro con brio`) drive the grouping.

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

**Play all** uses Authorization Code + PKCE. Scopes are `playlist-modify-private` and `playlist-modify-public`. No other scopes are requested. Playback does not use the queue API (`user-modify-playback-state`): that needs an active Premium device, while a playlist embed plays the movements in order without one.

Playlists are created **private** (`public: false`). Spotify has no temporary-playlist API, so each group is a private playlist in the listener’s library, named like `Classical Portal · Brahms Piano Concerto no. 2`. The embed can play that private playlist when the browser is logged into the same Spotify account. The same track list is reused from this browser instead of creating a duplicate. Register every environment’s callback exactly:

- Local: `http://127.0.0.1:3000/api/spotify/callback` (Spotify rejects `localhost`)
- Production / preview: `https://<your-domain>/api/spotify/callback`

Set `SPOTIFY_REDIRECT_URI` to the URI for that environment. If it is unset, the app falls back to `{origin}/api/spotify/callback`, which still has to be allow-listed in the Dashboard.

Without `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` the work page still offers **Search on Spotify**, which opens Spotify’s own search for the composer + work.

## Routes

- `/` — search, periods, and genres
- `/periods` — Open Opus epochs
- `/periods/[epoch]` — composers in that period, popular first (`baroque`, `early-romantic`, …)
- `/genres` — Open Opus work types, popular first
- `/genres/[genre]` — popular and essential works in that type (`orchestral`, `keyboard`, …)
- `/composers/[id]` — works, filterable by essential / popular / genre
- `/works/[id]` — work detail and Spotify track matches
- `/search?q=` — Open Opus omnisearch (the search box also typeaheads via `/api/search`)
- `/api/spotify/login` — start Spotify login (Play all)
- `/api/spotify/callback` — OAuth redirect target
- `/api/spotify/session` — whether the visitor is connected
- `/api/spotify/playlist` — create a private playlist of two or more matched tracks, in order
- `/api/spotify/logout` — clear Spotify cookies

Supabase and YouTube are no longer used. Old `/admin`, `/blog`, and `/piece/:id` URLs redirect home.

## Playback notes

- **Play all** — for a group of two or more movements. One click creates a private playlist of those tracks only, in album order, and the embed switches to that playlist so Spotify plays them back to back. If Spotify is not connected yet, the same click signs the listener in and then finishes the playlist when you return. The next visit embeds that playlist without creating another one. A single movement still uses the track embed. Choosing one row plays only that movement.
- **Open in Spotify** — works for Free and Premium; each listed item is a single track.
- **Embed** — ~30s preview unless the visitor is logged into Spotify in that browser; full playback often needs Premium.
- **Web Playback SDK** — not implemented. It needs Authorization Code plus the `streaming` scope, and **Premium is required**. Queueing via `/me/player/queue` is not implemented either.

## Matching quality checks

`npm test` scores realistic track titles for:

- Beethoven Symphony no. 5, op. 67 (`/works/16406`) vs other Beethoven symphonies
- Bach Cantata BWV 140 (`/works/9334`) vs BWV 147 and chorale BWV 645
- Chopin Nocturnes op. 9 (`/works/17109`) vs B.49 and op. 27
