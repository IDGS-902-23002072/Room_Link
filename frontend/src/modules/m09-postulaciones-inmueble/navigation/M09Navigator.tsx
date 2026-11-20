import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  DecisionPostulacionScreen,
  DetalleCandidatoScreen,
  ListaPostulacionesScreen,
} from '../screens';
import type { M09StackParamList } from './types';

const Stack = createNativeStackNavigator<M09StackParamList>();

interface Props {
  /** Útil para previsualizar una pantalla específica mientras se diseña */
  initialRouteName?: keyof M09StackParamList;
}

export function M09Navigator({ initialRouteName = 'ListaPostulaciones' }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="ListaPostulaciones" component={ListaPostulacionesScreen} />
      <Stack.Screen name="DetalleCandidato" component={DetalleCandidatoScreen} />
      <Stack.Screen name="DecisionPostulacion" component={DecisionPostulacionScreen} />
    </Stack.Navigator>
  );
}
