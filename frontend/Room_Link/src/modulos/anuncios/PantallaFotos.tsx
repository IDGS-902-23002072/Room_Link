
import React, { useState } from "react";

import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  ScrollView,
  Image,
  Alert,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import IndicadorPasos from "./componentes/IndicadorPasos";

export type Foto = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
};

type Props = {
  fotosIniciales?: Foto[];
  onVolver?: () => void;
  onEnviarRevision?: (fotos: Foto[]) => void;
};

const MAX_FOTOS = 10;

export default function PantallaFotos({
  fotosIniciales,
  onVolver,
  onEnviarRevision,
}: Props) {
  // Inicializar con las fotografías recibidas.
  // Si es una publicación nueva, comienza con un arreglo vacío.
  const [fotos, setFotos] = useState<Foto[]>(
    () => fotosIniciales ?? []
  );

  // Seleccionar fotografías de la galería.
  const agregarFotos = async () => {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert(
        "Límite alcanzado",
        "Solo puedes agregar un máximo de 10 fotografías."
      );
      return;
    }

    try {
      const permiso =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permiso.granted) {
        Alert.alert(
          "Permiso necesario",
          "Permite el acceso a tus fotografías para agregarlas."
        );
        return;
      }

      const resultado =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          quality: 0.8,
          selectionLimit: MAX_FOTOS - fotos.length,
        });

      if (resultado.canceled) {
        return;
      }

      const nuevasFotos: Foto[] = resultado.assets.map(
        (asset, index) => ({
          id: `${Date.now()}-${index}-${Math.random()}`,
          uri: asset.uri,
          fileName:
            asset.fileName ??
            `fotografia-${Date.now()}-${index}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg",
        })
      );

      setFotos((actuales) =>
        [...actuales, ...nuevasFotos].slice(0, MAX_FOTOS)
      );
    } catch (error) {
      console.error(
        "Error al seleccionar fotografías:",
        error
      );

      Alert.alert(
        "Error",
        "No se pudieron seleccionar las fotografías."
      );
    }
  };

  // Eliminar una fotografía.
  const eliminarFoto = (id: string) => {
    setFotos((actuales) =>
      actuales.filter((foto) => foto.id !== id)
    );
  };

  // Cambiar la posición de una fotografía.
  const moverFoto = (
    indice: number,
    direccion: -1 | 1
  ) => {
    setFotos((actuales) => {
      const destino = indice + direccion;

      if (destino < 0 || destino >= actuales.length) {
        return actuales;
      }

      const copia = [...actuales];

      [copia[indice], copia[destino]] = [
        copia[destino],
        copia[indice],
      ];

      return copia;
    });
  };

  // Enviar las fotografías a la pantalla principal.
  const enviarRevision = () => {
    if (fotos.length < 3) {
      Alert.alert(
        "Fotografías insuficientes",
        "Necesitas al menos 3 fotografías para continuar."
      );
      return;
    }

    onEnviarRevision?.(fotos);
  };

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.contenido}
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

          <Text style={styles.titulo}>
            Fotos del espacio
          </Text>
        </View>

        <IndicadorPasos pasoActual={3} />

        <Text style={styles.subtitulo}>
          Paso 3 de 3 · Fotografías de tu habitación
        </Text>

        <Text style={styles.instruccion}>
          Muestra cada rincón de tu espacio para que
          las personas interesadas puedan conocerlo.
        </Text>

        {/* Contador */}
        <View style={styles.contador}>
          <Text style={styles.contadorTexto}>
            Fotografías agregadas
          </Text>

          <Text style={styles.contadorNumero}>
            {fotos.length}/{MAX_FOTOS}
          </Text>
        </View>

        {/* Lista de fotografías */}
        {fotos.map((foto, indice) => (
          <View
            key={foto.id}
            style={styles.tarjetaFoto}
          >
            <Image
              source={{ uri: foto.uri }}
              style={styles.imagen}
              resizeMode="cover"
            />

            <View style={styles.infoFoto}>
              <Text style={styles.nombreFoto}>
                {indice === 0
                  ? "Fotografía principal"
                  : `Fotografía ${indice + 1}`}
              </Text>

              <View style={styles.acciones}>
                <Pressable
                  onPress={() => moverFoto(indice, -1)}
                  disabled={indice === 0}
                >
                  <Text
                    style={[
                      styles.accion,
                      indice === 0 && styles.deshabilitado,
                    ]}
                  >
                    ↑ Subir
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => moverFoto(indice, 1)}
                  disabled={indice === fotos.length - 1}
                >
                  <Text
                    style={[
                      styles.accion,
                      indice === fotos.length - 1 &&
                        styles.deshabilitado,
                    ]}
                  >
                    ↓ Bajar
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => eliminarFoto(foto.id)}
                >
                  <Text style={styles.eliminar}>
                    Eliminar
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {/* Estado vacío */}
        {fotos.length === 0 && (
          <View style={styles.vacio}>
            <Text style={styles.iconoVacio}>
              +
            </Text>

            <Text style={styles.textoVacio}>
              Todavía no agregas fotografías
            </Text>

            <Text style={styles.detalleVacio}>
              Selecciona imágenes de tu galería.
            </Text>
          </View>
        )}

        {/* Agregar fotografías */}
        <Pressable
          style={[
            styles.botonSubir,
            fotos.length >= MAX_FOTOS &&
              styles.botonDesactivado,
          ]}
          onPress={agregarFotos}
          disabled={fotos.length >= MAX_FOTOS}
        >
          <Text style={styles.textoSubir}>
            + Agregar fotografías
          </Text>
        </Pressable>

        {/* Enviar */}
        <Pressable
          style={[
            styles.botonEnviar,
            fotos.length < 3 && styles.botonDesactivado,
          ]}
          onPress={enviarRevision}
          disabled={fotos.length < 3}
        >
          <Text style={styles.textoEnviar}>
            Enviar anuncio a revisión
          </Text>
        </Pressable>

        <Text style={styles.nota}>
          Puedes agregar hasta 10 fotografías.
          La primera será la imagen principal.
        </Text>
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
    paddingTop: 15,
    paddingBottom: 28,
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

  textoVolver: {
    color: "#806487",
    fontSize: 30,
    lineHeight: 34,
  },

  titulo: {
    color: "#332A37",
    fontSize: 21,
    fontWeight: "700",
  },

  subtitulo: {
    color: "#948798",
    fontSize: 10,
    marginTop: 2,
    marginBottom: 9,
  },

  instruccion: {
    color: "#88768D",
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 15,
  },

  contador: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  contadorTexto: {
    color: "#66556B",
    fontSize: 11,
    fontWeight: "600",
  },

  contadorNumero: {
    color: "#806487",
    fontSize: 11,
    fontWeight: "700",
  },

  tarjetaFoto: {
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EDE5EE",
    marginBottom: 10,
  },

  imagen: {
    width: "100%",
    height: 145,
    backgroundColor: "#E9DDEA",
  },

  infoFoto: {
    padding: 11,
  },

  nombreFoto: {
    color: "#332A37",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 9,
  },

  acciones: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  accion: {
    color: "#806487",
    fontSize: 11,
    fontWeight: "600",
  },

  eliminar: {
    color: "#B34D5A",
    fontSize: 11,
    fontWeight: "600",
  },

  deshabilitado: {
    opacity: 0.3,
  },

  vacio: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E0EA",
    borderStyle: "dashed",
    borderRadius: 13,
    padding: 30,
    alignItems: "center",
    marginBottom: 12,
  },

  iconoVacio: {
    color: "#806487",
    fontSize: 35,
    marginBottom: 8,
  },

  textoVacio: {
    color: "#66556B",
    fontSize: 12,
    fontWeight: "600",
  },

  detalleVacio: {
    color: "#948798",
    fontSize: 10,
    marginTop: 5,
  },

  botonSubir: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E0EA",
    borderRadius: 11,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  textoSubir: {
    color: "#806487",
    fontSize: 12,
    fontWeight: "600",
  },

  botonEnviar: {
    backgroundColor: "#806487",
    borderRadius: 11,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  botonDesactivado: {
    opacity: 0.45,
  },

  textoEnviar: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  nota: {
    color: "#9A8B9D",
    fontSize: 10,
    textAlign: "center",
    marginTop: 10,
  },
});
