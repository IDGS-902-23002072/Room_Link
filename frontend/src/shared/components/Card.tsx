import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type CardProps = {
  children: React.ReactNode;
  tone?: 'default' | 'mint';
  style?: ViewStyle;
};

export function Card({ children, tone = 'default', style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        tone === 'mint' ? styles.mint : styles.default,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return <Text style={typography.cardLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  default: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mint: {
    backgroundColor: colors.mint,
  },
});
