import { PortadaHabitacion } from "../../exploracion/componentes/PortadaHabitacion";

import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";

export type Publicacion = {
  id: string;
  titulo: string;
  precio: string;
  estado: "Activa" | "Pausada" | "Cerrada" | "Borrador";
  detalle?: string;
  fotosCount?: number;
};

type Props = {
  publicacion: Publicacion;
  onVerDetalles?: (id: string) => void;
  onEditar?: (id: string) => void;
  onPausar?: (id: string) => void;
  onReactivar?: (id: string) => void;
  onCerrar?: (id: string) => void;
  onVerPostulaciones?: (publicacion: Publicacion) => void;
};

export default function TarjetaPublicacion({
  publicacion,
  onVerDetalles,
  onEditar,
  onPausar,
  onReactivar,
  onCerrar,
  onVerPostulaciones,
}: Props) {
  const activa = publicacion.estado === "Activa";
  const cerrada = publicacion.estado === "Cerrada";
  const borrador = publicacion.estado === "Borrador";

  return (
    <View style={styles.tarjeta}>
      <View style={styles.imagen}>
        <PortadaHabitacion id={publicacion.id} fotos={publicacion.fotosCount ?? 0} />
      </View>

      <View style={styles.contenido}>
        <Text style={styles.estado}>
          {publicacion.estado}
        </Text>

        <Text style={styles.titulo}>
          {publicacion.titulo}
        </Text>

        <Text style={styles.detalle}>
          {publicacion.precio} MXN / mes
          {publicacion.detalle ? ` · ${publicacion.detalle}` : ""}
        </Text>

        <View style={styles.acciones}>
          <Pressable accessibilityRole="button" onPress={() => onVerDetalles?.(publicacion.id)}>
            <Text style={styles.accion}>Ver detalles</Text>
          </Pressable>

          {!cerrada && (
            <>
              <Text style={styles.separador}> · </Text>

              <Pressable onPress={() => onEditar?.(publicacion.id)}>
                <Text style={styles.accion}>Editar</Text>
              </Pressable>
            </>
          )}

          {!cerrada && !borrador && (
            <>
              <Text style={styles.separador}> · </Text>

              {activa ? (
                <Pressable onPress={() => onPausar?.(publicacion.id)}>
                  <Text style={styles.accion}>Pausar</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => onReactivar?.(publicacion.id)}>
                  <Text style={styles.accion}>Reactivar</Text>
                </Pressable>
              )}

              <Text style={styles.separador}> · </Text>

              <Pressable onPress={() => onCerrar?.(publicacion.id)}>
                <Text style={styles.accionCerrar}>Cerrar</Text>
              </Pressable>
            </>
          )}
        </View>

        {!borrador && onVerPostulaciones ? (
          <Pressable
            style={styles.postulaciones}
            onPress={() => onVerPostulaciones(publicacion)}
          >
            <Text style={styles.postulacionesTexto}>
              Ver postulaciones ›
            </Text>
          </Pressable>
        ) : null}
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
    flexWrap: "wrap",
    marginTop: 7,
  },

  accion: {
    color: "#806487",
    fontSize: 11,
    fontWeight: "600",
  },

  accionCerrar: {
    color: "#A33D4D",
    fontSize: 11,
    fontWeight: "600",
  },

  separador: {
    color: "#B7A8BA",
    fontSize: 11,
  },

  postulaciones: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EDE5EE",
  },

  postulacionesTexto: {
    color: "#84658D",
    fontSize: 13,
    fontWeight: "700",
  },
});
