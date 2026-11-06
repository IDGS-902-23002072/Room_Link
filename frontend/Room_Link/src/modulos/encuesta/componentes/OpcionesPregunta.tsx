import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Pregunta } from '../datos/preguntas';

export function OpcionesPregunta({
  pregunta,
  seleccionada,
  alSeleccionar,
}: {
  pregunta: Pregunta;
  seleccionada: string;
  alSeleccionar: (respuesta: string) => void;
}) {
  return (
    <View style={styles.pregunta}>
      <Text style={styles.enunciado}>{pregunta.prompt}</Text>
      <View style={styles.opciones}>
        {pregunta.options.map((opcion) => {
          const seleccionadaActual = seleccionada === opcion;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: seleccionadaActual }}
              key={opcion}
              onPress={() => alSeleccionar(opcion)}
              style={({ pressed }) => [
                styles.opcion,
                seleccionadaActual && styles.opcionSeleccionada,
                pressed && styles.presionada,
              ]}>
              <Text
                numberOfLines={1}
                style={[styles.textoOpcion, seleccionadaActual && styles.textoSeleccionado]}>
                {opcion}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pregunta: {
    gap: 6,
  },
  enunciado: {
    color: '#28232D',
    fontSize: 12,
    fontWeight: '600',
  },
  opciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  opcion: {
    minHeight: 32,
    flexGrow: 1,
    flexBasis: '28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1EDF2',
  },
  opcionSeleccionada: {
    backgroundColor: '#E9DAEC',
    borderColor: '#E9DAEC',
  },
  presionada: {
    opacity: 0.75,
  },
  textoOpcion: {
    color: '#625D66',
    fontSize: 10,
  },
  textoSeleccionado: {
    color: '#84658D',
    fontWeight: '600',
  },
});
