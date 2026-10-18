import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
    </Stack.Navigator>
  );
}
