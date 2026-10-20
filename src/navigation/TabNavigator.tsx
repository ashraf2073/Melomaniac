import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { TrackListScreen } from '../screens/TrackListScreen';
import { colors } from '../theme/tokens';
import { GlassTabBar } from './GlassTabBar';
import type { LibraryStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const LibraryStack = createNativeStackNavigator<LibraryStackParamList>();

/**
 * Library has its own stack so that opening "Liked Songs" or a playlist keeps
 * the bottom tab bar (and the floating mini-player above it) visible.
 */
function LibraryNavigator() {
  return (
    <LibraryStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.obsidian },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.obsidian },
      }}
    >
      <LibraryStack.Screen name="LibraryHome" component={LibraryScreen} options={{ headerShown: false }} />
      <LibraryStack.Screen name="TrackList" component={TrackListScreen} />
    </LibraryStack.Navigator>
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.obsidian } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Library" component={LibraryNavigator} />
      <Tab.Screen name="Stats" component={StatsScreen} />
    </Tab.Navigator>
  );
}
