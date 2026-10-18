import { useEffect, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { Easing, useAnimatedReaction, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Number that counts up from 0 when it mounts. The tween runs on the UI thread. */
export function CountUp({
  to,
  decimals = 0,
  delay = 250,
  duration = 1400,
  style,
  suffix = '',
}: {
  to: number;
  decimals?: number;
  delay?: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  suffix?: string;
}) {
  const value = useSharedValue(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    value.value = 0;
    value.value = withDelay(delay, withTiming(to, { duration, easing: Easing.out(Easing.cubic) }));
  }, [to, delay, duration, value]);

  useAnimatedReaction(
    () => value.value,
    (current, previous) => {
      // Skip updates that wouldn't change the rounded number: far fewer React renders.
      const factor = 10 ** decimals;
      if (previous === null || Math.round(current * factor) !== Math.round(previous * factor)) {
        scheduleOnRN(setShown, current);
      }
    },
  );

  return (
    <Text style={style} accessibilityLabel={`${to.toFixed(decimals)}${suffix}`}>
      {shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </Text>
  );
}
