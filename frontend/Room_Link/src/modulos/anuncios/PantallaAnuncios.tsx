import React, { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  BackHandler,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
} from "react-native";

import PantallaPublicarHabitacion, {
  type DatosHabitacion,
} from "./PantallaPublicarHabitacion";

import PantallaUbicacion from "./PantallaUbicacion";
import PantallaDetallePublicacion from "./PantallaDetallePublicacion";

import PantallaFotos, {
  type Foto,
} from "./PantallaFotos";

import PantallaAnunciosPrincipal from "./PantallaAnunciosPrincipal";

import {
  crearAnuncio,
  publicarAnuncio,
  obtenerAnuncioPorId,
  obtenerUrlFoto,
  actualizarAnuncio,
  type FotoEdicion,
} from "./api";

// ======================================================
// TIPOS
// ======================================================

type Vista =
  | "anuncios"
  | "publicar"
  | "ubicacion"
  | "fotos"
  | "cargandoEdicion"
  | "detalle";

type Coordenadas = {
  latitude: number;
  longitude: number;
};

// ======================================================
// DATOS INICIALES
// ======================================================

const datosVacios: DatosHabitacion = {
  titulo: "",
  ubicacion: "",
  renta: "",
  descripcion: "",
  availableFrom: "",
  maxRoommates: "",
};

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export function PantallaAnuncios() {
  const [vista, setVista] = useState<Vista>("anuncios");

  const [datosHabitacion, setDatosHabitacion] =
    useState<DatosHabitacion>({ ...datosVacios });

  const [coordenadas, setCoordenadas] =
    useState<Coordenadas | null>(null);

  const [enviando, setEnviando] = useState(false);

  // ID de un borrador nuevo que ya se creó en el backend.
  const [habitacionIdPendiente, setHabitacionIdPendiente] =
    useState<string | null>(null);

  // Modo de edición.
  const [modoEdicion, setModoEdicion] = useState(false);

  // ID de la publicación que se está editando.
  const [habitacionIdEdicion, setHabitacionIdEdicion] =
    useState<string | null>(null);

  const [estadoEdicion, setEstadoEdicion] = useState<
    "draft" | "published" | "paused" | "closed" | null
  >(null);

  // Fotografías existentes en el servidor.
  const [fotosIniciales, setFotosIniciales] = useState<Foto[]>([]);

  const [anuncioSeleccionado, setAnuncioSeleccionado] =
    useState<string | null>(null);

  useEffect(() => {
  const suscripcion = BackHandler.addEventListener(
    "hardwareBackPress",
    () => {
      switch (vista) {
        case "fotos":
          setVista("ubicacion");
          return true;

        case "ubicacion":
          setVista("publicar");
          return true;

        case "publicar":
          setVista("anuncios");
          return true;

        case "detalle":
          setAnuncioSeleccionado(null);
          setVista("anuncios");
          return true;

        case "cargandoEdicion":
        case "anuncios":
          return true;

        default:
          return true;
      }
    }
  );

  return () => suscripcion.remove();
}, [vista]);

  // ====================================================
  // REINICIAR FORMULARIO
  // ====================================================

  const reiniciarFormulario = () => {
    setDatosHabitacion({ ...datosVacios });
    setCoordenadas(null);
    setHabitacionIdPendiente(null);
    setHabitacionIdEdicion(null);
    setFotosIniciales([]);
    setModoEdicion(false);
    setVista("anuncios");
    setEstadoEdicion(null);
  };

  // ====================================================
  // NUEVA PUBLICACIÓN
  // ====================================================

  const iniciarNuevaPublicacion = () => {
    setDatosHabitacion({ ...datosVacios });
    setCoordenadas(null);
    setHabitacionIdPendiente(null);
    setHabitacionIdEdicion(null);
    setFotosIniciales([]);
    setModoEdicion(false);
    setVista("publicar");
    setEstadoEdicion(null);
  };

  // ====================================================
  // EDITAR PUBLICACIÓN
  // ====================================================

  const editarPublicacion = async (id: string) => {
    try {
      setVista("cargandoEdicion");

      const anuncio = await obtenerAnuncioPorId(id);

      // Cargar los datos del formulario.
      setDatosHabitacion({
        titulo: anuncio.title,
        descripcion: anuncio.description ?? "",
        renta: String(anuncio.monthlyRent),
        ubicacion: anuncio.location?.address ?? "",
        availableFrom: anuncio.availableFrom ?? "",
        maxRoommates:
          anuncio.maxRoommates != null
            ? String(anuncio.maxRoommates)
            : "",
      });

      // Recuperar coordenadas.
      setCoordenadas(
        anuncio.location
          ? {
            latitude: anuncio.location.latitude,
            longitude: anuncio.location.longitude,
          }
          : null
      );

      // Guardar el ID original.
      setHabitacionIdEdicion(anuncio.id);
      // Guardar el estado original de la habitación.
      setEstadoEdicion(anuncio.status);

      // Activar edición.
      setModoEdicion(true);

      // Recuperar fotografías existentes.
      const fotosRecuperadas: Foto[] = anuncio.photos.map((foto) => ({
        id: foto.id,
        uri: obtenerUrlFoto(anuncio.id, foto.id),
        fileName: foto.fileName,
        mimeType: foto.mimeType,
      }));

      setFotosIniciales(fotosRecuperadas);

      setVista("publicar");
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "No se pudo cargar la publicación.";

      Alert.alert("Error al editar", mensaje);
      setVista("anuncios");
    }
  };

  // ====================================================
  // VER DETALLES DE UNA PUBLICACIÓN
  // ====================================================

  const verDetallesPublicacion = (id: string) => {
    setAnuncioSeleccionado(id);
    setVista("detalle");
  };

  // ====================================================
  // PREPARAR DATOS PARA EL BACKEND
  // ====================================================

  const construirDatosAnuncio = (
    datos: DatosHabitacion,
    fotos: Foto[]
  ) => {
    return {
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion.trim(),
      renta: datos.renta.trim(),

      ubicacion: datos.ubicacion.trim() || null,

      latitude: coordenadas?.latitude ?? null,
      longitude: coordenadas?.longitude ?? null,

      availableFrom: datos.availableFrom.trim() || null,

      maxRoommates: datos.maxRoommates.trim()
        ? Number(datos.maxRoommates)
        : null,

      fotos,
    };
  };

  // ====================================================
  // CONVERTIR FOTOGRAFÍAS PARA EDICIÓN
  // ====================================================

  const convertirFotosEdicion = (
    fotos: Foto[]
  ): FotoEdicion[] => {
    return fotos.map((foto) => {
      const fotoExistente = fotosIniciales.find(
        (original) => original.id === foto.id
      );

      if (fotoExistente) {
        return {
          type: "existing",
          id: foto.id,
        };
      }

      return {
        type: "new",
        foto,
      };
    });
  };

  // ====================================================
  // GUARDAR BORRADOR
  // ====================================================

  const guardarBorrador = async (datos: DatosHabitacion) => {
    if (enviando) return;

    setEnviando(true);

    try {
      const datosApi = construirDatosAnuncio(datos, []);

      if (modoEdicion && habitacionIdEdicion) {
        // Al editar, conservar las fotografías existentes.
        const fotosConservadas: FotoEdicion[] =
          fotosIniciales.map((foto) => ({
            type: "existing",
            id: foto.id,
          }));

        await actualizarAnuncio(habitacionIdEdicion, {
          ...datosApi,
          fotos: fotosConservadas,
        });

        Alert.alert(
          "Cambios guardados",
          "La información de la habitación se actualizó correctamente.",
          [
            {
              text: "Aceptar",
              onPress: reiniciarFormulario,
            },
          ]
        );

        return;
      }

      if (habitacionIdPendiente) {
        // Actualizar el borrador previamente creado.
        await actualizarAnuncio(habitacionIdPendiente, {
          ...datosApi,
          fotos: [],
        });

        Alert.alert(
          "¡Borrador actualizado!",
          "Los cambios se guardaron correctamente.",
          [
            {
              text: "Aceptar",
              onPress: reiniciarFormulario,
            },
          ]
        );

        return;
      }

      // Crear un borrador nuevo.
      const habitacion = await crearAnuncio(datosApi);

      setHabitacionIdPendiente(habitacion.id);

      Alert.alert(
        "¡Borrador guardado!",
        "Tu habitación se guardó correctamente. Puedes completar su ubicación y fotografías después.",
        [
          {
            text: "Aceptar",
            onPress: reiniciarFormulario,
          },
        ]
      );
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "No se pudo guardar el borrador.";

      Alert.alert("Error al guardar", mensaje);
    } finally {
      setEnviando(false);
    }
  };

  // ====================================================
  // RECIBIR DATOS DEL FORMULARIO
  // ====================================================

  const continuarFormulario = (datos: DatosHabitacion) => {
    setDatosHabitacion(datos);
    setVista("ubicacion");
  };

  // ====================================================
  // RECIBIR UBICACIÓN
  // ====================================================

  const continuarUbicacion = (
    direccion: string,
    ubicacionCoordenadas: Coordenadas
  ) => {
    setDatosHabitacion((actual) => ({
      ...actual,
      ubicacion: direccion,
    }));

    setCoordenadas(ubicacionCoordenadas);
    setVista("fotos");
  };

  // ====================================================
  // ENVIAR A PUBLICACIÓN
  // ====================================================
  /*
    const enviarRevision = async (fotos: Foto[]) => {
      if (enviando) return;

      if (!coordenadas || !datosHabitacion.ubicacion.trim()) {
        Alert.alert(
          "Ubicación requerida",
          "Selecciona la ubicación de la habitación."
        );
        return;
      }

      if (fotos.length < 3) {
        Alert.alert(
          "Fotografías insuficientes",
          "Debes agregar al menos 3 fotografías para publicar."
        );
        return;
      }

      setEnviando(true);

      try {
        const datosApi = construirDatosAnuncio(
          datosHabitacion,
          fotos
        );

        if (modoEdicion && habitacionIdEdicion) {
          // Identificar fotografías existentes y nuevas.
          const fotosParaGuardar = convertirFotosEdicion(fotos);

          await actualizarAnuncio(habitacionIdEdicion, {
            ...datosApi,
            fotos: fotosParaGuardar,
          });

          Alert.alert(
            "¡Cambios guardados!",
            "La publicación se actualizó correctamente.",
            [
              {
                text: "Aceptar",
                onPress: reiniciarFormulario,
              },
            ]
          );

          return;
        }

        let habitacionId = habitacionIdPendiente;

        if (!habitacionId) {
          // Crear una publicación nueva.
          const habitacion = await crearAnuncio(datosApi);

          habitacionId = habitacion.id;

          setHabitacionIdPendiente(habitacion.id);
        } else {
          // Actualizar el borrador que ya existía.
          const fotosParaGuardar = convertirFotosEdicion(fotos);

          await actualizarAnuncio(habitacionId, {
            ...datosApi,
            fotos: fotosParaGuardar,
          });
        }

        // Publicar el borrador.
        await publicarAnuncio(habitacionId);

        Alert.alert(
          "¡Publicación exitosa!",
          `Tu habitación "${datosHabitacion.titulo}" se guardó y publicó correctamente.\n\nFotografías almacenadas: ${fotos.length}`,
          [
            {
              text: "Aceptar",
              onPress: reiniciarFormulario,
            },
          ]
        );
      } catch (error) {
        const mensaje =
          error instanceof Error
            ? error.message
            : "Ocurrió un error al guardar la habitación.";

        Alert.alert(
          "No se pudieron guardar los cambios",
          mensaje
        );
      } finally {
        setEnviando(false);
      }
    };
    */


  const enviarRevision = async (fotos: Foto[]) => {
    if (enviando) return;

    if (!coordenadas || !datosHabitacion.ubicacion.trim()) {
      Alert.alert(
        "Ubicación requerida",
        "Selecciona la ubicación de la habitación."
      );
      return;
    }

    if (fotos.length < 3) {
      Alert.alert(
        "Fotografías insuficientes",
        "Debes agregar al menos 3 fotografías para publicar."
      );
      return;
    }

    setEnviando(true);

    try {
      const datosApi = construirDatosAnuncio(
        datosHabitacion,
        fotos
      );

      // ================================================
      // EDITAR UNA HABITACIÓN EXISTENTE
      // ================================================

      if (modoEdicion && habitacionIdEdicion) {
        const fotosParaGuardar = convertirFotosEdicion(fotos);

        // Actualizar primero los datos y fotografías.
        await actualizarAnuncio(habitacionIdEdicion, {
          ...datosApi,
          fotos: fotosParaGuardar,
        });

        // Si era un borrador, publicarlo después de actualizarlo.
        if (estadoEdicion === "draft") {
          await publicarAnuncio(habitacionIdEdicion);

          Alert.alert(
            "¡Publicación exitosa!",
            `Tu habitación "${datosHabitacion.titulo}" se actualizó y publicó correctamente.`,
            [
              {
                text: "Aceptar",
                onPress: reiniciarFormulario,
              },
            ]
          );

          return;
        }

        // Si ya estaba publicada o pausada,
        // solamente guardar los cambios.
        Alert.alert(
          "¡Cambios guardados!",
          "La publicación se actualizó correctamente.",
          [
            {
              text: "Aceptar",
              onPress: reiniciarFormulario,
            },
          ]
        );

        return;
      }

      // ================================================
      // CREAR O CONTINUAR UNA HABITACIÓN NUEVA
      // ================================================

      let habitacionId = habitacionIdPendiente;

      if (!habitacionId) {
        const habitacion = await crearAnuncio(datosApi);

        habitacionId = habitacion.id;
        setHabitacionIdPendiente(habitacion.id);
      } else {
        const fotosParaGuardar = convertirFotosEdicion(fotos);

        await actualizarAnuncio(habitacionId, {
          ...datosApi,
          fotos: fotosParaGuardar,
        });
      }

      // Publicar la habitación.
      await publicarAnuncio(habitacionId);

      Alert.alert(
        "¡Publicación exitosa!",
        `Tu habitación "${datosHabitacion.titulo}" se guardó y publicó correctamente.\n\nFotografías almacenadas: ${fotos.length}`,
        [
          {
            text: "Aceptar",
            onPress: reiniciarFormulario,
          },
        ]
      );

    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al guardar la habitación.";

      Alert.alert(
        "No se pudieron guardar los cambios",
        mensaje
      );
    } finally {
      setEnviando(false);
    }
  };


  // ====================================================
  // PANTALLA DE CARGA
  // ====================================================

  if (vista === "cargandoEdicion") {
    return (
      <SafeAreaView style={styles.pantallaCarga}>
        <StatusBar barStyle="dark-content" />

        <ActivityIndicator
          size="large"
          color="#806487"
        />

        <Text style={styles.textoCarga}>
          Recuperando información de la habitación...
        </Text>
      </SafeAreaView>
    );
  }

  // ====================================================
  // PANTALLA DE FORMULARIO
  // ====================================================

  if (vista === "publicar") {
    return (
      <PantallaPublicarHabitacion
        key={modoEdicion ? habitacionIdEdicion ?? "edicion" : "nueva"}
        datosIniciales={datosHabitacion}
        onVolver={() => setVista("anuncios")}
        onElegirUbicacion={continuarFormulario}
        onGuardarBorrador={guardarBorrador}
      />
    );
  }

  // ====================================================
  // PANTALLA DE UBICACIÓN
  // ====================================================

  if (vista === "ubicacion") {
    return (
      <PantallaUbicacion
        ubicacionInicial={datosHabitacion.ubicacion}
        coordenadasIniciales={coordenadas}
        onVolver={() => setVista("publicar")}
        onContinuar={continuarUbicacion}
      />
    );
  }

  // ====================================================
  // PANTALLA DE FOTOGRAFÍAS
  // ====================================================

  if (vista === "fotos") {
    return (
      <PantallaFotos
        key={modoEdicion ? habitacionIdEdicion ?? "edicion" : "nueva"}
        fotosIniciales={fotosIniciales}
        onVolver={() => setVista("ubicacion")}
        onEnviarRevision={enviarRevision}
      />
    );
  }

  // ====================================================
  // PANTALLA DE DETALLES
  // ====================================================

  if (vista === "detalle" && anuncioSeleccionado) {
    return (
      <PantallaDetallePublicacion
        anuncioId={anuncioSeleccionado}
        onVolver={() => {
          setAnuncioSeleccionado(null);
          setVista("anuncios");
        }}
      />
    );
  }

  // ====================================================
  // PANTALLA PRINCIPAL
  // ====================================================

  return (
    <PantallaAnunciosPrincipal
      onCrearPublicacion={iniciarNuevaPublicacion}
      onEditarPublicacion={editarPublicacion}
      onVerDetalles={verDetallesPublicacion}
    />
  );
}

// ======================================================
// ESTILOS
// ======================================================

const styles = StyleSheet.create({
  pantallaCarga: {
    flex: 1,
    backgroundColor: "#F8F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  textoCarga: {
    color: "#806487",
    fontSize: 12,
    marginTop: 15,
  },
});
