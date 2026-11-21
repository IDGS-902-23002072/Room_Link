
import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  obtenerAnuncioPorId,
  obtenerUrlFoto,
  type AnuncioDetalleBD,
} from "./api";

type Props = {
  anuncioId: string;
  onVolver: () => void;
};

function convertirEstado(estado: AnuncioDetalleBD["status"]) {
  switch (estado) {
    case "published":
      return "Activa";
    case "paused":
      return "Pausada";
    case "closed":
      return "Cerrada";
    case "draft":
      return "Borrador";
    default:
      return estado;
  }
}

function formatearFecha(fecha: string | null) {
  if (!fecha) return "Sin especificar";

  const [anio, mes, dia] = fecha.slice(0, 10).split("-");

  return `${dia}/${mes}/${anio}`;
}

export default function PantallaDetallePublicacion({
  anuncioId,
  onVolver,
}: Props) {
  const [anuncio, setAnuncio] = useState<AnuncioDetalleBD | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    const cargarDetalle = async () => {
      setCargando(true);
      setError(null);

      try {
        const respuesta = await obtenerAnuncioPorId(anuncioId);

        if (activo) {
          setAnuncio(respuesta);
        }
      } catch (error) {
        if (activo) {
          setError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la información del anuncio."
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    void cargarDetalle();

    return () => {
      activo = false;
    };
  }, [anuncioId]);

  if (cargando) {
    return (
      <SafeAreaView style={styles.pantallaCarga}>
        <StatusBar barStyle="dark-content" />

        <ActivityIndicator size="large" color="#806487" />

        <Text style={styles.textoCarga}>
          Cargando información del anuncio...
        </Text>
      </SafeAreaView>
    );
  }

  if (error || !anuncio) {
    return (
      <SafeAreaView style={styles.pantallaCarga}>
        <StatusBar barStyle="dark-content" />

        <Text style={styles.tituloError}>
          No se pudo mostrar el anuncio
        </Text>

        <Text style={styles.textoError}>
          {error ?? "No se encontró la información solicitada."}
        </Text>

        <Pressable style={styles.botonVolver} onPress={onVolver}>
          <Text style={styles.textoBotonVolver}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const fotos = [...anuncio.photos].sort(
    (a, b) => a.position - b.position
  );

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.encabezado}>
        <Pressable onPress={onVolver} style={styles.botonRegresar}>
          <Text style={styles.textoRegresar}>‹ Volver</Text>
        </Pressable>

        <Text style={styles.tituloEncabezado}>
          Detalles del anuncio
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contenido}
      >
        <View style={styles.seccionEstado}>
          <Text style={styles.estado}>
            {convertirEstado(anuncio.status)}
          </Text>
        </View>

        <Text style={styles.titulo}>
          {anuncio.title}
        </Text>

        <Text style={styles.precio}>
          ${Number(anuncio.monthlyRent).toLocaleString("es-MX")}
          <Text style={styles.precioMes}> / mes</Text>
        </Text>

        <Text style={styles.etiquetaSeccion}>
          FOTOGRAFÍAS
        </Text>

        {fotos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listaFotos}
          >
            {fotos.map((foto) => (
              <Image
                key={foto.id}
                source={{
                  uri: obtenerUrlFoto(anuncio.id, foto.id),
                }}
                style={styles.foto}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.sinFotos}>
            <Text style={styles.textoSinFotos}>
              Este anuncio todavía no tiene fotografías.
            </Text>
          </View>
        )}

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>
            Descripción
          </Text>

          <Text style={styles.descripcion}>
            {anuncio.description?.trim() ||
              "No se agregó una descripción para esta habitación."}
          </Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>
            Ubicación
          </Text>

          <Text style={styles.valor}>
            {anuncio.location?.address ?? "Sin ubicación registrada"}
          </Text>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion}>
            Características
          </Text>

          <View style={styles.fila}>
            <Text style={styles.etiqueta}>Renta mensual</Text>
            <Text style={styles.valor}>
              ${Number(anuncio.monthlyRent).toLocaleString("es-MX")}
            </Text>
          </View>

          <View style={styles.fila}>
            <Text style={styles.etiqueta}>Disponible desde</Text>
            <Text style={styles.valor}>
              {formatearFecha(anuncio.availableFrom)}
            </Text>
          </View>

          <View style={styles.fila}>
            <Text style={styles.etiqueta}>Máximo de compañeros</Text>
            <Text style={styles.valor}>
              {anuncio.maxRoommates ?? "Sin especificar"}
            </Text>
          </View>

          <View style={styles.fila}>
            <Text style={styles.etiqueta}>Fotografías</Text>
            <Text style={styles.valor}>
              {fotos.length}
            </Text>
          </View>
        </View>

        <Text style={styles.nota}>
          La información mostrada corresponde a los datos registrados
          en esta publicación.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F8F5F9",
  },

  pantallaCarga: {
    flex: 1,
    backgroundColor: "#F8F5F9",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  encabezado: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EDE5EE",
  },

  botonRegresar: {
    marginBottom: 10,
  },

  textoRegresar: {
    color: "#806487",
    fontSize: 14,
    fontWeight: "600",
  },

  tituloEncabezado: {
    color: "#332A37",
    fontSize: 20,
    fontWeight: "700",
  },

  contenido: {
    padding: 18,
    paddingBottom: 35,
  },

  seccionEstado: {
    alignSelf: "flex-start",
    backgroundColor: "#EDE5F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },

  estado: {
    color: "#806487",
    fontSize: 11,
    fontWeight: "700",
  },

  titulo: {
    color: "#332A37",
    fontSize: 23,
    fontWeight: "700",
    marginBottom: 8,
  },

  precio: {
    color: "#806487",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 24,
  },

  precioMes: {
    color: "#948798",
    fontSize: 13,
    fontWeight: "400",
  },

  etiquetaSeccion: {
    color: "#948798",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 12,
  },

  listaFotos: {
    gap: 10,
    paddingBottom: 8,
  },

  foto: {
    width: 245,
    height: 175,
    borderRadius: 13,
    backgroundColor: "#E9DDEB",
  },

  sinFotos: {
    height: 100,
    backgroundColor: "#EFE8F1",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  textoSinFotos: {
    color: "#88768D",
    fontSize: 12,
  },

  seccion: {
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    padding: 16,
    marginTop: 17,
    borderWidth: 1,
    borderColor: "#EDE5EE",
  },

  tituloSeccion: {
    color: "#332A37",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 13,
  },

  descripcion: {
    color: "#766A7A",
    fontSize: 13,
    lineHeight: 21,
  },

  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F1ECF2",
  },

  etiqueta: {
    color: "#948798",
    fontSize: 12,
    flex: 1,
  },

  valor: {
    color: "#443849",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },

  nota: {
    color: "#A397A7",
    fontSize: 10,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 16,
  },

  textoCarga: {
    color: "#806487",
    fontSize: 12,
    marginTop: 15,
  },

  tituloError: {
    color: "#332A37",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
  },

  textoError: {
    color: "#88768D",
    fontSize: 12,
    textAlign: "center",
  },

  botonVolver: {
    backgroundColor: "#806487",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 9,
    marginTop: 20,
  },

  textoBotonVolver: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
