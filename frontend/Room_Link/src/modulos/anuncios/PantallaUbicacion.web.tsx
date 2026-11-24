import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { solicitud } from '@/modulos/compatibilidad/api';

type Coordenadas = { latitude: number; longitude: number };
type Direccion = Coordenadas & { label: string };
type Props = {
  ubicacionInicial?: string;
  coordenadasIniciales?: Coordenadas | null;
  onVolver?: () => void;
  onContinuar?: (direccion: string, coordenadas: Coordenadas) => void;
};

export default function PantallaUbicacion({
  ubicacionInicial = '',
  coordenadasIniciales = null,
  onVolver,
  onContinuar,
}: Props) {
  const [direccion, setDireccion] = useState(ubicacionInicial);
  const [seleccion, setSeleccion] = useState(coordenadasIniciales);
  const [resultados, setResultados] = useState<Direccion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function buscar() {
    const q = direccion.trim();
    if (buscando || q.length < 3) return;
    setBuscando(true);
    setMensaje('');
    setResultados([]);
    try {
      const result = await solicitud<{ items: Direccion[] }>(`/api/v1/geolocation/search?${new URLSearchParams({ q })}`);
      setResultados(result.items);
      if (!result.items.length) setMensaje('No encontramos esa dirección. Prueba con una colonia o referencia pública.');
    } catch (cause) {
      setMensaje(cause instanceof Error ? cause.message : 'No se pudo buscar la dirección.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <SafeAreaView style={estilos.safe} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>Ubicación</Text>
        <Text style={estilos.nota}>Busca una calle, colonia o referencia pública en OpenStreetMap y selecciona el resultado.</Text>
        <TextInput
          accessibilityLabel="Dirección o colonia"
          style={estilos.input}
          value={direccion}
          editable={!buscando}
          maxLength={120}
          onChangeText={(value) => {
            setDireccion(value);
            setSeleccion(null);
            setResultados([]);
            setMensaje('');
          }}
          onSubmitEditing={buscar}
          placeholder="Calle, colonia o ciudad"
          placeholderTextColor="#746b7c"
        />
        <Pressable accessibilityRole="button" disabled={buscando || direccion.trim().length < 3}
          style={[estilos.boton, estilos.secundario]} onPress={buscar}>
          <Text style={estilos.secundarioTexto}>{buscando ? 'Buscando…' : 'Buscar ubicación'}</Text>
        </Pressable>
        {mensaje ? <Text accessibilityRole="alert" style={estilos.nota}>{mensaje}</Text> : null}
        {resultados.map(({ label, latitude, longitude }) => (
          <Pressable accessibilityRole="button" key={`${latitude},${longitude},${label}`}
            style={[estilos.boton, estilos.secundario]} onPress={() => {
              setDireccion(label);
              setSeleccion({ latitude, longitude });
              setResultados([]);
            }}>
            <Text style={estilos.secundarioTexto}>{label}</Text>
          </Pressable>
        ))}
        {seleccion && <Text style={estilos.nota}>Ubicación seleccionada</Text>}
        <View style={estilos.acciones}>
          {onVolver && <Pressable accessibilityRole="button"
            style={[estilos.boton, estilos.secundario]} onPress={onVolver}>
            <Text style={estilos.secundarioTexto}>Volver</Text>
          </Pressable>}
          <Pressable accessibilityRole="button"
            style={[estilos.boton, estilos.primario, !seleccion && estilos.deshabilitado]}
            disabled={!seleccion || buscando}
            onPress={() => { if (seleccion) onContinuar?.(direccion.trim(), seleccion); }}>
            <Text style={estilos.primarioTexto}>Continuar a fotografías</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  contenido: { padding: 24, gap: 16 },
  titulo: { fontSize: 24, fontWeight: '800', color: '#2b2430' },
  nota: { fontSize: 14, color: '#6b6472' },
  input: { borderWidth: 1, borderColor: '#e4dbe9', borderRadius: 14, padding: 14, fontSize: 16, color: '#2b2430' },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  boton: { borderRadius: 14, padding: 15, alignItems: 'center' },
  primario: { backgroundColor: '#CFEFE8' },
  primarioTexto: { color: '#214E42', fontWeight: '700' },
  secundario: { backgroundColor: '#f0eaf3' },
  secundarioTexto: { color: '#514458', fontWeight: '700' },
  deshabilitado: { opacity: 0.55 },
});
