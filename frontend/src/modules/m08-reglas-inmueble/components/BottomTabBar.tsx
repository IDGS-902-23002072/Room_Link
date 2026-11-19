import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

type TabId = 'descubrir' | 'anuncios' | 'chats' | 'perfil';

const TABS: { id: TabId; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { id: 'descubrir', label: 'Descubrir', icon: 'feather' },
  { id: 'anuncios', label: 'Anuncios', icon: 'home' },
  { id: 'chats', label: 'Chats', icon: 'message-circle' },
  { id: 'perfil', label: 'Perfil', icon: 'user' },
];

interface Props {
  active?: TabId;
  onTabPress?: (tab: TabId) => void;
}

export function BottomTabBar({ active = 'anuncios', onTabPress }: Props) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabPress?.(tab.id)}
            style={[styles.tab, isActive && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Feather
              name={tab.icon}
              size={18}
              color={isActive ? colors.textDark : colors.textMuted}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: 2,
  },
  tabActive: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    ...typography.tab,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.textDark,
    fontWeight: '700',
  },
});
