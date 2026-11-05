import { Platform } from "react-native";

// Sistema de diseño RoomLink. La paleta base proviene de los mockups móviles;
// el resto de los tokens (espaciado, radios, tipografía, sombras) se derivan
// para elevar el diseño manteniendo coherencia en las nueve vistas.

export const colors = {
  // Marca
  primary: "#81638b",
  primaryDark: "#6a4f73",
  primarySoft: "#efe7f2",
  secondary: "#b695c0",
  lavender: "#dac9df",
  lavenderSoft: "#ece3f0",

  // Acento
  teal: "#5dc1b9",
  tealDeep: "#2f8f86",
  tealSoft: "#9ce0db",
  tealSurface: "#dff3f1",

  // Neutrales
  bg: "#ece6f1",
  surface: "#ffffff",
  surfaceAlt: "#faf7fc",
  ink: "#2b2531",
  body: "#4c4556",
  muted: "#8a8294",
  faint: "#b4acbd",
  line: "#e7ddec",
  lineStrong: "#d8cadf",

  // Estados
  danger: "#c0564f",
  dangerSoft: "#f7e3e1",
  success: "#2f9e82",
  successSoft: "#dcf0e8",
  warning: "#c08a2c",
  warningSoft: "#f6ecd6",
  white: "#ffffff",
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const font = {
  family: Platform.select({
    web: "Manrope, 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
    default: undefined,
  }),
  display: 30,
  h1: 26,
  h2: 20,
  h3: 17,
  body: 15,
  sub: 13,
  cap: 12,
  eyebrow: 11,
};

export const weight = {
  medium: "500",
  semibold: "700",
  bold: "800",
};

export const shadow = {
  card: Platform.select({
    web: { boxShadow: "0 6px 20px rgba(84, 62, 94, 0.08)" },
    default: {
      shadowColor: "#543e5e",
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  }),
  nav: Platform.select({
    web: { boxShadow: "0 -4px 18px rgba(84, 62, 94, 0.08)" },
    default: {
      shadowColor: "#543e5e",
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: -4 },
      elevation: 8,
    },
  }),
};

// Compatibilidad: algunos módulos antiguos importaban `palette`.
export const palette = {
  background: colors.bg,
  surface: colors.surface,
  ink: colors.ink,
  muted: colors.muted,
  primary: colors.primary,
  danger: colors.danger,
  border: colors.line,
};
