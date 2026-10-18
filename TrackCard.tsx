import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { usePlayerStore } from '../store/usePlayerStore';
import { accent, colors, radius } from '../theme/tokens';
import type { Track } from '../types';
import { CoverArt } from './CoverArt';

/** Square card for horizontal carousels (Recently played, Made for you). */
export const TrackCard = memo(function TrackCard({
  track,
  context,
  source,
}: {
  track: Track;
  context: Track[];
  source: string;
}) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const isCurrent = usePlayerStore((s) => s.currentTrack?.id === track.id);
  return (
    <Pressable
      onPress={() => playTrack(track, context, source)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title} by ${track.artist}`}
    >
      <CoverArt uri={track.coverUrl} seed={track.id} label={track.title} size={140} radius={radius.md} />
      <Text numberOfLines={1} style={[styles.title, isCurrent && { color: accent }]}>
        {track.title}
      </Text>
      <Text numberOfLines={1} style={styles.artist}>
        {track.artist}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { width: 140, gap: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
  artist: { color: colors.textMuted, fontSize: 12.5 },
});
