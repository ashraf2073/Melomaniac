import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView } from '../components/GlassView';
import { accent, colors, layout } from '../theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { on: IconName; off: IconName; label: string }> = {
  Home: { on: 'home', off: 'home-outline', label: 'Home' },
  Search: { on: 'search', off: 'search-outline', label: 'Search' },
  Library: { on: 'library', off: 'library-outline', label: 'Library' },
  Stats: { on: 'stats-chart', off: 'stats-chart-outline', label: 'Stats' },
};

/**
 * Floating glass tab bar. It is absolutely positioned so screens extend beneath
 * it (that is what makes the blur visible); screens add `useContentInset()` as
 * bottom padding so their last row stays reachable.
 */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <GlassView
      intensity={70}
      style={[styles.bar, { height: layout.tabBarHeight + insets.bottom, paddingBottom: insets.bottom }]}
    >
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = ICONS[route.name] ?? ICONS.Home;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
            >
              <Ionicons
                name={focused ? meta.on : meta.off}
                size={24}
                color={focused ? accent : colors.textMuted}
              />
              <Text style={[styles.label, focused && { color: accent }]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', height: layout.tabBarHeight },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
});
