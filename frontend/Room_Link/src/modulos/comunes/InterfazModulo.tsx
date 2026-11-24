import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PantallaModulo({ titulo, detalle, volver, children }: {
  titulo: string;
  detalle: string;
  volver: Href;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={estilos.area}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Link href={volver} style={estilos.enlace}>‹ Volver</Link>
        <Text accessibilityRole="header" style={estilos.titulo}>{titulo}</Text>
        <Texto secundario>{detalle}</Texto>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Tarjeta({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <View style={estilos.tarjeta}>
      {titulo && <Text accessibilityRole="header" style={estilos.seccion}>{titulo}</Text>}
      {children}
    </View>
  );
}

export function Texto({ children, secundario = false }: { children: ReactNode; secundario?: boolean }) {
  return <Text style={[estilos.texto, secundario && estilos.secundario]}>{children}</Text>;
}

export function Aviso({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return children ? (
    <Text accessibilityLiveRegion="polite" accessibilityRole={error ? 'alert' : undefined} style={[estilos.aviso, error && estilos.error]}>
      {children}
    </Text>
  ) : null;
}

export function Accion({ texto, alPulsar, primaria = false, deshabilitada = false, seleccionada }: {
  texto: string;
  alPulsar: () => void;
  primaria?: boolean;
  deshabilitada?: boolean;
  seleccionada?: boolean;
}) {
  const destacada = primaria || seleccionada;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitada, selected: seleccionada }}
      disabled={deshabilitada}
      onPress={alPulsar}
      style={({ pressed }) => [estilos.boton, destacada && estilos.primario, (pressed || deshabilitada) && estilos.atenuado]}>
      <Text style={[estilos.enlace, destacada && estilos.blanco]}>{texto}</Text>
    </Pressable>
  );
}

export function Opciones<T extends string>({ opciones, valor, alCambiar }: {
  opciones: readonly (readonly [T, string])[];
  valor: T;
  alCambiar: (valor: T) => void;
}) {
  return (
    <View style={estilos.fila}>
      {opciones.map(([clave, texto]) => (
        <Accion alPulsar={() => alCambiar(clave)} key={clave} seleccionada={valor === clave} texto={texto} />
      ))}
    </View>
  );
}

export const estilos = StyleSheet.create({
  area: { flex: 1, backgroundColor: '#FAF7FA' },
  contenido: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 22, paddingBottom: 32, gap: 14 },
  titulo: { color: '#2C2433', fontSize: 29, fontWeight: '800' },
  seccion: { color: '#2C2433', fontSize: 17, fontWeight: '700' },
  texto: { color: '#2C2433', fontSize: 15, lineHeight: 21 },
  secundario: { color: '#6E5F74' },
  tarjeta: { backgroundColor: '#FFFFFF', borderColor: '#E8DEEB', borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  boton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#E8DEEB', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 8 },
  primario: { backgroundColor: '#81638B', borderColor: '#81638B' },
  enlace: { color: '#6C4F76', fontSize: 14, fontWeight: '700' },
  blanco: { color: '#FFFFFF' },
  atenuado: { opacity: 0.55 },
  aviso: { color: '#584461', backgroundColor: '#EEE4F1', borderRadius: 13, padding: 12, lineHeight: 20 },
  error: { color: '#913947', backgroundColor: '#FCEFF1' },
});
