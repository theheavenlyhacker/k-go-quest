import { useColorScheme } from 'react-native';
import { useApp } from '../state/app-context';
import type { Subject } from '../domain/types';

/**
 * K-Go Tokens, mirrored from the Figma variable collection
 * (file Sz4QcNaFmYiI9UdyLMjDhn). Names follow the Figma variable names so a
 * designer change maps to exactly one line here.
 */
export const tokens = {
  brand: { sky: '#2e86e0', grape: '#7a5ad6', limeDeep: '#6fb733', sun: '#ffb020', sunDeep: '#e8920a' },
  tint: { sky: '#dfedfa', grape: '#ebe6f9', limeDeep: '#e9f4e0', lime: '#eef9e4', sun: '#fff3dd', sunDeep: '#fceeda', forestBright: '#dce8e6', success: '#dcf0e8', warning: '#faedd9' },
  state: { success: '#199c67', warning: '#de8a00', critical: '#d2443a' },
  radius: { sm: 10, md: 16, lg: 22, pill: 999 },
} as const;

export const radius = tokens.radius;

/** elevation/card and elevation/appbar from the Figma effect styles. */
export const elevation = {
  card: { shadowColor: '#0c4a3e', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
  appbar: { shadowColor: '#0c4a3e', shadowOpacity: 0.55, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, elevation: 10 },
} as const;

const light = {
  dark: false,
  page: '#faf7ef',
  surface: '#ffffff',
  surfaceAlt: '#f4f0e5',
  appbar: '#0c4a3e',
  text: '#10221d',
  secondary: '#3c544b',
  muted: '#71877d',
  navActive: '#126655',
  onBrand: '#ffffff',
  border: '#e5dfd1',
  borderStrong: '#d6cebc',
};

/**
 * Dark values are derived from the forest ramp, not read from Figma — the
 * token collection's dark mode was not exported with the light one.
 */
const dark: typeof light = {
  dark: true,
  page: '#0b1714',
  surface: '#132520',
  surfaceAlt: '#1b322b',
  appbar: '#08322a',
  text: '#eaf1ec',
  secondary: '#c2d3cb',
  muted: '#8ba396',
  navActive: '#8fd89a',
  onBrand: '#ffffff',
  border: '#244037',
  borderStrong: '#2f5347',
};

export function useTheme() {
  const { preferences } = useApp();
  const system = useColorScheme();
  const isDark = preferences.appearance === 'dark' || (preferences.appearance === 'system' && system === 'dark');
  const base = isDark ? dark : light;
  // bg/card/soft are aliases kept for call sites written before the tokens landed.
  return { ...base, bg: base.page, card: base.surface, soft: base.surfaceAlt };
}

/** Per-subject brand + tint pairing, matching the Offline Library cards. */
export const subjectTheme: Record<Subject, { brand: string; tint: string }> = {
  MATH: { brand: tokens.brand.sky, tint: tokens.tint.sky },
  ENGLISH: { brand: tokens.brand.grape, tint: tokens.tint.grape },
  FILIPINO: { brand: tokens.brand.limeDeep, tint: tokens.tint.limeDeep },
  SCIENCE: { brand: tokens.brand.sunDeep, tint: tokens.tint.sunDeep },
};
export const subjectColor: Record<Subject, string> = {
  MATH: tokens.brand.sky, ENGLISH: tokens.brand.grape, FILIPINO: tokens.brand.limeDeep, SCIENCE: tokens.brand.sunDeep,
};

/** Kept for call sites that predate the token import. */
export const palette = {
  green: '#0c4a3e', greenLight: tokens.tint.lime, cream: '#faf7ef',
  blue: tokens.brand.sky, purple: tokens.brand.grape, orange: tokens.brand.sunDeep,
  red: tokens.state.critical, yellow: tokens.brand.sun,
};

/** Figma text styles. letterSpacing is absolute px, as React Native expects. */
export const type = {
  displayL: { fontFamily: 'Outfit_700Bold', fontSize: 21, lineHeight: 21 * 1.18, letterSpacing: -0.378 },
  titleM: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 15 * 1.28, letterSpacing: -0.15 },
  titleS: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, lineHeight: 13 * 1.3, letterSpacing: -0.065 },
  labelNav: { fontFamily: 'Outfit_600SemiBold', fontSize: 9.5, lineHeight: 9.5 * 1.2, letterSpacing: 0.095 },
  labelPill: { fontFamily: 'Outfit_700Bold', fontSize: 10, lineHeight: 10 * 1.3, letterSpacing: 0.2 },
  eyebrow: { fontFamily: 'PublicSans_700Bold', fontSize: 10, lineHeight: 10 * 1.3, letterSpacing: 1.4 },
  bodyM: { fontFamily: 'PublicSans_400Regular', fontSize: 13, lineHeight: 13 * 1.5, letterSpacing: 0 },
  bodyS: { fontFamily: 'PublicSans_400Regular', fontSize: 11, lineHeight: 11 * 1.48, letterSpacing: 0 },
  dataS: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 10.5, lineHeight: 10.5 * 1.4, letterSpacing: 0 },
} as const;

export type TypeVariant = keyof typeof type;
