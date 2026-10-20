export const colors = {
  obsidian: '#0B0B0C', // app background
  surface: '#121214', // cards
  surfaceHigh: '#1B1B1F', // raised cards, inputs
  border: 'rgba(255,255,255,0.08)',
  glass: 'rgba(18,18,20,0.66)',
  glassStrong: 'rgba(18,18,20,0.86)',
  accent: '#1DB954', // primary accent (Spotify-style green)
  accentAlt: '#00F0FF', // Electric Blue alternative
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.64)',
  textFaint: 'rgba(255,255,255,0.38)',
  danger: '#FF5470',
} as const;

/**
 * Want the Electric Blue look instead? Change this one line to colors.accentAlt.
 * (Text drawn ON the accent uses `onAccent` so it stays readable either way.)
 */
export const accent: string = colors.accent;
export const onAccent = '#04140A';

export const radius = { sm: 8, md: 14, lg: 22, xl: 32 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const layout = {
  tabBarHeight: 60,
  miniPlayerHeight: 64,
  miniPlayerGap: 8,
} as const;

export const fonts = {
  regular: undefined, // system font keeps the install small; swap in expo-font later
} as const;
