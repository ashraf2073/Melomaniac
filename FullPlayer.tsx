import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../../store/usePlayerStore';
import { accent, colors, onAccent, radius } from '../../theme/tokens';
import { currentLyricIndex, formatTime, parseLyrics } from '../../utils/format';
import { CoverArt } from '../CoverArt';
import { LikeButton } from '../LikeButton';
import { Scrubber } from '../Scrubber';

type DragGesture = ReturnType<typeof Gesture.Pan>;
type Tab = 'player' | 'lyrics' | 'queue';

interface FullPlayerProps {
  /** Pan gesture that drags the whole sheet; attached to the header only. */
  dragGesture: DragGesture;
  onCollapse: () => void;
}

export const FullPlayer = memo(function FullPlayer({ dragGesture, onCollapse }: FullPlayerProps) {
  const insets = useSafeAreaInsets();
  const track = usePlayerStore((s) => s.currentTrack);
  const [tab, setTab] = useState<Tab>('player');
  if (!track) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 }]}>
      <GestureDetector gesture={dragGesture}>
        <View style={styles.header}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Pressable
              hitSlop={14}
              onPress={onCollapse}
              accessibilityRole="button"
              accessibilityLabel="Minimize player"
            >
              <Ionicons name="chevron-down" size={28} color={colors.text} />
            </Pressable>
            <View style={styles.headerTitle}>
              <Text style={styles.headerKicker}>NOW PLAYING</Text>
              <Text numberOfLines={1} style={styles.headerAlbum}>
                {track.album ?? track.artist}
              </Text>
            </View>
            <View style={{ width: 28 }} />
          </View>
        </View>
      </GestureDetector>

      <View style={styles.tabs}>
        {(['player', 'lyrics', 'queue'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tab} accessibilityRole="tab">
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'player' ? 'Player' : t === 'lyrics' ? 'Lyrics' : 'Queue'}
            </Text>
            <View style={[styles.tabUnderline, tab === t && { backgroundColor: accent }]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {tab === 'player' ? <PlayerPane /> : tab === 'lyrics' ? <LyricsPane /> : <QueuePane />}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Player pane: artwork, scrub bar, transport controls, volume
// ---------------------------------------------------------------------------

function PlayerPane() {
  const track = usePlayerStore((s) => s.currentTrack);
  const { width, height } = useWindowDimensions();
  if (!track) return null;
  const artSize = Math.min(width - 56, height * 0.38);

  return (
    <ScrollView
      contentContainerStyle={styles.playerContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <CoverArt
        uri={track.coverUrl}
        seed={track.id}
        label={track.title}
        size={artSize}
        radius={radius.lg}
        style={styles.artShadow}
      />
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text numberOfLines={1} style={styles.title}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {track.artist}
          </Text>
        </View>
        <LikeButton track={track} size={28} />
      </View>
      <ProgressBlock />
      <Controls />
      <VolumeRow />
    </ScrollView>
  );
}

function ProgressBlock() {
  const position = usePlayerStore((s) => s.positionSec);
  const duration = usePlayerStore((s) => s.durationSec);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const fraction = duration > 0 ? position / duration : 0;

  return (
    <View style={styles.progress}>
      <Scrubber value={fraction} onSeek={(f) => seekTo(f * duration)} />
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>-{formatTime(Math.max(0, duration - position))}</Text>
      </View>
    </View>
  );
}

function Controls() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  return (
    <View style={styles.controls}>
      <Pressable hitSlop={10} onPress={toggleShuffle} accessibilityLabel="Shuffle">
        <Ionicons name="shuffle" size={26} color={shuffle ? accent : colors.textMuted} />
      </Pressable>
      <Pressable hitSlop={10} onPress={previous} accessibilityLabel="Previous track">
        <Ionicons name="play-skip-back" size={34} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={togglePlay}
        style={styles.playButton}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={36}
          color={onAccent}
          style={!isPlaying ? { marginLeft: 3 } : undefined}
        />
        {isBuffering && !isPlaying ? <View style={styles.bufferingDot} /> : null}
      </Pressable>
      <Pressable hitSlop={10} onPress={next} accessibilityLabel="Next track">
        <Ionicons name="play-skip-forward" size={34} color={colors.text} />
      </Pressable>
      <Pressable hitSlop={10} onPress={cycleRepeat} accessibilityLabel={`Repeat: ${repeat}`}>
        <View>
          <Ionicons name="repeat" size={26} color={repeat !== 'off' ? accent : colors.textMuted} />
          {repeat === 'one' ? <Text style={styles.repeatOne}>1</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

function VolumeRow() {
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  return (
    <View style={styles.volumeRow}>
      <Ionicons name="volume-low" size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Scrubber value={volume} onChange={setVolume} trackHeight={4} thumbSize={12} />
      </View>
      <Ionicons name="volume-high" size={18} color={colors.textMuted} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Lyrics pane: plain text, or LRC with the current line highlighted
// ---------------------------------------------------------------------------

function LyricsPane() {
  const lyrics = usePlayerStore((s) => s.currentTrack?.lyrics ?? null);
  const position = usePlayerStore((s) => s.positionSec);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const listRef = useRef<FlatList>(null);

  const parsed = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const activeIndex = parsed.synced ? currentLyricIndex(parsed.lines, position) : -1;

  useEffect(() => {
    if (activeIndex >= 0) {
      listRef.current?.scrollToIndex({ index: activeIndex, viewPosition: 0.35, animated: true });
    }
  }, [activeIndex]);

  if (parsed.lines.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="musical-notes-outline" size={40} color={colors.textFaint} />
        <Text style={styles.emptyText}>No lyrics for this track yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={parsed.lines}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={styles.lyricsContent}
      showsVerticalScrollIndicator={false}
      onScrollToIndexFailed={() => undefined}
      renderItem={({ item, index }) => {
        const active = index === activeIndex;
        const past = parsed.synced && activeIndex > index;
        return (
          <Pressable
            disabled={item.time === null}
            onPress={() => item.time !== null && seekTo(item.time)}
          >
            <Text
              style={[
                styles.lyricLine,
                parsed.synced && styles.lyricDim,
                past && styles.lyricPast,
                (active || !parsed.synced) && styles.lyricActive,
              ]}
            >
              {item.text || ' '}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Queue pane
// ---------------------------------------------------------------------------

function QueuePane() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const skipToIndex = usePlayerStore((s) => s.skipToIndex);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);

  return (
    <FlatList
      data={queue}
      keyExtractor={(t, i) => `${t.id}-${i}`}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 24 }}
      initialScrollIndex={undefined}
      ListHeaderComponent={
        <Text style={styles.queueHeader}>
          {queue.length} {queue.length === 1 ? 'track' : 'tracks'} in queue
        </Text>
      }
      renderItem={({ item, index }) => {
        const isCurrent = index === currentIndex;
        return (
          <Pressable
            onPress={() => skipToIndex(index)}
            style={[styles.queueRow, isCurrent && styles.queueRowActive]}
          >
            <CoverArt uri={item.coverUrl} seed={item.id} label={item.title} size={44} radius={6} />
            <View style={styles.titleText}>
              <Text numberOfLines={1} style={[styles.queueTitle, isCurrent && { color: accent }]}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={styles.queueArtist}>
                {item.artist}
              </Text>
            </View>
            {isCurrent ? (
              <Ionicons name="musical-note" size={18} color={accent} />
            ) : (
              <Pressable
                hitSlop={10}
                onPress={() => removeFromQueue(index)}
                accessibilityLabel={`Remove ${item.title} from queue`}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 6 },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, alignItems: 'center' },
  headerKicker: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  headerAlbum: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 6 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8 },
  tabText: { color: colors.textFaint, fontSize: 14, fontWeight: '700', paddingBottom: 8 },
  tabTextActive: { color: colors.text },
  tabUnderline: { height: 2, alignSelf: 'stretch', backgroundColor: 'transparent', borderRadius: 1 },

  body: { flex: 1 },
  playerContent: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24 },
  artShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 22, gap: 12 },
  titleText: { flex: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  artist: { color: colors.textMuted, fontSize: 16, marginTop: 3 },

  progress: { alignSelf: 'stretch', marginTop: 14 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  time: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

  controls: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bufferingDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: onAccent,
    opacity: 0.6,
  },
  repeatOne: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    color: accent,
    fontSize: 11,
    fontWeight: '800',
  },
  volumeRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  lyricsContent: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 160 },
  lyricLine: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 18, lineHeight: 32 },
  lyricDim: { color: colors.textFaint },
  lyricPast: { color: 'rgba(255,255,255,0.55)' },
  lyricActive: { color: colors.text },

  queueHeader: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 20, paddingVertical: 12 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  queueRowActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  queueTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  queueArtist: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
