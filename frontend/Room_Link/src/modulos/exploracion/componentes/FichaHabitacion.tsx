import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { HabitacionFeed } from '../datos/habitaciones';

export function FichaHabitacion({
  habitacion,
  vistaRapida,
  postulada,
  enviando,
  alPostularse,
  alVerDetalle,
  alCerrar,
}: {
  habitacion: HabitacionFeed;
  vistaRapida: boolean;
  postulada: boolean;
  enviando: boolean;
  alPostularse: (mensaje: string | null) => void;
  alVerDetalle: () => void;
  alCerrar: () => void;
}) {
  const [mensaje, setMensaje] = useState('');

  return (
    <View>
      {vistaRapida && (
        <View style={styles.cinta}>
          <Text style={styles.cintaTexto}>VISTA RÁPIDA</Text>
          <Text style={styles.recomendacion}>HABITACIÓN DEL FEED</Text>
        </View>
      )}

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
      <Text numberOfLines={vistaRapida ? 3 : undefined} style={styles.descripcion}>
        {habitacion.descripcion ?? 'Esta habitación aún no tiene una descripción.'}
      </Text>

      {!vistaRapida && !postulada && (
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
        {vistaRapida ? (
          <Pressable
            accessibilityRole="button"
            onPress={alVerDetalle}
            style={styles.botonSecundario}>
            <Text style={styles.textoBotonSecundario}>Ver detalle</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={alCerrar}
            style={styles.botonSecundario}>
            <Text style={styles.textoBotonSecundario}>Volver al feed</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cinta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cintaTexto: {
    color: '#84658D',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  recomendacion: {
    color: '#817987',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  portada: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#E9DAEC',
  },
  iconoPortada: {
    color: '#84658D',
    fontSize: 38,
    lineHeight: 42,
  },
  fotos: {
    color: '#6F5B76',
    fontSize: 10,
    fontWeight: '600',
  },
  titulo: {
    color: '#28232D',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  renta: {
    color: '#84658D',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  compatibilidad: {
    color: '#84658D',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  datos: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  dato: {
    flex: 1,
    padding: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  etiqueta: {
    color: '#817987',
    fontSize: 9,
    fontWeight: '600',
  },
  valor: {
    color: '#28232D',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  descripcion: {
    color: '#4A4350',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  etiquetaMensaje: {
    marginTop: 12,
  },
  mensaje: {
    minHeight: 64,
    padding: 10,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#EEE8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#28232D',
    fontSize: 11,
    textAlignVertical: 'top',
  },
  acciones: {
    gap: 8,
    marginTop: 14,
  },
  botonPrincipal: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
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
    fontSize: 11,
    fontWeight: '600',
  },
  botonSecundario: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#E9DAEC',
  },
  textoBotonSecundario: {
    color: '#6F5B76',
    fontSize: 10,
    fontWeight: '600',
  },
});
