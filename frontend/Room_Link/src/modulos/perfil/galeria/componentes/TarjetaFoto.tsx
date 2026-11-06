import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatearTamano, type FotoPerfil } from '../api';

function BotonAccion({
  etiqueta,
  icono,
  alPresionar,
  deshabilitado = false,
  activo = false,
  peligro = false,
}: {
  etiqueta: string;
  icono: string;
  alPresionar: () => void;
  deshabilitado?: boolean;
  activo?: boolean;
  peligro?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={etiqueta}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado, selected: activo }}
      disabled={deshabilitado}
      hitSlop={4}
      onPress={alPresionar}
      style={({ pressed }) => [
        styles.botonAccion,
        activo && styles.botonActivo,
        deshabilitado && styles.botonDeshabilitado,
        pressed && !deshabilitado && styles.botonPresionado,
      ]}>
      <Text
        style={[
          styles.iconoAccion,
          activo && styles.iconoActivo,
          peligro && styles.iconoPeligro,
        ]}>
        {icono}
      </Text>
    </Pressable>
  );
}

export function TarjetaFoto({
  foto,
  indice,
  total,
  ancho,
  ocupada = false,
  alMarcarPrincipal,
  alMoverIzquierda,
  alMoverDerecha,
  alEliminar,
}: {
  foto: FotoPerfil;
  indice: number;
  total: number;
  ancho: number;
  /** Bloquea las acciones mientras hay una operación en curso. */
  ocupada?: boolean;
  alMarcarPrincipal: () => void;
  alMoverIzquierda: () => void;
  alMoverDerecha: () => void;
  alEliminar: () => void;
}) {
  const esPrincipal = indice === 0;

  return (
    <View
      style={[
        styles.tarjeta,
        esPrincipal && styles.tarjetaPrincipal,
        { width: ancho },
      ]}>
      <View style={styles.marco}>
        <Image
          accessibilityLabel={`Foto ${indice + 1}${
            esPrincipal ? ', foto principal' : ''
          }: ${foto.nombre}`}
          resizeMode="cover"
          source={{ uri: foto.uri }}
          style={styles.foto}
        />

        {esPrincipal && (
          <View style={styles.insignia}>
            <Text style={styles.textoInsignia}>PRINCIPAL</Text>
          </View>
        )}

        <View style={styles.acciones}>
          <BotonAccion
            deshabilitado={indice === 0}
            etiqueta="Mover esta foto antes"
            icono="‹"
            alPresionar={alMoverIzquierda}
          />
          <BotonAccion
            activo={esPrincipal}
            deshabilitado={esPrincipal}
            etiqueta={
              esPrincipal
                ? 'Esta es la foto principal'
                : 'Elegir como foto principal'
            }
            icono={esPrincipal ? '★' : '☆'}
            alPresionar={alMarcarPrincipal}
          />
          <BotonAccion
            deshabilitado={indice === total - 1}
            etiqueta="Mover esta foto después"
            icono="›"
            alPresionar={alMoverDerecha}
          />
          <BotonAccion
            etiqueta="Eliminar esta foto"
            icono="✕"
            peligro
            alPresionar={alEliminar}
          />
        </View>
      </View>

      <View style={styles.pie}>
        <Text style={styles.numero}>Foto {indice + 1}</Text>
        <Text style={styles.tamano}>{formatearTamano(foto.tamano)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    padding: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBF1',
  },
  tarjetaPrincipal: {
    borderColor: '#C9A9D1',
  },
  marco: {
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#F3EBF5',
  },
  foto: {
    width: '100%',
    aspectRatio: 1,
  },
  insignia: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 35, 45, 0.72)',
  },
  textoInsignia: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  acciones: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 35, 45, 0.55)',
  },
  botonAccion: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  botonActivo: {
    backgroundColor: '#84658D',
  },
  botonDeshabilitado: {
    opacity: 0.38,
  },
  botonPresionado: {
    opacity: 0.7,
  },
  iconoAccion: {
    color: '#28232D',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  iconoActivo: {
    color: '#FFFFFF',
  },
  iconoPeligro: {
    color: '#B23A3A',
    fontSize: 11,
  },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 2,
  },
  numero: {
    color: '#6F5B76',
    fontSize: 9,
    fontWeight: '600',
  },
  tamano: {
    color: '#817987',
    fontSize: 8,
  },
});
