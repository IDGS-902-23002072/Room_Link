
import React, { useState } from "react";

import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  Keyboard,
} from "react-native";

import * as Location from "expo-location";

import IndicadorPasos from "./componentes/IndicadorPasos";
import MapaOSM from "./componentes/MapaOSM";
import type { Coordenadas } from "./componentes/mapaOSM.logica";

// ======================================================
// TIPOS
// ======================================================

type Region = Coordenadas & {
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  ubicacionInicial?: string;
  coordenadasIniciales?: Coordenadas | null;
  onVolver?: () => void;

  onContinuar?: (
    direccion: string,
    coordenadas: Coordenadas
  ) => void;
};

// ======================================================
// REGIÓN INICIAL
// ======================================================

const REGION_INICIAL: Region = {
  latitude: 21.1221,
  longitude: -101.68,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

// ======================================================
// PANTALLA
// ======================================================

export default function PantallaUbicacion({
  ubicacionInicial,
  coordenadasIniciales,
  onVolver,
  onContinuar,
}: Props) {

  // ====================================================
  // ESTADOS
  // ====================================================

  const [region, setRegion] = useState<Region>(() => ({
    ...REGION_INICIAL,
    ...(coordenadasIniciales ?? {}),
  }));


  const [coordenadas, setCoordenadas] =
    useState<Coordenadas | null>(
      coordenadasIniciales ?? null
    );

  const [direccion, setDireccion] = useState(
    ubicacionInicial ?? ""
  );

  const [cargando, setCargando] = useState(false);

  // ====================================================
  // ACTUALIZAR COORDENADAS
  // ====================================================

  const actualizarCoordenadas = (
    punto: Coordenadas
  ) => {
    setCoordenadas(punto);

    setRegion((actual) => ({
      ...actual,
      ...punto,
    }));
  };

  const manejarCambioDireccion = (texto: string) => {
    setDireccion(texto);

    // Si cambia la dirección, las coordenadas anteriores
    // dejan de considerarse confirmadas.
    setCoordenadas(null);
  };

  // ====================================================
  // OBTENER DIRECCIÓN DESDE COORDENADAS
  // ====================================================

  const obtenerDireccion = async (
    punto: Coordenadas
  ) => {
    setCargando(true);

    try {
      const resultado = await Location.reverseGeocodeAsync({
        latitude: punto.latitude,
        longitude: punto.longitude,
      });

      if (resultado.length > 0) {
        const lugar = resultado[0];

        const partes = [
          lugar.street,
          lugar.streetNumber,
          lugar.district,
          lugar.subregion,
          lugar.city,
          lugar.region,
          lugar.postalCode,
        ].filter(Boolean);

        if (partes.length > 0) {
          setDireccion(partes.join(", "));
        } else {
          Alert.alert(
            "Dirección no encontrada",
            "No pudimos obtener la dirección exacta. Puedes escribirla manualmente."
          );
        }
      } else {
        Alert.alert(
          "Dirección no encontrada",
          "Puedes escribir manualmente la dirección de la habitación."
        );
      }
    } catch {
      Alert.alert(
        "Aviso",
        "No se pudo obtener la dirección automáticamente. Puedes escribirla manualmente."
      );
    } finally {
      setCargando(false);
    }
  };

  // ====================================================
  // SELECCIONAR PUNTO DEL MAPA
  // ====================================================

  const seleccionarPunto = async (
    punto: Coordenadas
  ) => {
    Keyboard.dismiss();

    actualizarCoordenadas(punto);

    await obtenerDireccion(punto);
  };

  const manejarToqueMapa = (punto: Coordenadas) => {
    seleccionarPunto(punto);
  };

  // ====================================================
  // USAR UBICACIÓN ACTUAL
  // ====================================================

  const usarMiUbicacion = async () => {
    try {
      setCargando(true);

      const permiso =
        await Location.requestForegroundPermissionsAsync();

      if (permiso.status !== "granted") {
        Alert.alert(
          "Permiso requerido",
          "Debes permitir el acceso a tu ubicación o seleccionar manualmente un punto en el mapa."
        );

        return;
      }

      const posicion =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const punto: Coordenadas = {
        latitude: posicion.coords.latitude,
        longitude: posicion.coords.longitude,
      };

      actualizarCoordenadas(punto);

      setCargando(false);

      await obtenerDireccion(punto);

    } catch {
      setCargando(false);

      Alert.alert(
        "Error",
        "No se pudo obtener tu ubicación actual. Puedes seleccionar un punto en el mapa o escribir la dirección."
      );
    }
  };

  // ====================================================
  // BUSCAR DIRECCIÓN ESCRITA
  // ====================================================

  const buscarDireccion = async () => {
    const direccionBuscada = direccion.trim();

    if (!direccionBuscada) {
      Alert.alert(
        "Dirección requerida",
        "Escribe la dirección que deseas buscar."
      );

      return;
    }

    Keyboard.dismiss();
    setCargando(true);
    setCoordenadas(null);
    try {
      const resultados = await Location.geocodeAsync(
        direccionBuscada
      );

      if (resultados.length === 0) {
        Alert.alert(
          "No encontramos la dirección",
          "Intenta escribir una dirección más completa o selecciona el punto directamente en el mapa."
        );

        return;
      }

      const resultado = resultados[0];

      const punto: Coordenadas = {
        latitude: resultado.latitude,
        longitude: resultado.longitude,
      };

      actualizarCoordenadas(punto);

      Alert.alert(
        "Dirección localizada",
        "Encontramos las coordenadas aproximadas. Revisa el marcador en el mapa y confirma que corresponda a la ubicación de tu habitación."
      );

    } catch {
      Alert.alert(
        "Error de búsqueda",
        "No se pudo localizar la dirección. Intenta escribirla de otra manera o selecciona el punto en el mapa."
      );
    } finally {
      setCargando(false);
    }
  };

  // ====================================================
  // CONTINUAR
  // ====================================================

  const continuar = () => {
    const direccionFinal = direccion.trim();

    if (!direccionFinal) {
      Alert.alert(
        "Dirección requerida",
        "Escribe o selecciona la dirección de la habitación."
      );

      return;
    }

    if (!coordenadas) {
      Alert.alert(
        "Ubicación requerida",
        "Primero busca la dirección escrita o selecciona el punto de la habitación en el mapa."
      );

      return;
    }

    if (!onContinuar) {
      Alert.alert(
        "Error",
        "No se configuró la siguiente pantalla."
      );

      return;
    }

    onContinuar(
      direccionFinal,
      coordenadas
    );
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      {/* ENCABEZADO */}

      <View style={styles.encabezado}>
        <Text style={styles.marca}>
          ROOMLINK / 07
        </Text>

        <View style={styles.filaTitulo}>
          <Pressable
            onPress={onVolver}
            style={styles.botonVolver}
          >
            <Text style={styles.volver}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.titulo}>
            Ubicación del espacio
          </Text>
        </View>

        <IndicadorPasos pasoActual={2} />

        <Text style={styles.instruccion}>
          Selecciona en el mapa dónde se encuentra tu
          habitación o escribe su dirección manualmente.
        </Text>
      </View>

      {/* MAPA */}

      <View style={styles.mapaContenedor}>
        <MapaOSM
          style={styles.mapa}
          centro={region}
          marcador={coordenadas}
          onToque={manejarToqueMapa}
        />

        {/* BOTÓN GPS */}

        <Pressable
          style={styles.botonGPS}
          onPress={usarMiUbicacion}
          disabled={cargando}
        >
          <Text style={styles.textoGPS}>
            ◎ Usar mi ubicación actual
          </Text>
        </Pressable>
      </View>

      {/* FORMULARIO DE DIRECCIÓN */}

      <View style={styles.pie}>
        <Text style={styles.etiqueta}>
          Dirección de la habitación
        </Text>

        <TextInput
          style={styles.inputDireccion}
          value={direccion}
          onChangeText={manejarCambioDireccion}
          placeholder="Escribe calle, número, colonia y ciudad..."
          placeholderTextColor="#A99BAE"
          multiline
          maxLength={500}
          editable={!cargando}
        />

        {/* BUSCAR DIRECCIÓN */}

        <Pressable
          style={styles.botonBuscar}
          onPress={buscarDireccion}
          disabled={cargando || !direccion.trim()}
        >
          <Text style={styles.textoBotonBuscar}>
            Buscar dirección en el mapa
          </Text>
        </Pressable>

        {/* ESTADO DE COORDENADAS */}

        {cargando ? (
          <View style={styles.estado}>
            <ActivityIndicator color="#806487" />

            <Text style={styles.textoEstado}>
              Buscando ubicación...
            </Text>
          </View>
        ) : (
          <View style={styles.estado}>
            <Text style={styles.textoEstado}>
              {coordenadas
                ? "✓ Coordenadas seleccionadas"
                : "Selecciona un punto del mapa o busca tu dirección"}
            </Text>
          </View>
        )}

        {/* COORDENADAS */}

        {coordenadas && (
          <Text style={styles.coordenadas}>
            Latitud: {coordenadas.latitude.toFixed(6)}
            {"\n"}
            Longitud: {coordenadas.longitude.toFixed(6)}
          </Text>
        )}

        {/* CONTINUAR */}

        <Pressable
          style={[
            styles.botonContinuar,
            (!direccion.trim() ||
              !coordenadas ||
              cargando) && styles.botonDesactivado,
          ]}
          disabled={
            !direccion.trim() ||
            !coordenadas ||
            cargando
          }
          onPress={continuar}
        >
          <Text style={styles.textoBoton}>
            Continuar a fotografías
          </Text>
        </Pressable>
      </View>
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
    paddingHorizontal: 21,
    paddingTop: 13,
  },

  marca: {
    color: "#8A6C91",
    fontSize: 9,
    letterSpacing: 0.7,
    marginBottom: 7,
  },

  filaTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  botonVolver: {
    width: 27,
  },

  volver: {
    color: "#806487",
    fontSize: 30,
    lineHeight: 34,
  },

  titulo: {
    color: "#332A37",
    fontSize: 21,
    fontWeight: "700",
  },

  instruccion: {
    color: "#88768D",
    fontSize: 11,
    marginBottom: 12,
    lineHeight: 16,
  },

  mapaContenedor: {
    flex: 1,
    minHeight: 180,
    marginHorizontal: 15,
    borderRadius: 14,
    overflow: "hidden",
  },

  mapa: {
    flex: 1,
  },

  botonGPS: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    elevation: 3,
  },

  textoGPS: {
    color: "#765A7E",
    fontWeight: "600",
    fontSize: 12,
  },

  pie: {
    backgroundColor: "#FFFFFF",
    margin: 15,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDE5EE",
  },

  etiqueta: {
    color: "#88768D",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 7,
  },

  inputDireccion: {
    minHeight: 65,
    maxHeight: 100,
    backgroundColor: "#F8F5F9",
    borderWidth: 1,
    borderColor: "#E8DDEB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#332A37",
    fontSize: 12,
    textAlignVertical: "top",
  },

  botonBuscar: {
    backgroundColor: "#E9DDEA",
    borderRadius: 10,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },

  textoBotonBuscar: {
    color: "#654C6D",
    fontSize: 12,
    fontWeight: "700",
  },

  estado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    marginBottom: 5,
  },

  textoEstado: {
    color: "#88768D",
    fontSize: 10,
  },

  coordenadas: {
    color: "#A092A5",
    fontSize: 9,
    lineHeight: 14,
    marginBottom: 10,
  },

  botonContinuar: {
    backgroundColor: "#806487",
    borderRadius: 11,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  botonDesactivado: {
    opacity: 0.45,
  },

  textoBoton: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
