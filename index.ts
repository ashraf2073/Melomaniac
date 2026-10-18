export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  durationSec: number;
  audioUrl: string;
  coverUrl: string | null;
  /** Plain text, or LRC ("[mm:ss.xx]line") for synced lyrics. */
  lyrics: string | null;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  trackCount: number;
}

export interface RankedTrack {
  track_id: string;
  title: string;
  artist: string;
  cover_path: string | null;
  plays: number;
  seconds: number;
}

export interface RankedArtist {
  artist: string;
  plays: number;
  seconds: number;
}

export interface WeeklyRewindData {
  window_start: string;
  window_end: string;
  total_seconds: number;
  total_plays: number;
  top_tracks: RankedTrack[];
  top_artists: RankedArtist[];
  top_genre: string | null;
  /** One entry per local calendar day, oldest first. */
  daily: { day: string; seconds: number }[];
}

export interface UnwrappedData {
  year: number;
  total_seconds: number;
  total_plays: number;
  distinct_tracks: number;
  distinct_artists: number;
  active_days: number;
  top_artists: RankedArtist[];
  top_tracks: RankedTrack[];
  top_genres: { genre: string; seconds: number }[];
  top_artist_rank: { artist: string; rank: number; listeners: number } | null;
  peak_day: { day: string; seconds: number } | null;
  /** 24 numbers: seconds listened in each local hour of the day. */
  hourly: number[];
}
