-- =====================================================================
-- Melomaniac — Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- App-level profile for each Supabase Auth user (auth.users holds credentials).
create table if not exists public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- The music catalog. audio_path / cover_path are either a path inside the
-- `audio` / `covers` Storage buckets, or a full https:// URL.
create table if not exists public.tracks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  artist           text not null,
  album            text,
  genre            text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  audio_path       text not null,
  cover_path       text,
  lyrics           text,            -- plain text, or LRC: [mm:ss.xx]line
  created_at       timestamptz not null default now()
);
create index if not exists tracks_artist_idx on public.tracks (artist);
create index if not exists tracks_genre_idx  on public.tracks (genre);

-- One row per qualifying listen (>= 30 seconds actually played).
-- seconds_listened is topped up when the listen ends, so totals are accurate.
create table if not exists public.listen_history (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references public.users (id) on delete cascade,
  track_id         uuid not null references public.tracks (id) on delete cascade,
  listened_at      timestamptz not null default now(),
  seconds_listened integer not null check (seconds_listened >= 30),
  completed        boolean not null default false,
  source           text             -- 'home' | 'search' | 'library' | 'playlist' ...
);
create index if not exists listen_history_user_time_idx  on public.listen_history (user_id, listened_at desc);
create index if not exists listen_history_user_track_idx on public.listen_history (user_id, track_id);
create index if not exists listen_history_time_idx       on public.listen_history (listened_at);

