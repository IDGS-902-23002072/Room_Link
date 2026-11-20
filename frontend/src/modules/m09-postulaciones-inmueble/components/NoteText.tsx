import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface Props {
  texto: string;
  /** Estilo cursivo para citas del candidato */
  cita?: boolean;
}

export function NoteText({ texto, cita = false }: Props) {
  return <Text style={[styles.texto, cita && styles.cita]}>{texto}</Text>;
}

const styles = StyleSheet.create({
  texto: {
    ...typography.label,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
    lineHeight: 16,
  },
  cita: { fontStyle: 'italic' },
});
