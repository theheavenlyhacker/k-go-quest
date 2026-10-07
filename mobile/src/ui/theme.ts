import { useColorScheme } from 'react-native';
import { useApp } from '../state/app-context';
import type { Subject } from '../domain/types';

/**
 * K-Go Tokens, mirrored from the Figma variable collection
 * (file Sz4QcNaFmYiI9UdyLMjDhn). Names follow the Figma variable names so a
 * designer change maps to exactly one line here.
 */
export const tokens = {
  brand: { teal: '#0e5e56', coral: '#ff6a4d', green: '#2e9e6d', sky: '#2e86e0', grape: '#7a5ad6', limeDeep: '#6fb733', sun: '#ffb020', sunDeep: '#e8920a' },
  tint: { sky: '#dfedfa', grape: '#ebe6f9', limeDeep: '#e9f4e0', lime: '#eef9e4', sun: '#fff3dd', sunDeep: '#fceeda', forestBright: '#dce8e6', success: '#dcf0e8', warning: '#faedd9' },
  state: { success: '#199c67', warning: '#de8a00', critical: '#d2443a' },
  radius: { sm: 12, md: 16, lg: 22, pill: 999 },
} as const;

export const radius = tokens.radius;

/** The smallest a tappable control may be, in points. */
export const MIN_TOUCH = 44;

/** elevation/card and elevation/appbar from the Figma effect styles. */
export const elevation = {
  card: { shadowColor: '#0e5e56', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
  /** elevation/raised: the lifted first-place card on the League podium. */
  raised: { shadowColor: '#0e5e56', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 14 }, shadowRadius: 32, elevation: 8 },
  appbar: { shadowColor: '#0e5e56', shadowOpacity: 0.55, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, elevation: 10 },
} as const;

const light = {
  dark: false,
  page: '#fbf8f2',
  surface: '#ffffff',
  surfaceAlt: '#f1eee7',
  appbar: '#0e5e56',
  text: '#1c1b1f',
  secondary: '#5c5b66',
  muted: '#8e8d99',
  navActive: '#0e5e56',
  onBrand: '#ffffff',
  border: '#e9e5dc',
  borderStrong: '#d2cfd6',
};

/**
 * Dark palette from Figma Library 255:6, Progress 255:481 and Intro 266:148.
 */
const dark: typeof light = {
  dark: true,
  page: '#12181a',
  surface: '#1e2628',
  surfaceAlt: '#2a3335',
  appbar: '#0a3e38',
  text: '#f3f1ea',
  secondary: '#d7dadf',
  muted: '#8a9098',
  navActive: '#3ecdb0',
  onBrand: '#ffffff',
  border: '#2a3335',
  borderStrong: '#465154',
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
  MATH: { brand: tokens.brand.teal, tint: '#0e5e5624' },
  ENGLISH: { brand: tokens.brand.sun, tint: '#ffb02024' },
  FILIPINO: { brand: tokens.brand.green, tint: '#2e9e6d24' },
  SCIENCE: { brand: tokens.brand.coral, tint: '#ff6a4d24' },
};
const darkSubjectTheme: typeof subjectTheme = {
  MATH: { brand: '#3ecdb0', tint: '#3ecdb02e' },
  ENGLISH: { brand: '#ffc24d', tint: '#ffc24d2e' },
  FILIPINO: { brand: '#4fdb9e', tint: '#4fdb9e2e' },
  SCIENCE: { brand: '#ff9e86', tint: '#ff9e862e' },
};

export function useSubjectTheme() {
  return useTheme().dark ? darkSubjectTheme : subjectTheme;
}

export const subjectColor: Record<Subject, string> = {
  MATH: tokens.brand.teal, ENGLISH: tokens.brand.sun, FILIPINO: tokens.brand.green, SCIENCE: tokens.brand.coral,
};

/** Kept for call sites that predate the token import. */
export const palette = {
  green: '#0e5e56', greenLight: tokens.tint.lime, cream: '#fbf8f2',
  blue: tokens.brand.sky, purple: tokens.brand.grape, orange: tokens.brand.sunDeep,
  red: tokens.state.critical, yellow: tokens.brand.sun,
};

/** Figma text styles. letterSpacing is absolute px, as React Native expects. */
export const type = {
  displayXL: { fontFamily: 'Lexend_800ExtraBold', fontSize: 24, lineHeight: 31, letterSpacing: 0 },
  displayL: { fontFamily: 'Lexend_800ExtraBold', fontSize: 20, lineHeight: 26, letterSpacing: 0 },
  titleM: { fontFamily: 'Lexend_700Bold', fontSize: 15, lineHeight: 15 * 1.28, letterSpacing: -0.15 },
  titleS: { fontFamily: 'Lexend_700Bold', fontSize: 13, lineHeight: 13 * 1.3, letterSpacing: -0.065 },
  labelNav: { fontFamily: 'Lexend_700Bold', fontSize: 9.5, lineHeight: 9.5 * 1.2, letterSpacing: 0.095 },
  labelPill: { fontFamily: 'Lexend_800ExtraBold', fontSize: 10, lineHeight: 10 * 1.3, letterSpacing: 0.2 },
  eyebrow: { fontFamily: 'Lexend_700Bold', fontSize: 10, lineHeight: 10 * 1.3, letterSpacing: 1.4 },
  bodyM: { fontFamily: 'Lexend_500Medium', fontSize: 14, lineHeight: 18, letterSpacing: 0 },
  bodyS: { fontFamily: 'Lexend_500Medium', fontSize: 11, lineHeight: 11 * 1.48, letterSpacing: 0 },
  dataM: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 13, lineHeight: 13 * 1.4, letterSpacing: -0.13 },
  dataS: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 10.5, lineHeight: 10.5 * 1.4, letterSpacing: 0 },
} as const;

export type TypeVariant = keyof typeof type;
