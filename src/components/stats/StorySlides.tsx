import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { CoverArt } from '../CoverArt';
import { coverUrlFromPath } from '../../services/catalog';
import type { UnwrappedData } from '../../types';
import { formatDuration, formatHour, formatLongDay, toHours } from '../../utils/format';
import { derivePersonality, peakHourOf, percentileLabel } from '../../utils/personality';
import { GhostButton } from '../ui';
import { CountUp } from './CountUp';

export interface SlideDef {
  key: string;
  /** Two-stop background gradient for this slide. */
  colors: [string, string];
  render: () => ReactNode;
}

const W = '#FFFFFF';
const SOFT = 'rgba(255,255,255,0.8)';

export function buildSlides(d: UnwrappedData): SlideDef[] {
  const personality = derivePersonality(d);
  const peakHour = peakHourOf(d.hourly);
  const hourMax = Math.max(1, ...d.hourly);
  const hours = toHours(d.total_seconds);

  const slides: SlideDef[] = [
    {
      key: 'intro',
      colors: ['#5B2BD6', '#E0409A'],
      render: () => (
        <View style={styles.center}>
          <Animated.Text entering={FadeIn.duration(600)} style={styles.kicker}>
            MELOMANIAC
          </Animated.Text>
          <Animated.Text entering={ZoomIn.delay(200).duration(700)} style={styles.mega}>
            Unwrapped
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(700).duration(600)} style={styles.year}>
            {d.year}
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(1200)} style={styles.body}>
            Your year in music, one tap at a time.
          </Animated.Text>
        </View>
      ),
    },
    {
      key: 'hours',
      colors: ['#0F7B3B', '#0B3A5C'],
      render: () => (
        <View style={styles.center}>
          <Animated.Text entering={FadeInDown.duration(500)} style={styles.lead}>
            This year you listened for
          </Animated.Text>
          <CountUp to={hours} decimals={1} style={styles.mega} />
          <Animated.Text entering={FadeInUp.delay(900)} style={styles.unit}>
            hours
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(1500)} style={styles.body}>
            {d.total_plays.toLocaleString()} plays · {d.distinct_tracks} different songs · {d.active_days} days
          </Animated.Text>
        </View>
      ),
    },
  ];

  if (d.top_artist_rank) {
    const p = percentileLabel(d.top_artist_rank);
    slides.push({
      key: 'percentile',
      colors: ['#FF7A18', '#AF002D'],
      render: () => (
        <View style={styles.center}>
          <Animated.Text entering={FadeInDown.duration(500)} style={styles.lead}>
            Your top artist was
          </Animated.Text>
          <Animated.Text entering={ZoomIn.delay(250).duration(600)} style={styles.artistName} numberOfLines={3}>
            {d.top_artist_rank!.artist}
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(900)} style={styles.percent}>
            {p.headline}
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(1300)} style={styles.body}>
            {p.sub}
          </Animated.Text>
        </View>
      ),
    });
  }

  if (d.top_artists.length > 0) {
    slides.push({
      key: 'artists',
      colors: ['#00B4DB', '#0B3A5C'],
      render: () => (
        <View style={styles.listWrap}>
          <Animated.Text entering={FadeInDown} style={styles.heading}>
            Your top artists
          </Animated.Text>
          {d.top_artists.map((a, i) => (
            <Animated.View key={a.artist} entering={FadeInUp.delay(250 + i * 160).duration(500)} style={styles.listRow}>
              <Text style={styles.listRank}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle} numberOfLines={1}>{a.artist}</Text>
                <Text style={styles.listSub}>{formatDuration(a.seconds)}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      ),
    });
  }

  if (d.top_tracks.length > 0) {
    slides.push({
      key: 'tracks',
      colors: ['#8E2DE2', '#4A00E0'],
      render: () => (
        <View style={styles.listWrap}>
          <Animated.Text entering={FadeInDown} style={styles.heading}>
            Songs on repeat
          </Animated.Text>
          {d.top_tracks.map((t, i) => (
            <Animated.View key={t.track_id} entering={FadeInUp.delay(250 + i * 160).duration(500)} style={styles.listRow}>
              <Text style={styles.listRank}>{i + 1}</Text>
              <CoverArt uri={coverUrlFromPath(t.cover_path)} seed={t.track_id} label={t.title} size={46} radius={8} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.listSub} numberOfLines={1}>{t.artist} · {t.plays} plays</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      ),
    });
  }

  if (d.peak_day) {
    const peak = d.peak_day;
    slides.push({
      key: 'peak-day',
      colors: ['#F7971E', '#C0392B'],
      render: () => (
        <View style={styles.center}>
          <Animated.Text entering={FadeInDown.duration(500)} style={styles.lead}>
            Your biggest listening day
          </Animated.Text>
          <Animated.Text entering={ZoomIn.delay(250).duration(600)} style={styles.dateText}>
            {formatLongDay(peak.day)}
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(900)} style={styles.percent}>
            {formatDuration(peak.seconds)}
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(1300)} style={styles.body}>
            That day, the music never really stopped.
          </Animated.Text>
        </View>
      ),
    });
  }

  slides.push({
    key: 'clock',
    colors: ['#141E30', '#243B55'],
    render: () => (
      <View style={styles.center}>
        <Animated.Text entering={FadeInDown} style={styles.lead}>
          You listen most around
        </Animated.Text>
        <Animated.Text entering={ZoomIn.delay(200)} style={styles.mega}>
          {formatHour(peakHour)}
        </Animated.Text>
        <View style={styles.clock} accessible accessibilityLabel={`Listening by hour, peaking at ${formatHour(peakHour)}`}>
          {d.hourly.map((v, h) => (
            <Animated.View
              key={h}
              entering={FadeInUp.delay(400 + h * 30).duration(450)}
              style={[
                styles.clockBar,
                { height: 6 + (v / hourMax) * 90, opacity: h === peakHour ? 1 : 0.5 },
                h === peakHour && { backgroundColor: '#1DB954' },
              ]}
            />
          ))}
        </View>
        <View style={styles.clockLabels}>
          <Text style={styles.listSub}>12 AM</Text>
          <Text style={styles.listSub}>12 PM</Text>
          <Text style={styles.listSub}>11 PM</Text>
        </View>
      </View>
    ),
  });

  slides.push({
    key: 'personality',
    colors: ['#1DB954', '#0B3A5C'],
    render: () => (
      <View style={styles.center}>
        <Animated.Text entering={FadeInDown} style={styles.lead}>
          Your listening personality
        </Animated.Text>
        <Animated.View entering={ZoomIn.delay(250).duration(700)} style={styles.card}>
          <Ionicons name={personality.icon} size={56} color={W} />
          <Text style={styles.cardName}>{personality.name}</Text>
          <Text style={styles.cardBlurb}>{personality.blurb}</Text>
          <View style={styles.traitRow}>
            {personality.traits.map((t) => (
              <View key={t} style={styles.trait}>
                <Text style={styles.traitText}>{t}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(1200)} style={{ marginTop: 22 }}>
          <GhostButton
            label="Share"
            icon="share-outline"
            onPress={() =>
              void Share.share({
                message: `My Melomaniac Unwrapped ${d.year}: ${hours} hours of music, top artist ${
                  d.top_artists[0]?.artist ?? '—'
                }, and I'm ${personality.name}.`,
              })
            }
          />
        </Animated.View>
      </View>
    ),
  });

  return slides;
}

/** Shown instead of the story when there is no listening data for the year. */
export function EmptyUnwrapped({ year }: { year: number }) {
  return (
    <View style={styles.center}>
      <Ionicons name="musical-notes-outline" size={64} color={SOFT} />
      <Text style={styles.heading}>No story yet</Text>
      <Text style={styles.body}>
        Listen to songs for 30+ seconds and your {year} Unwrapped will build itself.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 6 },
  kicker: { color: SOFT, fontSize: 14, fontWeight: '800', letterSpacing: 4 },
  mega: { color: W, fontSize: 68, fontWeight: '900', letterSpacing: -2, textAlign: 'center' },
  year: { color: W, fontSize: 36, fontWeight: '800', opacity: 0.9 },
  unit: { color: W, fontSize: 30, fontWeight: '800', marginTop: -6 },
  lead: { color: SOFT, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  body: { color: SOFT, fontSize: 16, textAlign: 'center', marginTop: 14, lineHeight: 23 },
  artistName: { color: W, fontSize: 44, fontWeight: '900', textAlign: 'center', letterSpacing: -1, marginTop: 6 },
  percent: { color: W, fontSize: 40, fontWeight: '900', marginTop: 18, textAlign: 'center' },
  dateText: { color: W, fontSize: 34, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  heading: { color: W, fontSize: 30, fontWeight: '900', marginBottom: 14 },
  listWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  listRank: { color: W, fontSize: 26, fontWeight: '900', width: 30, textAlign: 'center' },
  listTitle: { color: W, fontSize: 18, fontWeight: '800' },
  listSub: { color: SOFT, fontSize: 13, marginTop: 2 },
  clock: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 100, marginTop: 28 },
  clockBar: { width: 9, borderRadius: 3, backgroundColor: '#fff' },
  clockLabels: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 8 },
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 28,
    padding: 26,
    gap: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardName: { color: W, fontSize: 32, fontWeight: '900', textAlign: 'center' },
  cardBlurb: { color: SOFT, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  trait: { backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  traitText: { color: W, fontSize: 12.5, fontWeight: '700' },
});
