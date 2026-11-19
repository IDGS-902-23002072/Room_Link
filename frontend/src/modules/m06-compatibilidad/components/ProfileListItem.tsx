import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Card, CardLabel } from '../../../shared/components';
import { colors, typography } from '../../../shared/theme';
import { SavedProfile } from '../../../modules/m06-compatibilidad/types';

type Props = { profile: SavedProfile; onPress?: () => void };

export function ProfileListItem({ profile, onPress }: Props) {
  const label =
    profile.status === 'saved'
      ? `GUARDADO · ${profile.affinity}%`
      : 'DESCARTADO';
  return (
    <Pressable onPress={onPress}>
      <Card>
        <CardLabel>{label}</CardLabel>
        <Text style={[typography.bodyStrong, styles.name]}>{profile.name}</Text>
        <Text style={typography.body}>{profile.detail}</Text>
      </Card>
    </Pressable>
  );
}

const styles = { name: { marginTop: 4, marginBottom: 2, color: colors.textStrong } };
