import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import type { HabitacionFeed } from '../datos/habitaciones';

function iniciales(nombre: string | null) {
  if (!nombre) return 'A';
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toLocaleUpperCase('es') ?? '')
    .join('');
}

export function TarjetaHabitacion({
  habitacion,
  postulada,
  enviando,
  guardada,
  alAbrir,
  alAlternarGuardada,
  alPostularme,
}: {
  habitacion: HabitacionFeed;
  postulada: boolean;
  enviando: boolean;
  guardada: boolean;
  alAbrir: () => void;
  alAlternarGuardada: () => void;
  alPostularme: () => void;
}) {
  const compartir = () => {
    Share.share({
      message: `${habitacion.titulo} · ${habitacion.rentaTexto}`,
    }).catch(() => {
      // El usuario canceló o la plataforma no permite compartir.
    });
  };

  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <View style={styles.avatar}>
          <Text style={styles.iniciales}>{iniciales(habitacion.anfitrion)}</Text>
        </View>
        <View style={styles.infoAnfitrion}>
          <Text numberOfLines={1} style={styles.nombre}>
            {habitacion.anfitrion ?? 'Anfitrión'}
          </Text>
          <Text style={styles.rol}>Anfitrión</Text>
        </View>
        {habitacion.compatibilidad !== null && (
          <View style={styles.compatibilidad}>
            <Text style={styles.textoCompatibilidad}>
              {habitacion.compatibilidad}% compatible
            </Text>
          </View>
        )}
      </View>

      <Pressable
        accessibilityLabel={`Abrir habitación ${habitacion.titulo}`}
        accessibilityRole="button"
        onPress={alAbrir}
        style={({ pressed }) => pressed && styles.presionada}>
        <View style={styles.portada}>
          <Text style={styles.iconoPortada}>⌂</Text>
          <View style={styles.etiquetaDisponible}>
            <Text style={styles.textoDisponible}>
              {habitacion.disponibleYa
                ? 'Disponible ahora'
                : `Desde ${habitacion.disponibleDesde}`}
            </Text>
          </View>
          <View style={styles.contadorFotos}>
            <Text style={styles.textoContador}>
              {habitacion.fotos} {habitacion.fotos === 1 ? 'foto' : 'fotos'}
            </Text>
          </View>
          <View style={styles.franjaPrecio}>
            <Text style={styles.precio}>
              {habitacion.rentaTexto.replace(' MXN/mes', '')}
            </Text>
            <Text style={styles.unidadPrecio}>MXN / mes</Text>
          </View>
        </View>

        <View style={styles.cuerpo}>
          <Text numberOfLines={2} style={styles.titulo}>
            {habitacion.titulo}
          </Text>
          {habitacion.descripcion && (
            <Text numberOfLines={2} style={styles.descripcion}>
              {habitacion.descripcion}
            </Text>
          )}
          {habitacion.maxCompaneros !== null && (
            <Text style={styles.detalle}>
              Hasta {habitacion.maxCompaneros}{' '}
              {habitacion.maxCompaneros === 1 ? 'compañero' : 'compañeros'}
            </Text>
          )}
        </View>
      </Pressable>

      <View style={styles.acciones}>
        <Pressable
          accessibilityLabel={guardada ? 'Quitar de guardadas' : 'Guardar habitación'}
          accessibilityRole="button"
          accessibilityState={{ selected: guardada }}
          onPress={alAlternarGuardada}
          style={styles.botonIcono}>
          <Text style={styles.iconoAccion}>{guardada ? '♥' : '♡'}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Compartir habitación"
          accessibilityRole="button"
          onPress={compartir}
          style={styles.botonIcono}>
          <Text style={styles.iconoAccion}>↗</Text>
        </Pressable>
        {postulada ? (
          <View style={styles.enviada}>
            <Text style={styles.textoEnviada}>✓ Postulación enviada</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: enviando }}
            disabled={enviando}
            onPress={alPostularme}
            style={({ pressed }) => [
              styles.botonPostular,
              enviando && styles.botonDeshabilitado,
              pressed && styles.presionada,
            ]}>
            <Text style={styles.textoPostular}>
              {enviando ? 'Enviando…' : 'Postularme'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBF1',
    overflow: 'hidden',
    shadowColor: '#4D3459',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  presionada: {
    opacity: 0.8,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#E9DAEC',
  },
  iniciales: {
    color: '#5E4466',
    fontSize: 15,
    fontWeight: '700',
  },
  infoAnfitrion: {
    flex: 1,
    gap: 2,
  },
  nombre: {
    color: '#28232D',
    fontSize: 15,
    fontWeight: '600',
  },
  rol: {
    color: '#6B6372',
    fontSize: 12,
  },
  compatibilidad: {
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#E9DAEC',
  },
  textoCompatibilidad: {
    color: '#4F3858',
    fontSize: 12,
    fontWeight: '700',
  },
  portada: {
    aspectRatio: 1.05,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9DAEC',
  },
  iconoPortada: {
    color: '#84658D',
    fontSize: 84,
    lineHeight: 92,
  },
  etiquetaDisponible: {
    position: 'absolute',
    top: 14,
    left: 14,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  textoDisponible: {
    color: '#2F6B45',
    fontSize: 12,
    fontWeight: '700',
  },
  contadorFotos: {
    position: 'absolute',
    top: 14,
    right: 14,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(24, 14, 30, 0.6)',
  },
  textoContador: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  franjaPrecio: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 36,
    paddingBottom: 16,
    backgroundColor: 'rgba(24, 14, 30, 0.58)',
  },
  precio: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  unidadPrecio: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  cuerpo: {
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  titulo: {
    color: '#28232D',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  descripcion: {
    color: '#4A4350',
    fontSize: 14,
    lineHeight: 21,
  },
  detalle: {
    color: '#6B6372',
    fontSize: 13,
  },
  acciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  botonIcono: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEE8F0',
    backgroundColor: '#FFFFFF',
  },
  iconoAccion: {
    color: '#84658D',
    fontSize: 24,
    lineHeight: 28,
  },
  botonPostular: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#84658D',
  },
  botonDeshabilitado: {
    backgroundColor: '#B9A6BF',
  },
  textoPostular: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  enviada: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#E4F1E8',
  },
  textoEnviada: {
    color: '#2F6B45',
    fontSize: 15,
    fontWeight: '600',
  },
});
