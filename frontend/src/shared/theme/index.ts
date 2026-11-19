export const colors = {
  background: '#F8F4F9',
  surface: '#FFFFFF',
  primary: '#86648C',
  primaryText: '#FFFFFF',
  lilac: '#D9C7DE',
  mint: '#9AE2DA',
  textStrong: '#2A2230',
  textMuted: '#6B6272',
  label: '#7A5C86',
  border: '#EDE4EF',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const radius = { sm: 10, md: 14, lg: 18, pill: 999 };

export const typography = {
  eyebrow: { fontSize: 10, letterSpacing: 0.4, color: colors.label, fontWeight: '600' as const },
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.textStrong },
  subtitle: { fontSize: 12, color: colors.textMuted },
  cardLabel: { fontSize: 11, fontWeight: '600' as const, color: colors.label },
  body: { fontSize: 12, color: colors.textMuted },
  bodyStrong: { fontSize: 15, fontWeight: '700' as const, color: colors.textStrong },
};
