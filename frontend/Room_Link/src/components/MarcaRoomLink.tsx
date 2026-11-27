import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { color } from '@/constants/roomlink';

export function MarcaRoomLink() {
  return (
    <View style={styles.fila} accessible accessibilityLabel="RoomLink">
      <View style={styles.sello}>
        <Image source={require('@/assets/images/roomlink-symbol.svg')} contentFit="contain" style={styles.icono} />
      </View>
      <Text style={styles.nombre}>RoomLink</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sello: { paddingVertical: 6 },
  icono: { width: 34, height: 30 },
  nombre: { color: color.tinta, fontSize: 20, fontWeight: '600', letterSpacing: -0.6 },
});
