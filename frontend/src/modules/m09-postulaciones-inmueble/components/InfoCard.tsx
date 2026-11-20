import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  titulo: string;
  detalle: string;
}

export function InfoCard({ titulo, detalle }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.detalle}>{detalle}</Text>
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
  detalle: { ...typography.label, color: colors.textMuted },
});
