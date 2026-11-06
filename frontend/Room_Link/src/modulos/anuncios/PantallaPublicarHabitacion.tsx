
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

// Datos que tendrá una habitación.
export type DatosHabitacion = {
  titulo: string;
  ubicacion: string;
  renta: string;
  descripcion: string;
};

// Propiedades que recibe la pantalla.
type Props = {
  datosIniciales?: Partial<DatosHabitacion>;
  onVolver?: () => void;
  onElegirUbicacion?: (
    datos: DatosHabitacion
  ) => void;
};

export default function PantallaPublicarHabitacion({
  datosIniciales,
  onVolver,
  onElegirUbicacion,
}: Props) {
  // Estados de los campos.
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

  // Validar información y abrir el mapa.
  const continuar = () => {
    if (!titulo.trim()) {
      Alert.alert(
        "Campo requerido",
        "Escribe el título de la publicación."
      );
      return;
    }

    if (!renta.trim()) {
      Alert.alert(
        "Campo requerido",
        "Escribe la renta mensual."
      );
      return;
    }

    if (!descripcion.trim()) {
      Alert.alert(
        "Campo requerido",
        "Escribe una descripción de la habitación."
      );
      return;
    }

    const datos: DatosHabitacion = {
      titulo: titulo.trim(),
      ubicacion: ubicacion.trim(),
      renta: renta.trim(),
      descripcion: descripcion.trim(),
    };

    onElegirUbicacion?.(datos);
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado */}
        <Text style={styles.marca}>
          ROOMLINK / 07
        </Text>

        <View style={styles.filaTitulo}>
          <Pressable
            onPress={onVolver}
            style={styles.botonVolver}
          >
            <Text style={styles.textoVolver}>‹</Text>
          </Pressable>

          <Text style={styles.tituloPrincipal}>
            Publica tu habitación
          </Text>
        </View>

        {/* Indicador de pasos */}
        <IndicadorPasos pasoActual={1} />

        <Text style={styles.subtitulo}>
          Paso 1 de 3 · Información del espacio
        </Text>

        {/* Título */}
        <CampoFormulario
          etiqueta="Título de la publicación"
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Ej. Habitación luminosa cerca de la UTL"
        />

        {/* Ubicación */}
        <Pressable onPress={continuar}>
          <View pointerEvents="none">
            <CampoFormulario
              etiqueta="Ubicación"
              value={ubicacion}
              onChangeText={setUbicacion}
              placeholder="Selecciona tu ubicación"
              editable={false}
            />
          </View>
        </Pressable>

        {/* Renta */}
        <CampoFormulario
          etiqueta="Renta mensual · MXN"
          value={renta}
          onChangeText={setRenta}
          placeholder="$3,500"
          keyboardType="numeric"
        />

        {/* Descripción */}
        <CampoFormulario
          etiqueta="Descripción"
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Describe las características de la habitación."
          multiline
        />

        {/* Continuar */}
        <Pressable
          style={styles.botonContinuar}
          onPress={continuar}
        >
          <Text style={styles.textoBoton}>
            Continuar a ubicación y reglas
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

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

  botonContinuar: {
    height: 45,
    backgroundColor: "#806487",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  textoBoton: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
