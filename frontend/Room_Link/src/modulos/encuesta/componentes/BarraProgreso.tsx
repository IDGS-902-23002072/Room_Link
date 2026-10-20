import { View } from 'react-native';

import { estilos } from '../estilos';

export function BarraProgreso({ progreso }: { progreso: number }) {
  return (
    <View
      accessibilityLabel={`Progreso: ${progreso}%`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: progreso }}
      style={estilos.progreso}>
      <View style={[estilos.progresoLleno, { width: `${progreso}%` }]} />
    </View>
  );
}
