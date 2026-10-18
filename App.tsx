import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TrackMenu } from './src/components/TrackMenu';
import { PlayerSheet } from './src/components/player/PlayerSheet';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import { useAuthStore } from './src/store/useAuthStore';
import { useLibraryStore } from './src/store/useLibraryStore';
import { initializePlayer, usePlayerStore } from './src/store/usePlayerStore';
import { useUIStore } from './src/store/useUIStore';
import { accent, colors } from './src/theme/tokens';

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: accent,
    background: colors.obsidian,
    card: colors.obsidian,
    text: colors.text,
    border: colors.border,
    notification: accent,
  },
};

export default function App() {
  const initAuth = useAuthStore((s) => s.init);
  const initializing = useAuthStore((s) => s.initializing);
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const hidePlayer = useUIStore((s) => s.hidePlayer);

  useEffect(() => initAuth(), [initAuth]);

  // Sign-in / sign-out side effects.
  useEffect(() => {
    if (userId) {
      void initializePlayer();
      void useLibraryStore.getState().load();
    } else {
      usePlayerStore.getState().stopAndClear();
      useLibraryStore.getState().reset();
    }
  }, [userId]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {initializing ? (
          <View style={styles.splash}>
            <ActivityIndicator color={accent} size="large" />
          </View>
        ) : userId ? (
          <>
            <NavigationContainer theme={navTheme}>
              <RootNavigator />
            </NavigationContainer>
            {/* Rendered after the navigator so it floats above every screen. */}
            {hidePlayer ? null : <PlayerSheet />}
            <TrackMenu />
          </>
        ) : (
          <AuthScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.obsidian },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.obsidian },
});
