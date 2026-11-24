import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
  pasoActual: number;
  total?: number;
};

export default function IndicadorPasos({
  pasoActual,
  total = 3,
}: Props) {
  return (
    <View style={styles.contenedor}>
      <View style={styles.fila}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[
              styles.segmento,
              index < pasoActual && styles.segmentoActivo,
            ]}
          />
        ))}
      </View>

      <Text style={styles.texto}>
        Paso {pasoActual} de {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    marginBottom: 17,
  },
  fila: {
    flexDirection: "row",
    gap: 5,
    height: 4,
  },
  segmento: {
    flex: 1,
    borderRadius: 5,
    backgroundColor: "#E9E0EA",
  },
  segmentoActivo: {
    backgroundColor: "#38BDB2",
  },
  texto: {
    color: "#88768D",
    fontSize: 11,
    marginTop: 7,
  },
});
