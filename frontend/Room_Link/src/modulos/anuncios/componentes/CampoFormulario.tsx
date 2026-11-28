import { color } from '@/constants/roomlink';

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInputProps,
} from "react-native";
import { EntradaValidada } from '@/modulos/comunes/EntradaValidada';

type Props = TextInputProps & {
  etiqueta: string;
  contenedorStyle?: object;
};

export default function CampoFormulario({
  etiqueta,
  contenedorStyle,
  ...inputProps
}: Props) {
  return (
    <View style={[styles.contenedor, contenedorStyle]}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>

      <EntradaValidada
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? etiqueta}
        placeholderTextColor={color.secundario}
        style={[
          styles.input,
          inputProps.multiline ? styles.multiline : undefined,
          inputProps.style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: color.control,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 9,
    marginBottom: 10,
  },
  etiqueta: {
    color: color.secundario,
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    color: color.tinta,
    fontSize: 16,
    padding: 0,
    minHeight: 32,
  },
  multiline: {
    minHeight: 58,
    textAlignVertical: "top",
  },
});
