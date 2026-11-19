import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HighlightCard, InfoCard, MapPlaceholder, ScreenHeader, ScreenLayout } from '../../m06-compatibilidad';
import {
  LUGARES_CERCANOS,
  PRIVACIDAD_TEXTO,
  PRIVACIDAD_TITULO,
  ZONA_SUBTITULO,
} from '../../m06-compatibilidad/data/zona';
import type { M08StackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<M08StackParamList, 'ConoceZona'>;

export function ConoceZonaScreen(_props: Props) {
  return (
    <ScreenLayout>
      <ScreenHeader title="Conoce la zona" subtitle={ZONA_SUBTITULO} />

      <MapPlaceholder />

      {LUGARES_CERCANOS.map((lugar) => (
        <InfoCard key={lugar.id} titulo={lugar.nombre} detalle={lugar.detalle} />
      ))}

      <HighlightCard titulo={PRIVACIDAD_TITULO} texto={PRIVACIDAD_TEXTO} />
    </ScreenLayout>
  );
}
