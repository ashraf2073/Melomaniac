import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/usePlayerStore';
import { layout } from '../theme/tokens';

/**
 * Bottom padding for scrollable screens so the last row is never hidden behind
 * the floating tab bar or the mini-player.
 */
export function useContentInset(): number {
  const insets = useSafeAreaInsets();
  const hasTrack = usePlayerStore((s) => s.currentTrack !== null);
  const miniPlayer = hasTrack ? layout.miniPlayerHeight + layout.miniPlayerGap * 2 : 0;
  return layout.tabBarHeight + insets.bottom + miniPlayer + 24;
}
