import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { accent, colors, onAccent, radius } from '../theme/tokens';

export function ScreenTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.screenTitle} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={accent} size="large" />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={colors.textFaint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.primary, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={onAccent} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={onAccent} /> : null}
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon} size={20} color={colors.text} /> : null}
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

/** Gradient call-to-action card (used for Weekly Rewind / Unwrapped teasers). */
export function GradientCard({
  colors: gradient,
  onPress,
  children,
}: {
  colors: [string, string];
  onPress?: () => void;
  children: ReactNode;
}) {
  const body = (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientCard}
    >
      {children}
    </LinearGradient>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  screenTitle: { color: colors.text, fontSize: 28, fontWeight: '800' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 36, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.xl,
    minHeight: 50,
  },
  primaryText: { color: onAccent, fontSize: 16, fontWeight: '800' },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  ghostText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  gradientCard: { borderRadius: radius.lg, padding: 18, overflow: 'hidden' },
});
