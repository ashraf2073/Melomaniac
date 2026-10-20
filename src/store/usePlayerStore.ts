import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { audioEngine, type EngineStatus } from '../services/audioEngine';
import { flushPendingListens, listenTracker } from '../services/listenLogger';
import type { RepeatMode, Track } from '../types';

/**
 * Global playback state.
 *
 * Zustand owns the queue (what the UI shows); `audioEngine` mirrors it into the
 * native playlist and reports status back through `handleEngineStatus` below.
 * Components should subscribe with selectors so the 4x-per-second position
 * updates only re-render what actually shows the position:
 *
 *   const isPlaying = usePlayerStore((s) => s.isPlaying);
 */

interface PlayerState {
  // ---- queue -----------------------------------------------------------
  queue: Track[]; // current play order (shuffled when shuffle is on)
  originalQueue: Track[]; // order before shuffle, used to restore on un-shuffle
  currentIndex: number; // -1 when nothing is loaded
  currentTrack: Track | null;
  playbackSource: string | null; // 'home' | 'search' | ... for listen analytics

  // ---- transport -------------------------------------------------------
  isPlaying: boolean;
  isBuffering: boolean;
  positionSec: number;
  durationSec: number;

  // ---- settings (persisted) ---------------------------------------------
  volume: number; // 0..1
  shuffle: boolean;
  repeat: RepeatMode;

  // ---- UI --------------------------------------------------------------
  isPlayerExpanded: boolean;
  setPlayerExpanded: (expanded: boolean) => void;

  // ---- actions ---------------------------------------------------------
  /** Play `track`. If `context` contains it, the whole context becomes the queue. */
  playTrack: (track: Track, context?: Track[], source?: string) => void;
  playQueue: (tracks: Track[], startIndex?: number, source?: string) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  skipToIndex: (index: number) => void;
  stopAndClear: () => void;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function shuffled<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// While a new queue loads natively, status events can briefly report the wrong
// index. We ignore them until the engine confirms the index we asked for.
let awaitingIndex: number | null = null;
let awaitingDeadline = 0;
const awaitIndex = (index: number) => {
  awaitingIndex = index;
  awaitingDeadline = Date.now() + 2000;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      originalQueue: [],
      currentIndex: -1,
      currentTrack: null,
      playbackSource: null,

      isPlaying: false,
      isBuffering: false,
      positionSec: 0,
      durationSec: 0,

      volume: 1,
      shuffle: false,
      repeat: 'off',

      isPlayerExpanded: false,
      setPlayerExpanded: (expanded) => set({ isPlayerExpanded: expanded }),

      playTrack: (track, context, source) => {
        const list = context && context.some((t) => t.id === track.id) ? context : [track];
        get().playQueue(list, list.findIndex((t) => t.id === track.id), source);
      },

      playQueue: (tracks, startIndex = 0, source) => {
        if (tracks.length === 0) return;
        const { shuffle, repeat, volume } = get();
        const start = clamp(startIndex, 0, tracks.length - 1);

        let order = tracks;
        let index = start;
        if (shuffle) {
          order = [tracks[start], ...shuffled(tracks.filter((_, i) => i !== start))];
          index = 0;
        }

        listenTracker.finalize(false); // close the previous listen before switching
        set({
          queue: order,
          originalQueue: tracks,
          currentIndex: index,
          currentTrack: order[index],
          playbackSource: source ?? null,
          isPlaying: true,
          isBuffering: true,
          positionSec: 0,
          durationSec: order[index].durationSec,
        });
        awaitIndex(index);
        void audioEngine.loadQueue(order, index, { repeat, volume, autoplay: true });
      },

      play: () => {
        set({ isPlaying: true });
        audioEngine.play();
      },
      pause: () => {
        set({ isPlaying: false });
        audioEngine.pause();
      },
      togglePlay: () => (get().isPlaying ? get().pause() : get().play()),

      next: () => audioEngine.next(),
      previous: () => {
        // Spotify behaviour: after 3s, "previous" restarts the track instead of going back.
        if (get().positionSec > 3) get().seekTo(0);
        else audioEngine.previous();
      },

      seekTo: (seconds) => {
        set({ positionSec: seconds });
        void audioEngine.seekTo(seconds);
      },

      setVolume: (volume) => {
        const v = clamp(volume, 0, 1);
        set({ volume: v });
        audioEngine.setVolume(v);
      },

      toggleShuffle: () => {
        const { shuffle, queue, originalQueue, currentIndex } = get();
        if (queue.length === 0 || currentIndex < 0) {
          set({ shuffle: !shuffle });
          return;
        }
        // Keep everything up to and including the current track; only reorder what's next.
        const head = queue.slice(0, currentIndex + 1);
        const tail = queue.slice(currentIndex + 1);
        let newTail: Track[];
        if (!shuffle) {
          newTail = shuffled(tail);
          set({ originalQueue: queue });
        } else {
          const remaining = new Set(tail.map((t) => t.id));
          const restored = originalQueue.filter((t) => remaining.has(t.id));
          newTail = restored.length === tail.length ? restored : tail;
        }
        set({ shuffle: !shuffle, queue: [...head, ...newTail] });
        audioEngine.replaceTail(currentIndex, newTail);
      },

      cycleRepeat: () => {
        const order: RepeatMode[] = ['off', 'all', 'one'];
        const nextMode = order[(order.indexOf(get().repeat) + 1) % order.length];
        set({ repeat: nextMode });
        audioEngine.setRepeat(nextMode);
      },

      addToQueue: (track) => {
        const { queue, originalQueue } = get();
        if (queue.length === 0) {
          get().playQueue([track], 0, 'queue');
          return;
        }
        set({ queue: [...queue, track], originalQueue: [...originalQueue, track] });
        audioEngine.addTrack(track);
      },

      playNext: (track) => {
        const { queue, originalQueue, currentIndex } = get();
        if (queue.length === 0) {
          get().playQueue([track], 0, 'queue');
          return;
        }
        const at = currentIndex + 1;
        set({
          queue: [...queue.slice(0, at), track, ...queue.slice(at)],
          originalQueue: [...originalQueue, track],
        });
        audioEngine.insertTrack(track, at);
      },

      removeFromQueue: (index) => {
        const { queue, originalQueue, currentIndex } = get();
        if (index < 0 || index >= queue.length || index === currentIndex) return;
        const removed = queue[index];
        const origAt = originalQueue.findIndex((t) => t.id === removed.id);
        set({
          queue: queue.filter((_, i) => i !== index),
          originalQueue: originalQueue.filter((_, i) => i !== origAt),
          currentIndex: index < currentIndex ? currentIndex - 1 : currentIndex,
        });
        audioEngine.removeAt(index);
      },

      skipToIndex: (index) => {
        const { queue } = get();
        if (index < 0 || index >= queue.length) return;
        awaitIndex(index);
        set({ currentIndex: index, currentTrack: queue[index], positionSec: 0, isPlaying: true });
        audioEngine.skipTo(index);
        audioEngine.play();
      },

      stopAndClear: () => {
        listenTracker.finalize(false);
        audioEngine.stop();
        set({
          queue: [],
          originalQueue: [],
          currentIndex: -1,
          currentTrack: null,
          isPlaying: false,
          isBuffering: false,
          positionSec: 0,
          durationSec: 0,
          isPlayerExpanded: false,
        });
      },
    }),
    {
      name: 'melomaniac-player',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only user settings. The queue is rebuilt from the catalog on demand.
      partialize: (s) => ({ volume: s.volume, shuffle: s.shuffle, repeat: s.repeat }),
    },
  ),
);

