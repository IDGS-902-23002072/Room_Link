import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, spacing } from '../theme';

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Descubrir: 'compass',
  Anuncios: 'home',
  Chats: 'message-circle',
  Perfil: 'user',
};

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.outer}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Feather
                name={ICONS[route.name] ?? 'circle'}
                size={16}
                color={focused ? colors.primary : colors.textStrong}
              />
              <Text style={[styles.label, focused && { color: colors.primary }]}>
                {route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.background, padding: spacing.md },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    gap: 2,
  },
  itemActive: { backgroundColor: colors.lilac },
  label: { fontSize: 9, color: colors.textStrong },
});
