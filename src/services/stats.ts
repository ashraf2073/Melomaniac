import { supabase } from '../lib/supabase';
import type { RankedArtist, UnwrappedData, WeeklyRewindData } from '../types';
import { deviceTimeZone } from '../utils/format';

/**
 * All aggregation happens in Postgres (see supabase/schema.sql), so the app
 * downloads a few hundred bytes of JSON instead of thousands of history rows.
 * The device time zone is passed along so "Sunday", "peak day" and "peak hour"
 * match the user's local clock rather than UTC.
 */

export async function fetchWeeklyRewind(): Promise<WeeklyRewindData> {
  const { data, error } = await supabase.rpc('weekly_rewind', {
    p_end: new Date().toISOString(),
    p_tz: deviceTimeZone(),
  });
  if (error) throw error;
  return data as WeeklyRewindData;
}

export async function fetchUnwrapped(year = new Date().getFullYear()): Promise<UnwrappedData> {
  const { data, error } = await supabase.rpc('yearly_unwrapped', {
    p_year: year,
    p_tz: deviceTimeZone(),
  });
  if (error) throw error;
  return data as UnwrappedData;
}

export async function fetchTopArtists(days = 90, limit = 20): Promise<RankedArtist[]> {
  const { data, error } = await supabase.rpc('top_artists', { p_days: days, p_limit: limit });
  if (error) throw error;
  return data as RankedArtist[];
}
