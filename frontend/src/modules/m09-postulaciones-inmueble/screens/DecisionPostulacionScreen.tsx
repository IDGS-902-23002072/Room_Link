import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  HighlightCard,
  MessageField,
  NoteText,
  PrimaryButton,
  ScreenHeader,
  ScreenLayout,
} from '../components';
import {
  DECISION_SUBTITULO,
  MENSAJE_ETIQUETA,
  MENSAJE_INICIAL,
  NOTA_DECISION,
  RESUMEN_TEXTO,
  RESUMEN_TITULO,
} from '../data/decision';
import type { M09StackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<M09StackParamList, 'DecisionPostulacion'>;

export function DecisionPostulacionScreen({ navigation }: Props) {
  const [mensaje, setMensaje] = useState(MENSAJE_INICIAL);
  const terminar = () => navigation.popToTop();

  return (
    <ScreenLayout>
      <ScreenHeader title="Tu decisión" subtitle={DECISION_SUBTITULO} />

      <HighlightCard titulo={RESUMEN_TITULO} texto={RESUMEN_TEXTO} />

      <MessageField etiqueta={MENSAJE_ETIQUETA} value={mensaje} onChangeText={setMensaje} />

      <PrimaryButton variant="accent" label="Aceptar postulación" onPress={terminar} />
      <PrimaryButton variant="secondary" label="Poner en lista de espera" onPress={terminar} />
      <PrimaryButton variant="secondary" label="Rechazar postulación" onPress={terminar} />

      <NoteText texto={NOTA_DECISION} />
    </ScreenLayout>
  );
}
