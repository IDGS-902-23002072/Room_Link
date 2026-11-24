// Registro exhaustivo de arrendador (RNF-03.4). Gatea el acceso a las pantallas
// de arrendador (Mis publicaciones, publicar, postulaciones): un seeker debe
// completar perfil + verificación de identidad + aceptar términos para que el
// backend le otorgue el rol `host`.

import { useEffect, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { convertirseEnArrendador } from '@/auth/api-auth';
import { obtenerPerfil, type PerfilPublico } from '@/modulos/perfil/api';

const COL = {
  morado: '#84658D',
  moradoClaro: '#E9DAEC',
  teal: '#5BC4B4',
  tealBg: '#CFEFE8',
  ink: '#2B2430',
  gris: '#817987',
  fondo: '#F5F1F6',
  blanco: '#FFFFFF',
  borde: '#ECE5EF',
  ok: '#2F9E82',
  peligro: '#C0564F',
};

function Requisito({
  cumplido,
  titulo,
  detalle,
}: {
  cumplido: boolean;
  titulo: string;
  detalle: string;
}) {
  return (
    <View style={styles.req}>
      <Text style={[styles.reqIcono, { color: cumplido ? COL.ok : COL.gris }]}>
        {cumplido ? '✓' : '○'}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.reqTitulo}>{titulo}</Text>
        <Text style={styles.reqDetalle}>{detalle}</Text>
      </View>
    </View>
  );
}

export default function PantallaConvertirseArrendador() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      setPerfil(await obtenerPerfil());
    } catch {
      setPerfil(null);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const perfilCompleto = Boolean(perfil?.fullName);
  const identidadOk =
    perfil?.identityStatus === 'pending' || perfil?.identityStatus === 'verified';
  const puede = perfilCompleto && identidadOk && acepta;

  async function convertir() {
    setEnviando(true);
    setError(null);
    try {
      await convertirseEnArrendador(true);
      // La sesión se actualiza con el rol host → el gate re-renderiza a Mis publicaciones.
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo completar el registro de arrendador.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>ROOMLINK / ARRENDADOR</Text>
        <Text style={styles.titulo}>Conviértete en arrendador</Text>
        <Text style={styles.subtitulo}>
          Para publicar habitaciones necesitamos verificar quién eres. Es un paso
          único y protege a toda la comunidad.
        </Text>

        {cargando ? (
          <ActivityIndicator color={COL.morado} style={{ marginTop: 28 }} />
        ) : (
          <>
            <View style={styles.card}>
              <Requisito
                cumplido={perfilCompleto}
                titulo="Perfil completo"
                detalle={
                  perfilCompleto
                    ? 'Tu perfil tiene los datos básicos.'
                    : 'Completa tu nombre y fecha de nacimiento en Perfil.'
                }
              />
              <Requisito
                cumplido={identidadOk}
                titulo="Verificación de identidad"
                detalle={
                  perfil?.identityStatus === 'verified'
                    ? 'Identidad verificada.'
                    : perfil?.identityStatus === 'pending'
                      ? 'Tu verificación está en revisión. Puedes continuar.'
                      : 'Solicita la verificación de identidad para continuar.'
                }
              />
            </View>

            {!identidadOk ? (
              <Link href="/galeria-fotos" asChild>
                <Pressable style={styles.botonSecundario}>
                  <Text style={styles.botonSecundarioTexto}>
                    Verificar mi identidad
                  </Text>
                </Pressable>
              </Link>
            ) : null}

            <Pressable
              style={styles.terminos}
              onPress={() => setAcepta((v) => !v)}
            >
              <Text style={[styles.check, acepta && styles.checkOn]}>
                {acepta ? '✓' : ''}
              </Text>
              <Text style={styles.terminosTexto}>
                Acepto las responsabilidades del arrendador: publicar información
                veraz, respetar a los postulantes y cumplir las reglas de la
                comunidad.
              </Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.botonPrimario, !puede && styles.deshabilitado]}
              onPress={convertir}
              disabled={!puede || enviando}
            >
              <Text style={styles.botonPrimarioTexto}>
                {enviando ? 'Registrando…' : 'Convertirme en arrendador'}
              </Text>
            </Pressable>

            <Text style={styles.nota}>
              Al convertirte en arrendador se habilitan Mis publicaciones, publicar
              habitaciones y gestionar postulaciones.
            </Text>
          </>
        )}
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
  card: {
    backgroundColor: COL.blanco,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: COL.borde,
    marginBottom: 14,
  },
  req: { flexDirection: 'row', padding: 12, gap: 12, alignItems: 'flex-start' },
  reqIcono: { fontSize: 18, fontWeight: '700', width: 20 },
  reqTitulo: { color: COL.ink, fontSize: 15, fontWeight: '700' },
  reqDetalle: { color: COL.gris, fontSize: 13, marginTop: 2, lineHeight: 18 },
  terminos: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginVertical: 8 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COL.morado,
    textAlign: 'center',
    lineHeight: 20,
    color: COL.blanco,
    fontWeight: '700',
    overflow: 'hidden',
  },
  checkOn: { backgroundColor: COL.morado },
  terminosTexto: { flex: 1, color: COL.ink, fontSize: 13, lineHeight: 19 },
  error: { color: COL.peligro, fontSize: 13, marginVertical: 6 },
  botonPrimario: {
    backgroundColor: COL.morado,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  botonPrimarioTexto: { color: COL.blanco, fontSize: 16, fontWeight: '700' },
  botonSecundario: {
    backgroundColor: COL.blanco,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COL.borde,
    marginBottom: 6,
  },
  botonSecundarioTexto: { color: COL.morado, fontSize: 15, fontWeight: '700' },
  deshabilitado: { opacity: 0.5 },
  nota: { color: COL.gris, fontSize: 13, marginTop: 14, lineHeight: 18 },
});
