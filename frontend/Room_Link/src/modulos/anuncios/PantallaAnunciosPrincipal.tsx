
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";

import BarraInferior from "./componentes/BarraInferior";

import TarjetaPublicacion, {
  type Publicacion,
} from "./componentes/TarjetaPublicacion";

import {
  obtenerMisPublicaciones,
  obtenerUrlPrimeraFoto,
} from "./api";

// ======================================================
// TIPOS
// ======================================================

type Filtro = "Activas" | "Pausadas" | "Cerradas";

type Props = {
  onCrearPublicacion?: () => void;
  onEditarPublicacion?: (id: string) => void;
};

type EstadoBD = "draft" | "published" | "paused" | "closed";

// ======================================================
// CONVERTIR ESTADO DE BASE DE DATOS A ESTADO VISUAL
// ======================================================

function convertirEstado(
  estado: EstadoBD
): Publicacion["estado"] | null {
  switch (estado) {
    case "published":
      return "Activa";

    case "paused":
      return "Pausada";

    case "closed":
      return "Cerrada";

    case "draft":
      return null;
  }
}

// ======================================================
// CONVERTIR FILTRO A ESTADO VISUAL
// ======================================================

function convertirFiltro(
  filtro: Filtro
): Publicacion["estado"] {
  switch (filtro) {
    case "Activas":
      return "Activa";

    case "Pausadas":
      return "Pausada";

    case "Cerradas":
      return "Cerrada";
  }
}

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function PantallaAnunciosPrincipal({
  onCrearPublicacion,
  onEditarPublicacion,
}: Props) {
  const [publicaciones, setPublicaciones] =
    useState<Publicacion[]>([]);

  const [filtro, setFiltro] =
    useState<Filtro>("Activas");

  const [cargando, setCargando] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);

  // ======================================================
  // CONSULTAR PUBLICACIONES
  // ======================================================

  const cargarPublicaciones = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const respuesta = await obtenerMisPublicaciones();

      const publicacionesConvertidas: Publicacion[] =
        respuesta
          .filter(
            (habitacion) =>
              habitacion.status === "published" ||
              habitacion.status === "paused" ||
              habitacion.status === "closed"
          )
          .map((habitacion) => {
            const estado = convertirEstado(
              habitacion.status as EstadoBD
            );

            return {
              id: habitacion.id,
              titulo: habitacion.title,

              precio: `$${Number(
                habitacion.monthlyRent
              ).toLocaleString("es-MX")}`,

              estado: estado!,

              fotosCount: habitacion.photosCount,

              detalle: `${habitacion.photosCount} fotografías`,

              imagen: obtenerUrlPrimeraFoto(habitacion.id),
            };
          });

      setPublicaciones(publicacionesConvertidas);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al cargar tus publicaciones.";

      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }, []);

  // ======================================================
  // CARGAR PUBLICACIONES AL ENTRAR
  // ======================================================

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      setCargando(true);
      setError(null);

      try {
        const respuesta = await obtenerMisPublicaciones();

        if (!activo) return;

        const publicacionesConvertidas: Publicacion[] =
          respuesta
            .filter(
              (habitacion) =>
                habitacion.status === "published" ||
                habitacion.status === "paused" ||
                habitacion.status === "closed"
            )
            .map((habitacion) => {
              const estado = convertirEstado(
                habitacion.status as EstadoBD
              );

              return {
                id: habitacion.id,
                titulo: habitacion.title,

                precio: `$${Number(
                  habitacion.monthlyRent
                ).toLocaleString("es-MX")}`,

                estado: estado!,

                fotosCount: habitacion.photosCount,

                detalle: `${habitacion.photosCount} fotografías`,

                imagen: obtenerUrlPrimeraFoto(habitacion.id),
              };
            });

        setPublicaciones(publicacionesConvertidas);
      } catch (error) {
        if (!activo) return;

        const mensaje =
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar tus publicaciones.";

        setError(mensaje);
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  // ======================================================
  // FILTRAR PUBLICACIONES
  // ======================================================

  const publicacionesFiltradas = useMemo(() => {
    const estadoBuscado = convertirFiltro(filtro);

    return publicaciones.filter(
      (publicacion) =>
        publicacion.estado === estadoBuscado
    );
  }, [publicaciones, filtro]);

  // ======================================================
  // CONTAR PUBLICACIONES POR ESTADO
  // ======================================================

  const contar = (estado: Publicacion["estado"]): number => {
    return publicaciones.filter(
      (publicacion) => publicacion.estado === estado
    ).length;
  };

  // ======================================================
  // ACTUALIZAR AL DESLIZAR HACIA ABAJO
  // ======================================================

  const actualizar = useCallback(() => {
    cargarPublicaciones();
  }, [cargarPublicaciones]);

  // ======================================================
  // INTERFAZ
  // ======================================================

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      {/* ENCABEZADO */}

      <View style={styles.encabezado}>
        <Text style={styles.marca}>ROOMLINK / 07</Text>

        <Text style={styles.titulo}>
          Mis publicaciones
        </Text>

        <Text style={styles.subtitulo}>
          Gestiona los espacios que compartes.
        </Text>
      </View>

      {/* FILTROS */}

      <View style={styles.pestanas}>
        {(
          ["Activas", "Pausadas", "Cerradas"] as Filtro[]
        ).map((item) => {
          const estado = convertirFiltro(item);

          return (
            <Pressable
              key={item}
              onPress={() => setFiltro(item)}
              style={[
                styles.pestana,
                filtro === item && styles.pestanaActiva,
              ]}
            >
              <Text
                style={[
                  styles.textoPestana,
                  filtro === item &&
                    styles.textoPestanaActivo,
                ]}
              >
                {item} {contar(estado)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* LISTA DE PUBLICACIONES */}

      <ScrollView
        style={styles.lista}
        contentContainerStyle={styles.listaContenido}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cargando}
            onRefresh={actualizar}
            tintColor="#806487"
            colors={["#806487"]}
          />
        }
      >
        {cargando && publicaciones.length === 0 ? (
          <View style={styles.mensaje}>
            <ActivityIndicator
              size="large"
              color="#806487"
            />

            <Text style={styles.textoMensaje}>
              Cargando tus publicaciones...
            </Text>
          </View>
        ) : error && publicaciones.length === 0 ? (
          <View style={styles.mensaje}>
            <Text style={styles.error}>
              {error}
            </Text>

            <Pressable
              style={styles.botonReintentar}
              onPress={cargarPublicaciones}
            >
              <Text style={styles.textoBoton}>
                Volver a intentar
              </Text>
            </Pressable>
          </View>
        ) : publicacionesFiltradas.length > 0 ? (
          publicacionesFiltradas.map((publicacion) => (
            <TarjetaPublicacion
              key={publicacion.id}
              publicacion={publicacion}
              onEditar={onEditarPublicacion}
            />
          ))
        ) : (
          <Text style={styles.vacio}>
            No tienes publicaciones en esta categoría.
          </Text>
        )}

        {/* CREAR PUBLICACIÓN */}

        <Pressable
          style={styles.botonCrear}
          onPress={onCrearPublicacion}
        >
          <Text style={styles.textoBoton}>
            + Crear publicación
          </Text>
        </Pressable>
      </ScrollView>

      <BarraInferior activa="Anuncios" />
    </SafeAreaView>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: "#F8F5F9",
  },

  encabezado: {
    paddingHorizontal: 22,
    paddingTop: 13,
    paddingBottom: 15,
  },

  marca: {
    color: "#8A6C91",
    fontSize: 9,
    letterSpacing: 0.7,
    marginBottom: 7,
  },

  titulo: {
    color: "#332A37",
    fontSize: 23,
    fontWeight: "700",
  },

  subtitulo: {
    color: "#948798",
    fontSize: 11,
    marginTop: 5,
  },

  pestanas: {
    marginHorizontal: 16,
    backgroundColor: "#E9DDEA",
    borderRadius: 9,
    flexDirection: "row",
    padding: 3,
    marginBottom: 12,
  },

  pestana: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 7,
  },

  pestanaActiva: {
    backgroundColor: "#D6C2D9",
  },

  textoPestana: {
    fontSize: 10,
    color: "#8A788D",
  },

  textoPestanaActivo: {
    color: "#654C6D",
    fontWeight: "700",
  },

  lista: {
    flex: 1,
  },

  listaContenido: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    flexGrow: 1,
  },

  vacio: {
    textAlign: "center",
    color: "#948798",
    marginTop: 35,
    fontSize: 12,
  },

  mensaje: {
    alignItems: "center",
    marginTop: 35,
    paddingHorizontal: 15,
  },

  textoMensaje: {
    color: "#948798",
    fontSize: 12,
    marginTop: 12,
  },

  error: {
    color: "#A33D4D",
    fontSize: 12,
    textAlign: "center",
  },

  botonReintentar: {
    backgroundColor: "#806487",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    marginTop: 14,
  },

  botonCrear: {
    backgroundColor: "#806487",
    minHeight: 44,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  textoBoton: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
