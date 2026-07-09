// GreenShelf design tokens, lifted straight from the website's styles.css so the
// native app is the same brand, not a lookalike. Light and dark are full palettes;
// everything else (spacing, radii, type scale) is shared.

export type ThemeName = 'light' | 'dark';

export interface Palette {
  // Warm paper backgrounds
  paper: string;
  paperWarm: string;
  paperDeep: string;
  surface: string;
  surface2: string;
  // Ink (text)
  ink: string;
  inkSoft: string;
  inkFaint: string;
  // Hairlines / borders
  hairline: string;
  hairlineStrong: string;
  // Brand green + gold
  accent: string;
  accentDeep: string;
  accentBright: string;
  accentTint: string;
  gold: string;
  goldSoft: string;
  sageSoft: string;
  error: string;
  errorSoft: string;
  // Contrast colour that reads on top of accent (buttons)
  onAccent: string;
  // Status/theme bar colour
  bar: string;
  // Card cover colourways (5 muted publisher-series looks)
  covers: { bg: string; ink: string }[];
}

export const light: Palette = {
  paper: '#f6f1e6',
  paperWarm: '#efe7d3',
  paperDeep: '#e6dabd',
  surface: '#fffdf8',
  surface2: '#f3ecdb',
  ink: '#1b1712',
  inkSoft: '#4a4236',
  inkFaint: '#6f6757',
  hairline: 'rgba(27, 23, 18, 0.12)',
  hairlineStrong: 'rgba(27, 23, 18, 0.22)',
  accent: '#2f5e44',
  accentDeep: '#214733',
  accentBright: '#3a7355',
  accentTint: 'rgba(47, 94, 68, 0.10)',
  gold: '#a8761f',
  goldSoft: '#d9a94a',
  sageSoft: '#e2dcc6',
  error: '#b23b22',
  errorSoft: 'rgba(178, 59, 34, 0.10)',
  onAccent: '#f6f1e6',
  bar: '#2d5016',
  covers: [
    { bg: '#2f5e44', ink: '#f6f1e6' },
    { bg: '#214733', ink: '#e2dcc6' },
    { bg: '#a8761f', ink: '#fffdf8' },
    { bg: '#3a4a3f', ink: '#e6dabd' },
    { bg: '#6b4a2a', ink: '#f6f1e6' },
  ],
};

export const dark: Palette = {
  paper: '#16140f',
  paperWarm: '#1f1c16',
  paperDeep: '#2a261e',
  surface: '#211d16',
  surface2: '#2a251c',
  ink: '#f3ecdc',
  inkSoft: '#c3b9a3',
  inkFaint: '#94896f',
  hairline: 'rgba(243, 236, 220, 0.12)',
  hairlineStrong: 'rgba(243, 236, 220, 0.22)',
  accent: '#79b894',
  accentDeep: '#5c9c78',
  accentBright: '#8fcaa8',
  accentTint: 'rgba(121, 184, 148, 0.14)',
  gold: '#d9b25e',
  goldSoft: '#e7c87f',
  sageSoft: '#2d3a30',
  error: '#e0795f',
  errorSoft: 'rgba(224, 121, 95, 0.14)',
  onAccent: '#16140f',
  bar: '#161208',
  covers: [
    { bg: '#2d3a30', ink: '#8fcaa8' },
    { bg: '#233026', ink: '#79b894' },
    { bg: '#4a3a1e', ink: '#e7c87f' },
    { bg: '#2a2b26', ink: '#c3b9a3' },
    { bg: '#3a2c1c', ink: '#d9b25e' },
  ],
};

export const palettes: Record<ThemeName, Palette> = { light, dark };

// Shared scales
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

// Fraunces = display, Inter = body. Loaded in the root layout.
export const font = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const type = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 26,
  xxl: 34,
} as const;
