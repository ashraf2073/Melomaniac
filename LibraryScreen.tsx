import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradientFor } from '../components/CoverArt';
import { EmptyState, GhostButton, PrimaryButton, ScreenTitle, SectionHeader } from '../components/ui';
import { useContentInset } from '../hooks/useContentInset';
import type { LibraryScreenProps } from '../navigation/types';
import { createPlaylist, fetchPlaylists } from '../services/catalog';
import { fetchTopArtists } from '../services/stats';
import { useAuthStore } from '../store/useAuthStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { accent, colors, radius } from '../theme/tokens';
import type { Playlist, RankedArtist } from '../types';
import { formatDuration } from '../utils/format';
import { notify } from '../utils/notify';

export function LibraryScreen({ navigation }: LibraryScreenProps<'LibraryHome'>) {
  const insets = useSafeAreaInsets();
  const bottomInset = useContentInset();
  const likedCount = useLibraryStore((s) => s.likedIds.size);
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [artists, setArtists] = useState<RankedArtist[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    const [p, a] = await Promise.allSettled([fetchPlaylists(), fetchTopArtists(90, 12)]);
    if (p.status === 'fulfilled') setPlaylists(p.value);
    if (a.status === 'fulfilled') setArtists(a.value);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submitPlaylist = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createPlaylist(trimmed);
      setCreating(false);
      setName('');
      await load();
    } catch {
      notify('Could not create playlist');
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
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
            <Pressable onPress={() => setCreating(true)} hitSlop={10} accessibilityLabel="New playlist">
              <Ionicons name="add" size={30} color={colors.text} />
            </Pressable>
          }
        >
          Your Library
        </ScreenTitle>

        {/* Liked songs */}
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('TrackList', { kind: 'liked' })}
          accessibilityRole="button"
        >
          <LinearGradient colors={['#4B2BD6', '#9C7BFF']} style={styles.tileArt}>
            <Ionicons name="heart" size={26} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Liked Songs</Text>
            <Text style={styles.rowSub}>{likedCount} {likedCount === 1 ? 'song' : 'songs'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
        </Pressable>

        {/* Playlists */}
        <SectionHeader title="Playlists" />
        {playlists.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="No playlists yet"
            body="Create one, then add songs from any track's ⋮ menu."
            action={<GhostButton label="New playlist" icon="add" onPress={() => setCreating(true)} />}
          />
        ) : (
          playlists.map((p) => (
            <Pressable
              key={p.id}
              style={styles.row}
              onPress={() => navigation.navigate('TrackList', { kind: 'playlist', id: p.id, name: p.name })}
              accessibilityRole="button"
            >
              <LinearGradient colors={gradientFor(p.id)} style={styles.tileArt}>
                <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.9)" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.rowSub}>{p.trackCount} {p.trackCount === 1 ? 'song' : 'songs'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>
          ))
        )}

        {/* Top artists */}
        <SectionHeader title="Your top artists" />
        {artists.length === 0 ? (
          <Text style={styles.hint}>Artists you listen to for 30+ seconds will show up here.</Text>
        ) : (
          artists.map((a, i) => (
            <View key={a.artist} style={styles.row}>
              <LinearGradient colors={gradientFor(a.artist)} style={[styles.tileArt, styles.round]}>
                <Text style={styles.initial}>{a.artist.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{a.artist}</Text>
                <Text style={styles.rowSub}>{formatDuration(a.seconds)} · {a.plays} plays</Text>
              </View>
              <Text style={styles.rank}>#{i + 1}</Text>
            </View>
          ))
        )}

        <View style={styles.account}>
          {email ? <Text style={styles.rowSub}>Signed in as {email}</Text> : null}
          <GhostButton label="Sign out" icon="log-out-outline" onPress={() => void signOut()} />
        </View>
      </ScrollView>

      <Modal transparent animationType="fade" visible={creating} onRequestClose={() => setCreating(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New playlist</Text>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Playlist name"
              placeholderTextColor={colors.textFaint}
              style={styles.modalInput}
              maxLength={100}
              onSubmitEditing={() => void submitPlaylist()}
            />
            <View style={styles.modalButtons}>
              <GhostButton label="Cancel" onPress={() => setCreating(false)} />
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Create" onPress={() => void submitPlaylist()} disabled={!name.trim()} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 8 },
  tileArt: { width: 56, height: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 28 },
  initial: { color: '#fff', fontSize: 22, fontWeight: '800' },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  rank: { color: accent, fontWeight: '800', fontSize: 15 },
  hint: { color: colors.textMuted, paddingHorizontal: 16, fontSize: 14 },
  account: { alignItems: 'center', gap: 12, marginTop: 36, paddingHorizontal: 16 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: colors.surfaceHigh, borderRadius: radius.lg, padding: 20, gap: 16 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  modalInput: {
    backgroundColor: colors.obsidian,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
