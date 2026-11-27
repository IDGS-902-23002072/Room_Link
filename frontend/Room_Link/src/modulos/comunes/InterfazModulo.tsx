import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color } from '@/constants/roomlink';

export function PantallaModulo({ titulo, detalle, volver, children }: {
  titulo: string;
  detalle: string;
  volver: Href;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={estilos.area}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Link href={volver} style={[estilos.enlace, estilos.volver]}>‹ Volver</Link>
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

export function Accion({ texto, alPulsar, primaria = false, deshabilitada = false, seleccionada, peligro = false }: {
  texto: string;
  alPulsar: () => void;
  primaria?: boolean;
  deshabilitada?: boolean;
  seleccionada?: boolean;
  peligro?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitada, selected: seleccionada }}
      disabled={deshabilitada}
      onPress={alPulsar}
      style={({ pressed }) => [estilos.boton, seleccionada && estilos.seleccionada, primaria && estilos.primario, peligro && estilos.peligro, (pressed || deshabilitada) && estilos.atenuado]}>
      <Text style={[estilos.enlace, primaria && estilos.blanco, peligro && estilos.textoPeligro]}>{texto}</Text>
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
  area: { flex: 1, backgroundColor: color.blanco },
  contenido: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 20, paddingBottom: 40, gap: 20 },
  titulo: { color: color.tinta, fontSize: 32, fontWeight: '600', letterSpacing: -0.9 },
  seccion: { color: color.tinta, fontSize: 18, fontWeight: '600', letterSpacing: -0.25 },
  texto: { color: color.tinta, fontSize: 15, lineHeight: 22 },
  secundario: { color: color.secundario },
  tarjeta: { backgroundColor: color.blanco, borderColor: color.borde, borderWidth: 1, borderRadius: 16, padding: 20, gap: 14 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  boton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: color.borde, backgroundColor: color.blanco, paddingHorizontal: 13, paddingVertical: 8 },
  primario: { backgroundColor: color.accion, borderColor: color.accion },
  seleccionada: { backgroundColor: color.menta, borderColor: color.menta },
  peligro: { backgroundColor: color.rosa, borderColor: color.rosa },
  textoPeligro: { color: color.rosaTexto },
  enlace: { color: color.tinta, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  volver: { alignSelf: 'flex-start', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, backgroundColor: color.superficie, overflow: 'hidden' },
  blanco: { color: color.blanco },
  atenuado: { opacity: 0.55 },
  aviso: { color: color.accion, backgroundColor: color.mentaSuave, borderRadius: 8, padding: 12, lineHeight: 20 },
  error: { color: color.rosaTexto, backgroundColor: color.rosa },
});
