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
          placeholderTextColor="#9A909E"
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
    color: '#6F5B76',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 5,
  },
  contenedorEntrada: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EEE8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  contenedorMultilinea: {
    minHeight: 112,
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingBottom: 10,
  },
  contenedorEnfocado: {
    borderColor: '#C9A9D1',
  },
  contenedorError: {
    borderColor: '#D89A9A',
  },
  entrada: {
    flex: 1,
    color: '#28232D',
    fontSize: 12,
    paddingVertical: 0,
  },
  entradaMultilinea: {
    minHeight: 90,
    lineHeight: 17,
  },
  prefijo: {
    color: '#9C80A4',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  sufijo: {
    color: '#817987',
    fontSize: 9,
    marginLeft: 6,
  },
  ayuda: {
    color: '#817987',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 4,
  },
  textoError: {
    color: '#B23A3A',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 4,
  },
});
