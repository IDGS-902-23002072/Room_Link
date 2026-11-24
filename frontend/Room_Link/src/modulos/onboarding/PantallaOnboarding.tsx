import { color } from '@/constants/roomlink';

// Onboarding obligatorio (bugs #0 y #12): fuerza completar perfil + encuesta de
// compatibilidad antes de dejar usar la app. Se muestra cuando el gate de
// (pestanas)/_layout detecta que falta alguno de los dos.

import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboarding } from '@/auth/useOnboarding';
import { crearPerfil } from '@/modulos/perfil/api';

const COL = {
  morado: color.accion,
  moradoClaro: color.menta,
  ink: color.tinta,
  gris: color.secundario,
  fondo: color.blanco,
  blanco: color.blanco,
  borde: color.borde,
  ok: color.accion,
  peligro: color.rosaTexto,
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  ...rest
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
} & Omit<React.ComponentProps<typeof TextInput>, 'onChange' | 'value' | 'onChangeText'>) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COL.gris}
        {...rest}
      />
    </View>
  );
}

export default function PantallaOnboarding() {
  const router = useRouter();
  const { cargando, tienePerfil, tieneEncuesta, completo, refrescar } = useOnboarding();

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [occupation, setOccupation] = useState('');
  const [bio, setBio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cargando) {
    return (
      <SafeAreaView style={styles.pantalla}>
        <ActivityIndicator color={COL.morado} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  // Ya completó todo: lo mandamos a la app.
  if (completo) {
    return <Redirect href="/(pestanas)/explorar" />;
  }

  async function guardarPerfil() {
    if (!fullName.trim()) return setError('Ingresa tu nombre completo.');
    if (!FECHA_RE.test(birthDate)) return setError('La fecha debe tener el formato AAAA-MM-DD.');
    setGuardando(true);
    setError(null);
    try {
      await crearPerfil({
        fullName: fullName.trim(),
        birthDate,
        occupation: occupation.trim() || null,
        bio: bio.trim() || null,
      });
      refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el perfil.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>ROOMLINK · BIENVENIDO</Text>

        {/* Paso 1 — Perfil */}
        {!tienePerfil ? (
          <>
            <Text style={styles.titulo}>Completa tu perfil</Text>
            <Text style={styles.subtitulo}>
              Paso 1 de 2. Necesitamos estos datos antes de que explores RoomLink.
            </Text>

            <Campo label="Nombre completo" valor={fullName} onChange={setFullName} placeholder="Tu nombre" />
            <Campo
              label="Fecha de nacimiento"
              valor={birthDate}
              onChange={setBirthDate}
              placeholder="AAAA-MM-DD"
              autoCapitalize="none"
            />
            <Campo label="Ocupación (opcional)" valor={occupation} onChange={setOccupation} placeholder="Estudiante, diseñador…" />
            <Campo label="Sobre ti (opcional)" valor={bio} onChange={setBio} placeholder="Una frase sobre ti" multiline />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.boton, guardando && styles.deshabilitado]}
              onPress={guardarPerfil}
              disabled={guardando}
            >
              <Text style={styles.botonTexto}>
                {guardando ? 'Guardando…' : 'Guardar y continuar'}
              </Text>
            </Pressable>
          </>
        ) : !tieneEncuesta ? (
          /* Paso 2 — Encuesta de compatibilidad */
          <>
            <Text style={styles.ok}>✓ Perfil completo</Text>
            <Text style={styles.titulo}>Encuesta de compatibilidad</Text>
            <Text style={styles.subtitulo}>
              Paso 2 de 2. Responde la encuesta para que podamos encontrarte
              roomies afines. Es rápida y obligatoria la primera vez.
            </Text>

            <Pressable
              style={styles.boton}
              onPress={() => router.push('/encuesta')}
            >
              <Text style={styles.botonTexto}>Hacer la encuesta</Text>
            </Pressable>

            <Pressable style={styles.secundario} onPress={refrescar}>
              <Text style={styles.secundarioTexto}>Ya la completé — continuar</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COL.fondo },
  scroll: { padding: 22, paddingBottom: 48 },
  eyebrow: { color: COL.gris, fontSize: 12, letterSpacing: 1, fontWeight: '600' },
  titulo: { color: COL.ink, fontSize: 26, fontWeight: '700', marginTop: 2 },
  subtitulo: { color: COL.gris, fontSize: 14, marginTop: 6, marginBottom: 18, lineHeight: 20 },
  ok: { color: COL.ok, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  label: { color: COL.gris, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: COL.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COL.borde,
    padding: 14,
    color: COL.ink,
    fontSize: 15,
  },
  error: { color: COL.peligro, fontSize: 13, marginBottom: 8 },
  boton: {
    backgroundColor: COL.morado,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  botonTexto: { color: COL.blanco, fontSize: 16, fontWeight: '700' },
  secundario: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secundarioTexto: { color: COL.morado, fontSize: 14, fontWeight: '600' },
  deshabilitado: { opacity: 0.5 },
});
