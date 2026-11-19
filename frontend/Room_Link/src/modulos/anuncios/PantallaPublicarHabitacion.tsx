
import React, { useState } from "react";

import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
} from "react-native";

import CampoFormulario from "./componentes/CampoFormulario";
import IndicadorPasos from "./componentes/IndicadorPasos";

// ======================================================
// TIPOS
// ======================================================

export type DatosHabitacion = {
  titulo: string;
  ubicacion: string;
  renta: string;
  descripcion: string;
  availableFrom: string;
  maxRoommates: string;
};

export type IntencionPublicacion = "draft" | "publish";

type Props = {
  datosIniciales?: Partial<DatosHabitacion>;

  onVolver?: () => void;

  // Continuar con el proceso de publicación.
  onElegirUbicacion?: (
    datos: DatosHabitacion,
    intencion: IntencionPublicacion
  ) => void;

  // Guardar la información como borrador.
  onGuardarBorrador?: (
    datos: DatosHabitacion
  ) => void;
};

// ======================================================
// VALIDACIONES DE FECHA
// ======================================================

/**
 * Obtiene la fecha actual de México.
 * Formato: YYYY-MM-DD.
 */
function obtenerFechaActualMexico(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const obtenerParte = (tipo: string): string => {
    return partes.find((parte) => parte.type === tipo)?.value ?? "";
  };

  return `${obtenerParte("year")}-${obtenerParte("month")}-${obtenerParte("day")}`;
}

/**
 * Comprueba que la fecha exista realmente.
 */
function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const [year, month, day] = fecha.split("-").map(Number);

  if (
    year === undefined ||
    month === undefined ||
    day === undefined
  ) {
    return false;
  }

  const fechaUTC = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    fechaUTC.getUTCFullYear() === year &&
    fechaUTC.getUTCMonth() === month - 1 &&
    fechaUTC.getUTCDate() === day
  );
}

// ======================================================
// PANTALLA
// ======================================================

