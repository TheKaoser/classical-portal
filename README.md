# Classical Portal

A minimal classical-music browser: composers and works from [Open Opus](https://openopus.org), recordings from [Spotify](https://developer.spotify.com/documentation/web-api).

Live path: **home → period / search → composer → work → Spotify**.

## How it works

```
Browser
  │
  ├─ Next.js App Router (server components)
  │     ├─ Open Opus REST API (no auth) — periods, composers, works, search
  │     └─ Spotify Web API (client-credentials, server-only) — matching albums/tracks
  │
  └─ Play
        ├─ Spotify embed iframe (preview, or full track if the listener is logged into Spotify)
        ├─ 30s `preview_url` audio when Spotify returns one (no Premium)
        └─ “Open in Spotify” / search deep link (Free and Premium)
```

Open Opus is unauthenticated. Spotify’s **client secret never leaves the server**. The Web Playback SDK is not used: it requires user OAuth and **Spotify Premium**. Embeds and deep links work without that.

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
| `SPOTIFY_REDIRECT_URI` | No | Reserved for a future login / Web Playback SDK flow |

Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard). Client Credentials does not need a redirect URI. If you add one later, Spotify requires `http://127.0.0.1:...` locally (not `localhost`) and HTTPS in production.

Without these variables the work page still offers **Search on Spotify**, which opens Spotify’s own search for the composer + work.

## Routes

- `/` — search, periods, popular composers
- `/periods` — Open Opus epochs
- `/periods/[epoch]` — composers in that period (`baroque`, `early-romantic`, …)
- `/composers/[id]` — works, filterable by essential / popular / genre
- `/works/[id]` — work detail and Spotify matches
- `/search?q=` — Open Opus omnisearch

Supabase and YouTube are no longer used. Old `/admin`, `/blog`, and `/piece/:id` URLs redirect home.

## Playback notes

- **Open in Spotify** — works for Free and Premium.
- **Embed** — ~30s preview unless the visitor is logged into Spotify in that browser; full playback often needs Premium.
- **Web Playback SDK** — not implemented. It needs Authorization Code (PKCE or confidential) plus the `streaming` scope, and **Premium is required**.
