import { Alert, TextInput, type TextInputProps } from 'react-native';

import {
  esEntradaTelefono,
  mensajeTextoRestringido,
  tieneCaracteresDeControl,
  tieneTextoRestringido,
} from './validacionCampos';

export function EntradaValidada({ onChangeText, ...props }: TextInputProps) {
  return (
    <TextInput
      {...props}
      inputMode={props.keyboardType === 'phone-pad' ? 'numeric' : props.inputMode}
      onChangeText={onChangeText && ((valor) => {
        if (props.keyboardType === 'phone-pad' && !esEntradaTelefono(valor)) {
          Alert.alert('Revisa el teléfono', 'Escribe hasta 10 dígitos, sin espacios ni otros símbolos.');
          return;
        }
        if (tieneCaracteresDeControl(valor, Boolean(props.multiline))) {
          Alert.alert('Revisa el campo', 'El texto contiene caracteres invisibles no permitidos.');
          return;
        }
        if (!props.secureTextEntry && tieneTextoRestringido(valor)) {
          Alert.alert('Revisa el campo', mensajeTextoRestringido);
          return;
        }
        onChangeText(valor);
      })}
    />
  );
}
