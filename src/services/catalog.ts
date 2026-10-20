import { supabase } from '../lib/supabase';
import type { Playlist, Track } from '../types';

interface TrackRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration_seconds: number;
  audio_path: string;
  cover_path: string | null;
  lyrics: string | null;
}

const COLUMNS = 'id,title,artist,album,genre,duration_seconds,audio_path,cover_path,lyrics';

/** Storage path -> public URL. Full http(s) URLs pass through untouched. */
function resolveUrl(bucket: 'audio' | 'covers', path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const coverUrlFromPath = (path: string | null): string | null =>
  path ? resolveUrl('covers', path) : null;

export function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    durationSec: row.duration_seconds,
    audioUrl: resolveUrl('audio', row.audio_path),
    coverUrl: coverUrlFromPath(row.cover_path),
    lyrics: row.lyrics,
  };
}

/** PostgREST embeds a to-one relation as an object, but be tolerant of arrays. */
const firstOf = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export async function fetchLatestTracks(limit = 40): Promise<Track[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as TrackRow[]).map(mapTrack);
}

/** Characters with special meaning inside a PostgREST filter string. */
const sanitize = (q: string) => q.replace(/[%*,()\\]/g, ' ').trim();

export async function searchTracks(query: string, genre: string | null = null): Promise<Track[]> {
  const q = sanitize(query);
  let request = supabase.from('tracks').select(COLUMNS);
  if (q) request = request.or(`title.ilike.*${q}*,artist.ilike.*${q}*,album.ilike.*${q}*`);
  if (genre) request = request.eq('genre', genre);
  const { data, error } = await request.order('title').limit(50);
  if (error) throw error;
  return (data as TrackRow[]).map(mapTrack);
}

export async function fetchGenres(): Promise<string[]> {
  const { data, error } = await supabase.from('tracks').select('genre').not('genre', 'is', null);
  if (error) throw error;
  const unique = new Set((data as { genre: string }[]).map((r) => r.genre));
  return [...unique].sort();
}

interface HistoryRow {
  tracks: TrackRow | TrackRow[] | null;
}

/** Most recently played distinct tracks. */
export async function fetchRecentlyPlayed(limit = 12): Promise<Track[]> {
  const { data, error } = await supabase
    .from('listen_history')
    .select(`listened_at, tracks (${COLUMNS})`)
    .order('listened_at', { ascending: false })
    .limit(80);
  if (error) throw error;

  const seen = new Set<string>();
  const out: Track[] = [];
  for (const row of (data ?? []) as unknown as HistoryRow[]) {
    const t = firstOf(row.tracks);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(mapTrack(t));
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Lightweight "made for you": tracks from the genres you play most, that you
 * haven't played recently. Falls back to the newest tracks for new accounts.
 */
export async function fetchRecommendations(recent: Track[], limit = 10): Promise<Track[]> {
  const counts = new Map<string, number>();
  for (const t of recent) if (t.genre) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
  const topGenres = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);

  const recentIds = new Set(recent.map((t) => t.id));
  let pool: Track[] = [];
  if (topGenres.length > 0) {
    const { data, error } = await supabase
      .from('tracks')
      .select(COLUMNS)
      .in('genre', topGenres)
      .limit(60);
    if (error) throw error;
    pool = (data as TrackRow[]).map(mapTrack).filter((t) => !recentIds.has(t.id));
  }
  if (pool.length < limit) {
    const latest = await fetchLatestTracks(40);
    const have = new Set(pool.map((t) => t.id));
    pool = [...pool, ...latest.filter((t) => !have.has(t.id) && !recentIds.has(t.id))];
  }
  return pool.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

export async function fetchLikedTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from('liked_tracks')
    .select(`created_at, tracks (${COLUMNS})`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const out: Track[] = [];
  for (const row of (data ?? []) as unknown as HistoryRow[]) {
    const t = firstOf(row.tracks);
    if (t) out.push(mapTrack(t));
  }
  return out;
}

export async function fetchLikedIds(): Promise<string[]> {
  const { data, error } = await supabase.from('liked_tracks').select('track_id');
  if (error) throw error;
  return (data as { track_id: string }[]).map((r) => r.track_id);
}

export async function setLiked(trackId: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase.from('liked_tracks').upsert({ track_id: trackId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('liked_tracks').delete().eq('track_id', trackId);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

interface PlaylistRow {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  playlist_tracks: { count: number }[] | null;
}

export async function fetchPlaylists(): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('id,name,description,is_public,playlist_tracks(count)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as PlaylistRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isPublic: p.is_public,
    trackCount: p.playlist_tracks?.[0]?.count ?? 0,
  }));
}

export async function createPlaylist(name: string): Promise<void> {
  const { error } = await supabase.from('playlists').insert({ name: name.trim() });
  if (error) throw error;
}

export async function fetchPlaylistTracks(playlistId: string): Promise<Track[]> {
  const { data, error } = await supabase
    .from('playlist_tracks')
    .select(`position, tracks (${COLUMNS})`)
    .eq('playlist_id', playlistId)
    .order('position');
  if (error) throw error;
  const out: Track[] = [];
  for (const row of (data ?? []) as unknown as HistoryRow[]) {
    const t = firstOf(row.tracks);
    if (t) out.push(mapTrack(t));
  }
  return out;
}

export async function addToPlaylist(playlistId: string, trackId: string): Promise<void> {
  const { count } = await supabase
    .from('playlist_tracks')
    .select('track_id', { count: 'exact', head: true })
    .eq('playlist_id', playlistId);
  const { error } = await supabase
    .from('playlist_tracks')
    .upsert({ playlist_id: playlistId, track_id: trackId, position: count ?? 0 });
  if (error) throw error;
}