export default function PantallaPublicarHabitacion({
  datosIniciales,
  onVolver,
  onElegirUbicacion,
  onGuardarBorrador,
}: Props) {

  // ====================================================
  // ESTADOS
  // ====================================================

  const [titulo, setTitulo] = useState(
    datosIniciales?.titulo ?? ""
  );

  const [ubicacion, setUbicacion] = useState(
    datosIniciales?.ubicacion ?? ""
  );

  const [renta, setRenta] = useState(
    datosIniciales?.renta ?? ""
  );

  const [descripcion, setDescripcion] = useState(
    datosIniciales?.descripcion ?? ""
  );

  const [availableFrom, setAvailableFrom] = useState(
    datosIniciales?.availableFrom ?? ""
  );

  const [maxRoommates, setMaxRoommates] = useState(
    datosIniciales?.maxRoommates ?? ""
  );

  // ====================================================
  // OBTENER DATOS DEL FORMULARIO
  // ====================================================

  const obtenerDatos = (): DatosHabitacion => ({
    titulo: titulo.trim(),
    ubicacion: ubicacion.trim(),
    renta: renta.trim(),
    descripcion: descripcion.trim(),
    availableFrom: availableFrom.trim(),
    maxRoommates: maxRoommates.trim(),
  });

  // ====================================================
  // VALIDAR INFORMACIÓN
  // ====================================================

  const validarDatos = (
    intencion: IntencionPublicacion
  ): boolean => {

    // -----------------------------------------------
    // TÍTULO
    // -----------------------------------------------

    if (!titulo.trim()) {
      Alert.alert(
        "Campo requerido",
        "Escribe el título de la publicación."
      );
      return false;
    }

    if (
      titulo.trim().length < 5 ||
      titulo.trim().length > 200
    ) {
      Alert.alert(
        "Título incorrecto",
        "El título debe tener entre 5 y 200 caracteres."
      );
      return false;
    }

    // -----------------------------------------------
    // RENTA
    // -----------------------------------------------

    if (!renta.trim()) {
      Alert.alert(
        "Campo requerido",
        "Escribe la renta mensual."
      );
      return false;
    }

    const rentaLimpia = renta.replace(/[$,\s]/g, "");
    const rentaNumerica = Number(rentaLimpia);

    if (
      !/^\d+(\.\d{1,2})?$/.test(rentaLimpia) ||
      !Number.isFinite(rentaNumerica) ||
      rentaNumerica <= 0 ||
      rentaNumerica > 99999999.99
    ) {
      Alert.alert(
        "Renta incorrecta",
        "Ingresa una renta válida, mayor a cero y con máximo dos decimales."
      );
      return false;
    }

    // -----------------------------------------------
    // DESCRIPCIÓN
    // -----------------------------------------------

    if (descripcion.trim().length > 5000) {
      Alert.alert(
        "Descripción demasiado larga",
        "La descripción no puede superar los 5000 caracteres."
      );
      return false;
    }

    // -----------------------------------------------
    // FECHA DE DISPONIBILIDAD
    // -----------------------------------------------

    const fecha = availableFrom.trim();

    // Si se proporciona una fecha, siempre debe ser válida.
    if (fecha) {
      if (!fechaValida(fecha)) {
        Alert.alert(
          "Fecha incorrecta",
          "Ingresa una fecha real con formato AAAA-MM-DD. Ejemplo: 2026-12-01."
        );
        return false;
      }

      if (fecha < obtenerFechaActualMexico()) {
        Alert.alert(
          "Fecha no válida",
          "La fecha de disponibilidad no puede ser anterior al día de hoy."
        );
        return false;
      }
    }

    // -----------------------------------------------
    // MÁXIMO DE COMPAÑEROS
    // -----------------------------------------------

    const cantidadTexto = maxRoommates.trim();

    // El campo es opcional, pero si se proporciona
    // debe contener un entero entre 1 y 100.
    if (cantidadTexto) {
      const cantidad = Number(cantidadTexto);

      if (
        !/^\d+$/.test(cantidadTexto) ||
        !Number.isInteger(cantidad) ||
        cantidad < 1 ||
        cantidad > 100
      ) {
        Alert.alert(
          "Dato incorrecto",
          "El máximo de compañeros debe ser un número entero entre 1 y 100."
        );
        return false;
      }
    }

    // -----------------------------------------------
    // VALIDACIONES PARA BORRADOR
    // -----------------------------------------------

    // Para guardar un borrador no exigimos ubicación,
    // descripción, fecha ni fotografías.
    if (intencion === "draft") {
      return true;
    }

    // -----------------------------------------------
    // VALIDACIONES PARA CONTINUAR
    // -----------------------------------------------

    // La ubicación se selecciona en el siguiente paso.
    // La fecha sí es obligatoria antes de publicar.
    if (!fecha) {
      Alert.alert(
        "Campo requerido",
        "Indica desde qué fecha estará disponible la habitación."
      );
      return false;
    }

    return true;
  };

  // ====================================================
  // GUARDAR BORRADOR
  // ====================================================

  const guardarBorrador = () => {
    if (!validarDatos("draft")) {
      return;
    }

    if (!onGuardarBorrador) {
      Alert.alert(
        "Acción no disponible",
        "No se configuró la función para guardar borradores."
      );
      return;
    }

    Alert.alert(
      "Guardar borrador",
      "¿Deseas guardar esta habitación como borrador? Puedes agregar la ubicación y las fotografías después.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Guardar",
          onPress: () => {
            onGuardarBorrador(obtenerDatos());
          },
        },
      ]
    );
  };

  // ====================================================
  // CONTINUAR CON LA PUBLICACIÓN
  // ====================================================

  const continuar = () => {
    if (!validarDatos("publish")) {
      return;
    }

    if (!onElegirUbicacion) {
      Alert.alert(
        "Error",
        "No se configuró el siguiente paso del formulario."
      );
      return;
    }

    onElegirUbicacion(
      obtenerDatos(),
      "publish"
    );
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ENCABEZADO */}

        <Text style={styles.marca}>
          ROOMLINK / 07
        </Text>

        <View style={styles.filaTitulo}>
          <Pressable
            onPress={onVolver}
            style={styles.botonVolver}
          >
            <Text style={styles.textoVolver}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.tituloPrincipal}>
            Publica tu habitación
          </Text>
        </View>

        {/* PASOS */}

        <IndicadorPasos pasoActual={1} />

        <Text style={styles.subtitulo}>
          Paso 1 de 3 · Información del espacio
        </Text>

        {/* TÍTULO */}

        <CampoFormulario
          etiqueta="Título de la publicación"
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Ej. Habitación luminosa cerca de la UTL"
        />

        {/* UBICACIÓN */}

        <CampoFormulario
          etiqueta="Ubicación"
          value={ubicacion}
          onChangeText={setUbicacion}
          placeholder="Se seleccionará en el siguiente paso"
          editable={false}
        />

        {/* RENTA */}

        <CampoFormulario
          etiqueta="Renta mensual · MXN"
          value={renta}
          onChangeText={setRenta}
          placeholder="Ej. 3500"
          keyboardType="decimal-pad"
        />

        {/* DESCRIPCIÓN */}

        <CampoFormulario
          etiqueta="Descripción (opcional)"
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Describe las características de la habitación."
          multiline
        />

        {/* FECHA */}

        <CampoFormulario
          etiqueta="Disponible a partir de"
          value={availableFrom}
          onChangeText={setAvailableFrom}
          placeholder="AAAA-MM-DD (Ej. 2026-12-01)"
        />

        {/* MÁXIMO DE COMPAÑEROS */}

        <CampoFormulario
          etiqueta="Máximo de compañeros (opcional)"
          value={maxRoommates}
          onChangeText={setMaxRoommates}
          placeholder="Ej. 2"
          keyboardType="numeric"
        />

        {/* GUARDAR BORRADOR */}

        <Pressable
          style={styles.botonBorrador}
          onPress={guardarBorrador}
        >
          <Text style={styles.textoBotonBorrador}>
            Guardar como borrador
          </Text>
        </Pressable>

        {/* CONTINUAR PARA PUBLICAR */}

        <Pressable
          style={styles.botonContinuar}
          onPress={continuar}
        >
          <Text style={styles.textoBoton}>
            Continuar para publicar
          </Text>
        </Pressable>

        <Text style={styles.textoAyuda}>
          Puedes guardar tu información y terminarla después.
          Para publicar, necesitarás completar los siguientes
          pasos, seleccionar una ubicación y agregar al menos
          3 fotografías.
        </Text>

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
    backgroundColor: "#F8F5F9",
  },

  contenido: {
    paddingHorizontal: 21,
    paddingTop: 16,
    paddingBottom: 30,
  },

  marca: {
    color: "#8A6C91",
    fontSize: 9,
    letterSpacing: 0.7,
    marginBottom: 8,
  },

  filaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  botonVolver: {
    width: 27,
    marginRight: 5,
  },

  textoVolver: {
    color: "#806487",
    fontSize: 30,
    lineHeight: 32,
  },

  tituloPrincipal: {
    color: "#332A37",
    fontSize: 21,
    fontWeight: "700",
  },

  subtitulo: {
    color: "#948798",
    fontSize: 10,
    marginTop: -4,
    marginBottom: 13,
  },

  botonBorrador: {
    height: 45,
    backgroundColor: "#E9DDEA",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  textoBotonBorrador: {
    color: "#654C6D",
    fontSize: 13,
    fontWeight: "700",
  },

  botonContinuar: {
    height: 45,
    backgroundColor: "#806487",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  textoBoton: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  textoAyuda: {
    color: "#948798",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 12,
    paddingHorizontal: 8,
  },
});
