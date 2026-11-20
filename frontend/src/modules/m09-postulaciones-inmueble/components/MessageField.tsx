import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  etiqueta: string;
  value: string;
  onChangeText: (texto: string) => void;
}

export function MessageField({ etiqueta, value, onChangeText }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline
        style={styles.input}
        placeholder="Escribe un mensaje"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={etiqueta}
      />
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
  etiqueta: { ...typography.label, color: colors.textMuted },
  input: {
    ...typography.bodyStrong,
    color: colors.textDark,
    padding: 0,
    minHeight: 36,
    textAlignVertical: 'top',
  },
});
