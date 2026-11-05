import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminHeader } from '../components/admin/AdminHeader';
import { CoverArt, gradientFor } from '../components/CoverArt';
import { EmptyState, SectionHeader } from '../components/ui';
import { useContentInset } from '../hooks/useContentInset';
import type { RootScreenProps } from '../navigation/types';
import {
  fetchAdminListeners,
  fetchAdminOverview,
  fetchAdminTracks,
  type AdminListener,
  type AdminOverview,
  type AdminTrack,
} from '../services/admin';
import { useAuthStore } from '../store/useAuthStore';
import { accent, colors, onAccent, radius } from '../theme/tokens';
import { describeError } from '../utils/errors';
import { formatLongDay, formatTime, toHours } from '../utils/format';

export function AdminScreen({ navigation }: RootScreenProps<'Admin'>) {
  const bottomInset = useContentInset();
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tracks, setTracks] = useState<AdminTrack[] | null>(null);
  const [listeners, setListeners] = useState<AdminListener[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [o, t, l] = await Promise.allSettled([fetchAdminOverview(), fetchAdminTracks(), fetchAdminListeners()]);
    if (o.status === 'fulfilled') setOverview(o.value);
    if (t.status === 'fulfilled') setTracks(t.value);
    if (l.status === 'fulfilled') setListeners(l.value);
    const failed = [o, t, l].find((r): r is PromiseRejectedResult => r.status === 'rejected');
    setError(failed ? describeError(failed.reason) : null);
  }, []);

  // Reload whenever this screen comes back into view, e.g. after saving in the song editor.
  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void load();
    }, [isAdmin, load]),
  );

  const header = (
    <AdminHeader
      title="Admin tools"
      onBack={() => navigation.goBack()}
      right={
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ADMIN</Text>
        </View>
      }
    />
  );

  if (!isAdmin) {
    return (
      <View style={styles.root}>
        {header}
        <EmptyState
          icon="lock-closed-outline"
          title="Admins only"
          body="This account is not an admin. Run make-admin.sql in Supabase for your email, then open Library again."
        />
      </View>
    );
  }

  const songCount = tracks?.length ?? overview?.tracks ?? 0;

  return (
    <View style={styles.root}>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomInset }}
        keyboardShouldPersistTaps="handled"
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
        {error ? <EmptyState icon="alert-circle-outline" title="Couldn't load everything" body={error} /> : null}

        {/* Totals */}
        <View style={styles.tiles}>
          <Tile label="Listeners" value={overview ? String(overview.users) : '-'} icon="people" />
          <Tile label="Songs" value={String(songCount)} icon="musical-notes" />
          <Tile label="Plays" value={overview ? String(overview.plays) : '-'} icon="play-circle" />
          <Tile label="Hours listened" value={overview ? String(toHours(overview.seconds)) : '-'} icon="time" />
        </View>
        {overview ? (
          <Text style={styles.note}>
            {overview.plays_7d} {overview.plays_7d === 1 ? 'play' : 'plays'} in the last 7 days
          </Text>
        ) : null}

        {overview && overview.top_tracks.length > 0 ? (
          <>
            <SectionHeader title="Most played" />
            {overview.top_tracks.map((t, i) => (
              <View key={t.id} style={styles.row}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{t.artist}</Text>
                </View>
                <Text style={styles.metric}>{t.plays}×</Text>
              </View>
            ))}
          </>
        ) : null}

        {/* Songs */}
        <SectionHeader
          title="Songs"
          action={
            <Pressable
              onPress={() => navigation.navigate('SongEditor')}
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel="Add a song"
            >
              <Ionicons name="add" size={20} color={onAccent} />
              <Text style={styles.addText}>Add song</Text>
            </Pressable>
          }
        />
        {tracks && tracks.length === 0 ? (
          <EmptyState icon="musical-notes-outline" title="No songs yet" body="Tap Add song to upload your first one." />
        ) : null}
        {(tracks ?? []).map((t) => (
          <Pressable
            key={t.id}
            style={styles.row}
            onPress={() => navigation.navigate('SongEditor', { track: t })}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${t.title}`}
          >
            <CoverArt uri={t.coverUrl} seed={t.id} label={t.title} size={48} radius={8} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {t.artist}
                {t.genre ? ` · ${t.genre}` : ''}
                {t.durationSec > 0 ? ` · ${formatTime(t.durationSec)}` : ''}
              </Text>
            </View>
            <Ionicons name="create-outline" size={20} color={colors.textMuted} />
          </Pressable>
        ))}

        {/* Listeners */}
        <SectionHeader title="Listeners" />
        {listeners && listeners.length === 0 ? <Text style={styles.note}>Nobody has signed up yet.</Text> : null}
        {(listeners ?? []).map((l) => (
          <View key={l.user_id} style={styles.row}>
            <LinearGradient colors={gradientFor(l.user_id)} style={styles.avatar}>
              <Text style={styles.initial}>{l.name.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{l.name}</Text>
              <Text style={styles.rowSub}>Joined {formatLongDay(l.joined_at)}</Text>
            </View>
            <Text style={styles.metric}>{l.plays} {l.plays === 1 ? 'play' : 'plays'}</Text>
          </View>
        ))}

        <Text style={[styles.note, { marginTop: 28 }]}>
          Only upload music you own or are licensed to use. Listeners see only totals here, never what a person plays.
        </Text>
      </ScrollView>
    </View>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={20} color={accent} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  badge: { backgroundColor: accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: onAccent, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  tileValue: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 4 },
  tileLabel: { color: colors.textMuted, fontSize: 13 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingHorizontal: 16, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 8 },
  rank: { color: colors.textMuted, width: 18, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  metric: { color: accent, fontSize: 14, fontWeight: '800' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: accent,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 999,
  },
  addText: { color: onAccent, fontSize: 14, fontWeight: '800' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
