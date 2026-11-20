import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CandidateCard,
  PrimaryButton,
  ScreenHeader,
  ScreenLayout,
  SegmentedTabs,
} from '../components';
import {
  PESTANAS_POSTULACIONES,
  POSTULACIONES,
  POSTULACIONES_SUBTITULO,
} from '../data/postulaciones';
import type { M09StackParamList } from '../navigation/types';
import type { EstadoPostulacion } from '../types';

type Props = NativeStackScreenProps<M09StackParamList, 'ListaPostulaciones'>;

export function ListaPostulacionesScreen({ navigation }: Props) {
  const [pestana, setPestana] = useState<EstadoPostulacion>('nueva');
  const irADetalle = () => navigation.navigate('DetalleCandidato');

  return (
    <ScreenLayout>
      <ScreenHeader title="Personas interesadas" subtitle={POSTULACIONES_SUBTITULO} />

      <SegmentedTabs pestanas={PESTANAS_POSTULACIONES} activa={pestana} onChange={setPestana} />

      {POSTULACIONES.map((postulacion) => (
        <CandidateCard key={postulacion.id} postulacion={postulacion} onPress={irADetalle} />
      ))}

      <PrimaryButton label="Revisar primera postulación" onPress={irADetalle} />
    </ScreenLayout>
  );
}
