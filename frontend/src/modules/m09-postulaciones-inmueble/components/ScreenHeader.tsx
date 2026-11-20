import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface Props {
  title: string;
  subtitle: string;
}

export function ScreenHeader({ title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>ROOMLINK / 09</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, marginBottom: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.textMuted },
  title: { ...typography.title, color: colors.textDark },
  subtitle: { ...typography.subtitle, color: colors.textMuted },
});
