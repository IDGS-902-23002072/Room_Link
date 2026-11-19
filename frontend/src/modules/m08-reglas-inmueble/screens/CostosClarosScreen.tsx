import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  HighlightCard,
  InfoCard,
  PrimaryButton,
  ScreenHeader,
  ScreenLayout,
} from '../../m06-compatibilidad';
import {
  CONCEPTOS_COSTO,
  COSTOS_SUBTITULO,
  TOTAL_DETALLE,
  TOTAL_MENSUAL,
} from '../../m06-compatibilidad/data/costos';
import type { M08StackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<M08StackParamList, 'CostosClaros'>;

export function CostosClarosScreen({ navigation }: Props) {
  return (
    <ScreenLayout>
      <ScreenHeader title="Costos claros" subtitle={COSTOS_SUBTITULO} />

      {CONCEPTOS_COSTO.map((concepto) => (
        <InfoCard
          key={concepto.id}
          titulo={concepto.etiqueta}
          detalle={concepto.valor}
          destacado={concepto.destacado}
        />
      ))}

      <HighlightCard titulo={`Total mensual estimado · ${TOTAL_MENSUAL}`} texto={TOTAL_DETALLE} />

      <PrimaryButton label="Guardar desglose" onPress={() => navigation.popToTop()} />
    </ScreenLayout>
  );
}
