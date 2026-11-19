// M09 — Vista del arrendador: postulaciones de una habitación.
//   M09.1 "Personas interesadas"  → lista (tabs Nuevas / Resueltas)
//   M09.2 "Conoce a tu candidato"  → detalle del candidato
//   M09.3 "Tu decisión"            → aceptar / lista de espera / rechazar
// Un único componente con estado interno `vista` (como el flujo de anuncios).

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
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

import {
  decidirPostulacion,
  listarPostulaciones,
  obtenerPerfilCandidato,
  type Decision,
  type PerfilCandidato,
  type Postulacion,
} from './api';

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
  peligro: '#C0564F',
};

type Vista = 'lista' | 'candidato' | 'decision';
type Tab = 'nuevas' | 'resueltas';

const esNueva = (p: Postulacion) => p.status === 'pending';
const etiquetaEstado = (p: Postulacion) =>
  p.status === 'accepted'
    ? 'ACEPTADA'
    : p.status === 'rejected'
      ? 'RECHAZADA'
      : 'NUEVA';

export default function PantallaPostulaciones({
  listingId,
  titulo,
}: {
  listingId: string;
  titulo: string;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Postulacion[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('nuevas');

  const [vista, setVista] = useState<Vista>('lista');
  const [sel, setSel] = useState<Postulacion | null>(null);
  const [perfil, setPerfil] = useState<PerfilCandidato | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [decidiendo, setDecidiendo] = useState(false);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const data = await listarPostulaciones(listingId);
      setPosts(data);
      const ids = [...new Set(data.map((p) => p.applicantId))];
      const entradas = await Promise.all(
        ids.map(async (uid) => {
          try {
            const perfil = await obtenerPerfilCandidato(uid);
            return [uid, perfil.fullName] as const;
          } catch {
            return [uid, 'Candidato'] as const;
          }
        }),
      );
      setNombres(Object.fromEntries(entradas));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron cargar las postulaciones.',
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const nuevas = posts.filter(esNueva).length;
  const filtradas = posts.filter((p) => (tab === 'nuevas' ? esNueva(p) : !esNueva(p)));

  async function abrirCandidato(p: Postulacion) {
    setSel(p);
    setMensaje('');
    setPerfil(null);
    setVista('candidato');
    setCargandoPerfil(true);
    try {
      setPerfil(await obtenerPerfilCandidato(p.applicantId));
    } catch {
      // detalle sin perfil: se muestra con lo que trae la postulación
    } finally {
      setCargandoPerfil(false);
    }
  }

  async function decidir(decision: Decision) {
    if (!sel) return;
    setDecidiendo(true);
    setError(null);
    try {
      await decidirPostulacion(sel.id, decision);
      await cargar();
      setVista('lista');
      setSel(null);
      setMensaje('');
      setTab('resueltas');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo registrar la decisión.',
      );
    } finally {
      setDecidiendo(false);
    }
  }

  const volver = () => {
    if (vista === 'decision') return setVista('candidato');
    if (vista === 'candidato') return setVista('lista');
    router.back();
  };

  const nombreCand = (p: Postulacion) => nombres[p.applicantId] ?? 'Candidato';

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={volver} hitSlop={10}>
          <Text style={styles.volver}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.eyebrow}>ROOMLINK / 09</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* M09.1 — Lista */}
        {vista === 'lista' && (
          <>
            <Text style={styles.titulo}>Personas interesadas</Text>
            <Text style={styles.subtitulo}>
              {titulo} · {posts.length}{' '}
              {posts.length === 1 ? 'postulación' : 'postulaciones'}
            </Text>

            <View style={styles.tabs}>
              {([
                ['nuevas', `Nuevas ${nuevas || ''}`.trim()],
                ['resueltas', 'Resueltas'],
              ] as const).map(([clave, label]) => (
                <Pressable
                  key={clave}
                  onPress={() => setTab(clave)}
                  style={[styles.tab, tab === clave && styles.tabActiva]}
                >
                  <Text style={[styles.tabTexto, tab === clave && styles.tabTextoActivo]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {cargando ? (
              <ActivityIndicator color={COL.morado} style={{ marginTop: 28 }} />
            ) : filtradas.length === 0 ? (
              <View style={styles.vacio}>
                <Text style={styles.vacioTitulo}>
                  {tab === 'nuevas' ? 'Sin postulaciones nuevas' : 'Sin resueltas'}
                </Text>
                <Text style={styles.vacioTexto}>
                  {tab === 'nuevas'
                    ? 'Cuando alguien postule a tu habitación, aparecerá aquí.'
                    : 'Las postulaciones que aceptes o rechaces se mostrarán acá.'}
                </Text>
              </View>
            ) : (
              filtradas.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.card}
                  onPress={() => abrirCandidato(p)}
                >
                  <Text style={styles.cardMeta}>
                    {p.compatibilityScore != null
                      ? `${p.compatibilityScore}% COMPATIBLE · `
                      : ''}
                    {etiquetaEstado(p)}
                  </Text>
                  <Text style={styles.cardNombre}>{nombreCand(p)}</Text>
                  {p.message ? (
                    <Text style={styles.cardMensaje} numberOfLines={1}>
                      {p.message}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </>
        )}

        {/* M09.2 — Conoce a tu candidato */}
        {vista === 'candidato' && sel && (
          <>
            <Text style={styles.titulo}>Conoce a tu candidato</Text>
            <Text style={styles.subtitulo}>Postulación · {titulo}</Text>

            <View style={styles.card}>
              <Text style={styles.cardNombre}>
                {cargandoPerfil
                  ? 'Cargando…'
                  : perfil
                    ? `${perfil.fullName}${perfil.age ? `, ${perfil.age}` : ''}`
                    : nombreCand(sel)}
              </Text>
              <Text style={styles.cardMeta}>
                {sel.compatibilityScore != null
                  ? `${sel.compatibilityScore}% compatible`
                  : 'Compatibilidad no disponible'}
                {perfil?.isVerified ? ' · Identidad verificada' : ''}
              </Text>
            </View>

            {perfil?.occupation ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Ocupación</Text>
                <Text style={styles.cardValor}>{perfil.occupation}</Text>
              </View>
            ) : null}

            {perfil?.bio ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Sobre el candidato</Text>
                <Text style={styles.cardValor}>{perfil.bio}</Text>
              </View>
            ) : null}

            {sel.message ? (
              <Text style={styles.quote}>“{sel.message}”</Text>
            ) : null}

            <Pressable
              style={styles.botonPrimario}
              onPress={() => setVista('decision')}
            >
              <Text style={styles.botonPrimarioTexto}>Evaluar solicitud</Text>
            </Pressable>
          </>
        )}

        {/* M09.3 — Tu decisión */}
        {vista === 'decision' && sel && (
          <>
            <Text style={styles.titulo}>Tu decisión</Text>
            <Text style={styles.subtitulo}>
              Tu respuesta se enviará a {nombreCand(sel)}.
            </Text>

            <View style={styles.tealCard}>
              <Text style={styles.tealTitulo}>{nombreCand(sel)} quiere vivir aquí</Text>
              <Text style={styles.tealTexto}>{titulo}</Text>
            </View>

            {/* Nota local para el host (aún no la consume el backend de decide). */}
            <Text style={styles.cardLabel}>Mensaje para la persona</Text>
            <TextInput
              style={styles.input}
              placeholder="Me gustaría que agendáramos una visita."
              placeholderTextColor={COL.gris}
              value={mensaje}
              onChangeText={setMensaje}
              multiline
            />

            <Pressable
              style={[styles.botonAceptar, decidiendo && styles.deshabilitado]}
              onPress={() => decidir('accept')}
              disabled={decidiendo}
            >
              <Text style={styles.botonAceptarTexto}>
                {decidiendo ? 'Enviando…' : 'Aceptar postulación'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.botonSecundario}
              onPress={() => setVista('lista')}
              disabled={decidiendo}
            >
              <Text style={styles.botonSecundarioTexto}>Poner en lista de espera</Text>
            </Pressable>

            <Pressable
              style={styles.botonSecundario}
              onPress={() => decidir('reject')}
              disabled={decidiendo}
            >
              <Text style={[styles.botonSecundarioTexto, { color: COL.peligro }]}>
                Rechazar postulación
              </Text>
            </Pressable>

            <Text style={styles.nota}>
              Aceptar una postulación permite continuar la conversación y definir
              los acuerdos de la casa.
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
  volver: { color: COL.morado, fontSize: 15, marginBottom: 10 },
  eyebrow: { color: COL.gris, fontSize: 12, letterSpacing: 1, fontWeight: '600' },
  titulo: { color: COL.ink, fontSize: 26, fontWeight: '700', marginTop: 2 },
  subtitulo: { color: COL.gris, fontSize: 14, marginTop: 4, marginBottom: 16 },
  error: { color: COL.peligro, fontSize: 13, marginVertical: 8 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COL.moradoClaro,
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabActiva: { backgroundColor: COL.morado },
  tabTexto: { color: COL.morado, fontSize: 14, fontWeight: '600' },
  tabTextoActivo: { color: COL.blanco },
  card: {
    backgroundColor: COL.blanco,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COL.borde,
  },
  cardMeta: { color: COL.morado, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  cardNombre: { color: COL.ink, fontSize: 18, fontWeight: '700', marginTop: 4 },
  cardMensaje: { color: COL.gris, fontSize: 14, marginTop: 4 },
  cardLabel: { color: COL.gris, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  cardValor: { color: COL.ink, fontSize: 15 },
  quote: { color: COL.gris, fontSize: 14, fontStyle: 'italic', marginVertical: 10 },
  vacio: { alignItems: 'center', paddingVertical: 40 },
  vacioTitulo: { color: COL.ink, fontSize: 16, fontWeight: '700' },
  vacioTexto: { color: COL.gris, fontSize: 14, textAlign: 'center', marginTop: 6 },
  botonPrimario: {
    backgroundColor: COL.morado,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  botonPrimarioTexto: { color: COL.blanco, fontSize: 16, fontWeight: '700' },
  tealCard: { backgroundColor: COL.tealBg, borderRadius: 16, padding: 18, marginBottom: 16 },
  tealTitulo: { color: COL.ink, fontSize: 18, fontWeight: '700' },
  tealTexto: { color: COL.ink, fontSize: 14, marginTop: 4, opacity: 0.8 },
  input: {
    backgroundColor: COL.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COL.borde,
    padding: 14,
    minHeight: 64,
    color: COL.ink,
    fontSize: 15,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  botonAceptar: {
    backgroundColor: COL.teal,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  botonAceptarTexto: { color: COL.ink, fontSize: 16, fontWeight: '700' },
  botonSecundario: {
    backgroundColor: COL.blanco,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COL.borde,
  },
  botonSecundarioTexto: { color: COL.morado, fontSize: 16, fontWeight: '700' },
  nota: { color: COL.gris, fontSize: 13, marginTop: 4, lineHeight: 18 },
  deshabilitado: { opacity: 0.6 },
});
