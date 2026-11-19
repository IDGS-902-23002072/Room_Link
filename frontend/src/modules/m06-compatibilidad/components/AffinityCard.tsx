import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, CardLabel } from '../../../shared/components';
import { colors, spacing, typography } from '../../../shared/theme';

type Props = { affinity: number; summary: string };

export function AffinityCard({ affinity, summary }: Props) {
  return (
    <Card tone="mint">
      <CardLabel>Afinidad general</CardLabel>
      <Text style={styles.value}>{affinity}%</Text>
      <Text style={typography.body}>{summary}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  value: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textStrong,
    marginVertical: spacing.xs,
  },
});
