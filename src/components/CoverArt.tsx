import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

/** Deterministic gradient so tracks without artwork still look distinct. */
export function gradientFor(seed: string): [string, string] {
  let hue = 0;
  for (let i = 0; i < seed.length; i++) hue = (hue * 31 + seed.charCodeAt(i)) % 360;
  return [`hsl(${hue}, 58%, 40%)`, `hsl(${(hue + 48) % 360}, 62%, 20%)`];
}

interface CoverArtProps {
  uri?: string | null;
  /** Stable string (usually the track id) used to pick the fallback gradient. */
  seed: string;
  /** Shown as an initial on the fallback gradient. */
  label?: string;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function CoverArt({ uri, seed, label, size, radius = 8, style }: CoverArtProps) {
  const box: ViewStyle = size
    ? { width: size, height: size, borderRadius: radius }
    : { width: '100%', aspectRatio: 1, borderRadius: radius };

  if (uri) {
    return (
      <Image source={{ uri }} style={[box, style as object]} contentFit="cover" transition={200} />
    );
  }
  return (
    <View style={[box, styles.fallback, style]}>
      <LinearGradient colors={gradientFor(seed)} style={StyleSheet.absoluteFill} />
      {label ? (
        <Text style={[styles.initial, { fontSize: size ? size * 0.42 : 48 }]}>
          {label.trim().charAt(0).toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

/** Full-bleed blurred artwork used behind the player: the dynamic album-art background. */
export function ArtBackdrop({
  uri,
  seed,
  blur = 70,
  dim = 0.58,
}: {
  uri?: string | null;
  seed: string;
  blur?: number;
  dim?: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={gradientFor(seed)} style={StyleSheet.absoluteFill} />
      {uri ? (
        <Image
          source={{ uri }}
          blurRadius={blur}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={500}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(11,11,12,${dim})` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initial: { color: 'rgba(255,255,255,0.85)', fontWeight: '800' },
});
