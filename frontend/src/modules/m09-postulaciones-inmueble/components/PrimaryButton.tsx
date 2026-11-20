import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type Variant = 'primary' | 'secondary' | 'accent';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
}

export function PrimaryButton({ label, onPress, variant = 'primary' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  accent: { backgroundColor: colors.accent },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  label: { ...typography.button, color: colors.textOnPrimary },
  labelSecondary: { color: colors.primary },
});
