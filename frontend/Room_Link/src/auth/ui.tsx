import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { EntradaValidada } from '@/modulos/comunes/EntradaValidada';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarcaRoomLink } from '@/components/MarcaRoomLink';
import { color } from '@/constants/roomlink';

export const paleta = {
  primario: color.accion,
  primarioTexto: color.blanco,
  secundario: color.accion,
  lavanda: color.lavanda,
  teal: color.menta,
  fondo: color.blanco,
  tarjeta: color.blanco,
  tinta: color.tinta,
  tenue: color.secundario,
  borde: color.borde,
  error: color.rosaTexto,
  ok: color.accion,
};

export function PantallaAuth({
  children,
  kicker,
  portada = false,
  titulo,
  subtitulo,
}: {
  children: ReactNode;
  kicker?: string;
  portada?: boolean;
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <SafeAreaView style={estilos.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={estilos.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <MarcaRoomLink />
        {portada && (
          <Image
            contentFit="cover"
            source={require('@/assets/images/interior-roomlink.webp')}
            style={estilos.portada}
          />
        )}
        {kicker ? <Text style={estilos.kicker}>{kicker}</Text> : null}
        <Text accessibilityRole="header" style={estilos.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
        <View style={estilos.cuerpo}>{children}</View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Campo({
  etiqueta,
  valor,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize = 'none',
  testID,
}: {
  etiqueta: string;
  testID?: string;
  valor: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <EntradaValidada
        accessibilityLabel={etiqueta}
        testID={testID}
        style={estilos.input}
        value={valor}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={paleta.tenue}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

export function BotonPrimario({
  etiqueta,
  onPress,
  cargando,
  variante = 'solido',
}: {
  etiqueta: string;
  onPress: () => void;
  cargando?: boolean;
  variante?: 'solido' | 'contorno';
}) {
  const esSolido = variante === 'solido';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={cargando}
      onPress={onPress}
      accessibilityState={{ disabled: cargando, busy: cargando }}
      style={({ pressed }) => [
        estilos.boton,
        esSolido ? estilos.botonSolido : estilos.botonContorno,
        (cargando || pressed) && estilos.botonDeshab,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={esSolido ? paleta.primarioTexto : paleta.primario} />
      ) : (
        <Text style={esSolido ? estilos.botonTextoSolido : estilos.botonTextoContorno}>
          {etiqueta}
        </Text>
      )}
    </Pressable>
  );
}

export function Enlace({ etiqueta, onPress }: { etiqueta: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={estilos.enlace}>
      <Text style={estilos.enlaceTexto}>{etiqueta}</Text>
    </Pressable>
  );
}

export function Aviso({ texto, tono }: { texto: string; tono: 'error' | 'ok' }) {
  if (!texto) return null;
  return (
    <View
      style={[
        estilos.aviso,
        { backgroundColor: tono === 'error' ? color.rosa : color.menta },
      ]}
    >
      <Text style={{ color: tono === 'error' ? paleta.error : paleta.ok, fontSize: 14 }}>
        {texto}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  safe: { flex: 1, backgroundColor: paleta.fondo },
  scroll: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, flexGrow: 1 },
  portada: { width: '100%', height: 220, borderRadius: 8, marginTop: 18 },
  kicker: {
    color: paleta.secundario,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  titulo: { color: paleta.tinta, fontSize: 34, fontWeight: '600', marginTop: 19, letterSpacing: -1 },
  subtitulo: { color: paleta.tenue, fontSize: 15, lineHeight: 22, marginTop: 6 },
  cuerpo: { marginTop: 24, gap: 16 },
  campo: { gap: 6 },
  etiqueta: { color: paleta.tinta, fontSize: 14, fontWeight: '700' },
  input: {
    backgroundColor: color.fondo,
    borderColor: color.control,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: paleta.tinta,
  },
  boton: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonSolido: { backgroundColor: paleta.primario },
  botonContorno: { backgroundColor: paleta.tarjeta, borderWidth: 1, borderColor: paleta.borde },
  botonDeshab: { opacity: 0.6 },
  botonTextoSolido: { color: paleta.primarioTexto, fontSize: 16, fontWeight: '700' },
  botonTextoContorno: { color: paleta.tinta, fontSize: 16, fontWeight: '700' },
  enlace: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  enlaceTexto: { color: paleta.primario, fontSize: 14, fontWeight: '700' },
  aviso: { borderRadius: 12, padding: 12 },
});
