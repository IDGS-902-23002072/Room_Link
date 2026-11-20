import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import type { PerfilCandidato } from '../types';

interface Props {
  perfil: PerfilCandidato;
}

export function ProfileCard({ perfil }: Props) {
  const { iniciales, nombre, edad, compatibilidad, identidadVerificada } = perfil;
  const detalle = `${compatibilidad}% compatible${identidadVerificada ? ' · Identidad verificada' : ''}`;
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.iniciales}>{iniciales}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.nombre}>{`${nombre}, ${edad}`}</Text>
        <Text style={styles.detalle}>{detalle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciales: { ...typography.name, color: colors.primary },
  info: { flex: 1, gap: spacing.xs },
  nombre: { ...typography.name, color: colors.textDark },
  detalle: { ...typography.label, color: colors.textMuted },
});
