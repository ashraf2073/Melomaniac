import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverArt } from '../components/CoverArt';
import { EmptyState, GradientCard, Loading, ScreenTitle, SectionHeader } from '../components/ui';
import { useContentInset } from '../hooks/useContentInset';
import type { TabScreenProps } from '../navigation/types';
import { coverUrlFromPath } from '../services/catalog';
import { fetchWeeklyRewind } from '../services/stats';
import { accent, colors, radius } from '../theme/tokens';
import type { WeeklyRewindData } from '../types';
import { formatDuration, isSunday, weekdayShort } from '../utils/format';

// Distinct, colour-blind-friendlier hues for the artist split chart.
const SLICE_COLORS = ['#1DB954', '#00F0FF', '#FFB020', '#FF5470', '#9C7BFF'];

export function StatsScreen({ navigation }: TabScreenProps<'Stats'>) {
  const insets = useSafeAreaInsets();
  const bottomInset = useContentInset();
  const { width } = useWindowDimensions();
  const chartWidth = width - 32;

  const [data, setData] = useState<WeeklyRewindData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const sunday = isSunday();

  const load = useCallback(async () => {
    try {
      setData(await fetchWeeklyRewind());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your stats');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const chartConfig = useMemo(
    () => ({
      backgroundGradientFrom: colors.surface,
      backgroundGradientTo: colors.surface,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(29, 185, 84, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.7})`,
      barPercentage: 0.6,
      propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.08)' },
    }),
    [],
  );

  if (!data && !error) return <Loading />;

  const minutes = data ? Math.round(data.total_seconds / 60) : 0;
  const hasData = !!data && data.total_plays > 0;

  const pieData = data
    ? data.top_artists.map((a, i) => ({
        name: a.artist,
        population: Math.max(1, Math.round(a.seconds / 60)),
        color: SLICE_COLORS[i % SLICE_COLORS.length],
        legendFontColor: 'rgba(255,255,255,0.8)',
        legendFontSize: 12,
      }))
    : [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomInset }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.text}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <ScreenTitle
        right={
          sunday ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>NEW TODAY</Text>
            </View>
          ) : undefined
        }
      >
        Weekly Rewind
      </ScreenTitle>

      {error ? <EmptyState icon="cloud-offline-outline" title="Couldn't load your stats" body={error} /> : null}

      {data && !hasData ? (
        <EmptyState
          icon="stats-chart-outline"
          title="Nothing to rewind yet"
          body="Play any song for 30+ seconds and it counts toward your weekly stats."
        />
      ) : null}

      {data && hasData ? (
        <>
          {/* Hero numbers */}
          <View style={{ paddingHorizontal: 16 }}>
            <GradientCard colors={['#0F7B3B', '#0B3A5C']}>
              <Text style={styles.kicker}>{sunday ? 'YOUR WEEK IN MUSIC' : 'LAST 7 DAYS'}</Text>
              <Text style={styles.hero}>{minutes.toLocaleString()}</Text>
              <Text style={styles.heroUnit}>minutes listened · {formatDuration(data.total_seconds)}</Text>
              <View style={styles.chips}>
                <Chip icon="play-circle" label={`${data.total_plays} plays`} />
                {data.top_genre ? <Chip icon="pricetag" label={`Top genre: ${data.top_genre}`} /> : null}
              </View>
            </GradientCard>
          </View>

          {/* Daily minutes */}
          <SectionHeader title="Listening by day" />
          <View style={styles.chartWrap}>
            <BarChart
              data={{
                labels: data.daily.map((d) => weekdayShort(d.day)),
                datasets: [{ data: data.daily.map((d) => Math.round(d.seconds / 60)) }],
              }}
              width={chartWidth}
              height={200}
              yAxisLabel=""
              yAxisSuffix="m"
              fromZero
              showValuesOnTopOfBars
              chartConfig={chartConfig}
              style={styles.chart}
            />
          </View>

          {/* Top tracks */}
          <SectionHeader title="Top 5 tracks" />
          {data.top_tracks.map((t, i) => (
            <View key={t.track_id} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <CoverArt uri={coverUrlFromPath(t.cover_path)} seed={t.track_id} label={t.title} size={48} radius={8} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.rowTitle}>{t.title}</Text>
                <Text numberOfLines={1} style={styles.rowSub}>{t.artist}</Text>
              </View>
              <Text style={styles.metric}>{t.plays}×</Text>
            </View>
          ))}

          {/* Top artists + split chart */}
          <SectionHeader title="Top 5 artists" />
          {pieData.length > 0 ? (
            <View style={styles.chartWrap}>
              <PieChart
                data={pieData}
                width={chartWidth}
                height={170}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="0"
                absolute={false}
                style={styles.chart}
              />
            </View>
          ) : null}
          {data.top_artists.map((a, i) => (
            <View key={a.artist} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={[styles.dot, { backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }]} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.rowTitle}>{a.artist}</Text>
                <Text style={styles.rowSub}>{a.plays} plays</Text>
              </View>
              <Text style={styles.metric}>{formatDuration(a.seconds)}</Text>
            </View>
          ))}
        </>
      ) : null}

      {/* Yearly story entry */}
      <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
        <GradientCard colors={['#5B2BD6', '#E0409A']} onPress={() => navigation.navigate('Unwrapped')}>
          <View style={styles.wrapRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>YOUR YEAR IN MUSIC</Text>
              <Text style={styles.wrapTitle}>Melomaniac Unwrapped {new Date().getFullYear()}</Text>
              <Text style={styles.wrapSub}>Tap to play your story</Text>
            </View>
            <Ionicons name="play-circle" size={48} color="#fff" />
          </View>
        </GradientCard>
      </View>
    </ScrollView>
  );
}

function Chip({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color="#fff" />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  badge: { backgroundColor: accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: '#04140A', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  kicker: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  hero: { color: '#fff', fontSize: 64, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  heroUnit: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: -4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  chartWrap: { paddingHorizontal: 16 },
  chart: { borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 7 },
  rank: { color: colors.textMuted, width: 18, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  metric: { color: accent, fontSize: 14, fontWeight: '800' },
  wrapRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrapTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 4 },
  wrapSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
});
