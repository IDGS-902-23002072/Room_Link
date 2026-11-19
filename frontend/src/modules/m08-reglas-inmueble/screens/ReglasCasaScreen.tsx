import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OptionToggleGroup, PrimaryButton, ScreenHeader, ScreenLayout } from '../../m06-compatibilidad';
import { GRUPOS_REGLAS, REGLAS_ADICIONALES_INICIAL } from '../../m06-compatibilidad/data/reglas';
import type { M08StackParamList } from '../../../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<M08StackParamList, 'ReglasCasa'>;

export function ReglasCasaScreen({ navigation }: Props) {
  const [selecciones, setSelecciones] = useState<Record<string, string>>(() =>
    Object.fromEntries(GRUPOS_REGLAS.map((g) => [g.id, g.seleccionInicial])),
  );
  const [adicionales, setAdicionales] = useState(REGLAS_ADICIONALES_INICIAL);

  return (
    <ScreenLayout>
      <ScreenHeader title="Reglas de la casa" subtitle="Haz claras las expectativas desde el inicio." />

      <View style={styles.groups}>
        {GRUPOS_REGLAS.map((grupo) => (
          <OptionToggleGroup
            key={grupo.id}
            titulo={grupo.titulo}
            opciones={grupo.opciones}
            seleccionada={selecciones[grupo.id]}
            onChange={(id) => setSelecciones((prev) => ({ ...prev, [grupo.id]: id }))}
          />
        ))}
      </View>

      <View style={styles.textCard}>
        <Text style={styles.textLabel}>Reglas adicionales</Text>
        <TextInput
          value={adicionales}
          onChangeText={setAdicionales}
          multiline
          style={styles.textInput}
          placeholder="Escribe una regla adicional"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <PrimaryButton label="Guardar reglas" onPress={() => navigation.navigate('ConoceZona')} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.lg },
  textCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  textLabel: { ...typography.label, color: colors.textMuted },
  textInput: {
    ...typography.bodyStrong,
    color: colors.textDark,
    padding: 0,
    minHeight: 36,
    textAlignVertical: 'top',
  },
});
