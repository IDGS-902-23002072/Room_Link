
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
  Platform,
} from "react-native";

import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

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

  onElegirUbicacion?: (
    datos: DatosHabitacion,
    intencion: IntencionPublicacion
  ) => void;

  onGuardarBorrador?: (
    datos: DatosHabitacion
  ) => void;
};

// ======================================================
// FUNCIONES DE FECHA
// ======================================================

// Obtiene la fecha actual de México en YYYY-MM-DD.
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

// Comprueba que la fecha exista realmente.
function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const [year, month, day] = fecha.split("-").map(Number);

  const fechaUTC = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    fechaUTC.getUTCFullYear() === year &&
    fechaUTC.getUTCMonth() === month - 1 &&
    fechaUTC.getUTCDate() === day
  );
}

// Convierte Date a YYYY-MM-DD sin problemas de zona horaria.
function convertirFechaAFormato(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

// Convierte YYYY-MM-DD a Date sin alterar el día.
function convertirFormatoAFecha(valor: string): Date | null {
  if (!valor) {
    return null;
  }

  if (!fechaValida(valor)) {
    return null;
  }

  const [anio, mes, dia] = valor.split("-").map(Number);

  return new Date(anio, mes - 1, dia);
}

// Obtiene la fecha local de México para usarla como mínimo.
function obtenerFechaMinima(): Date {
  const fechaMexico = obtenerFechaActualMexico();
  const [anio, mes, dia] = fechaMexico.split("-").map(Number);

  return new Date(anio, mes - 1, dia);
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

  // const [ubicacion, setUbicacion] = useState(
  //  datosIniciales?.ubicacion ?? ""
  // );

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

  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  // Fecha que se muestra actualmente en el calendario.
  const fechaSeleccionada =
    convertirFormatoAFecha(availableFrom) ?? obtenerFechaMinima();

  // ====================================================
  // MANEJAR SELECCIÓN DEL CALENDARIO
  // ====================================================

  const manejarCambioFecha = (
    evento: DateTimePickerEvent,
    fecha?: Date
  ) => {

    if (evento.type === "dismissed") {
      setMostrarCalendario(false);
      return;
    }

    if (fecha) {
      setAvailableFrom(convertirFechaAFormato(fecha));
    }

    // Android cierra el calendario después de seleccionar.
    if (Platform.OS === "android") {
      setMostrarCalendario(false);
    }
  };

  // ====================================================
  // OBTENER DATOS DEL FORMULARIO
  // ====================================================

  const obtenerDatos = (): DatosHabitacion => ({
    titulo: titulo.trim(),
    ubicacion: '',
    renta: renta.trim(),
    descripcion: descripcion.trim(),
    availableFrom: availableFrom.trim(),
    maxRoommates: maxRoommates.trim(),
  });

  // ====================================================
  // VALIDAR INFORMACIÓN
  // ====================================================

  /*const validarDatos = (
    intencion: IntencionPublicacion
  ): boolean => {

    // TÍTULO

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

    // RENTA

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

    // DESCRIPCIÓN

    if (descripcion.trim().length > 5000) {
      Alert.alert(
        "Descripción demasiado larga",
        "La descripción no puede superar los 5000 caracteres."
      );
      return false;
    }

    // FECHA DE DISPONIBILIDAD

    const fecha = availableFrom.trim();

    if (fecha) {
      if (!fechaValida(fecha)) {
        Alert.alert(
          "Fecha incorrecta",
          "Selecciona una fecha válida en el calendario."
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

    // MÁXIMO DE COMPAÑEROS

    const cantidadTexto = maxRoommates.trim();

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

    // VALIDACIONES PARA BORRADOR

    if (intencion === "draft") {
      return true;
    }

    // VALIDACIONES PARA PUBLICAR

    if (!fecha) {
      Alert.alert(
        "Campo requerido",
        "Indica desde qué fecha estará disponible la habitación."
      );
      return false;
    }

    return true;
  };*/



  const validarDatos = (
    intencion: IntencionPublicacion
  ): boolean => {

    // ==================================================
    // VALIDACIONES PARA BORRADOR Y PUBLICACIÓN
    // ==================================================

    // TÍTULO: obligatorio para ambas acciones.

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

    // RENTA: obligatoria para ambas acciones.

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

    // ==================================================
    // SI ES BORRADOR, NO EXIGIR LOS DEMÁS CAMPOS
    // ==================================================

    if (intencion === "draft") {
      return true;
    }

    // ==================================================
    // VALIDACIONES EXCLUSIVAS PARA PUBLICAR
    // ==================================================

    // DESCRIPCIÓN

    if (descripcion.trim().length > 5000) {
      Alert.alert(
        "Descripción demasiado larga",
        "La descripción no puede superar los 5000 caracteres."
      );
      return false;
    }

    // FECHA DE DISPONIBILIDAD

    const fecha = availableFrom.trim();

    if (!fecha) {
      Alert.alert(
        "Campo requerido",
        "Indica desde qué fecha estará disponible la habitación."
      );
      return false;
    }

    if (!fechaValida(fecha)) {
      Alert.alert(
        "Fecha incorrecta",
        "Selecciona una fecha válida en el calendario."
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

    // MÁXIMO DE COMPAÑEROS

    const cantidadTexto = maxRoommates.trim();

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

        {/* <CampoFormulario
          etiqueta="Ubicación"
          value={ubicacion}
          onChangeText={setUbicacion}
          placeholder="Se seleccionará en el siguiente paso"
          editable={false}
        />*/}

        {/* RENTA */}

        <CampoFormulario
          etiqueta="Renta mensual · MXN"
          value={renta}
          onChangeText={(texto) => {
            // Solo permite números y un punto decimal.
            const limpio = texto.replace(/[^0-9.]/g, "");

            // Evita que se escriban varios puntos.
            const partes = limpio.split(".");
            const numero =
              partes.length > 1
                ? `${partes[0]}.${partes.slice(1).join("")}`
                : limpio;

            // Máximo dos decimales.
            const valorFinal = numero.replace(
              /^(\d+\.?\d{0,2}).*$/,
              "$1"
            );

            setRenta(valorFinal);
          }}
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

        {/* FECHA DE DISPONIBILIDAD */}

        <Text style={styles.etiquetaFecha}>
          Disponible a partir de
        </Text>

        <Pressable
          style={styles.campoFecha}
          onPress={() => setMostrarCalendario(true)}
        >
          <Text style={styles.iconoCalendario}>
            📅
          </Text>

          <Text style={styles.textoFecha}>
            {availableFrom
              ? fechaSeleccionada.toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
              : "Seleccionar fecha"}
          </Text>

          <Text style={styles.textoCambiarFecha}>
            Elegir
          </Text>
        </Pressable>

        {/* CALENDARIO */}

        {mostrarCalendario && (
          <View style={styles.contenedorCalendario}>

            <DateTimePicker
              value={fechaSeleccionada}
              mode="date"
              display={
                Platform.OS === "android"
                  ? "calendar"
                  : "spinner"
              }
              minimumDate={obtenerFechaMinima()}
              onChange={manejarCambioFecha}
              locale="es-MX"
            />

            {/* BOTÓN PARA CERRAR EN IOS */}

            {Platform.OS === "ios" && (
              <Pressable
                style={styles.botonListoFecha}
                onPress={() => setMostrarCalendario(false)}
              >
                <Text style={styles.textoBotonListo}>
                  Listo
                </Text>
              </Pressable>
            )}

          </View>
        )}

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

  // FECHA

  etiquetaFecha: {
    color: "#4A3B50",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 7,
    marginTop: 12,
  },

  campoFecha: {
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5DCE8",
    borderRadius: 10,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  iconoCalendario: {
    fontSize: 19,
    marginRight: 10,
  },

  textoFecha: {
    flex: 1,
    color: "#493B50",
    fontSize: 13,
  },

  textoCambiarFecha: {
    color: "#806487",
    fontSize: 12,
    fontWeight: "700",
  },

  contenedorCalendario: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E5DCE8",
  },

  botonListoFecha: {
    backgroundColor: "#806487",
    borderRadius: 9,
    padding: 11,
    alignItems: "center",
    marginTop: 8,
  },

  textoBotonListo: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // BOTONES

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
