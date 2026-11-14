import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { HabitacionFeed } from '../datos/habitaciones';

export function FichaHabitacion({
  habitacion,
  postulada,
  enviando,
  alPostularse,
  alCerrar,
}: {
  habitacion: HabitacionFeed;
  postulada: boolean;
  enviando: boolean;
  alPostularse: (mensaje: string | null) => void;
  alCerrar: () => void;
}) {
  const [mensaje, setMensaje] = useState('');

  return (
    <View>
      <View style={styles.portada}>
        <Text style={styles.iconoPortada}>⌂</Text>
        <Text style={styles.fotos}>
          {habitacion.fotos} {habitacion.fotos === 1 ? 'foto' : 'fotos'}
        </Text>
      </View>

      <Text style={styles.titulo}>{habitacion.titulo}</Text>
      <Text style={styles.renta}>{habitacion.rentaTexto}</Text>
      {habitacion.compatibilidad !== null && (
        <Text style={styles.compatibilidad}>
          {habitacion.compatibilidad}% compatible con el anfitrión
        </Text>
      )}

      <View style={styles.datos}>
        <View style={styles.dato}>
          <Text style={styles.etiqueta}>Disponibilidad</Text>
          <Text style={styles.valor}>
            {habitacion.disponibleYa
              ? 'Disponible ahora'
              : habitacion.disponibleDesde}
          </Text>
        </View>
        <View style={styles.dato}>
          <Text style={styles.etiqueta}>Compañeros</Text>
          <Text style={styles.valor}>
            {habitacion.maxCompaneros
              ? `Hasta ${habitacion.maxCompaneros}`
              : 'No indicado'}
          </Text>
        </View>
      </View>

      <Text style={styles.etiqueta}>Descripción</Text>
      <Text style={styles.descripcion}>
        {habitacion.descripcion ?? 'Esta habitación aún no tiene una descripción.'}
      </Text>

      {!postulada && (
        <>
          <Text style={[styles.etiqueta, styles.etiquetaMensaje]}>
            Mensaje para el anfitrión (opcional)
          </Text>
          <TextInput
            accessibilityLabel="Mensaje para el anfitrión"
            maxLength={500}
            multiline
            onChangeText={setMensaje}
            placeholder="Preséntate brevemente…"
            placeholderTextColor="#9A909E"
            style={styles.mensaje}
            value={mensaje}
          />
        </>
      )}

      <View style={styles.acciones}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: postulada || enviando }}
          disabled={postulada || enviando}
          onPress={() => alPostularse(mensaje)}
          style={({ pressed }) => [
            styles.botonPrincipal,
            (postulada || enviando) && styles.botonDeshabilitado,
            pressed && styles.presionado,
          ]}>
          <Text style={styles.textoBotonPrincipal}>
            {postulada ? 'Postulación enviada' : enviando ? 'Enviando…' : 'Postularme'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={alCerrar}
          style={styles.botonSecundario}>
          <Text style={styles.textoBotonSecundario}>Volver al feed</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  portada: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#E9DAEC',
  },
  iconoPortada: {
    color: '#84658D',
    fontSize: 60,
    lineHeight: 66,
  },
  fotos: {
    color: '#6F5B76',
    fontSize: 12,
    fontWeight: '600',
  },
  titulo: {
    color: '#28232D',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    lineHeight: 28,
  },
  renta: {
    color: '#84658D',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  compatibilidad: {
    color: '#84658D',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  datos: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  dato: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  etiqueta: {
    color: '#6B6372',
    fontSize: 12,
    fontWeight: '600',
  },
  valor: {
    color: '#28232D',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  descripcion: {
    color: '#4A4350',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  etiquetaMensaje: {
    marginTop: 16,
  },
  mensaje: {
    minHeight: 84,
    padding: 12,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#EEE8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#28232D',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  acciones: {
    gap: 8,
    marginTop: 14,
  },
  botonPrincipal: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#84658D',
  },
  botonDeshabilitado: {
    backgroundColor: '#B9A6BF',
  },
  presionado: {
    opacity: 0.75,
  },
  textoBotonPrincipal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  botonSecundario: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#E9DAEC',
  },
  textoBotonSecundario: {
    color: '#6F5B76',
    fontSize: 14,
    fontWeight: '600',
  },
});
