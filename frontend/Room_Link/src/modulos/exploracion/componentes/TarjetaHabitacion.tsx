import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HabitacionFeed } from '../datos/habitaciones';

export function TarjetaHabitacion({
  habitacion,
  postulada,
  alAbrir,
  alVerRapido,
}: {
  habitacion: HabitacionFeed;
  postulada: boolean;
  alAbrir: () => void;
  alVerRapido: () => void;
}) {
  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <View style={styles.portada}>
          <Text style={styles.iconoPortada}>⌂</Text>
          <Text style={styles.fotos}>
            {habitacion.fotos} {habitacion.fotos === 1 ? 'foto' : 'fotos'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Vista rápida de ${habitacion.titulo}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={(evento) => {
            evento.stopPropagation();
            alVerRapido();
          }}
          style={styles.botonRapido}>
          <Text style={styles.iconoRapido}>◉</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={`Abrir habitación ${habitacion.titulo}`}
        accessibilityRole="button"
        onPress={alAbrir}
        style={({ pressed }) => [styles.contenido, pressed && styles.presionada]}>
        <Text numberOfLines={2} style={styles.titulo}>
          {habitacion.titulo}
        </Text>
        <Text numberOfLines={1} style={styles.renta}>
          {habitacion.rentaTexto}
        </Text>
        <Text numberOfLines={1} style={styles.detalle}>
          {habitacion.disponibleYa
            ? 'Disponible ahora'
            : `Disponible desde ${habitacion.disponibleDesde}`}
        </Text>
        {habitacion.compatibilidad !== null && (
          <Text numberOfLines={1} style={styles.compatibilidad}>
            {habitacion.compatibilidad}% compatible con el anfitrión
          </Text>
        )}
        {postulada && <Text style={styles.postulada}>Postulación enviada</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    minHeight: 160,
    flexBasis: '47%',
    flexGrow: 1,
    padding: 11,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBF1',
  },
  contenido: {
    paddingTop: 3,
  },
  presionada: {
    opacity: 0.7,
  },
  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  portada: {
    flex: 1,
    height: 58,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#E9DAEC',
  },
  iconoPortada: {
    color: '#84658D',
    fontSize: 22,
    lineHeight: 24,
  },
  fotos: {
    color: '#6F5B76',
    fontSize: 8,
    fontWeight: '600',
  },
  botonRapido: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FBF9FC',
  },
  iconoRapido: {
    color: '#84658D',
    fontSize: 16,
  },
  titulo: {
    color: '#28232D',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  renta: {
    color: '#84658D',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  compatibilidad: {
    color: '#84658D',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },
  detalle: {
    color: '#817987',
    fontSize: 9,
    marginTop: 3,
  },
  postulada: {
    color: '#3E7A52',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
  },
});