create table if not exists public.liked_tracks (
  user_id    uuid not null default auth.uid() references public.users (id) on delete cascade,
  track_id   uuid not null references public.tracks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.playlists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  description text,
  cover_path  text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists playlists_owner_idx on public.playlists (owner_id);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  track_id    uuid not null references public.tracks (id) on delete cascade,
  position    integer not null default 0,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

-- ---------------------------------------------------------------------
-- 2. NEW-USER TRIGGER: create public.users row when someone signs up
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this script ran.
insert into public.users (id, username, display_name)
select id, split_part(email, '@', 1), split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- (The anon/publishable key ships inside the app, so RLS is what protects data.)
-- ---------------------------------------------------------------------
alter table public.users           enable row level security;
alter table public.tracks          enable row level security;
alter table public.listen_history  enable row level security;
alter table public.liked_tracks    enable row level security;
alter table public.playlists       enable row level security;
alter table public.playlist_tracks enable row level security;

-- users: you can read and edit only your own profile
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- tracks: any signed-in user can read; only admins can add, edit or delete (section 3b)
drop policy if exists "tracks_select_authenticated" on public.tracks;
create policy "tracks_select_authenticated" on public.tracks
  for select to authenticated using (true);

-- listen_history: strictly private to the user
drop policy if exists "listens_select_own" on public.listen_history;
create policy "listens_select_own" on public.listen_history
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "listens_insert_own" on public.listen_history;
create policy "listens_insert_own" on public.listen_history
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "listens_update_own" on public.listen_history;
create policy "listens_update_own" on public.listen_history
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "listens_delete_own" on public.listen_history;
create policy "listens_delete_own" on public.listen_history
  for delete to authenticated using (user_id = (select auth.uid()));

-- liked_tracks
drop policy if exists "likes_select_own" on public.liked_tracks;
create policy "likes_select_own" on public.liked_tracks
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "likes_insert_own" on public.liked_tracks;
create policy "likes_insert_own" on public.liked_tracks
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "likes_delete_own" on public.liked_tracks;
create policy "likes_delete_own" on public.liked_tracks
  for delete to authenticated using (user_id = (select auth.uid()));

-- playlists: owner has full control; public playlists are readable by everyone signed in
drop policy if exists "playlists_select" on public.playlists;
create policy "playlists_select" on public.playlists
  for select to authenticated using (owner_id = (select auth.uid()) or is_public);
drop policy if exists "playlists_insert_own" on public.playlists;
create policy "playlists_insert_own" on public.playlists
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "playlists_update_own" on public.playlists;
create policy "playlists_update_own" on public.playlists
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "playlists_delete_own" on public.playlists;
create policy "playlists_delete_own" on public.playlists
  for delete to authenticated using (owner_id = (select auth.uid()));

-- playlist_tracks: follows the parent playlist's ownership / visibility
drop policy if exists "playlist_tracks_select" on public.playlist_tracks;
create policy "playlist_tracks_select" on public.playlist_tracks
  for select to authenticated using (
    exists (select 1 from public.playlists p
            where p.id = playlist_id
              and (p.owner_id = (select auth.uid()) or p.is_public))
  );
drop policy if exists "playlist_tracks_write_own" on public.playlist_tracks;
create policy "playlist_tracks_write_own" on public.playlist_tracks
  for all to authenticated
  using (exists (select 1 from public.playlists p
                 where p.id = playlist_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.playlists p
                      where p.id = playlist_id and p.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- 3b. ADMINS
-- Who is an admin is decided here, on the server. The app only asks
-- "am I an admin?" and can never grant it to itself: this table has no
-- grants and no policies for the API, so the only way to add a row is the
-- SQL Editor (see make-admin.sql).
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admins manage the catalog: add, edit and delete songs.
drop policy if exists "tracks_insert_admin" on public.tracks;
create policy "tracks_insert_admin" on public.tracks
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "tracks_update_admin" on public.tracks;
create policy "tracks_update_admin" on public.tracks
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "tracks_delete_admin" on public.tracks;
create policy "tracks_delete_admin" on public.tracks
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 3c. ACCESS FOR THE APP (GRANTS)
-- Since 30 Oct 2026 Supabase no longer gives the API roles access to new
-- tables by itself, so it is granted here. Row Level Security above still
-- decides which rows each person can see or change. Signed-out visitors
-- (anon) get nothing.
-- ---------------------------------------------------------------------
revoke all on table public.users, public.tracks, public.listen_history,
                    public.liked_tracks, public.playlists, public.playlist_tracks
  from anon, authenticated;

grant select on public.users to authenticated;
grant update (username, display_name, avatar_url) on public.users to authenticated;
grant select, insert, update, delete on public.tracks          to authenticated; -- writes: admins only (3b)
grant select, insert, update, delete on public.listen_history  to authenticated;
grant select, insert, delete         on public.liked_tracks    to authenticated;
grant select, insert, update, delete on public.playlists       to authenticated;
grant select, insert, update, delete on public.playlist_tracks to authenticated;

-- For scripts that use the secret key (never put that key inside the app).
grant select, insert, update, delete on all tables in schema public to service_role;

-- ---------------------------------------------------------------------
-- 4. STORAGE BUCKETS (public-read; admins upload from the app or the dashboard)
-- For licensed commercial music, switch `audio` to private + signed URLs.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true), ('covers', 'covers', true)
on conflict (id) do update set public = excluded.public;

-- Admins can upload, replace and delete song files and covers from the app.
-- Everyone can still play and view them because the buckets are public-read.
drop policy if exists "files_select_admin" on storage.objects;
create policy "files_select_admin" on storage.objects
  for select to authenticated
  using (bucket_id in ('audio', 'covers') and (select public.is_admin()));
drop policy if exists "files_insert_admin" on storage.objects;
create policy "files_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('audio', 'covers') and (select public.is_admin()));
drop policy if exists "files_update_admin" on storage.objects;
create policy "files_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id in ('audio', 'covers') and (select public.is_admin()))
  with check (bucket_id in ('audio', 'covers') and (select public.is_admin()));
drop policy if exists "files_delete_admin" on storage.objects;
create policy "files_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id in ('audio', 'covers') and (select public.is_admin()));

-- ---------------------------------------------------------------------
-- 5. STATS FUNCTIONS (called from the app with supabase.rpc)
-- ---------------------------------------------------------------------

-- Weekly Rewind: the last 7 local calendar days (including today).
create or replace function public.weekly_rewind(
  p_end timestamptz default now(),
  p_tz  text        default 'UTC'
) returns jsonb
language sql
stable
set search_path = ''
as $$
  with win as (
    select (((p_end at time zone p_tz)::date - 6)::timestamp at time zone p_tz) as s,
           p_end as e
  ),
  base as (
    select h.track_id, h.seconds_listened, h.listened_at,
           t.title, t.artist, t.genre, t.cover_path
    from public.listen_history h
    join public.tracks t on t.id = h.track_id
    cross join win
    where h.user_id = (select auth.uid())
      and h.listened_at >= win.s
      and h.listened_at <  win.e
  ),
  top_tracks as (
    select track_id, title, artist, cover_path,
           count(*) as plays, sum(seconds_listened) as seconds
    from base
    group by track_id, title, artist, cover_path
    order by plays desc, seconds desc
    limit 5
  ),
  top_artists as (
    select artist, count(*) as plays, sum(seconds_listened) as seconds
    from base
    group by artist
    order by seconds desc
    limit 5
  ),
  top_genre as (
    select genre
    from base
    where genre is not null
    group by genre
    order by sum(seconds_listened) desc
    limit 1
  ),
  days as (
    select g::date as day
    from generate_series(
      ((p_end at time zone p_tz)::date - 6)::timestamp,
      ((p_end at time zone p_tz)::date)::timestamp,
      interval '1 day'
    ) g
  ),
  daily as (
    select d.day, coalesce(sum(b.seconds_listened), 0) as seconds
    from days d
    left join base b on (b.listened_at at time zone p_tz)::date = d.day
    group by d.day
  )
  select jsonb_build_object(
    'window_start', (select s from win),
    'window_end',   (select e from win),
    'total_seconds', coalesce((select sum(seconds_listened) from base), 0),
    'total_plays',   (select count(*) from base),
    'top_tracks',  coalesce((select jsonb_agg(to_jsonb(t) order by t.plays desc, t.seconds desc) from top_tracks t), '[]'::jsonb),
    'top_artists', coalesce((select jsonb_agg(to_jsonb(a) order by a.seconds desc) from top_artists a), '[]'::jsonb),
    'top_genre',   (select genre from top_genre),
    'daily',       coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'seconds', d.seconds) order by d.day) from daily d), '[]'::jsonb)
  );
