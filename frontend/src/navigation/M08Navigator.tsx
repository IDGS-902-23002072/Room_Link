import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConoceZonaScreen, CostosClarosScreen, ReglasCasaScreen } from '../modules/m08-reglas-inmueble/screens';
import type { M08StackParamList } from '../modules/m08-reglas-inmueble';

const Stack = createNativeStackNavigator<M08StackParamList>();

interface Props {
  /** Útil para previsualizar una pantalla específica mientras se diseña */
  initialRouteName?: keyof M08StackParamList;
}

export function M08Navigator({ initialRouteName = 'ReglasCasa' }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="ReglasCasa" component={ReglasCasaScreen} />
      <Stack.Screen name="ConoceZona" component={ConoceZonaScreen} />
      <Stack.Screen name="CostosClaros" component={CostosClarosScreen} />
    </Stack.Navigator>
  );
}
