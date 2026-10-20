import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { usePlayerStore } from '../../store/usePlayerStore';
import { accent, colors, layout, onAccent } from '../../theme/tokens';
import { ArtBackdrop, CoverArt } from '../CoverArt';
import { FullPlayer } from './FullPlayer';

const SPRING = { damping: 26, stiffness: 260, mass: 0.9, overshootClamping: false } as const;

const clamp = (n: number, min: number, max: number) => {
  'worklet';
  return Math.min(max, Math.max(min, n));
};

/**
 * Sticky mini-player that snaps up into a full-screen player.
 *
 * One shared value (`translateY`) drives everything:
 *   translateY = collapsedY  → mini bar floating above the tab bar
 *   translateY = 0           → full-screen player
 * `progress` (0..1) is derived from it to cross-fade the two layouts, grow the
 * card's height and square off its corners. Render this once, above the
 * navigator, so it floats over every screen.
 */
export function PlayerSheet() {
  const track = usePlayerStore((s) => s.currentTrack);
  const expanded = usePlayerStore((s) => s.isPlayerExpanded);
  const setExpanded = usePlayerStore((s) => s.setPlayerExpanded);

  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const bottomOffset = layout.tabBarHeight + insets.bottom + layout.miniPlayerGap;
  const collapsedY = screenH - layout.miniPlayerHeight - bottomOffset;
  const hasTrack = track !== null;

  // Start off-screen so the mini-player slides up the first time a track loads.
  const translateY = useSharedValue(screenH);
  const startY = useSharedValue(0);

  // Store → animation (taps, back button, programmatic open/close).
  useEffect(() => {
    const target = !hasTrack ? screenH : expanded ? 0 : collapsedY;
    translateY.value = withSpring(target, SPRING);
  }, [hasTrack, expanded, collapsedY, screenH, translateY]);

  // Android back button collapses the full player instead of leaving the app.
  useEffect(() => {
    if (!expanded) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setExpanded(false);
      return true;
    });
    return () => sub.remove();
  }, [expanded, setExpanded]);

  // Gesture → animation. Two instances: a gesture object can only be attached once.
  const makeDrag = () =>
    Gesture.Pan()
      .activeOffsetY([-8, 8])
      .onBegin(() => {
        startY.value = translateY.value;
      })
      .onUpdate((e) => {
        translateY.value = clamp(startY.value + e.translationY, 0, collapsedY);
      })
      .onEnd((e) => {
        const flungUp = e.velocityY < -600;
        const flungDown = e.velocityY > 600;
        const open = flungUp || (!flungDown && translateY.value < collapsedY * 0.5);
        translateY.value = withSpring(open ? 0 : collapsedY, SPRING);
        scheduleOnRN(setExpanded, open);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const miniDrag = useMemo(makeDrag, [collapsedY]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fullDrag = useMemo(makeDrag, [collapsedY]);

  const progress = useDerivedValue(() =>
    interpolate(translateY.value, [collapsedY, 0], [0, 1], Extrapolation.CLAMP),
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const cardStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [layout.miniPlayerHeight, screenH]),
    marginHorizontal: interpolate(progress.value, [0, 1], [8, 0]),
    borderRadius: interpolate(progress.value, [0, 1], [18, 0]),
  }));
  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2], [1, 0], Extrapolation.CLAMP),
  }));
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 0.85], [0, 1], Extrapolation.CLAMP),
  }));

  if (!track) return null;

  return (
    // box-none: the empty area around the floating card must not block touches.
    <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents="box-none">
      <Animated.View style={[styles.card, cardStyle]}>
        <ArtBackdrop uri={track.coverUrl} seed={track.id} />

        {/* ---- Full player layer (fixed height so nothing re-lays out mid-drag) ---- */}
        <Animated.View
          style={[styles.fullLayer, { height: screenH }, fullStyle]}
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          <FullPlayer dragGesture={fullDrag} onCollapse={() => setExpanded(false)} />
        </Animated.View>

        {/* ---- Mini bar layer ---- */}
        <Animated.View
          style={[styles.miniLayer, miniStyle]}
          pointerEvents={expanded ? 'none' : 'auto'}
        >
          <GestureDetector gesture={miniDrag}>
            <View style={styles.miniRow}>
              <Pressable
                style={styles.miniInfo}
                onPress={() => setExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Open player"
              >
                <CoverArt uri={track.coverUrl} seed={track.id} label={track.title} size={46} radius={8} />
                <View style={styles.miniText}>
                  <Text numberOfLines={1} style={styles.miniTitle}>
                    {track.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.miniArtist}>
                    {track.artist}
                  </Text>
                </View>
              </Pressable>
              <MiniControls />
            </View>
          </GestureDetector>
          <MiniProgress />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function MiniControls() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  return (
    <View style={styles.miniControls}>
      <Pressable
        hitSlop={8}
        onPress={togglePlay}
        style={styles.miniPlay}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={22}
          color={onAccent}
          style={!isPlaying ? { marginLeft: 2 } : undefined}
        />
      </Pressable>
      <Pressable hitSlop={8} onPress={next} accessibilityLabel="Next track">
        <Ionicons name="play-skip-forward" size={26} color={colors.text} />
      </Pressable>
    </View>
  );
}

function MiniProgress() {
  const fraction = usePlayerStore((s) => (s.durationSec > 0 ? s.positionSec / s.durationSec : 0));
  return (
    <View style={styles.miniProgressTrack}>
      <View style={[styles.miniProgressFill, { width: `${Math.min(100, fraction * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', top: 0, left: 0, right: 0 },
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fullLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  miniLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: layout.miniPlayerHeight },
  miniRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 9,
    paddingRight: 14,
    gap: 10,
  },
  miniInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  miniText: { flex: 1 },
  miniTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  miniArtist: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  miniControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  miniPlay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniProgressTrack: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 3,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  miniProgressFill: { height: '100%', backgroundColor: accent },
});
