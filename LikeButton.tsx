import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useLibraryStore } from '../store/useLibraryStore';
import { accent, colors } from '../theme/tokens';
import type { Track } from '../types';

export function LikeButton({ track, size = 24 }: { track: Track; size?: number }) {
  const liked = useLibraryStore((s) => s.likedIds.has(track.id));
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  return (
    <Pressable
      hitSlop={12}
      onPress={() => void toggleLike(track)}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
    >
      <Ionicons
        name={liked ? 'heart' : 'heart-outline'}
        size={size}
        color={liked ? accent : colors.textMuted}
      />
    </Pressable>
  );
}
