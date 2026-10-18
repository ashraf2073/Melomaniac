import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradientFor } from '../components/CoverArt';
import { TrackRow } from '../components/TrackRow';
import { EmptyState, Loading, ScreenTitle } from '../components/ui';
import { useContentInset } from '../hooks/useContentInset';
import { fetchGenres, searchTracks } from '../services/catalog';
import { colors, radius } from '../theme/tokens';
import type { Track } from '../types';

/** Waits `ms` after the user stops typing before returning the value. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const bottomInset = useContentInset();

  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounced(query, 250);
  const searching = debouncedQuery.trim().length > 0 || genre !== null;

  useEffect(() => {
    fetchGenres().then(setGenres).catch(() => setGenres([]));
  }, []);

  // Real-time filter: re-query as the text (debounced) or the genre chip changes.
  useEffect(() => {
    if (!searching) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchTracks(debouncedQuery, genre)
      .then((r) => {
        if (!cancelled) {
          setResults(r);
          setError(null);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true; // ignore out-of-order responses
    };
  }, [debouncedQuery, genre, searching]);

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenTitle>Search</ScreenTitle>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Songs, artists or albums"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            accessibilityLabel="Search"
          />
          {query.length > 0 || genre ? (
            <Pressable
              hitSlop={10}
              onPress={() => {
                setQuery('');
                setGenre(null);
              }}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {genre ? (
          <Text style={styles.filter}>
            Genre: <Text style={{ color: colors.text, fontWeight: '800' }}>{genre}</Text>
          </Text>
        ) : null}
      </View>

      {!searching ? (
        <FlatList
          key="genres"
          data={genres}
          numColumns={2}
          keyExtractor={(g) => g}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 12, paddingTop: 8, paddingBottom: bottomInset }}
          ListHeaderComponent={genres.length > 0 ? <Text style={styles.browse}>Browse all</Text> : undefined}
          ListEmptyComponent={
            <EmptyState icon="search-outline" title="Search the catalog" body="Type above to find a song, artist or album." />
          }
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <GenreTile genre={item} onPress={() => setGenre(item)} />}
        />
      ) : loading && results.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          key="results"
          data={results}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: bottomInset }}
          ListEmptyComponent={
            <EmptyState
              icon={error ? 'cloud-offline-outline' : 'sad-outline'}
              title={error ? "Search isn't working" : 'No results'}
              body={error ?? 'Try a different spelling or another genre.'}
            />
          }
          renderItem={({ item }) => <TrackRow track={item} context={results} source="search" />}
        />
      )}
    </View>
  );
}

function GenreTile({ genre, onPress }: { genre: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tile} accessibilityRole="button" accessibilityLabel={`Browse ${genre}`}>
      <LinearGradient colors={gradientFor(genre)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={styles.tileText}>{genre}</Text>
      <Ionicons name="musical-notes" size={54} color="rgba(255,255,255,0.18)" style={styles.tileIcon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    height: 48,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 0 },
  filter: { color: colors.textMuted, fontSize: 13, marginHorizontal: 18, marginTop: 10 },
  browse: { color: colors.text, fontSize: 18, fontWeight: '800', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  tile: { flex: 1, height: 96, borderRadius: radius.md, padding: 14, overflow: 'hidden', justifyContent: 'flex-start' },
  tileText: { color: colors.text, fontSize: 18, fontWeight: '800' },
  tileIcon: { position: 'absolute', right: -6, bottom: -6, transform: [{ rotate: '22deg' }] },
});
