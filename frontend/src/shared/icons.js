import { View } from "react-native";
import { colors } from "./theme";

// Iconografía line-art propia, construida con Views para no sumar dependencias
// (react-native-svg / librerías de iconos). Cada icono se dibuja dentro de un
// cuadro de `size`, hereda `color` y usa un grosor de trazo proporcional.

export function Icon({ name, size = 24, color = colors.ink, filled = false }) {
  const s = Math.max(1.6, size * 0.083); // grosor de trazo
  const c = color;

  // Primitivas: todas devuelven un objeto de estilo absoluto.
  const line = (st) => ({ position: "absolute", backgroundColor: c, borderRadius: s, ...st });
  const ring = (st) => ({ position: "absolute", borderColor: c, borderWidth: s, backgroundColor: "transparent", ...st });
  const box = (st, fill) => ({ position: "absolute", borderColor: c, borderWidth: s, backgroundColor: fill ? c : "transparent", ...st });
  const dot = (st) => ({ position: "absolute", backgroundColor: c, borderRadius: 999, ...st });
  const triUp = (w, h, col, st) => ({ position: "absolute", width: 0, height: 0, borderLeftWidth: w, borderRightWidth: w, borderBottomWidth: h, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: col, ...st });
  const triDown = (w, h, col, st) => ({ position: "absolute", width: 0, height: 0, borderLeftWidth: w, borderRightWidth: w, borderTopWidth: h, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: col, ...st });
  const triRight = (w, h, col, st) => ({ position: "absolute", width: 0, height: 0, borderTopWidth: h, borderBottomWidth: h, borderLeftWidth: w, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: col, ...st });

  const map = {
    home: [
      triUp(size * 0.42, size * 0.34, c, { top: size * 0.08, left: size * 0.08 }),
      box({ top: size * 0.4, left: size * 0.2, width: size * 0.6, height: size * 0.52, borderBottomLeftRadius: s, borderBottomRightRadius: s }, filled),
    ],
    search: [
      ring({ top: size * 0.08, left: size * 0.08, width: size * 0.56, height: size * 0.56 }),
      line({ top: size * 0.62, left: size * 0.6, width: size * 0.32, height: s, transform: [{ rotate: "45deg" }] }),
    ],
    send: [triRight(size * 0.74, size * 0.34, c, { top: size * 0.5 - size * 0.34, left: size * 0.12 })],
    chevronRight: [
      line({ top: size * 0.22, left: size * 0.42, width: s, height: size * 0.36, transform: [{ rotate: "-45deg" }] }),
      line({ top: size * 0.44, left: size * 0.42, width: s, height: size * 0.36, transform: [{ rotate: "45deg" }] }),
    ],
    back: [
      line({ top: size * 0.22, left: size * 0.52, width: s, height: size * 0.36, transform: [{ rotate: "45deg" }] }),
      line({ top: size * 0.44, left: size * 0.52, width: s, height: size * 0.36, transform: [{ rotate: "-45deg" }] }),
    ],
    compass: [
      ring({ top: size * 0.06, left: size * 0.06, width: size * 0.82, height: size * 0.82 }),
      triUp(size * 0.08, size * 0.22, c, { top: size * 0.3, left: size * 0.42, transform: [{ rotate: "35deg" }] }),
      triDown(size * 0.08, size * 0.22, filled ? c : colors.faint, { top: size * 0.46, left: size * 0.42, transform: [{ rotate: "35deg" }] }),
    ],
    chat: [
      box({ top: size * 0.12, left: size * 0.1, width: size * 0.8, height: size * 0.54, borderRadius: size * 0.2 }, filled),
      triDown(size * 0.1, size * 0.18, c, { top: size * 0.58, left: size * 0.26 }),
    ],
    person: [
      box({ top: size * 0.08, left: size * 0.5 - size * 0.18, width: size * 0.36, height: size * 0.36, borderRadius: 999 }, filled),
      box({ top: size * 0.52, left: size * 0.16, width: size * 0.68, height: size * 0.42, borderTopLeftRadius: size * 0.34, borderTopRightRadius: size * 0.34 }, filled),
    ],
    flag: [
      line({ top: size * 0.08, left: size * 0.18, width: s, height: size * 0.84 }),
      box({ top: size * 0.1, left: size * 0.2, width: size * 0.5, height: size * 0.34 }, filled),
    ],
    chart: [
      line({ bottom: size * 0.08, left: size * 0.14, width: size * 0.16, height: size * 0.4 }),
      line({ bottom: size * 0.08, left: size * 0.42, width: size * 0.16, height: size * 0.66 }),
      line({ bottom: size * 0.08, left: size * 0.7, width: size * 0.16, height: size * 0.28 }),
    ],
    warning: filled
      ? [
          triUp(size * 0.46, size * 0.8, c, { top: size * 0.08, left: size * 0.04 }),
          line({ top: size * 0.4, left: size * 0.5 - s / 2, width: s, height: size * 0.22, backgroundColor: colors.white }),
          { position: "absolute", top: size * 0.68, left: size * 0.5 - s / 2, width: s, height: s, borderRadius: 999, backgroundColor: colors.white },
        ]
      : [
          line({ top: size * 0.1, left: size * 0.5 - s / 2, width: s, height: size * 0.56, transform: [{ rotate: "0deg" }] }),
          line({ top: size * 0.1, left: size * 0.1, width: s, height: size * 0.62, transform: [{ rotate: "-30deg" }] }),
          line({ top: size * 0.1, left: size * 0.9 - s, width: s, height: size * 0.62, transform: [{ rotate: "30deg" }] }),
          line({ bottom: size * 0.08, left: size * 0.2, width: size * 0.6, height: s }),
          line({ top: size * 0.34, left: size * 0.5 - s / 2, width: s, height: size * 0.18, backgroundColor: c }),
          { position: "absolute", top: size * 0.58, left: size * 0.5 - s / 2, width: s, height: s, borderRadius: 999, backgroundColor: c },
        ],
    check: [
      line({ top: size * 0.52, left: size * 0.16, width: s, height: size * 0.3, transform: [{ rotate: "-45deg" }] }),
      line({ top: size * 0.34, left: size * 0.4, width: s, height: size * 0.52, transform: [{ rotate: "45deg" }] }),
    ],
    shield: [
      box({ top: size * 0.08, left: size * 0.18, width: size * 0.64, height: size * 0.54, borderTopLeftRadius: s, borderTopRightRadius: s }, filled),
      triDown(size * 0.34, size * 0.3, filled ? c : "transparent", { top: size * 0.58, left: size * 0.16 }),
      !filled && triDown(size * 0.33, size * 0.28, colors.surface, { top: size * 0.56, left: size * 0.17 }),
    ].filter(Boolean),
    dots: [
      dot({ top: size * 0.45, left: size * 0.12, width: s * 1.3, height: s * 1.3 }),
      dot({ top: size * 0.45, left: size * 0.5 - s * 0.65, width: s * 1.3, height: s * 1.3 }),
      dot({ top: size * 0.45, right: size * 0.12, width: s * 1.3, height: s * 1.3 }),
    ],
  };

  const nodes = map[name] || [];
  return (
    <View style={{ width: size, height: size }}>
      {nodes.map((st, index) => (
        <View key={index} style={st} />
      ))}
    </View>
  );
}