/** Native engine → store. Runs ~4x per second while audio is playing. */
function handleEngineStatus(s: EngineStatus) {
  const state = usePlayerStore.getState();
  const { queue } = state;
  // Queue is being rebuilt (shuffle / load): the counts disagree for a moment.
  if (queue.length === 0 || s.trackCount !== queue.length) return;

  if (awaitingIndex !== null) {
    if (s.currentIndex === awaitingIndex || Date.now() > awaitingDeadline) awaitingIndex = null;
    else return;
  }

  const index = clamp(s.currentIndex, 0, queue.length - 1);
  const track = queue[index];
  const changed = track.id !== state.currentTrack?.id || index !== state.currentIndex;
  const duration = s.durationSec > 0 ? s.durationSec : track.durationSec;

  usePlayerStore.setState({
    currentIndex: index,
    currentTrack: track,
    isPlaying: s.playing,
    isBuffering: s.isBuffering,
    positionSec: s.positionSec,
    durationSec: duration,
  });

  if (changed) audioEngine.updateLockScreen(track);

  listenTracker.onTick({
    trackId: track.id,
    source: state.playbackSource,
    playing: s.playing,
    positionSec: s.positionSec,
    durationSec: duration,
    didJustFinish: s.didJustFinish,
  });
}

let initialized = false;

/** Call once on app start (after sign-in is fine too). Safe to call repeatedly. */
export async function initializePlayer() {
  if (initialized) return;
  initialized = true;
  audioEngine.setStatusListener(handleEngineStatus);
  await audioEngine.configure();
  audioEngine.setVolume(usePlayerStore.getState().volume);

  void flushPendingListens();
  AppState.addEventListener('change', (appState) => {
    if (appState === 'active') void flushPendingListens();
  });
}
