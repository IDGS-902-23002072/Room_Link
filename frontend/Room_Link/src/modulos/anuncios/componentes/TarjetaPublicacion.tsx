
import React, { useState } from "react";

import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
} from "react-native";

export type Publicacion = {
  id: string;
  titulo: string;
  precio: string;
  estado: "Activa" | "Pausada" | "Cerrada";
  imagen?: string;
  detalle?: string;
  fotosCount?: number;
};

const imagenPredeterminada =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800";

type Props = {
  publicacion: Publicacion;
  onPausar?: (id: string) => void;
  onReactivar?: (id: string) => void;
  onCerrar?: (id: string) => void;
};

export default function TarjetaPublicacion({
  publicacion,
  onPausar,
  onReactivar,
  onCerrar,
}: Props) {
  const [errorImagen, setErrorImagen] = useState(false);

  const activa = publicacion.estado === "Activa";
  const pausada = publicacion.estado === "Pausada";

  const imagenMostrar =
    !errorImagen && publicacion.imagen
      ? publicacion.imagen
      : imagenPredeterminada;

  return (
    <View style={styles.tarjeta}>
      <Image
        source={{ uri: imagenMostrar }}
        style={styles.imagen}
        resizeMode="cover"
        onError={() => setErrorImagen(true)}
      />

      <View style={styles.contenido}>
        <Text style={styles.estado}>
          {publicacion.estado.toUpperCase()} ·{" "}
          {publicacion.fotosCount ?? 0} FOTOS
        </Text>

        <Text style={styles.titulo}>
          {publicacion.titulo}
        </Text>

        <Text style={styles.detalle}>
          {publicacion.precio} MXN / mes
          {publicacion.detalle
            ? ` · ${publicacion.detalle}`
            : ""}
        </Text>

        <View style={styles.acciones}>
          {activa ? (
            <Pressable
              onPress={() => onPausar?.(publicacion.id)}
            >
              <Text style={styles.accion}>
                Editar · Pausar
              </Text>
            </Pressable>
          ) : pausada ? (
            <Pressable
              onPress={() => onReactivar?.(publicacion.id)}
            >
              <Text style={styles.accion}>
                Reactivar
              </Text>
            </Pressable>
          ) : null}

          {(activa || pausada) && (
            <Text style={styles.separador}> · </Text>
          )}

          <Pressable
            onPress={() => onCerrar?.(publicacion.id)}
          >
            <Text style={styles.accion}>
              Cerrar
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDE5EE",
  },

  imagen: {
    width: "100%",
    height: 105,
    backgroundColor: "#E9DDEB",
  },

  contenido: {
    padding: 12,
  },

  estado: {
    color: "#8A6C91",
    fontSize: 9,
    marginBottom: 5,
    letterSpacing: 0.3,
  },

  titulo: {
    color: "#332A37",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 4,
  },

  detalle: {
    color: "#88768D",
    fontSize: 11,
  },

  acciones: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  accion: {
    color: "#806487",
    fontSize: 11,
    fontWeight: "600",
  },

  separador: {
    color: "#B7A8BA",
    fontSize: 11,
  },
});
