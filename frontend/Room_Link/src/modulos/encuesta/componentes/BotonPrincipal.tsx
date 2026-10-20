import { Pressable, Text } from 'react-native';

import { estilos } from '../estilos';

export function BotonPrincipal({
  etiqueta,
  alPresionar,
}: {
  etiqueta: string;
  alPresionar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.botonPrincipal,
        pressed && estilos.botonPresionado,
      ]}>
      <Text style={estilos.textoBoton}>{etiqueta}</Text>
    </Pressable>
  );
}
