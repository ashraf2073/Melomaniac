import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addToPlaylist, fetchPlaylists } from '../services/catalog';
import { useLibraryStore } from '../store/useLibraryStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { accent, colors, radius } from '../theme/tokens';
import type { Playlist } from '../types';
import { notify } from '../utils/notify';
import { CoverArt } from './CoverArt';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** One bottom sheet for every "…" button in the app. Mounted once in App.tsx. */
export function TrackMenu() {
  const track = useUIStore((s) => s.menuTrack);
  const close = useUIStore((s) => s.closeMenu);
  const insets = useSafeAreaInsets();

  const playNext = usePlayerStore((s) => s.playNext);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const liked = useLibraryStore((s) => (track ? s.likedIds.has(track.id) : false));
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  const [view, setView] = useState<'actions' | 'playlists'>('actions');
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);

  useEffect(() => {
    if (track) {
      setView('actions');
      setPlaylists(null);
    }
  }, [track]);

  if (!track) return null;

  const openPlaylists = async () => {
    setView('playlists');
    try {
      setPlaylists(await fetchPlaylists());
    } catch {
      setPlaylists([]);
    }
  };

  const chooseAndClose = (fn: () => void, message: string) => {
    fn();
    close();
    notify(message);
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close menu" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <CoverArt uri={track.coverUrl} seed={track.id} label={track.title} size={52} radius={8} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.title}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={styles.artist}>
              {track.artist}
            </Text>
          </View>
        </View>

        {view === 'actions' ? (
          <View>
            <Action
              icon="play-forward"
              label="Play next"
              onPress={() => chooseAndClose(() => playNext(track), 'Playing next')}
            />
            <Action
              icon="list"
              label="Add to queue"
              onPress={() => chooseAndClose(() => addToQueue(track), 'Added to queue')}
            />
            <Action
              icon={liked ? 'heart' : 'heart-outline'}
              label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
              tint={liked ? accent : undefined}
              onPress={() => {
                void toggleLike(track);
                close();
              }}
            />
            <Action icon="add-circle-outline" label="Add to playlist" onPress={openPlaylists} />
          </View>
        ) : playlists === null ? (
          <ActivityIndicator color={accent} style={{ marginVertical: 28 }} />
        ) : playlists.length === 0 ? (
          <Text style={styles.empty}>No playlists yet. Create one from Your Library.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 320 }}>
            {playlists.map((p) => (
              <Action
                key={p.id}
                icon="musical-notes-outline"
                label={p.name}
                onPress={async () => {
                  try {
                    await addToPlaylist(p.id, track.id);
                    close();
                    notify(`Added to ${p.name}`);
                  } catch {
                    notify('Could not add to playlist');
                  }
                }}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Action({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color={tint ?? colors.text} />
      <Text style={[styles.actionLabel, tint ? { color: tint } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surfaceHigh,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  artist: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 15 },
  actionLabel: { color: colors.text, fontSize: 16, fontWeight: '500', flex: 1 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 28, paddingHorizontal: 24 },
});
