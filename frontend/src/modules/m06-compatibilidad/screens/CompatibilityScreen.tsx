import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, ScreenLayout } from '../../../shared/components';
import { AffinityCard } from '../components/AffinityCard';
import { HabitsTable } from '../components/HabitsTable';
import { compatibilityMock as data } from '../data/mock';
import { M06StackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<M06StackParamList, 'Compatibility'>;

export default function CompatibilityScreen({ navigation }: Props) {
  return (
    <ScreenLayout
      eyebrow="ROOMLINK / 06"
      title="¿Qué tanto coinciden?"
      subtitle={`Tú y ${data.roomie.name} · Comparación por hábitos`}
    >
      <AffinityCard affinity={data.affinity} summary={data.summary} />
      <HabitsTable habits={data.habits} otherName={data.roomie.name} />
      <Button
        label="Ver puntos de convivencia"
        onPress={() => navigation.navigate('SharedPoints')}
      />
      <Button
        variant="secondary"
        label="Guardar perfil"
        onPress={() => navigation.navigate('SavedProfiles')}
      />
    </ScreenLayout>
  );
}
