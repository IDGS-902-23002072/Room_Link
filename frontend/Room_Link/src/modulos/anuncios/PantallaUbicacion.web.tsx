import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Coordenadas = {
  latitude: number;
  longitude: number;
};

type Props = {
  ubicacionInicial?: string;
  onVolver?: () => void;
  onContinuar?: (direccion: string, coordenadas: Coordenadas) => void;
};

// Centro por defecto (León, Gto.) — en web no hay selector de mapa interactivo;
// el mapa con pin (react-native-maps) sólo está disponible en la app nativa.
const COORDENADAS_DEFECTO: Coordenadas = { latitude: 21.1221, longitude: -101.68 };

/**
 * Shim web de PantallaUbicacion. `react-native-maps` no soporta web, así que
 * en web se captura la dirección por texto y se usan coordenadas por defecto.
 * Metro resuelve este archivo (.web.tsx) sólo en la plataforma web.
 */
export default function PantallaUbicacion({
  ubicacionInicial = '',
  onVolver,
  onContinuar,
}: Props) {
  const [direccion, setDireccion] = useState(ubicacionInicial);

  return (
    <SafeAreaView style={estilos.safe}>
      <View style={estilos.contenido}>
        <Text style={estilos.titulo}>Ubicación</Text>
        <Text style={estilos.nota}>
          El mapa interactivo con pin está disponible en la app móvil. En web,
          escribe la dirección de la habitación.
        </Text>
        <TextInput
          style={estilos.input}
          value={direccion}
          onChangeText={setDireccion}
          placeholder="Calle, número, colonia, ciudad"
          placeholderTextColor="#9b93a3"
        />
        <View style={estilos.acciones}>
          {onVolver ? (
            <Pressable style={[estilos.boton, estilos.secundario]} onPress={onVolver}>
              <Text style={estilos.secundarioTexto}>Volver</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[estilos.boton, estilos.primario]}
            onPress={() =>
              onContinuar?.(direccion.trim(), COORDENADAS_DEFECTO)
            }
          >
            <Text style={estilos.primarioTexto}>Continuar</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  contenido: { padding: 24, gap: 16 },
  titulo: { fontSize: 24, fontWeight: '800', color: '#2b2430', marginTop: 8 },
  nota: { fontSize: 14, color: '#6b6472' },
  input: {
    borderWidth: 1,
    borderColor: '#e4dbe9',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#2b2430',
    backgroundColor: '#f7f4f9',
  },
  acciones: { flexDirection: 'row', gap: 12, marginTop: 8 },
  boton: { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primario: { backgroundColor: '#81638b' },
  primarioTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secundario: { backgroundColor: '#f0eaf3' },
  secundarioTexto: { color: '#2b2430', fontWeight: '700', fontSize: 16 },
});
