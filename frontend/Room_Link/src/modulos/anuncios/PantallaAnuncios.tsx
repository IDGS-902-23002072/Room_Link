
import React, { useState } from "react";
import { Alert } from "react-native";

import PantallaPublicarHabitacion, {
  type DatosHabitacion,
} from "./PantallaPublicarHabitacion";

import PantallaUbicacion from "./PantallaUbicacion";
import PantallaFotos, { type Foto } from "./PantallaFotos";
import PantallaAnunciosPrincipal from "./PantallaAnunciosPrincipal";

import { crearAnuncio, publicarAnuncio } from "./api";

type Vista =
  | "anuncios"
  | "publicar"
  | "ubicacion"
  | "fotos";

type Coordenadas = {
  latitude: number;
  longitude: number;
};

export function PantallaAnuncios() {
  const [vista, setVista] = useState<Vista>("anuncios");

  const [datosHabitacion, setDatosHabitacion] =
    useState<DatosHabitacion>({
      titulo: "",
      ubicacion: "",
      renta: "",
      descripcion: "",
    });

  const [coordenadas, setCoordenadas] =
    useState<Coordenadas | null>(null);

  const [enviando, setEnviando] = useState(false);

  // Conserva el ID si la habitación se guarda,
  // pero falla el intento de publicación.
  const [habitacionIdPendiente, setHabitacionIdPendiente] =
    useState<string | null>(null);

  // Recibir información del formulario.
  const continuarFormulario = (
    datos: DatosHabitacion
  ) => {
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

  // Registrar y publicar la habitación.
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
      let habitacionId = habitacionIdPendiente;

      // Primero guardamos la habitación y sus fotografías.
      if (!habitacionId) {
        const habitacion = await crearAnuncio({
          titulo: datosHabitacion.titulo,
          descripcion: datosHabitacion.descripcion,
          renta: datosHabitacion.renta,
          ubicacion: datosHabitacion.ubicacion,
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
          fotos,
        });

        habitacionId = habitacion.id;
        setHabitacionIdPendiente(habitacion.id);
      }

      // Después solicitamos publicar la habitación.
      await publicarAnuncio(habitacionId);

      Alert.alert(
        "¡Publicación exitosa!",
        `Tu habitación "${datosHabitacion.titulo}" se guardó y publicó correctamente.

Fotografías almacenadas: ${fotos.length}`,
        [
          {
            text: "Aceptar",
            onPress: () => {
              setDatosHabitacion({
                titulo: "",
                ubicacion: "",
                renta: "",
                descripcion: "",
              });

              setCoordenadas(null);
              setHabitacionIdPendiente(null);
              setVista("anuncios");
            },
          },
        ]
      );
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "Ocurrió un error al registrar la habitación.";

      Alert.alert(
        "No se pudo completar la publicación",
        mensaje
      );
    } finally {
      setEnviando(false);
    }
  };

  // Pantalla para publicar una habitación.
  if (vista === "publicar") {
    return (
      <PantallaPublicarHabitacion
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
        onVolver={() => setVista("ubicacion")}
        onEnviarRevision={enviarRevision}
      />
    );
  }

  // Pantalla principal de anuncios.
  return (
    <PantallaAnunciosPrincipal
      onCrearPublicacion={() => setVista("publicar")}
    />
  );
}