$$;

-- Melomaniac Unwrapped: one calendar year in the user's time zone.
-- SECURITY DEFINER only so we can rank the user's top artist against all
-- listeners; everything else is filtered to auth.uid(). Returns aggregates only.
create or replace function public.yearly_unwrapped(
  p_year int  default (extract(year from now()))::int,
  p_tz   text default 'UTC'
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select make_timestamptz(p_year,     1, 1, 0, 0, 0, p_tz) as s,
           make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, p_tz) as e
  ),
  mine as (
    select h.track_id, h.seconds_listened, h.listened_at,
           t.title, t.artist, t.genre, t.cover_path
    from public.listen_history h
    join public.tracks t on t.id = h.track_id
    cross join bounds b
    where h.user_id = (select auth.uid())
      and h.listened_at >= b.s
      and h.listened_at <  b.e
  ),
  top_artists as (
    select artist, count(*) as plays, sum(seconds_listened) as seconds
    from mine group by artist order by seconds desc limit 5
  ),
  top_tracks as (
    select track_id, title, artist, cover_path,
           count(*) as plays, sum(seconds_listened) as seconds
    from mine
    group by track_id, title, artist, cover_path
    order by plays desc, seconds desc
    limit 5
  ),
  top_genres as (
    select genre, sum(seconds_listened) as seconds
    from mine where genre is not null
    group by genre order by seconds desc limit 5
  ),
  by_day as (
    select (listened_at at time zone p_tz)::date as day, sum(seconds_listened) as seconds
    from mine group by 1
  ),
  peak_day as (
    select day, seconds from by_day order by seconds desc, day limit 1
  ),
  hours as (
    select g as hr, coalesce(sum(m.seconds_listened), 0) as seconds
    from generate_series(0, 23) g
    left join mine m on extract(hour from (m.listened_at at time zone p_tz))::int = g
    group by g
  ),
  my_top as (
    select artist, sum(seconds_listened) as secs
    from mine group by artist order by secs desc limit 1
  ),
  everyone as (
    select h.user_id, sum(h.seconds_listened) as secs
    from public.listen_history h
    join public.tracks t on t.id = h.track_id
    join my_top mt on t.artist = mt.artist
    cross join bounds b
    where h.listened_at >= b.s and h.listened_at < b.e
    group by h.user_id
  ),
  artist_rank as (
    select mt.artist,
           1 + count(*) filter (where e.secs > mt.secs) as listener_rank,
           count(*) as listeners
    from my_top mt
    cross join everyone e
    group by mt.artist, mt.secs
  )
  select jsonb_build_object(
    'year',             p_year,
    'total_seconds',    coalesce((select sum(seconds_listened) from mine), 0),
    'total_plays',      (select count(*) from mine),
    'distinct_tracks',  (select count(distinct track_id) from mine),
    'distinct_artists', (select count(distinct artist) from mine),
    'active_days',      (select count(*) from by_day),
    'top_artists', coalesce((select jsonb_agg(to_jsonb(a) order by a.seconds desc) from top_artists a), '[]'::jsonb),
    'top_tracks',  coalesce((select jsonb_agg(to_jsonb(t) order by t.plays desc, t.seconds desc) from top_tracks t), '[]'::jsonb),
    'top_genres',  coalesce((select jsonb_agg(to_jsonb(g) order by g.seconds desc) from top_genres g), '[]'::jsonb),
    'top_artist_rank', (select jsonb_build_object('artist', artist, 'rank', listener_rank, 'listeners', listeners) from artist_rank),
    'peak_day',    (select jsonb_build_object('day', day, 'seconds', seconds) from peak_day),
    'hourly',      coalesce((select jsonb_agg(seconds order by hr) from hours), '[]'::jsonb)
  );
