import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../shared/theme';
import { HabitComparison } from '../../../modules/m06-compatibilidad/types';

type Props = { habits: HabitComparison[]; otherName: string };

export function HabitsTable({ habits, otherName }: Props) {
  return (
    <View style={styles.table}>
      <View style={styles.row}>
        <Text style={[styles.cell, styles.head]}>Hábito</Text>
        <Text style={[styles.cell, styles.head]}>Tú</Text>
        <Text style={[styles.cell, styles.head]}>{otherName}</Text>
      </View>
      {habits.map((h) => (
        <View key={h.id} style={styles.row}>
          <Text style={[styles.cell, styles.muted]}>{h.habit}</Text>
          <Text style={[styles.cell, styles.value]}>{h.you}</Text>
          <Text style={[styles.cell, styles.value]}>{h.other}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row' },
  cell: { flex: 1, fontSize: 11 },
  head: { fontWeight: '700', color: colors.label },
  muted: { color: colors.textMuted },
  value: { color: colors.textStrong, fontWeight: '500' },
});
