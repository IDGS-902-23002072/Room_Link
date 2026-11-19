export const colors = {
  background: '#DCC9E3',
  screen: '#FAF7FA',
  surface: '#FFFFFF',
  border: '#E6DDEA',
  primary: '#85648C',
  primarySoft: '#DCC9E3',
  mint: '#9EE0DA',
  textDark: '#2B2433',
  textMuted: '#7A7083',
  textOnPrimary: '#FFFFFF',
  mapBase: '#E8DEEA',
  mapBlock: '#F4EEF5',
  mapPark: '#9EE0DA',
  mapPoi: '#B79CC4',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const typography = {
  eyebrow: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.6 },
  title: { fontSize: 26, fontWeight: '700' as const },
  subtitle: { fontSize: 12, fontWeight: '400' as const },
  section: { fontSize: 14, fontWeight: '700' as const },
  label: { fontSize: 11, fontWeight: '500' as const },
  body: { fontSize: 13, fontWeight: '500' as const },
  bodyStrong: { fontSize: 14, fontWeight: '700' as const },
  button: { fontSize: 14, fontWeight: '700' as const },
  tab: { fontSize: 10, fontWeight: '500' as const },
};
