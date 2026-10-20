import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { TrackRow } from '../components/TrackRow';
import { EmptyState, GhostButton, Loading, PrimaryButton } from '../components/ui';
import { useContentInset } from '../hooks/useContentInset';
import type { LibraryScreenProps } from '../navigation/types';
import { fetchLikedTracks, fetchPlaylistTracks } from '../services/catalog';
import { useLibraryStore } from '../store/useLibraryStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { colors } from '../theme/tokens';
import type { Track } from '../types';

/** Shows either "Liked Songs" or one playlist, depending on the route params. */
export function TrackListScreen({ navigation, route }: LibraryScreenProps<'TrackList'>) {
  const params = route.params;
  const bottomInset = useContentInset();
  const likesVersion = useLibraryStore((s) => s.likesVersion);
  const playQueue = usePlayerStore((s) => s.playQueue);

  const [tracks, setTracks] = useState<Track[] | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: params.kind === 'liked' ? 'Liked Songs' : params.name });
  }, [navigation, params]);

  const load = useCallback(async () => {
    try {
      setTracks(params.kind === 'liked' ? await fetchLikedTracks() : await fetchPlaylistTracks(params.id));
    } catch {
      setTracks([]);
    }
    // likesVersion: refetch when a heart is toggled while this screen is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, likesVersion]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (tracks === null) return <Loading />;

  const source = params.kind === 'liked' ? 'liked' : 'playlist';

  const shufflePlay = () => {
    usePlayerStore.setState({ shuffle: true });
    playQueue(tracks, Math.floor(Math.random() * tracks.length), source);
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: bottomInset }}
        ListHeaderComponent={
          tracks.length > 0 ? (
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Play" icon="play" onPress={() => playQueue(tracks, 0, source)} />
              </View>
              <GhostButton label="Shuffle" icon="shuffle" onPress={shufflePlay} />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon={params.kind === 'liked' ? 'heart-outline' : 'musical-notes-outline'}
            title={params.kind === 'liked' ? 'Songs you like appear here' : 'This playlist is empty'}
            body={
              params.kind === 'liked'
                ? 'Tap the heart on any track to save it.'
                : "Open a track's ⋮ menu and choose Add to playlist."
            }
          />
        }
        renderItem={({ item }) => <TrackRow track={item} context={tracks} source={source} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
});
