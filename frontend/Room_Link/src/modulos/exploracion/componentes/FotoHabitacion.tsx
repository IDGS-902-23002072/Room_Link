import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

// Muestra una foto de la habitación o un marcador si no tiene o no carga.
export function FotoHabitacion({
  uri,
  estilo,
}: {
  uri: string | null;
  estilo?: StyleProp<ViewStyle>;
}) {
  const [fallo, setFallo] = useState(false);

  if (!uri || fallo) {
    return (
      <View style={[styles.marcador, estilo]}>
        <Text style={styles.icono}>⌂</Text>
        <Text style={styles.texto}>Sin foto</Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      onError={() => setFallo(true)}
      resizeMode="cover"
      source={{ uri }}
      style={estilo as never}
    />
  );
}

const styles = StyleSheet.create({
  marcador: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9DAEC',
  },
  icono: {
    color: '#84658D',
    fontSize: 30,
  },
  texto: {
    color: '#6F5B76',
    fontSize: 10,
    marginTop: 2,
  },
});
