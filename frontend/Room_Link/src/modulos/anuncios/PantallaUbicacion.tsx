
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
} from "react-native";

import MapView, {
  Marker,
  MapPressEvent,
  Region,
} from "react-native-maps";

import * as Location from "expo-location";

import IndicadorPasos from "./componentes/IndicadorPasos";

type Coordenadas = {
  latitude: number;
  longitude: number;
};

type Props = {
  ubicacionInicial?: string;
  onVolver?: () => void;
  onContinuar?: (
    direccion: string,
    coordenadas: Coordenadas
  ) => void;
};

const REGION_INICIAL: Region = {
  latitude: 21.1221,
  longitude: -101.68,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

export default function PantallaUbicacion({
  ubicacionInicial,
  onVolver,
  onContinuar,
}: Props) {
  const [region, setRegion] =
    useState<Region>(REGION_INICIAL);

  const [coordenadas, setCoordenadas] =
    useState<Coordenadas>({
      latitude: REGION_INICIAL.latitude,
      longitude: REGION_INICIAL.longitude,
    });

  const [direccion, setDireccion] = useState(
    ubicacionInicial ?? ""
  );

  const [cargando, setCargando] = useState(false);

  // Consultar dirección mediante coordenadas
  const obtenerDireccion = async (
    punto: Coordenadas
  ) => {
    setCargando(true);

    try {
      const respuesta = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${punto.latitude}&lon=${punto.longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "es",
          },
        }
      );

      if (!respuesta.ok) {
        throw new Error("Error consultando dirección");
      }

      const resultado = await respuesta.json();

      setDireccion(
        resultado.display_name ??
          "Ubicación seleccionada"
      );
    } catch {
      setDireccion(
        `${punto.latitude.toFixed(5)}, ${punto.longitude.toFixed(5)}`
      );

      Alert.alert(
        "Aviso",
        "No se pudo obtener la dirección, pero conservamos las coordenadas."
      );
    } finally {
      setCargando(false);
    }
  };

  // Seleccionar punto del mapa
  const seleccionarPunto = (punto: Coordenadas) => {
    setCoordenadas(punto);

    setRegion((actual) => ({
      ...actual,
      ...punto,
    }));

    obtenerDireccion(punto);
  };

  const manejarToqueMapa = (
    evento: MapPressEvent
  ) => {
    seleccionarPunto(
      evento.nativeEvent.coordinate
    );
  };

  // Obtener GPS del dispositivo
  const usarMiUbicacion = async () => {
    try {
      setCargando(true);

      const permiso =
        await Location.requestForegroundPermissionsAsync();

      if (permiso.status !== "granted") {
        setCargando(false);

        Alert.alert(
          "Permiso requerido",
          "Debes permitir el acceso a tu ubicación."
        );

        return;
      }

      const posicion =
        await Location.getCurrentPositionAsync({});

      seleccionarPunto({
        latitude: posicion.coords.latitude,
        longitude: posicion.coords.longitude,
      });
    } catch {
      setCargando(false);

      Alert.alert(
        "Error",
        "No se pudo obtener tu ubicación actual."
      );
    }
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.encabezado}>
        <Text style={styles.marca}>
          ROOMLINK / 07
        </Text>

        <View style={styles.filaTitulo}>
          <Pressable onPress={onVolver}>
            <Text style={styles.volver}>‹</Text>
          </Pressable>

          <Text style={styles.titulo}>
            Ubicación del espacio
          </Text>
        </View>

        <IndicadorPasos pasoActual={2} />

        <Text style={styles.instruccion}>
          Selecciona en el mapa dónde se encuentra
          tu habitación.
        </Text>
      </View>

      {/* Mapa */}
      <View style={styles.mapaContenedor}>
        <MapView
          style={styles.mapa}
          region={region}
          onPress={manejarToqueMapa}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={coordenadas}
            title="Habitación"
            description="Ubicación seleccionada"
          />
        </MapView>

        <Pressable
          style={styles.botonGPS}
          onPress={usarMiUbicacion}
        >
          <Text style={styles.textoGPS}>
            ◎ Usar mi ubicación actual
          </Text>
        </Pressable>
      </View>

      {/* Dirección seleccionada */}
      <View style={styles.pie}>
        <Text style={styles.etiqueta}>
          Dirección seleccionada
        </Text>

        {cargando ? (
          <ActivityIndicator color="#806487" />
        ) : (
          <Text style={styles.direccion}>
            {direccion ||
              "Toca el mapa para seleccionar una ubicación"}
          </Text>
        )}

        <Pressable
          style={[
            styles.botonContinuar,
            !direccion && styles.botonDesactivado,
          ]}
          disabled={!direccion || cargando}
          onPress={() =>
            onContinuar?.(direccion, coordenadas)
          }
        >
          <Text style={styles.textoBoton}>
            Continuar a fotografías
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

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
  },
  mapaContenedor: {
    flex: 1,
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
    fontSize: 10,
    marginBottom: 5,
  },
  direccion: {
    color: "#332A37",
    fontSize: 12,
    marginBottom: 12,
  },
  botonContinuar: {
    backgroundColor: "#806487",
    borderRadius: 11,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
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
