import { color } from '@/constants/roomlink';


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

// ======================================================
// TIPOS
// ======================================================

export type Foto = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
};

export type IntencionFotos = "draft" | "publish";

type Props = {
  fotosIniciales?: Foto[];

  // Indica si se está guardando un borrador o publicando.
  intencion?: IntencionFotos;

  onVolver?: () => void;

  // Regresar las fotografías y la intención seleccionada.
  onEnviarRevision?: (
    fotos: Foto[],
    intencion: IntencionFotos
  ) => void;
};

const MAX_FOTOS = 10;
const MIN_FOTOS_PUBLICACION = 3;

// ======================================================
// PANTALLA
// ======================================================

export default function PantallaFotos({
  fotosIniciales,
  intencion = "publish",
  onVolver,
  onEnviarRevision,
}: Props) {

  // ====================================================
  // ESTADOS
  // ====================================================

  const [fotos, setFotos] = useState<Foto[]>(
    () => fotosIniciales ?? []
  );

  // ====================================================
  // SELECCIONAR FOTOGRAFÍAS
  // ====================================================

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

  // ====================================================
  // ELIMINAR FOTOGRAFÍA
  // ====================================================

  const eliminarFoto = (id: string) => {
    setFotos((actuales) =>
      actuales.filter((foto) => foto.id !== id)
    );
  };

  // ====================================================
  // CAMBIAR ORDEN DE FOTOGRAFÍAS
  // ====================================================

  const moverFoto = (
    indice: number,
    direccion: -1 | 1
  ) => {
    setFotos((actuales) => {
      const destino = indice + direccion;

      if (
        destino < 0 ||
        destino >= actuales.length
      ) {
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

  // ====================================================
  // CONTINUAR
  // ====================================================

  const enviarRevision = () => {

    // Para publicar se requieren al menos 3 fotografías.
    if (
      intencion === "publish" &&
      fotos.length < MIN_FOTOS_PUBLICACION
    ) {
      Alert.alert(
        "Fotografías insuficientes",
        "Necesitas al menos 3 fotografías para publicar tu habitación."
      );
      return;
    }

    if (!onEnviarRevision) {
      Alert.alert(
        "Error",
        "No se configuró la siguiente acción."
      );
      return;
    }

    onEnviarRevision(fotos, intencion);
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <SafeAreaView style={styles.pantalla}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.contenido}
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

        {/* CONTADOR */}

        <View style={styles.contador}>
          <Text style={styles.contadorTexto}>
            Fotografías agregadas
          </Text>

          <Text style={styles.contadorNumero}>
            {fotos.length}/{MAX_FOTOS}
          </Text>
        </View>

        {/* LISTA DE FOTOGRAFÍAS */}

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

        {/* ESTADO VACÍO */}

        {fotos.length === 0 && (
          <View style={styles.vacio}>
            <Text style={styles.iconoVacio}>
              +
            </Text>

            <Text style={styles.textoVacio}>
              Todavía no agregas fotografías
            </Text>

            <Text style={styles.detalleVacio}>
              Puedes agregarlas ahora o hacerlo después.
            </Text>
          </View>
        )}

        {/* AGREGAR FOTOGRAFÍAS */}

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

        {/* CONTINUAR */}

        <Pressable
          style={styles.botonEnviar}
          onPress={enviarRevision}
        >
          <Text style={styles.textoEnviar}>
            {intencion === "draft"
              ? "Guardar borrador"
              : "Enviar anuncio a revisión"}
          </Text>
        </Pressable>

        {/* INFORMACIÓN */}

        <Text style={styles.nota}>
          Puedes agregar hasta 10 fotografías.
          La primera será la imagen principal.
          {intencion === "publish"
            ? " Para publicar necesitas al menos 3 fotografías."
            : " Puedes completar tus fotografías después."}
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
    backgroundColor: color.blanco,
  },

  contenido: {
    paddingHorizontal: 21,
    paddingTop: 15,
    paddingBottom: 28,
  },

  marca: {
    color: color.accion,
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
    color: color.accion,
    fontSize: 30,
    lineHeight: 34,
  },

  titulo: {
    color: color.tinta,
    fontSize: 21,
    fontWeight: "700",
  },

  subtitulo: {
    color: color.secundario,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 9,
  },

  instruccion: {
    color: color.secundario,
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
    color: color.accion,
    fontSize: 11,
    fontWeight: "700",
  },

  tarjetaFoto: {
    backgroundColor: color.blanco,
    borderRadius: 13,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: color.borde,
    marginBottom: 10,
  },

  imagen: {
    width: "100%",
    height: 145,
    backgroundColor: color.menta,
  },

  infoFoto: {
    padding: 11,
  },

  nombreFoto: {
    color: color.tinta,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 9,
  },

  acciones: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  accion: {
    color: color.accion,
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
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: "#E9E0EA",
    borderStyle: "dashed",
    borderRadius: 13,
    padding: 30,
    alignItems: "center",
    marginBottom: 12,
  },

  iconoVacio: {
    color: color.accion,
    fontSize: 35,
    marginBottom: 8,
  },

  textoVacio: {
    color: "#66556B",
    fontSize: 12,
    fontWeight: "600",
  },

  detalleVacio: {
    color: color.secundario,
    fontSize: 10,
    marginTop: 5,
    textAlign: "center",
  },

  botonSubir: {
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: "#E9E0EA",
    borderRadius: 11,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  textoSubir: {
    color: color.accion,
    fontSize: 12,
    fontWeight: "600",
  },

  botonEnviar: {
    backgroundColor: color.accion,
    borderRadius: 11,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  textoEnviar: {
    color: color.blanco,
    fontSize: 13,
    fontWeight: "700",
  },

  botonDesactivado: {
    opacity: 0.45,
  },

  nota: {
    color: "#9A8B9D",
    fontSize: 10,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 16,
  },
});
