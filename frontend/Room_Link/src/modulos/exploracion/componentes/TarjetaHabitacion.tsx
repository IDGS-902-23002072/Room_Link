import { Pressable, StyleSheet, Text, View } from 'react-native';

import { urlFotoPortada, type HabitacionFeed } from '../../habitaciones/api';
import { formatearFecha, formatearRenta, ubicacionCorta } from '../formato';
import { FotoHabitacion } from './FotoHabitacion';

export function TarjetaHabitacion({
  habitacion,
  alAbrir,
}: {
  habitacion: HabitacionFeed;
  alAbrir: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Ver habitación ${habitacion.title}`}
      accessibilityRole="button"
      onPress={alAbrir}
      style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
      <FotoHabitacion
        estilo={styles.foto}
        uri={habitacion.photosCount > 0 ? urlFotoPortada(habitacion.id) : null}
      />
      <View style={styles.contenido}>
        <View style={styles.filaPrecio}>
          <Text style={styles.renta}>{formatearRenta(habitacion.monthlyRent)}</Text>
          <Text style={styles.mes}>/ mes</Text>
        </View>
        <Text numberOfLines={1} style={styles.titulo}>
          {habitacion.title}
        </Text>
        <Text numberOfLines={1} style={styles.detalle}>
          ⌖ {ubicacionCorta(habitacion.address, habitacion.zone, habitacion.city)}
        </Text>
        <View style={styles.etiquetas}>
          <Text style={styles.etiqueta}>{formatearFecha(habitacion.availableFrom)}</Text>
          {habitacion.maxRoommates ? (
            <Text style={styles.etiqueta}>
              Hasta {habitacion.maxRoommates}{' '}
              {habitacion.maxRoommates === 1 ? 'persona' : 'personas'}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBF1',
  },
  presionada: {
    opacity: 0.75,
  },
  foto: {
    width: '100%',
    height: 150,
  },
  contenido: {
    padding: 12,
  },
  filaPrecio: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  renta: {
    color: '#28232D',
    fontSize: 16,
    fontWeight: '700',
  },
  mes: {
    color: '#817987',
    fontSize: 10,
  },
  titulo: {
    color: '#28232D',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  detalle: {
    color: '#817987',
    fontSize: 10,
    marginTop: 3,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  etiqueta: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#F6F1F7',
    color: '#6F5B76',
    fontSize: 9,
  },
});
