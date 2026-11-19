import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../m08-reglas-inmueble/theme';

interface Props {
  titulo: string;
  detalle: string;
  /** Muestra el detalle con texto más grande y fuerte (valores como $3,500) */
  destacado?: boolean;
}

export function InfoCard({ titulo, detalle, destacado = false }: Props) {
  return (
    <View style={styles.card}>
      <Text style={[styles.titulo, destacado && styles.tituloChico]}>{titulo}</Text>
      <Text style={[styles.detalle, destacado && styles.detalleDestacado]}>{detalle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  titulo: { ...typography.bodyStrong, color: colors.textDark },
  tituloChico: { ...typography.label, color: colors.textMuted },
  detalle: { ...typography.label, color: colors.textMuted },
  detalleDestacado: { ...typography.bodyStrong, color: colors.textDark },
});
