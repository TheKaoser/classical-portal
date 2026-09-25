-- Durable Spotify catalog matches, one row per work and market.
-- Positive rows never expire (expires_at is null). Negative rows set expires_at
-- about 7 days out and are ignored after that, so the work can be searched once more.
--
-- The server connects with STORAGE_CLASSICAL_POSTGRES_URL, or
-- STORAGE_CLASSICAL_DATABASE_URL when that is unset. Both are postgres:// URLs.
-- The table is created on first use (the same statement is in
-- lib/spotify-match-store.ts). This file is the reference copy.
--
-- Clearing one entry. market must match SPOTIFY_MARKET for that deployment:
--
--   delete from public.spotify_work_matches
--   where work_id = '17109' and market = 'ES';

create table if not exists public.spotify_work_matches (
  work_id text not null,
  market text not null,
  negative boolean not null,
  recordings jsonb not null,
  query text not null default '',
  search_url text not null default '',
  stored_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint spotify_work_matches_pkey primary key (work_id, market),
  constraint spotify_work_matches_expiry_ck check (
    (negative = false and expires_at is null)
    or (negative = true and expires_at is not null)
  )
);

comment on table public.spotify_work_matches is
  'Spotify matches keyed by work id and market. Positive rows do not expire. Negative rows expire at expires_at.';
