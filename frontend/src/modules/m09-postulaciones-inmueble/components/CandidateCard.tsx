import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { ETIQUETA_ESTADO } from '../data/postulaciones';
import type { Postulacion } from '../types';

interface Props {
  postulacion: Postulacion;
  onPress?: () => void;
}

export function CandidateCard({ postulacion, onPress }: Props) {
  const { compatibilidad, estado, nombre, detalle } = postulacion;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}, ${compatibilidad}% compatible`}
    >
      <Text style={styles.eyebrow}>
        {`${compatibilidad}% COMPATIBLE · ${ETIQUETA_ESTADO[estado]}`}
      </Text>
      <Text style={styles.nombre}>{nombre}</Text>
      <Text style={styles.detalle}>{detalle}</Text>
    </Pressable>
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
  pressed: { opacity: 0.85 },
  eyebrow: { ...typography.eyebrow, color: colors.primary },
  nombre: { ...typography.name, color: colors.textDark },
  detalle: { ...typography.label, color: colors.textMuted },
});
