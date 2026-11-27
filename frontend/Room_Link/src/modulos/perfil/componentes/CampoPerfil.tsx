import { color } from '@/constants/roomlink';

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export function CampoPerfil({
  etiqueta,
  valor,
  alCambiar,
  placeholder,
  multiline = false,
  prefijo,
  sufijo,
  ayuda,
  error,
  accessibilityLabel,
  ...props
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  placeholder?: string;
  multiline?: boolean;
  prefijo?: string;
  sufijo?: string;
  ayuda?: string;
  error?: string;
  accessibilityLabel?: string;
} & Pick<TextInputProps, 'keyboardType' | 'maxLength' | 'autoCapitalize' | 'autoComplete'>) {
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View
        style={[
          styles.contenedorEntrada,
          multiline && styles.contenedorMultilinea,
          enfocado && styles.contenedorEnfocado,
          error ? styles.contenedorError : null,
        ]}>
        {prefijo && <Text style={styles.prefijo}>{prefijo}</Text>}
        <TextInput
          accessibilityLabel={accessibilityLabel ?? etiqueta}
          autoCapitalize={props.autoCapitalize ?? (multiline ? 'sentences' : 'words')}
          autoComplete={props.autoComplete}
          keyboardType={props.keyboardType}
          maxLength={props.maxLength}
          multiline={multiline}
          onBlur={() => setEnfocado(false)}
          onChangeText={alCambiar}
          onFocus={() => setEnfocado(true)}
          placeholder={placeholder}
          placeholderTextColor={color.secundario}
          style={[styles.entrada, multiline && styles.entradaMultilinea]}
          textAlignVertical={multiline ? 'top' : 'center'}
          value={valor}
        />
        {sufijo && <Text style={styles.sufijo}>{sufijo}</Text>}
      </View>
      {error ? (
        <Text style={styles.textoError}>{error}</Text>
      ) : ayuda ? (
        <Text style={styles.ayuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: {
    flex: 1,
    marginTop: 12,
  },
  etiqueta: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  contenedorEntrada: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color.control,
    borderRadius: 8,
    backgroundColor: color.blanco,
  },
  contenedorMultilinea: {
    minHeight: 112,
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingBottom: 10,
  },
  contenedorEnfocado: {
    borderColor: color.accion,
  },
  contenedorError: {
    borderColor: color.rosaTexto,
  },
  entrada: {
    flex: 1,
    color: color.tinta,
    fontSize: 15,
    paddingVertical: 0,
  },
  entradaMultilinea: {
    minHeight: 90,
    lineHeight: 17,
  },
  prefijo: {
    color: color.accion,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 6,
  },
  sufijo: {
    color: color.secundario,
    fontSize: 12,
    marginLeft: 6,
  },
  ayuda: {
    color: color.secundario,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  textoError: {
    color: color.rosaTexto,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
