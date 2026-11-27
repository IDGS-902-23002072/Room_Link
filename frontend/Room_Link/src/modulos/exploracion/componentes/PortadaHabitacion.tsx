import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { color } from '@/constants/roomlink';
import { obtenerUrlPrimeraFoto } from '@/modulos/anuncios/api';

export function PortadaHabitacion({ id, fotos }: { id: string; fotos: number }) {
  const [fotoFallida, setFotoFallida] = useState(false);
  if (fotos > 0 && !fotoFallida) {
    return (
      <Image
        accessibilityLabel="Fotografía de la habitación"
        source={obtenerUrlPrimeraFoto(id)}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        onError={() => setFotoFallida(true)}
      />
    );
  }

  return (
    <View style={styles.vacia}>
      <Image source={require('@/assets/images/tabIcons/home-outline.png')} style={styles.icono} />
      <Text style={styles.texto}>{fotos > 0 ? 'Foto no disponible' : 'Sin fotografías'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  vacia: { alignItems: 'center', gap: 8, paddingTop: 24 },
  icono: { width: 32, height: 32 },
  texto: { color: color.secundario, fontSize: 13, fontWeight: '600' },
});
