import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

type Pestana = "Descubrir" | "Anuncios" | "Chats" | "Perfil";

type Props = {
  activa?: Pestana;
  onCambiar?: (pestana: Pestana) => void;
};

const pestanas: { nombre: Pestana; simbolo: string }[] = [
  { nombre: "Descubrir", simbolo: "⌕" },
  { nombre: "Anuncios", simbolo: "⌂" },
  { nombre: "Chats", simbolo: "▢" },
  { nombre: "Perfil", simbolo: "♙" },
];

export default function BarraInferior({
  activa = "Anuncios",
  onCambiar,
}: Props) {
  return (
    <View style={styles.contenedor}>
      {pestanas.map((pestana) => {
        const seleccionada = activa === pestana.nombre;

        return (
          <Pressable
            key={pestana.nombre}
            onPress={() => onCambiar?.(pestana.nombre)}
            style={styles.elemento}
          >
            <View
              style={[
                styles.icono,
                seleccionada && styles.iconoActivo,
              ]}
            >
              <Text
                style={[
                  styles.simbolo,
                  seleccionada && styles.simboloActivo,
                ]}
              >
                {pestana.simbolo}
              </Text>
            </View>

            <Text
              style={[
                styles.nombre,
                seleccionada && styles.nombreActivo,
              ]}
            >
              {pestana.nombre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    height: 62,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 7,
    marginHorizontal: 15,
    marginBottom: 10,
  },
  elemento: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  icono: {
    width: 42,
    height: 27,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  iconoActivo: {
    backgroundColor: "#E5D5E8",
  },
  simbolo: {
    fontSize: 20,
    color: "#88768D",
  },
  simboloActivo: {
    color: "#765A7E",
  },
  nombre: {
    fontSize: 9,
    color: "#88768D",
  },
  nombreActivo: {
    color: "#765A7E",
    fontWeight: "700",
  },
});
