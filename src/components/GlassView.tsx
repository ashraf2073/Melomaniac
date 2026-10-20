import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * Glassmorphism surface.
 * iOS: real native blur. Android: a translucent layer (always looks right and has
 * no per-frame blur cost). To experiment with real blur on Android, flip
 * NATIVE_BLUR to true and check the expo-blur docs for `experimentalBlurMethod`.
 */
const NATIVE_BLUR = Platform.OS === 'ios';

interface GlassViewProps {
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function GlassView({ intensity = 55, style, children }: GlassViewProps) {
  if (NATIVE_BLUR) {
    return (
      <BlurView tint="dark" intensity={intensity} style={[styles.base, style]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[styles.base, styles.androidGlass, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  androidGlass: { backgroundColor: colors.glassStrong },
});
