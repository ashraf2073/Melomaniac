import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type LibraryStackParamList = {
  LibraryHome: undefined;
  TrackList: { kind: 'liked' } | { kind: 'playlist'; id: string; name: string };
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Library: NavigatorScreenParams<LibraryStackParamList> | undefined;
  Stats: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Unwrapped: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

/** Props for a tab screen that can also navigate to root-stack screens (e.g. Unwrapped). */
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type LibraryScreenProps<T extends keyof LibraryStackParamList> = NativeStackScreenProps<
  LibraryStackParamList,
  T
>;