$$;

-- Top artists over the last N days (Library → Artists).
create or replace function public.top_artists(
  p_days  int default 90,
  p_limit int default 20
) returns table (artist text, plays bigint, seconds bigint)
language sql
stable
set search_path = ''
as $$
  select t.artist, count(*) as plays, sum(h.seconds_listened)::bigint as seconds
  from public.listen_history h
  join public.tracks t on t.id = h.track_id
  where h.user_id = (select auth.uid())
    and h.listened_at >= now() - make_interval(days => p_days)
  group by t.artist
  order by seconds desc
  limit p_limit;
$$;

-- Only signed-in users may call the stats functions.
revoke all on function public.weekly_rewind(timestamptz, text) from public, anon;
revoke all on function public.yearly_unwrapped(int, text)      from public, anon;
revoke all on function public.top_artists(int, int)            from public, anon;
grant execute on function public.weekly_rewind(timestamptz, text) to authenticated;
grant execute on function public.yearly_unwrapped(int, text)      to authenticated;
grant execute on function public.top_artists(int, int)            to authenticated;

-- ---------------------------------------------------------------------
-- 6. ADMIN FUNCTIONS (totals only: nobody's listening history is exposed)
-- Each one refuses anyone who is not in public.admins.
-- ---------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users',    (select count(*) from public.users),
    'tracks',   (select count(*) from public.tracks),
    'plays',    (select count(*) from public.listen_history),
    'seconds',  coalesce((select sum(seconds_listened) from public.listen_history), 0),
    'plays_7d', (select count(*) from public.listen_history where listened_at >= now() - interval '7 days'),
    'top_tracks', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', x.id, 'title', x.title, 'artist', x.artist, 'plays', x.plays)
               order by x.plays desc)
      from (
        select t.id, t.title, t.artist, count(*) as plays
        from public.listen_history h
        join public.tracks t on t.id = h.track_id
        group by t.id, t.title, t.artist
        order by plays desc
        limit 5
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_listeners(p_limit int default 100)
returns table (user_id uuid, name text, joined_at timestamptz, plays bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select u.id, coalesce(u.display_name, u.username, 'listener'), u.created_at, count(h.id)
    from public.users u
    left join public.listen_history h on h.user_id = u.id
    group by u.id, u.display_name, u.username, u.created_at
    order by u.created_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

revoke all on function public.admin_overview()        from public, anon;
revoke all on function public.admin_listeners(int)    from public, anon;
grant execute on function public.admin_overview()     to authenticated;
grant execute on function public.admin_listeners(int) to authenticated;
