import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  titulo: string;
  texto: string;
}

export function HighlightCard({ titulo, texto }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.mint,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  titulo: { ...typography.bodyStrong, fontSize: 15, color: colors.textDark },
  texto: { ...typography.label, color: colors.textDark },
});
