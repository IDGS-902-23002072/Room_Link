import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../m08-reglas-inmueble/theme';

/**
 * Mapa ilustrativo (solo diseño). Más adelante se puede reemplazar por
 * un MapView real manteniendo la misma altura y esquinas redondeadas.
 */
export function MapPlaceholder() {
  return (
    <View style={styles.map}>
      <View style={[styles.block, { top: 0, left: 0, width: '16%', height: '36%' }]} />
      <View style={[styles.block, { top: 0, left: '20%', width: '46%', height: '36%' }]} />
      <View style={[styles.block, { top: 0, right: 0, width: '30%', height: '36%' }]} />
      <View style={[styles.block, { bottom: 0, left: 0, width: '16%', height: '56%' }]} />
      <View style={[styles.block, { bottom: 0, left: '20%', width: '46%', height: '56%' }]} />
      <View style={[styles.block, { bottom: 0, right: 0, width: '30%', height: '56%' }]} />

      <View style={styles.park}>
        <Text style={styles.poiText}>Parque</Text>
      </View>
      <View style={styles.utl}>
        <Text style={styles.utlText}>UTL</Text>
      </View>

      <View style={styles.pin}>
        <Feather name="map-pin" size={20} color={colors.textOnPrimary} />
      </View>

      <Text style={styles.caption}>Zona aproximada · Mapa ilustrativo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 150,
    backgroundColor: colors.mapBase,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  block: {
    position: 'absolute',
    backgroundColor: colors.mapBlock,
  },
  park: {
    position: 'absolute',
    top: '30%',
    left: '12%',
    width: 62,
    height: 40,
    backgroundColor: colors.mapPark,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utl: {
    position: 'absolute',
    top: '24%',
    right: '8%',
    width: 40,
    height: 40,
    backgroundColor: colors.mapPoi,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiText: { ...typography.label, fontSize: 10, color: colors.textDark },
  utlText: { ...typography.label, fontSize: 10, color: colors.textDark },
  pin: {
    position: 'absolute',
    top: '12%',
    left: '46%',
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
  },
});
