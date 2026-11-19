import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../../shared/theme';

type Props = {
  saved: number;
  discarded: number;
  active: 'saved' | 'discarded';
  onChange: (value: 'saved' | 'discarded') => void;
};

export function SegmentedTabs({ saved, discarded, active, onChange }: Props) {
  const items: { key: 'saved' | 'discarded'; label: string }[] = [
    { key: 'saved', label: `Guardados ${saved}` },
    { key: 'discarded', label: `Descartados ${discarded}` },
  ];
  return (
    <View style={styles.wrap}>
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[styles.item, isActive && styles.itemActive]}
          >
            <Text style={[styles.text, isActive && styles.textActive]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.lilac,
    borderRadius: radius.pill,
    padding: 3,
  },
  item: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  itemActive: { backgroundColor: colors.surface },
  text: { fontSize: 11, fontWeight: '600', color: colors.label },
  textActive: { color: colors.textStrong },
});
