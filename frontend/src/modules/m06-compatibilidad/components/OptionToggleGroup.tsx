import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../m08-reglas-inmueble/theme';
import type { OpcionRegla } from '../../../navigation/types';

interface Props {
  titulo: string;
  opciones: OpcionRegla[];
  seleccionada: string;
  onChange: (id: string) => void;
}

export function OptionToggleGroup({ titulo, opciones, seleccionada, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{titulo}</Text>
      <View style={styles.row}>
        {opciones.map((opcion) => {
          const activa = opcion.id === seleccionada;
          return (
            <Pressable
              key={opcion.id}
              onPress={() => onChange(opcion.id)}
              style={[styles.option, activa ? styles.optionActive : styles.optionIdle]}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
            >
              <Text style={[styles.label, activa && styles.labelActive]}>
                {opcion.label}
                {activa ? ' ✓' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  title: { ...typography.section, color: colors.textDark },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  optionActive: { backgroundColor: colors.primarySoft },
  optionIdle: { backgroundColor: colors.surface },
  label: { ...typography.label, color: colors.textMuted },
  labelActive: { color: colors.textDark },
});
