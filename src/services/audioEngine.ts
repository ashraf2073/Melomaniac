import { Platform } from 'react-native';
import {
  createAudioPlaylist,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  type AudioLockScreenOptions,
  type AudioMetadata,
  type AudioPlaylist,
  type AudioPlaylistLoopMode,
  type AudioPlaylistStatus,
  type AudioSource,
} from 'expo-audio';
import type { RepeatMode, Track } from '../types';

/**
 * Thin wrapper around expo-audio's native AudioPlaylist.
 *
 * Why a *playlist* and not a single AudioPlayer? The native playlist owns the
 * media session, so the lock-screen / notification / Bluetooth "next" and
 * "previous" buttons work even when JavaScript is throttled in the background.
 * Zustand (usePlayerStore) stays the source of truth for the UI; this class only
 * mirrors the queue natively and reports status back.
 */

export interface EngineStatus {
  playing: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
  positionSec: number;
  durationSec: number;
  currentIndex: number;
  trackCount: number;
  didJustFinish: boolean;
}

type StatusListener = (status: EngineStatus) => void;

const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showNextTrack: true,
  showPreviousTrack: true,
  showSeekBackward: false,
  showSeekForward: false,
};

const LOOP_MODE: Record<RepeatMode, AudioPlaylistLoopMode> = {
  off: 'none',
  all: 'all',
  one: 'single',
};

const toSource = (track: Track): AudioSource => ({ uri: track.audioUrl, name: track.title });

const toMetadata = (track: Track): AudioMetadata => ({
  title: track.title,
  artist: track.artist,
  albumTitle: track.album ?? undefined,
  artworkUrl: track.coverUrl ?? undefined,
});

const toEngineStatus = (s: AudioPlaylistStatus): EngineStatus => ({
  playing: s.playing,
  isBuffering: s.isBuffering,
  isLoaded: s.isLoaded,
  positionSec: s.currentTime,
  durationSec: s.duration,
  currentIndex: s.currentIndex,
  trackCount: s.trackCount,
  didJustFinish: s.didJustFinish,
});

class AudioEngine {
  private playlist: AudioPlaylist | null = null;
  private ready: Promise<AudioPlaylist> | null = null;
  private onStatus: StatusListener | null = null;
  private askedForNotifications = false;

  setStatusListener(listener: StatusListener) {
    this.onStatus = listener;
  }

  /** Idempotent. Configures the audio session and creates the native playlist once. */
  configure(): Promise<AudioPlaylist> {
    if (!this.ready) {
      this.ready = (async () => {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          // Required for lock-screen controls to attach to this player.
          interruptionMode: 'doNotMix',
        });
        const playlist = createAudioPlaylist({ loop: 'none', updateInterval: 250 });
        playlist.addListener('playlistStatusUpdate', (status) => {
          this.onStatus?.(toEngineStatus(status));
        });
        this.playlist = playlist;
        return playlist;
      })();
    }
    return this.ready;
  }

  /** Android 13+ needs POST_NOTIFICATIONS for the media notification to show. */
  private async askForNotificationsOnce() {
    if (Platform.OS !== 'android' || this.askedForNotifications) return;
    this.askedForNotifications = true;
    try {
      await requestNotificationPermissionsAsync();
    } catch {
      // Not fatal: playback still works, only the notification would be hidden.
    }
  }

  /** Replace the whole native queue, jump to startIndex and (optionally) start playing. */
  async loadQueue(
    tracks: Track[],
    startIndex: number,
    opts: { repeat: RepeatMode; volume: number; autoplay?: boolean },
  ) {
    const playlist = await this.configure();
    playlist.clear();
    for (const track of tracks) playlist.add(toSource(track));
    playlist.loop = LOOP_MODE[opts.repeat];
    playlist.volume = opts.volume;
    if (startIndex > 0) playlist.skipTo(startIndex);
    const current = tracks[startIndex];
    if (current) playlist.setActiveForLockScreen(true, toMetadata(current), LOCK_SCREEN_OPTIONS);
    if (opts.autoplay ?? true) {
      playlist.play();
      void this.askForNotificationsOnce();
    }
  }

  updateLockScreen(track: Track) {
    this.playlist?.updateLockScreenMetadata(toMetadata(track));
  }

  play() {
    this.playlist?.play();
  }
  pause() {
    this.playlist?.pause();
  }
  next() {
    this.playlist?.next();
  }
  previous() {
    this.playlist?.previous();
  }
  skipTo(index: number) {
    this.playlist?.skipTo(index);
  }
  async seekTo(seconds: number) {
    await this.playlist?.seekTo(Math.max(0, seconds));
  }
  setVolume(volume: number) {
    if (this.playlist) this.playlist.volume = Math.min(1, Math.max(0, volume));
  }
  setRepeat(mode: RepeatMode) {
    if (this.playlist) this.playlist.loop = LOOP_MODE[mode];
  }

  addTrack(track: Track) {
    this.playlist?.add(toSource(track));
  }
  insertTrack(track: Track, index: number) {
    this.playlist?.insert(toSource(track), index);
  }
  removeAt(index: number) {
    this.playlist?.remove(index);
  }

  /**
   * Replace everything after `afterIndex` (used by shuffle) without touching the
   * track that is currently playing, so there is no gap or restart.
   */
  replaceTail(afterIndex: number, tail: Track[]) {
    const playlist = this.playlist;
    if (!playlist) return;
    for (let i = playlist.trackCount - 1; i > afterIndex; i--) playlist.remove(i);
    for (const track of tail) playlist.add(toSource(track));
  }

  stop() {
    const playlist = this.playlist;
    if (!playlist) return;
    playlist.pause();
    playlist.clear();
    playlist.clearLockScreenControls();
  }
}

export const audioEngine = new AudioEngine();
