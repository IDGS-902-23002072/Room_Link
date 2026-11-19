import React from 'react';
import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, CardLabel, ScreenLayout } from '../../../shared/components';
import { colors, typography } from '../../../shared/theme';
import { compatibilityMock as data } from '../data/mock';
import { M06StackParamList } from '../../../modules/m06-compatibilidad/types';

type Props = NativeStackScreenProps<M06StackParamList, 'SharedPoints'>;

export default function SharedPointsScreen({ navigation }: Props) {
  return (
    <ScreenLayout
      eyebrow="ROOMLINK / 06"
      title="Lo que pueden compartir"
      subtitle="Las diferencias también se pueden acordar."
    >
      <Card tone="mint">
        <Text style={[typography.bodyStrong, { color: colors.textStrong }]}>
          {data.commonPointsCount} puntos en común
        </Text>
        <Text style={[typography.body, { marginTop: 6 }]}>
          {data.commonPointsSummary}
        </Text>
      </Card>

      <Card>
        <CardLabel>PARA CONVERSAR</CardLabel>
        <Text style={[typography.bodyStrong, { marginTop: 4 }]}>
          {data.talkingPoint.title}
        </Text>
        <Text style={typography.body}>{data.talkingPoint.description}</Text>
      </Card>

      <Card>
        <Text style={[typography.bodyStrong, { fontSize: 13 }]}>
          {data.suggestion.title}
        </Text>
        <Text style={typography.body}>{data.suggestion.description}</Text>
      </Card>

      <Button
        label={`Enviar solicitud a ${data.roomie.name}`}
        onPress={() => {
          /* TODO: conectar con módulo de solicitudes/chat */
        }}
      />
      <Button
        variant="secondary"
        label="Volver a comparar"
        onPress={() => navigation.goBack()}
      />
    </ScreenLayout>
  );
}
