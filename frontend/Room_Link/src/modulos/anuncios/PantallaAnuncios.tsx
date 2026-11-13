
import React, { useState } from "react";

import {
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,

} from "react-native";

import PantallaPublicarHabitacion, {
  type DatosHabitacion,
} from "./PantallaPublicarHabitacion";

import PantallaUbicacion from "./PantallaUbicacion";

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

type Vista =
  | "anuncios"
  | "publicar"
  | "ubicacion"
  | "fotos"
  | "cargandoEdicion";

type Coordenadas = {
  latitude: number;
  longitude: number;
};

// Valores iniciales para una habitación nueva.
const datosVacios: DatosHabitacion = {
  titulo: "",
  ubicacion: "",
  renta: "",
  descripcion: "",
  availableFrom: "",
  maxRoommates: "",
};

export function PantallaAnuncios() {
  const [vista, setVista] = useState<Vista>("anuncios");

  const [datosHabitacion, setDatosHabitacion] =
    useState<DatosHabitacion>({ ...datosVacios });

  const [coordenadas, setCoordenadas] =
    useState<Coordenadas | null>(null);

  const [enviando, setEnviando] = useState(false);

  // Conserva el ID cuando falla la publicación de una habitación nueva.
  const [habitacionIdPendiente, setHabitacionIdPendiente] =
    useState<string | null>(null);

  // Indica si estamos creando o editando.
  const [modoEdicion, setModoEdicion] = useState(false);

  // ID de la publicación que estamos editando.
  const [habitacionIdEdicion, setHabitacionIdEdicion] =
    useState<string | null>(null);

  // Fotografías que ya estaban guardadas en el servidor.
  const [fotosIniciales, setFotosIniciales] = useState<Foto[]>([]);

  // Limpiar el formulario y regresar a las publicaciones.
  const reiniciarFormulario = () => {
    setDatosHabitacion({ ...datosVacios });
    setCoordenadas(null);
    setHabitacionIdPendiente(null);
    setHabitacionIdEdicion(null);
    setFotosIniciales([]);
    setModoEdicion(false);
    setVista("anuncios");
  };

  // Comenzar una publicación nueva.
  const iniciarNuevaPublicacion = () => {
    setDatosHabitacion({ ...datosVacios });
    setCoordenadas(null);
    setHabitacionIdPendiente(null);
    setHabitacionIdEdicion(null);
    setFotosIniciales([]);
    setModoEdicion(false);
    setVista("publicar");
  };

  // Consultar una publicación y cargar sus datos para editarla.
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

      // Recuperar las coordenadas guardadas.
      setCoordenadas(
        anuncio.location
          ? {
              latitude: anuncio.location.latitude,
              longitude: anuncio.location.longitude,
            }
          : null
      );

      // Guardar el ID de la publicación original.
      setHabitacionIdEdicion(anuncio.id);

      // Activar el modo edición.
      setModoEdicion(true);

      // Recuperar las fotografías existentes.
      const fotosRecuperadas: Foto[] = anuncio.photos.map((foto) => ({
        id: foto.id,
        uri: obtenerUrlFoto(anuncio.id, foto.id),
        fileName: foto.fileName,
        mimeType: foto.mimeType,
      }));

      setFotosIniciales(fotosRecuperadas);

      // Abrir el formulario con los datos recuperados.
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

  // Recibir información del formulario.
  const continuarFormulario = (datos: DatosHabitacion) => {
    setDatosHabitacion(datos);
    setVista("ubicacion");
  };

  // Recibir ubicación seleccionada.
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

  // Guardar una habitación nueva o actualizar una existente.
  const enviarRevision = async (fotos: Foto[]) => {
    if (enviando) return;

    if (!coordenadas) {
      Alert.alert(
        "Ubicación requerida",
        "Selecciona la ubicación de la habitación."
      );
      return;
    }

    setEnviando(true);

    try {
      if (modoEdicion && habitacionIdEdicion) {
        // Identificar cuáles fotografías ya existen
        // y cuáles son nuevas.
        const fotosParaGuardar: FotoEdicion[] = fotos.map((foto) => {
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

        // Actualizar la publicación original.
        await actualizarAnuncio(habitacionIdEdicion, {
          titulo: datosHabitacion.titulo,
          descripcion: datosHabitacion.descripcion,
          renta: datosHabitacion.renta,
          ubicacion: datosHabitacion.ubicacion,
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
          availableFrom: datosHabitacion.availableFrom,
          maxRoommates: Number(datosHabitacion.maxRoommates),
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
      } else {
        // Crear una habitación nueva.
        let habitacionId = habitacionIdPendiente;

        if (!habitacionId) {
          const habitacion = await crearAnuncio({
            titulo: datosHabitacion.titulo,
            descripcion: datosHabitacion.descripcion,
            renta: datosHabitacion.renta,
            ubicacion: datosHabitacion.ubicacion,
            latitude: coordenadas.latitude,
            longitude: coordenadas.longitude,
            availableFrom: datosHabitacion.availableFrom,
            maxRoommates: Number(datosHabitacion.maxRoommates),
            fotos,
          });

          habitacionId = habitacion.id;
          setHabitacionIdPendiente(habitacion.id);
        }

        // Publicar la habitación guardada.
        await publicarAnuncio(habitacionId);

        Alert.alert(
          "¡Publicación exitosa!",
          `Tu habitación "${datosHabitacion.titulo}" se guardó y publicó correctamente.

Fotografías almacenadas: ${fotos.length}`,
          [
            {
              text: "Aceptar",
              onPress: reiniciarFormulario,
            },
          ]
        );
      }
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

  // Pantalla de carga mientras recuperamos una publicación.
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

  // Pantalla para publicar o editar una habitación.
  if (vista === "publicar") {
    return (
      <PantallaPublicarHabitacion
        key={modoEdicion ? habitacionIdEdicion ?? "edicion" : "nueva"}
        datosIniciales={datosHabitacion}
        onVolver={() => setVista("anuncios")}
        onElegirUbicacion={continuarFormulario}
      />
    );
  }

  // Pantalla del mapa.
  if (vista === "ubicacion") {
    return (
      <PantallaUbicacion
        ubicacionInicial={datosHabitacion.ubicacion}
        onVolver={() => setVista("publicar")}
        onContinuar={continuarUbicacion}
      />
    );
  }

  // Pantalla de fotografías.
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

  // Pantalla principal de anuncios.
  return (
    <PantallaAnunciosPrincipal
      onCrearPublicacion={iniciarNuevaPublicacion}
      onEditarPublicacion={editarPublicacion}
    />
  );
}

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
