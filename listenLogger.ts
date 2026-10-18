import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

/**
 * Listen tracking
 * ---------------
 * A "listen" is logged to Supabase once a track has been *actually played* for
 * more than 30 seconds. We measure real playback time, not the playhead
 * position, so scrubbing forward cannot fake a listen and seeking back does not
 * double count. Flow:
 *
 *   onTick (every status update, ~4x/second)
 *     └─ accumulate played seconds while playing
 *     └─ at >= 30s: INSERT a row  (so a listen survives the app being killed)
 *   track changes / ends / finishes
 *     └─ UPDATE that row with the final seconds + completed flag
 *   network failure
 *     └─ the listen is queued in AsyncStorage and flushed on next launch/foreground
 */

export const LISTEN_THRESHOLD_SEC = 30;
const MAX_TICK_SEC = 10; // ignore absurd jumps (e.g. JS was suspended for a minute)
const COMPLETED_RATIO = 0.9; // listened to >= 90% of the track counts as completed
const QUEUE_KEY = 'melomaniac:pending-listens:v1';

interface PendingListen {
  user_id: string | null;
  track_id: string;
  listened_at: string;
  seconds_listened: number;
  completed: boolean;
  source: string | null;
}

interface Session {
  trackId: string;
  source: string | null;
  startedAt: string;
  durationSec: number;
  accumulated: number;
  rowId: number | null;
  lastSyncedSeconds: number;
  insertPromise: Promise<void> | null;
}

export interface TickInput {
  trackId: string | null;
  source: string | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  didJustFinish: boolean;
}

class ListenTracker {
  private session: Session | null = null;
  private lastWall = 0;
  private lastPosition = 0;
  private wasPlaying = false;

  onTick(t: TickInput) {
    const now = Date.now();

    if (!t.trackId) {
      this.finalize(false);
      return;
    }
    if (this.session && this.session.trackId !== t.trackId) this.finalize(false);
    if (!this.session) this.begin(t, now);

    const s = this.session as Session;
    if (t.durationSec > 0) s.durationSec = t.durationSec;

    const justPaused = this.wasPlaying && !t.playing;

    if (this.wasPlaying && t.playing) {
      const wallDelta = (now - this.lastWall) / 1000;
      const mediaDelta = t.positionSec - this.lastPosition;
      // Take the smallest of: wall-clock time, playhead movement, hard cap.
      // A forward seek moves the playhead a lot but not the wall clock; a
      // backward seek gives a negative delta. Both are correctly ignored.
      if (mediaDelta > 0) s.accumulated += Math.min(wallDelta, mediaDelta, MAX_TICK_SEC);
    }

    this.lastWall = now;
    this.lastPosition = t.positionSec;
    this.wasPlaying = t.playing;

    if (s.rowId === null && s.insertPromise === null && s.accumulated >= LISTEN_THRESHOLD_SEC) {
      s.insertPromise = this.insert(s);
    }
    if (justPaused) void this.sync(s);
    if (t.didJustFinish) this.finalize(true);
  }

  /** Close the current listen (track changed, finished, or queue cleared). */
  finalize(completed: boolean) {
    const s = this.session;
    this.session = null;
    this.wasPlaying = false;
    if (!s || s.accumulated < LISTEN_THRESHOLD_SEC) return; // < 30s: not a listen
    void this.persistFinal(s, completed);
  }

  private begin(t: TickInput, now: number) {
    this.session = {
      trackId: t.trackId as string,
      source: t.source,
      startedAt: new Date(now).toISOString(),
      durationSec: t.durationSec,
      accumulated: 0,
      rowId: null,
      lastSyncedSeconds: 0,
      insertPromise: null,
    };
    this.lastWall = now;
    this.lastPosition = t.positionSec;
    this.wasPlaying = t.playing;
  }

  private async insert(s: Session): Promise<void> {
    const seconds = Math.max(LISTEN_THRESHOLD_SEC, Math.round(s.accumulated));
    const { data, error } = await supabase
      .from('listen_history')
      .insert({
        track_id: s.trackId,
        listened_at: s.startedAt,
        seconds_listened: seconds,
        completed: false,
        source: s.source,
      })
      .select('id')
      .single();
    if (!error && data) {
      s.rowId = data.id as number;
      s.lastSyncedSeconds = seconds;
    }
  }

  /** Cheap top-up on pause so partial listens are saved even if the app is killed later. */
  private async sync(s: Session) {
    if (s.insertPromise) await s.insertPromise;
    const seconds = Math.round(s.accumulated);
    if (s.rowId === null || seconds - s.lastSyncedSeconds < 5) return;
    const { error } = await supabase
      .from('listen_history')
      .update({ seconds_listened: seconds })
      .eq('id', s.rowId);
    if (!error) s.lastSyncedSeconds = seconds;
  }

  private async persistFinal(s: Session, completedByEvent: boolean) {
    if (s.insertPromise) await s.insertPromise;
    const seconds = Math.round(s.accumulated);
    const completed =
      completedByEvent || (s.durationSec > 0 && s.accumulated / s.durationSec >= COMPLETED_RATIO);

    if (s.rowId !== null) {
      // Best effort: the row already exists with >= 30s, so a failure only loses the top-up.
      await supabase
        .from('listen_history')
        .update({ seconds_listened: seconds, completed })
        .eq('id', s.rowId);
      return;
    }

    // The 30s insert never succeeded (offline?). Queue the whole listen for later.
    const { data } = await supabase.auth.getSession();
    await enqueue({
      user_id: data.session?.user.id ?? null,
      track_id: s.trackId,
      listened_at: s.startedAt,
      seconds_listened: Math.max(LISTEN_THRESHOLD_SEC, seconds),
      completed,
      source: s.source,
    });
    void flushPendingListens();
  }
}

export const listenTracker = new ListenTracker();

// ---------------------------------------------------------------------------
// Offline queue
// ---------------------------------------------------------------------------

async function readQueue(): Promise<PendingListen[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingListen[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingListen[]) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-500)));
  } catch {
    // storage full / unavailable: drop silently, stats are best-effort
  }
}

async function enqueue(item: PendingListen) {
  await writeQueue([...(await readQueue()), item]);
}

let flushing = false;

/** Call on app start and whenever the app returns to the foreground. */
export async function flushPendingListens() {
  if (flushing) return;
  flushing = true;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    const queue = await readQueue();
    const mine = queue.filter((q) => q.user_id === userId || q.user_id === null);
    if (mine.length === 0) return;

    const { error } = await supabase
      .from('listen_history')
      .insert(mine.map((q) => ({ ...q, user_id: userId })));
    if (!error) await writeQueue(queue.filter((q) => !mine.includes(q)));
  } finally {
    flushing = false;
  }
}
