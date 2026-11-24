import { color } from '@/constants/roomlink';


import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "expo-router";

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";

import { SafeAreaView } from 'react-native-safe-area-context';

import { MarcaRoomLink } from '@/components/MarcaRoomLink';

import TarjetaPublicacion, {
  type Publicacion,
} from "./componentes/TarjetaPublicacion";

import {
  obtenerMisPublicaciones,
  pausarAnuncio,
  reactivarAnuncio,
  cerrarAnuncio,
} from "./api";

// ======================================================
// TIPOS
// ======================================================

type Filtro =
  | "Activas"
  | "Pausadas"
  | "Cerradas"
  | "Borradores";

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
): Publicacion["estado"] {
  switch (estado) {
    case "published":
      return "Activa";

    case "paused":
      return "Pausada";

    case "closed":
      return "Cerrada";

    case "draft":
      return "Borrador";
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

    case "Borradores":
      return "Borrador";
  }
}

// ======================================================
// PANTALLA PRINCIPAL
// ======================================================

export default function PantallaAnunciosPrincipal({
  onCrearPublicacion,
  onEditarPublicacion,
}: Props) {
  const router = useRouter();

  const [publicaciones, setPublicaciones] =
    useState<Publicacion[]>([]);

  const [filtro, setFiltro] =
    useState<Filtro>("Activas");

  const [cargando, setCargando] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);

  const [procesando, setProcesando] =
    useState<string | null>(null);

  // ====================================================
  // CONVERTIR RESPUESTA DEL BACKEND
  // ====================================================

  const convertirPublicaciones = useCallback(
    (
      respuesta: Awaited<
        ReturnType<typeof obtenerMisPublicaciones>
      >
    ) => {
      return respuesta
        .filter(
          (habitacion) =>
            habitacion.status === "published" ||
            habitacion.status === "paused" ||
            habitacion.status === "closed" ||
            habitacion.status === "draft"
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

            estado,

            fotosCount: habitacion.photosCount,

            detalle: `${habitacion.photosCount} fotografías`,

          };
        });
    },
    []
  );

  // ====================================================
  // CONSULTAR PUBLICACIONES
  // ====================================================

  const cargarPublicaciones = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const respuesta = await obtenerMisPublicaciones();

      const publicacionesConvertidas =
        convertirPublicaciones(respuesta);

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
  }, [convertirPublicaciones]);

  // ====================================================
  // CARGAR PUBLICACIONES AL ENTRAR
  // ====================================================

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      setError(null);

      try {
        const respuesta = await obtenerMisPublicaciones();

        if (!activo) return;

        setPublicaciones(convertirPublicaciones(respuesta));
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
  }, [convertirPublicaciones]);

  // ====================================================
  // CAMBIAR ESTADO DE UNA PUBLICACIÓN
  // ====================================================

  const ejecutarAccion = async (
    id: string,
    accion: () => Promise<unknown>,
    mensajeExito: string
  ) => {
    if (procesando) return;

    setProcesando(id);

    try {
      await accion();

      // Consultar nuevamente los estados desde MySQL.
      const respuesta = await obtenerMisPublicaciones();

      setPublicaciones(convertirPublicaciones(respuesta));

      Alert.alert("Operación exitosa", mensajeExito);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la publicación.";

      Alert.alert("Error", mensaje);
    } finally {
      setProcesando(null);
    }
  };

  // ====================================================
  // PAUSAR PUBLICACIÓN
  // ====================================================

  const confirmarPausar = (id: string) => {
    Alert.alert(
      "Pausar publicación",
      "¿Estás segura de que deseas pausar esta publicación? Dejará de estar disponible para quienes buscan habitación.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Pausar",
          onPress: () => {
            void ejecutarAccion(
              id,
              () => pausarAnuncio(id),
              "La publicación se movió a la sección Pausadas."
            );
          },
        },
      ]
    );
  };

  // ====================================================
  // REACTIVAR PUBLICACIÓN
  // ====================================================

  const confirmarReactivar = (id: string) => {
    Alert.alert(
      "Reactivar publicación",
      "¿Deseas volver a publicar esta habitación?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Reactivar",
          onPress: () => {
            void ejecutarAccion(
              id,
              () => reactivarAnuncio(id),
              "La publicación volvió a estar activa."
            );
          },
        },
      ]
    );
  };

  // ====================================================
  // CERRAR PUBLICACIÓN
  // ====================================================

  const confirmarCerrar = (id: string) => {
    Alert.alert(
      "Cerrar publicación",
      "¿Estás segura de que deseas cerrar esta publicación? Esta acción cambiará su estado a cerrada.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Cerrar publicación",
          style: "destructive",
          onPress: () => {
            void ejecutarAccion(
              id,
              () => cerrarAnuncio(id),
              "La publicación se movió a la sección Cerradas."
            );
          },
        },
      ]
    );
  };

  // ====================================================
  // FILTRAR PUBLICACIONES
  // ====================================================

  const publicacionesFiltradas = useMemo(() => {
    const estadoBuscado = convertirFiltro(filtro);

    return publicaciones.filter(
      (publicacion) =>
        publicacion.estado === estadoBuscado
    );
  }, [publicaciones, filtro]);

  // ====================================================
  // CONTAR PUBLICACIONES POR ESTADO
  // ====================================================

  const contar = (estado: Publicacion["estado"]): number => {
    return publicaciones.filter(
      (publicacion) => publicacion.estado === estado
    ).length;
  };

  // ====================================================
  // ACTUALIZAR AL DESLIZAR HACIA ABAJO
  // ====================================================

  const actualizar = useCallback(() => {
    void cargarPublicaciones();
  }, [cargarPublicaciones]);

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      {/* ENCABEZADO */}

      <View style={styles.encabezado}>
        <MarcaRoomLink />

        <Text accessibilityRole="header" style={styles.titulo}>
          Mis publicaciones
        </Text>

        <Text style={styles.subtitulo}>
          Gestiona los espacios que compartes.
        </Text>
      </View>

      {/* FILTROS */}

      <View style={styles.pestanas}>
        {(
          [
            "Activas",
            "Pausadas",
            "Cerradas",
            "Borradores",
          ] as Filtro[]
        ).map((item) => {
          const estado = convertirFiltro(item);

          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: item === filtro }}
              disabled={procesando !== null}
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
            tintColor={color.accion}
            colors={[color.accion]}
          />
        }
      >
        {cargando && publicaciones.length === 0 ? (
          <View style={styles.mensaje}>
            <ActivityIndicator
              size="large"
              color={color.accion}
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
              onPausar={confirmarPausar}
              onReactivar={confirmarReactivar}
              onCerrar={confirmarCerrar}
              onVerPostulaciones={(pub) =>
                router.push({
                  pathname: '/postulaciones',
                  params: { listingId: pub.id, titulo: pub.titulo },
                })
              }
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
          disabled={procesando !== null}
        >
          <Text style={styles.textoBoton}>
            + Crear publicación
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: color.blanco,
  },

  encabezado: {
    paddingHorizontal: 22,
    paddingTop: 13,
    paddingBottom: 18,
    gap: 8,
  },

  titulo: {
    color: color.tinta,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.9,
  },

  subtitulo: {
    color: color.secundario,
    fontSize: 14,
    lineHeight: 20,
  },

  pestanas: {
    marginHorizontal: 16,
    backgroundColor: color.menta,
    borderRadius: 9,
    flexDirection: "row",
    padding: 3,
    marginBottom: 12,
  },

  pestana: {
    flex: 1,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 10,
  },

  pestanaActiva: {
    backgroundColor: color.menta,
  },

  textoPestana: {
    fontSize: 12,
    textAlign: "center",
    color: color.secundario,
  },

  textoPestanaActivo: {
    color: color.accion,
    fontWeight: "700",
  },

  lista: {
    flex: 1,
  },

  listaContenido: {
    paddingHorizontal: 16,
    paddingBottom: 88,
    flexGrow: 1,
  },

  vacio: {
    textAlign: "center",
    color: color.secundario,
    marginTop: 35,
    fontSize: 12,
  },

  mensaje: {
    alignItems: "center",
    marginTop: 35,
    paddingHorizontal: 15,
  },

  textoMensaje: {
    color: color.secundario,
    fontSize: 12,
    marginTop: 12,
  },

  error: {
    color: color.rosaTexto,
    fontSize: 12,
    textAlign: "center",
  },

  botonReintentar: {
    backgroundColor: color.accion,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    marginTop: 14,
  },

  botonCrear: {
    backgroundColor: color.accion,
    minHeight: 44,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  textoBoton: {
    color: color.blanco,
    fontSize: 13,
    fontWeight: "700",
  },
});
