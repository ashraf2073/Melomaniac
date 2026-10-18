/** 215 -> "3:35" */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** 15120 -> "4h 12m", 1800 -> "30m" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const toMinutes = (seconds: number) => Math.round((seconds || 0) / 60);
export const toHours = (seconds: number) => Math.round(((seconds || 0) / 3600) * 10) / 10;

export interface LyricLine {
  /** Seconds from the start of the track, or null for unsynced lyrics. */
  time: number | null;
  text: string;
}

/**
 * Accepts plain text or LRC ("[01:23.45]line"). Metadata tags like [ar:Artist]
 * are dropped. `synced` is true when at least one line carries a timestamp.
 */
export function parseLyrics(raw: string | null): { synced: boolean; lines: LyricLine[] } {
  if (!raw) return { synced: false, lines: [] };
  const lines: LyricLine[] = [];
  let synced = false;

  for (const line of raw.split(/\r?\n/)) {
    const timed = line.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$/);
    if (timed) {
      synced = true;
      const fraction = timed[3] ? Number(timed[3].padEnd(3, '0')) / 1000 : 0;
      lines.push({ time: Number(timed[1]) * 60 + Number(timed[2]) + fraction, text: timed[4].trim() });
    } else if (/^\[[a-z]{2,}:.*\]$/i.test(line.trim())) {
      continue; // LRC metadata tag
    } else {
      lines.push({ time: null, text: line.trim() });
    }
  }
  return { synced, lines };
}

/** Index of the line being sung at `positionSec` (synced lyrics only), or -1. */
export function currentLyricIndex(lines: LyricLine[], positionSec: number): number {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].time;
    if (t !== null && t <= positionSec + 0.15) index = i;
    else if (t !== null && t > positionSec) break;
  }
  return index;
}

export const isSunday = (d: Date = new Date()) => d.getDay() === 0;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-03-14" -> local Date (avoids the UTC off-by-one that new Date("2026-03-14") causes). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const weekdayShort = (day: string) => WEEKDAYS[parseDay(day).getDay()].slice(0, 3);

/** "Saturday, March 14" */
export function formatLongDay(day: string): string {
  const d = parseDay(day);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** 14 -> "2 PM", 0 -> "12 AM" */
export function formatHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
