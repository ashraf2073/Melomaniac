import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { accent, colors, radius } from '../theme/tokens';
import type { Track } from '../types';
import { formatTime } from '../utils/format';
import { CoverArt } from './CoverArt';
import { LikeButton } from './LikeButton';

interface TrackRowProps {
  track: Track;
  /** The list this row belongs to: tapping plays it as the queue, starting here. */
  context: Track[];
  /** Where the play came from, stored on each listen for analytics. */
  source: string;
}

export const TrackRow = memo(function TrackRow({ track, context, source }: TrackRowProps) {
  const isCurrent = usePlayerStore((s) => s.currentTrack?.id === track.id);
  const isPlaying = usePlayerStore((s) => s.currentTrack?.id === track.id && s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const openMenu = useUIStore((s) => s.openMenu);

  return (
    <Pressable
      onPress={() => playTrack(track, context, source)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title} by ${track.artist}`}
    >
      <CoverArt uri={track.coverUrl} seed={track.id} label={track.title} size={52} radius={radius.sm} />
      <View style={styles.meta}>
        <Text numberOfLines={1} style={[styles.title, isCurrent && { color: accent }]}>
          {track.title}
        </Text>
        <View style={styles.subRow}>
          {isCurrent ? (
            <Ionicons name={isPlaying ? 'volume-medium' : 'pause'} size={13} color={accent} />
          ) : null}
          <Text numberOfLines={1} style={styles.sub}>
            {track.artist}
            {track.durationSec > 0 ? `  ·  ${formatTime(track.durationSec)}` : ''}
          </Text>
        </View>
      </View>
      <LikeButton track={track} size={22} />
      <Pressable hitSlop={10} onPress={() => openMenu(track)} accessibilityLabel="More options">
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  meta: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
});
