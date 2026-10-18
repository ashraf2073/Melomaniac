import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { UnwrappedData } from '../types';
import { formatHour } from './format';

export interface Personality {
  name: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  blurb: string;
  /** Short facts shown as chips on the card. */
  traits: string[];
}

export function peakHourOf(hourly: number[]): number {
  let best = 0;
  hourly.forEach((v, h) => {
    if (v > hourly[best]) best = h;
  });
  return best;
}

/**
 * Rule-based "listening personality". Rules are checked top to bottom and the
 * first match wins, so reorder them to change which traits take priority.
 */
export function derivePersonality(d: UnwrappedData): Personality {
  const peak = peakHourOf(d.hourly);
  const topShare =
    d.total_seconds > 0 && d.top_artists[0] ? d.top_artists[0].seconds / d.total_seconds : 0;
  const variety = d.total_plays > 0 ? d.distinct_artists / d.total_plays : 0;

  const traits = [
    `${d.distinct_artists} artists`,
    `${d.active_days} active days`,
    `Peak hour ${formatHour(peak)}`,
  ];

  if (d.total_plays < 10) {
    return {
      name: 'The Newcomer',
      icon: 'sparkles',
      blurb: 'Your story is just getting started. Keep listening and watch this card evolve.',
      traits,
    };
  }
  if (topShare >= 0.5) {
    return {
      name: 'The Loyalist',
      icon: 'heart',
      blurb: `Over half your listening belongs to ${d.top_artists[0].artist}. When you find your sound, you stay.`,
      traits,
    };
  }
  if (d.distinct_artists >= 15 || variety >= 0.6) {
    return {
      name: 'The Explorer',
      icon: 'compass',
      blurb: 'Always digging for something new. Your library has more directions than a map.',
      traits,
    };
  }
  if (peak >= 22 || peak <= 4) {
    return {
      name: 'The Night Owl',
      icon: 'moon',
      blurb: 'The world goes quiet and your playlist gets loud. Midnight is your golden hour.',
      traits,
    };
  }
  if (peak >= 5 && peak <= 9) {
    return {
      name: 'The Early Bird',
      icon: 'sunny',
      blurb: 'You start the day with a soundtrack. Mornings run on your music.',
      traits,
    };
  }
  if (d.active_days >= 200) {
    return {
      name: 'The Daily Ritualist',
      icon: 'repeat',
      blurb: 'Music is part of your routine, every single day. Consistency is your superpower.',
      traits,
    };
  }
  return {
    name: 'The Groove Keeper',
    icon: 'musical-notes',
    blurb: 'A steady listener with taste that is entirely your own.',
    traits,
  };
}

/** What to show for the "top artist percentile" slide. */
export function percentileLabel(rank: { rank: number; listeners: number }): {
  headline: string;
  sub: string;
} {
  if (rank.rank <= 1) {
    return {
      headline: '#1 listener',
      sub: rank.listeners > 1 ? `out of ${rank.listeners} people listening` : 'so far on Melomaniac',
    };
  }
  const pct = Math.max(1, Math.ceil((rank.rank / rank.listeners) * 100));
  return { headline: `Top ${pct}%`, sub: `You ranked #${rank.rank} of ${rank.listeners} listeners` };
}
