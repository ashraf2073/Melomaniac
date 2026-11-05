import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminScreen } from '../screens/AdminScreen';
import { SongEditorScreen } from '../screens/SongEditorScreen';
import { UnwrappedScreen } from '../screens/UnwrappedScreen';
import { colors } from '../theme/tokens';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.obsidian } }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="Unwrapped"
        component={UnwrappedScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen name="Admin" component={AdminScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SongEditor" component={SongEditorScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}
