import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  InfoCard,
  NoteText,
  PrimaryButton,
  ProfileCard,
  ScreenHeader,
  ScreenLayout,
} from '../components';
import {
  CANDIDATO_SUBTITULO,
  DATOS_CANDIDATO,
  MENSAJE_CANDIDATO,
  PERFIL_CANDIDATO,
} from '../data/candidato';
import type { M09StackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<M09StackParamList, 'DetalleCandidato'>;

export function DetalleCandidatoScreen({ navigation }: Props) {
  return (
    <ScreenLayout>
      <ScreenHeader title="Conoce a tu candidato" subtitle={CANDIDATO_SUBTITULO} />

      <ProfileCard perfil={PERFIL_CANDIDATO} />

      {DATOS_CANDIDATO.map((dato) => (
        <InfoCard key={dato.id} titulo={dato.titulo} detalle={dato.detalle} />
      ))}

      <NoteText texto={MENSAJE_CANDIDATO} cita />

      <PrimaryButton
        label="Evaluar solicitud"
        onPress={() => navigation.navigate('DecisionPostulacion')}
      />
      {/* El mockup no define destino para esta acción: se conecta cuando exista la pantalla. */}
      <PrimaryButton variant="secondary" label="Ver comparación de hábitos" />
    </ScreenLayout>
  );
}
