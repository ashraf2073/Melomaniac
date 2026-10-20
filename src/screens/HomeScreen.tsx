import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackCard } from '../components/TrackCard';
import { TrackRow } from '../components/TrackRow';
import { EmptyState, GradientCard, Loading, SectionHeader } from '../components/ui';
import { useContentInset } from '../hooks/useContentInset';
import type { TabScreenProps } from '../navigation/types';
import {
  fetchLatestTracks,
  fetchRecentlyPlayed,
  fetchRecommendations,
} from '../services/catalog';
import { fetchWeeklyRewind } from '../services/stats';
import { colors } from '../theme/tokens';
import type { Track, WeeklyRewindData } from '../types';
import { formatDuration, isSunday, weekdayShort } from '../utils/format';

interface HomeData {
  recent: Track[];
  recs: Track[];
  latest: Track[];
  weekly: WeeklyRewindData | null;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Late night vibes' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const insets = useSafeAreaInsets();
  const bottomInset = useContentInset();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [recent, latest, weekly] = await Promise.all([
        fetchRecentlyPlayed(12),
        fetchLatestTracks(30),
        fetchWeeklyRewind().catch(() => null),
      ]);
      const recs = await fetchRecommendations(recent, 10);
      setData({ recent, recs, latest, weekly });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }, []);

  // Refresh whenever the tab regains focus so "Recently played" is current.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!data && !error) return <Loading />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomInset }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
    >
      <Text style={styles.greeting}>{greeting()}</Text>

      {error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your music" body={error} />
      ) : null}

      {data ? (
        <>
          <StatsHighlight weekly={data.weekly} onOpen={() => navigation.navigate('Stats')} />

          {data.recent.length > 0 ? (
            <>
              <SectionHeader title="Recently played" />
              <Carousel tracks={data.recent} source="home-recent" />
            </>
          ) : null}

          {data.recs.length > 0 ? (
            <>
              <SectionHeader title={data.recent.length > 0 ? 'Made for you' : 'Fresh picks'} />
              <Carousel tracks={data.recs} source="home-recs" />
            </>
          ) : null}

          <SectionHeader title="All tracks" />
          {data.latest.length === 0 ? (
            <EmptyState
              icon="musical-notes-outline"
              title="No tracks yet"
              body="Add rows to the tracks table (see supabase/seed.sql) and pull to refresh."
            />
          ) : (
            data.latest.map((t) => <TrackRow key={t.id} track={t} context={data.latest} source="home" />)
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function Carousel({ tracks, source }: { tracks: Track[]; source: string }) {
  return (
    <FlatList
      horizontal
      data={tracks}
      keyExtractor={(t) => t.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
      renderItem={({ item }) => <TrackCard track={item} context={tracks} source={source} />}
    />
  );
}

/** Quick stats card. On Sundays it becomes the "Weekly Rewind is ready" call-to-action. */
function StatsHighlight({ weekly, onOpen }: { weekly: WeeklyRewindData | null; onOpen: () => void }) {
  const sunday = isSunday();
  const minutes = weekly ? Math.round(weekly.total_seconds / 60) : 0;
  const topArtist = weekly?.top_artists[0]?.artist;
  const bars = weekly?.daily ?? [];
  const max = Math.max(1, ...bars.map((d) => d.seconds));

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
      <GradientCard colors={sunday ? ['#0F7B3B', '#0A3B5C'] : ['#1B1B1F', '#121214']} onPress={onOpen}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{sunday ? 'YOUR WEEKLY REWIND IS READY' : 'THIS WEEK'}</Text>
            {weekly && weekly.total_plays > 0 ? (
              <>
                <Text style={styles.big}>{minutes} min</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {topArtist ? `Top artist: ${topArtist}` : formatDuration(weekly.total_seconds)}
                </Text>
              </>
            ) : (
              <Text style={styles.sub}>Listen to a few songs (30s+) to start your stats.</Text>
            )}
          </View>
          <Ionicons name="arrow-forward-circle" size={34} color={colors.text} />
        </View>
        {bars.length > 0 ? (
          <View style={styles.bars}>
            {bars.map((d) => (
              <View key={d.day} style={styles.barCol}>
                <View style={[styles.bar, { height: 6 + (d.seconds / max) * 34 }]} />
                <Text style={styles.barLabel}>{weekdayShort(d.day).charAt(0)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </GradientCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  greeting: { color: colors.text, fontSize: 28, fontWeight: '800', paddingHorizontal: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  big: { color: colors.text, fontSize: 36, fontWeight: '900', marginTop: 4 },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, height: 56 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.85)' },
  barLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
});
