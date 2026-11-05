import { createAudioPlayer } from 'expo-audio';
import { File as ExpoFile } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { coverUrlFromPath } from './catalog';

/**
 * Everything an admin can do. The database is the gatekeeper: each call below is
 * refused by Row Level Security (or by the admin_* functions) unless the signed-in
 * account is in the `admins` table, whatever this app shows on screen.
 */

/** Supabase's free plan accepts files up to 50 MB. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface AdminOverview {
  users: number;
  tracks: number;
  plays: number;
  seconds: number;
  plays_7d: number;
  top_tracks: { id: string; title: string; artist: string; plays: number }[];
}

export interface AdminListener {
  user_id: string;
  name: string;
  joined_at: string;
  plays: number;
}

export interface AdminTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  durationSec: number;
  lyrics: string | null;
  audioPath: string;
  coverPath: string | null;
  coverUrl: string | null;
  createdAt: string;
}

/** The text fields of a song, as typed in the editor. */
export interface SongFields {
  title: string;
  artist: string;
  album: string;
  genre: string;
  lyrics: string;
  durationSec: number;
}

export interface PickedFile {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string | null;
}

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
  created_at: string;
}

const COLUMNS = 'id,title,artist,album,genre,duration_seconds,audio_path,cover_path,lyrics,created_at';

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw error;
  return data as AdminOverview;
}

export async function fetchAdminListeners(limit = 100): Promise<AdminListener[]> {
  const { data, error } = await supabase.rpc('admin_listeners', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as AdminListener[]).map((row) => ({ ...row, plays: Number(row.plays) }));
}

export async function fetchAdminTracks(): Promise<AdminTrack[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as TrackRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    durationSec: row.duration_seconds,
    lyrics: row.lyrics,
    audioPath: row.audio_path,
    coverPath: row.cover_path,
    coverUrl: coverUrlFromPath(row.cover_path),
    createdAt: row.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
};
const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const isUrl = (path: string) => /^https?:\/\//i.test(path);

function extensionOf(name: string, fallback: string): string {
  const match = /\.([a-z0-9]{2,5})$/i.exec(name);
  return (match ? match[1] : fallback).toLowerCase();
}

function slug(text: string): string {
  let plain = text.toLowerCase();
  try {
    plain = plain.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  } catch {
    // normalize() is optional: unaccented text is fine without it
  }
  return plain.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'track';
}

/** A storage file name that is URL-safe and cannot clash with an earlier upload. */
function storageKey(artist: string, title: string, extension: string): string {
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${slug(artist)}-${slug(title)}-${unique}.${extension}`;
}

async function putFile(
  bucket: 'audio' | 'covers',
  path: string,
  file: PickedFile,
  types: Record<string, string>,
  fallbackType: string,
): Promise<void> {
  const bytes = await new ExpoFile(file.uri).arrayBuffer();
  const declared = file.mimeType && file.mimeType !== 'application/octet-stream' ? file.mimeType : null;
  const contentType = declared ?? types[extensionOf(file.name, '')] ?? fallbackType;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType, cacheControl: '31536000', upsert: false });
  if (error) throw error;
}

async function removeStored(bucket: 'audio' | 'covers', path: string | null): Promise<void> {
  if (!path || isUrl(path)) return; // links to files elsewhere are not ours to delete
  await supabase.storage.from(bucket).remove([path]);
}

/**
 * Loads the file in a silent player just long enough to read its length.
 * Returns 0 when it cannot be read, in which case the editor lets you type it.
 */
export async function detectDurationSeconds(uri: string, timeoutMs = 8000): Promise<number> {
  let player: ReturnType<typeof createAudioPlayer> | null = null;
  try {
    player = createAudioPlayer({ uri });
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (player.isLoaded && player.duration > 0) return Math.round(player.duration);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return 0;
  } catch {
    return 0;
  } finally {
    try {
      player?.remove();
    } catch {
      // already released
    }
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const orNull = (text: string) => (text.trim() ? text.trim() : null);

/** Uploads the audio (and cover), then adds the song. Files are removed again if saving fails. */
export async function uploadTrack(
  fields: SongFields,
  audio: PickedFile,
  cover: PickedFile | null,
  onStep: (step: string) => void,
): Promise<void> {
  const uploaded: { bucket: 'audio' | 'covers'; path: string }[] = [];
  try {
    onStep('Uploading the song...');
    const audioPath = storageKey(fields.artist, fields.title, extensionOf(audio.name, 'mp3'));
    await putFile('audio', audioPath, audio, AUDIO_TYPES, 'audio/mpeg');
    uploaded.push({ bucket: 'audio', path: audioPath });

    let coverPath: string | null = null;
    if (cover) {
      onStep('Uploading the cover...');
      coverPath = storageKey(fields.artist, fields.title, extensionOf(cover.name, 'jpg'));
      await putFile('covers', coverPath, cover, IMAGE_TYPES, 'image/jpeg');
      uploaded.push({ bucket: 'covers', path: coverPath });
    }

    onStep('Saving...');
    const { error } = await supabase.from('tracks').insert({
      title: fields.title.trim(),
      artist: fields.artist.trim(),
      album: orNull(fields.album),
      genre: orNull(fields.genre),
      duration_seconds: fields.durationSec,
      audio_path: audioPath,
      cover_path: coverPath,
      lyrics: orNull(fields.lyrics),
    });
    if (error) throw error;
  } catch (e) {
    await Promise.allSettled(uploaded.map((f) => supabase.storage.from(f.bucket).remove([f.path])));
    throw e;
  }
}

export async function updateTrack(id: string, fields: SongFields): Promise<void> {
  const { data, error } = await supabase
    .from('tracks')
    .update({
      title: fields.title.trim(),
      artist: fields.artist.trim(),
      album: orNull(fields.album),
      genre: orNull(fields.genre),
      duration_seconds: fields.durationSec,
      lyrics: orNull(fields.lyrics),
    })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  // Row Level Security hides a refused update by changing zero rows rather than raising an error.
  if (!data || data.length === 0) throw new Error('Only admins can do that.');
}

export async function deleteTrack(track: AdminTrack): Promise<void> {
  const { data, error } = await supabase.from('tracks').delete().eq('id', track.id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Only admins can do that.');
  // Best effort: the song is already gone, a leftover file only wastes space.
  await Promise.allSettled([removeStored('audio', track.audioPath), removeStored('covers', track.coverPath)]);
}
