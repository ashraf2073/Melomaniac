import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { EmptyUnwrapped, buildSlides } from '../components/stats/StorySlides';
import { Loading, PrimaryButton } from '../components/ui';
import type { RootScreenProps } from '../navigation/types';
import { fetchUnwrapped } from '../services/stats';
import { useUIStore } from '../store/useUIStore';
import { colors } from '../theme/tokens';
import type { UnwrappedData } from '../types';

const SLIDE_MS = 6500;
const HOLD_MS = 220; // press longer than this = "hold to pause", not a tap

/**
 * Instagram-style story deck.
 *   tap right / left   → next / previous slide
 *   press and hold     → pause
 *   swipe left / right → next / previous
 *   swipe down         → close
 * One shared value (`progress`, 0..1) drives the active progress bar; when it
 * finishes the deck advances. Pausing cancels the animation and resuming
 * continues from where it stopped.
 */
export function UnwrappedScreen({ navigation }: RootScreenProps<'Unwrapped'>) {
  const insets = useSafeAreaInsets();
  const setHidePlayer = useUIStore((s) => s.setHidePlayer);

  const [data, setData] = useState<UnwrappedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    setHidePlayer(true);
    return () => setHidePlayer(false);
  }, [setHidePlayer]);

  useEffect(() => {
    fetchUnwrapped(year)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [year]);

  const close = useCallback(() => navigation.goBack(), [navigation]);

  if (error) {
    return (
      <View style={[styles.fill, styles.dark, { paddingTop: insets.top }]}>
        <CloseButton onPress={close} top={insets.top + 8} />
        <View style={styles.fill}>
          <Text style={styles.errorText}>Couldn't load your Unwrapped</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <PrimaryButton label="Close" onPress={close} />
        </View>
      </View>
    );
  }
  if (!data) return <Loading />;
  if (data.total_plays === 0) {
    return (
      <View style={[styles.fill, styles.dark]}>
        <CloseButton onPress={close} top={insets.top + 8} />
        <EmptyUnwrapped year={year} />
      </View>
    );
  }
  return <StoryDeck data={data} onClose={close} />;
}

function StoryDeck({ data, onClose }: { data: UnwrappedData; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const slides = useMemo(() => buildSlides(data), [data]);
  const last = slides.length - 1;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useSharedValue(0);
  const shownIndex = useRef(0);
  const pressStart = useRef(0);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return setIndex(0); // already first: restart this slide
      if (next > last) return; // last slide stays up; the user closes it
      setIndex(next);
    },
    [last],
  );
  const advance = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);

  // (Re)start the progress animation whenever the slide changes or pause toggles.
  useEffect(() => {
    if (shownIndex.current !== index) {
      shownIndex.current = index;
      progress.value = 0;
    }
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    if (index === last) {
      progress.value = withTiming(1, { duration: 400 }); // last slide: fill, but don't auto-close
      return;
    }
    const remaining = SLIDE_MS * (1 - progress.value);
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(advance);
    });
    return () => cancelAnimation(progress);
  }, [index, paused, last, progress, advance]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .activeOffsetY([-24, 24])
    .onEnd((e) => {
      const horizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
      if (horizontal && e.translationX < -50) scheduleOnRN(goTo, index + 1);
      else if (horizontal && e.translationX > 50) scheduleOnRN(goTo, index - 1);
      else if (!horizontal && e.translationY > 90) scheduleOnRN(onClose);
    });

  const slide = slides[index];

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.fill}>
        <LinearGradient colors={slide.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

        {/* Slide content, keyed so each slide mounts fresh and replays its entrance animations. */}
        <View key={slide.key} style={[styles.fill, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
          {slide.render()}
        </View>

        {/* Tap zones: left third = back, rest = forward. Hold anywhere to pause. */}
        <View style={styles.zones} pointerEvents="box-none">
          {(['back', 'forward'] as const).map((zone) => (
            <Pressable
              key={zone}
              style={{ flex: zone === 'back' ? 1 : 2 }}
              onPressIn={() => {
                pressStart.current = Date.now();
                setPaused(true);
              }}
              onPressOut={() => setPaused(false)}
              onPress={() => {
                if (Date.now() - pressStart.current > HOLD_MS) return; // it was a hold, not a tap
                goTo(zone === 'back' ? index - 1 : index + 1);
              }}
              accessibilityRole="button"
              accessibilityLabel={zone === 'back' ? 'Previous slide' : 'Next slide'}
            />
          ))}
        </View>

        {/* Progress bars + close button sit above the tap zones. */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.bars} pointerEvents="none">
            {slides.map((s, i) => (
              <ProgressBar key={s.key} state={i < index ? 'done' : i === index ? 'active' : 'todo'} progress={progress} />
            ))}
          </View>
          <View style={styles.topRow}>
            <Text style={styles.brand}>Melomaniac Unwrapped</Text>
            <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close story">
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

function ProgressBar({ state, progress }: { state: 'done' | 'active' | 'todo'; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    width: state === 'done' ? '100%' : state === 'active' ? `${progress.value * 100}%` : '0%',
  }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

function CloseButton({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={14} style={[styles.closeAbs, { top }]} accessibilityLabel="Close">
      <Ionicons name="close" size={28} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dark: { backgroundColor: colors.obsidian },
  zones: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 100, flexDirection: 'row' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#fff' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  closeAbs: { position: 'absolute', right: 16, zIndex: 5 },
  errorText: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 120 },
  errorSub: { color: colors.textMuted, textAlign: 'center', margin: 16 },
});
