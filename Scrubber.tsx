import { useEffect, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { accent } from '../theme/tokens';

const clamp01 = (n: number) => {
  'worklet';
  return Math.min(1, Math.max(0, n));
};

interface ScrubberProps {
  /** Current position as a fraction 0..1 (driven by the player). */
  value: number;
  /** Called once when the finger lifts: seek here. */
  onSeek?: (fraction: number) => void;
  /** Called continuously while dragging (used by the volume slider). */
  onChange?: (fraction: number) => void;
  color?: string;
  trackColor?: string;
  trackHeight?: number;
  thumbSize?: number;
}

/**
 * Drag-or-tap slider built on gesture-handler + reanimated, so the thumb follows
 * the finger on the UI thread. While the finger is down we ignore incoming
 * `value` updates; after release we hold briefly so the thumb doesn't snap back
 * to the old position before the native seek lands.
 */
export function Scrubber({
  value,
  onSeek,
  onChange,
  color = accent,
  trackColor = 'rgba(255,255,255,0.22)',
  trackHeight = 5,
  thumbSize = 14,
}: ScrubberProps) {
  const width = useSharedValue(1);
  const progress = useSharedValue(clamp01(value));
  const dragging = useSharedValue(false);
  const thumbScale = useSharedValue(1);
  const holdUntil = useRef(0);

  useEffect(() => {
    if (!dragging.value && Date.now() > holdUntil.current) progress.value = clamp01(value);
  }, [value, dragging, progress]);

  const commit = (fraction: number) => {
    holdUntil.current = Date.now() + 600;
    onSeek?.(fraction);
  };
  const live = (fraction: number) => onChange?.(fraction);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      dragging.value = true;
      thumbScale.value = withTiming(1.4, { duration: 120 });
      progress.value = clamp01(e.x / width.value);
      scheduleOnRN(live, progress.value);
    })
    .onUpdate((e) => {
      progress.value = clamp01(e.x / width.value);
      scheduleOnRN(live, progress.value);
    })
    .onEnd(() => {
      scheduleOnRN(commit, progress.value);
    })
    .onFinalize(() => {
      dragging.value = false;
      thumbScale.value = withTiming(1, { duration: 120 });
    });

  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * width.value }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * width.value - thumbSize / 2 },
      { scale: thumbScale.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.touchArea}
        onLayout={(e: LayoutChangeEvent) => {
          width.value = Math.max(1, e.nativeEvent.layout.width);
        }}
      >
        <View style={[styles.track, { height: trackHeight, backgroundColor: trackColor }]}>
          <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
        </View>
        <Animated.View
          style={[
            styles.thumb,
            { width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, top: 16 - thumbSize / 2 },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // 32px tall hit area around a thin track keeps it easy to grab one-handed.
  touchArea: { height: 32, justifyContent: 'center' },
  track: { borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%' },
  thumb: { position: 'absolute', left: 0, backgroundColor: '#fff' },
});
