import { Image, StyleSheet, Text, View } from 'react-native';

import { color } from '@/constants/roomlink';

export function MarcaRoomLink() {
  return (
    <View style={styles.fila} accessible accessibilityLabel="RoomLink">
      <View style={styles.sello}>
        <Image source={require('@/assets/images/tabIcons/home-outline.png')} style={styles.icono} />
      </View>
      <Text style={styles.nombre}>RoomLink</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sello: { backgroundColor: color.menta, borderRadius: 12, padding: 8 },
  icono: { width: 22, height: 22 },
  nombre: { color: color.tinta, fontSize: 21, fontWeight: '800', letterSpacing: -0.7 },
});
