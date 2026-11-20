import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import type { EstadoPostulacion, PestanaPostulaciones } from '../types';

interface Props {
  pestanas: PestanaPostulaciones[];
  activa: EstadoPostulacion;
  onChange: (id: EstadoPostulacion) => void;
}

export function SegmentedTabs({ pestanas, activa, onChange }: Props) {
  return (
    <View style={styles.container}>
      {pestanas.map((pestana) => {
        const seleccionada = pestana.id === activa;
        const texto =
          pestana.cantidad !== undefined ? `${pestana.label} ${pestana.cantidad}` : pestana.label;
        return (
          <Pressable
            key={pestana.id}
            onPress={() => onChange(pestana.id)}
            style={[styles.tab, seleccionada && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: seleccionada }}
          >
            <Text style={[styles.label, seleccionada && styles.labelActive]}>{texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    padding: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  tabActive: { backgroundColor: colors.surface },
  label: { ...typography.label, color: colors.textMuted },
  labelActive: { color: colors.textDark, fontWeight: '700' },
});
