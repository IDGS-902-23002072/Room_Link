import { Text, View } from 'react-native';

import { estilos } from '../estilos';

export function MedidorResultado({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <View style={estilos.medidor}>
      <View style={estilos.filaMedidor}>
        <Text style={estilos.etiquetaMedidor}>{etiqueta}</Text>
        <Text style={estilos.valorMedidor}>{valor}%</Text>
      </View>
      <View style={estilos.fondoMedidor}>
        <View style={[estilos.llenadoMedidor, { width: `${valor}%` }]} />
      </View>
    </View>
  );
}
