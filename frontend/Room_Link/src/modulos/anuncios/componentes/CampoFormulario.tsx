import { color } from '@/constants/roomlink';

import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from "react-native";

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

      <TextInput
        {...inputProps}
        placeholderTextColor="#9A8B9D"
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
    borderColor: "#E9E0EA",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 9,
    marginBottom: 10,
  },
  etiqueta: {
    color: color.secundario,
    fontSize: 11,
    marginBottom: 4,
  },
  input: {
    color: color.tinta,
    fontSize: 14,
    padding: 0,
    minHeight: 23,
  },
  multiline: {
    minHeight: 58,
    textAlignVertical: "top",
  },
});
