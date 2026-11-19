import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { M08StackParamList } from '../../../navigation/types';
import { colors, radius, spacing } from '../theme';

const ROUTES: (keyof M08StackParamList)[] = ['ReglasCasa', 'ConoceZona', 'CostosClaros'];

/**
 * Solo para desarrollo: tres puntos para saltar entre las pantallas del módulo
 * y revisarlas contra el mockup. No se muestra en producción (__DEV__ = false).
 * Para quitarlo, borra este archivo y su uso en ScreenLayout.
 */
export function PreviewSwitcher() {
  const navigation = useNavigation<NativeStackNavigationProp<M08StackParamList>>();
  const route = useRoute();

  if (!__DEV__) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {ROUTES.map((name) => (
        <Pressable
          key={name}
          onPress={() => navigation.navigate(name)}
          hitSlop={8}
          style={[styles.dot, route.name === name && styles.dotActive]}
          accessibilityLabel={`Ir a ${name}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  dotActive: { backgroundColor: colors.primary },
});
