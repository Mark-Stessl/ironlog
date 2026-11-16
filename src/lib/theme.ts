import { useWindowDimensions } from 'react-native';

// Colors: Ice cyan palette.
export const C = {
  bg: '#0A0F12',
  card: '#10171B',
  cardHi: '#172127',
  border: '#1C272E',
  borderHi: '#2A3943',
  text: '#E8EEF1',
  textDim: '#93A1AA',
  textFaint: '#5E6C75',
  accent: '#22D3EE',
  accentDim: 'rgba(34, 211, 238, 0.12)',
  accentLine: 'rgba(34, 211, 238, 0.45)',
  onAccent: '#03252B',
  good: '#34C77B',
  goodDim: 'rgba(52, 199, 123, 0.10)',
  danger: '#F87171',
  gold: '#E9BE58',
  backdrop: '#070B0D',
} as const;

// Fonts: Inter for text, Space Grotesk for headings (same pair as Nightshelf).
// Each weight is its own font family so it renders the same on Android, iOS and web.
export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
} as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const R = { sm: 8, md: 10, lg: 14 } as const;

/** Width from which the app switches to the desktop layout (sidebar, side panels). */
export const DESKTOP_MIN_WIDTH = 900;

export function useIsDesktop(): boolean {
  return useWindowDimensions().width >= DESKTOP_MIN_WIDTH;
}
