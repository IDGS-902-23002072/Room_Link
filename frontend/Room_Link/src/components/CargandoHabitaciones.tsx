import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { color } from '@/constants/roomlink';

/** Reserva el espacio de la tarjeta mientras llega la primera página. */
export function CargandoHabitaciones() {
  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel="Buscando habitaciones" style={styles.contenedor}>
      <View accessible={false} style={styles.foto} />
      <View style={styles.contenido}>
        <View accessible={false} style={styles.linea} />
        <View accessible={false} style={[styles.linea, styles.corta]} />
        <View style={styles.estado}>
          <ActivityIndicator color={color.accion} />
          <Text style={styles.texto}>Buscando tu próximo espacio…</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { borderRadius: 16, borderWidth: 1, borderColor: color.borde, overflow: 'hidden' },
  foto: { height: 240, backgroundColor: color.superficie },
  contenido: { padding: 20, gap: 12 },
  linea: { height: 18, width: '85%', borderRadius: 4, backgroundColor: color.superficie },
  corta: { width: '55%' },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  texto: { flex: 1, color: color.secundario, fontSize: 14, lineHeight: 20 },
});
