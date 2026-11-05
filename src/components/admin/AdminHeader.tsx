import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';

/** Top bar for the admin screens: back arrow, title and an optional right-hand element. */
export function AdminHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.obsidian,
  },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800' },
});
