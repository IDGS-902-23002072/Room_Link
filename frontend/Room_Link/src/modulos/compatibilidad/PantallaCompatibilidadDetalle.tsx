import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';
import {
  enviarSolicitudConexion,
  obtenerFeedAfinidad,
  obtenerPerfilAfinidad,
  obtenerTestCompatibilidad,
  type DimensionCompatibilidad,
  type PerfilAfinidad,
  type ResultadoTest,
} from './api';

type VistaM06 = 'comparacion' | 'puntos' | 'guardados';
type TabGuardados = 'saved' | 'discarded';

interface PerfilGuardadoLocal {
  userId: string;
  fullName: string;
  age: number;
  city: string | null;
  zone: string | null;
  compatibilityScore: number | null;
  estado: TabGuardados;
  actualizadoEn: string;
}

const ETIQUETAS_DIMENSION: Record<DimensionCompatibilidad, string> = {
  schedule: 'Horario',
  cleanliness: 'Limpieza',
  noise: 'Ruido',
  pets: 'Mascotas',
  smoking: 'Tabaco',
  visits: 'Visitas',
  genderPref: 'Preferencia de género',
};

const ORDEN_DIMENSIONES: DimensionCompatibilidad[] = [
  'schedule',
  'cleanliness',
  'noise',
  'pets',
  'smoking',
  'visits',
  'genderPref',
];

function describirNivel(nivel: 'bajo' | 'medio' | 'alto' | null, porcentaje: number | null): string {
  if (porcentaje === null || nivel === null) return 'Sin dato';
  if (nivel === 'alto') return `Alto (${porcentaje}%)`;
  if (nivel === 'medio') return `Medio (${porcentaje}%)`;
  return `Bajo (${porcentaje}%)`;
}

function resumenAfinidad(score: number | null): string {
  if (score === null) {
    return 'Completa la encuesta de compatibilidad para ver tu porcentaje exacto.';
  }
  if (score >= 80) return 'Muy alta afinidad en hábitos clave de convivencia.';
  if (score >= 60) return 'Buena compatibilidad con algunos puntos por acordar.';
  return 'Tienen estilos distintos; conviene conversar expectativas antes de vivir juntos.';
}

export function PantallaCompatibilidadDetalle({
  candidateIdInicial,
  vistaInicial = 'comparacion',
}: {
  candidateIdInicial?: string;
  vistaInicial?: VistaM06;
}) {
  const router = useRouter();
  const { sesion } = useSesion();
  const userId = sesion?.usuario.id ?? '';
  const claveStorage = `@roomlink/m06-perfiles:${userId}`;

  const [vista, setVista] = useState<VistaM06>(vistaInicial);
  const [tabGuardados, setTabGuardados] = useState<TabGuardados>('saved');

  const [miTest, setMiTest] = useState<ResultadoTest | null>(null);
  const [candidatos, setCandidatos] = useState<PerfilAfinidad[]>([]);
  const [candidatoId, setCandidatoId] = useState<string>(candidateIdInicial ?? '');
  const [candidato, setCandidato] = useState<PerfilAfinidad | null>(null);

  const [guardados, setGuardados] = useState<PerfilGuardadoLocal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let activo = true;
    void AsyncStorage.getItem(claveStorage)
      .then((raw) => {
        if (!activo || !raw) return;
        const parsed = JSON.parse(raw) as PerfilGuardadoLocal[];
        if (Array.isArray(parsed)) setGuardados(parsed);
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [claveStorage, userId]);

  const persistirGuardados = useCallback(
    async (lista: PerfilGuardadoLocal[]) => {
      setGuardados(lista);
      if (!userId) return;
      await AsyncStorage.setItem(claveStorage, JSON.stringify(lista)).catch(() => undefined);
    },
    [claveStorage, userId],
  );

  const cargarDatos = useCallback(async () => {
    if (!userId) return;
    setCargando(true);
    setError(null);
    setMensajeEstado(null);
    try {
      const [testRes, feedRes] = await Promise.all([
        obtenerTestCompatibilidad(),
        obtenerFeedAfinidad(1),
      ]);
      setMiTest(testRes);
      const otros = feedRes.profiles.filter((p) => p.userId !== userId);
      setCandidatos(otros);

      const objetivo = candidatoId || candidateIdInicial || otros[0]?.userId || '';
      if (objetivo) {
        setCandidatoId(objetivo);
        try {
          const detalle = await obtenerPerfilAfinidad(objetivo);
          setCandidato(detalle);
        } catch {
          const fallback = otros.find((p) => p.userId === objetivo) ?? null;
          setCandidato(fallback);
        }
      } else {
        setCandidato(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la comparación de compatibilidad.',
      );
    } finally {
      setCargando(false);
    }
  }, [userId, candidatoId, candidateIdInicial]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const seleccionarCandidato = async (id: string) => {
    setCandidatoId(id);
    setMensajeEstado(null);
    setVista('comparacion');
    const enFeed = candidatos.find((c) => c.userId === id) ?? null;
    if (enFeed) setCandidato(enFeed);
    try {
      const detalle = await obtenerPerfilAfinidad(id);
      setCandidato(detalle);
    } catch {
      // mantener datos en caché si la consulta puntual falla
    }
  };

  const filasHabitos = useMemo(() => {
    const misResumenes = new Map(
      (miTest?.summary ?? []).map((item) => [item.dimension, item]),
    );
    const otroResumenes = new Map(
      (candidato?.compatibilitySummary ?? []).map((item) => [item.dimension, item]),
    );

    return ORDEN_DIMENSIONES.map((dim) => {
      const mio = misResumenes.get(dim) ?? null;
      const otro = otroResumenes.get(dim) ?? null;
      const diferencia =
        mio && otro ? Math.abs(mio.percentage - otro.percentage) : null;
      return {
        dimension: dim,
        etiqueta: ETIQUETAS_DIMENSION[dim],
        tuValor: describirNivel(mio?.level ?? null, mio?.percentage ?? null),
        otroValor: describirNivel(otro?.level ?? null, otro?.percentage ?? null),
        coincide: diferencia !== null && diferencia <= 25,
        diferencia,
      };
    });
  }, [miTest, candidato]);

  const analisisConvivencia = useMemo(() => {
    const comunes = filasHabitos.filter((f) => f.coincide);
    const diferencias = filasHabitos
      .filter((f) => f.diferencia !== null && f.diferencia > 25)
      .sort((a, b) => (b.diferencia ?? 0) - (a.diferencia ?? 0));

    const principalDiferencia = diferencias[0] ?? null;

    return {
      comunes,
      principalDiferencia,
    };
  }, [filasHabitos]);

  const guardarEstadoPerfil = async (estado: TabGuardados) => {
    if (!candidato) return;
    const registro: PerfilGuardadoLocal = {
      userId: candidato.userId,
      fullName: candidato.fullName,
      age: candidato.age,
      city: candidato.city,
      zone: candidato.zone,
      compatibilityScore: candidato.compatibilityScore,
      estado,
      actualizadoEn: new Date().toISOString(),
    };
    const filtrados = guardados.filter((g) => g.userId !== candidato.userId);
    await persistirGuardados([registro, ...filtrados]);
    setMensajeEstado(
      estado === 'saved'
        ? `Guardaste a ${candidato.fullName} en tus perfiles.`
        : `Moviste a ${candidato.fullName} a descartados.`,
    );
  };

  const manejarEnviarSolicitud = async () => {
    if (!candidato || enviandoSolicitud) return;
    setEnviandoSolicitud(true);
    setError(null);
    setMensajeEstado(null);
    try {
      await enviarSolicitudConexion(
        candidato.userId,
        `Hola ${candidato.fullName}, vi nuestra compatibilidad en RoomLink y me gustaría conectar.`,
      );
      setMensajeEstado(`Solicitud de conexión enviada a ${candidato.fullName}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar la solicitud de conexión.',
      );
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const conteoGuardados = guardados.filter((g) => g.estado === 'saved').length;
  const conteoDescartados = guardados.filter((g) => g.estado === 'discarded').length;
  const listaFiltrada = guardados.filter((g) => g.estado === tabGuardados);

  const estadoActual = candidato
    ? guardados.find((g) => g.userId === candidato.userId)?.estado ?? null
    : null;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.barraSuperior}>
          <Pressable onPress={() => router.back()} style={styles.botonVolver}>
            <Text style={styles.textoVolver}>‹ Volver</Text>
          </Pressable>
          <Text style={styles.eyebrow}>ROOMLINK / 06</Text>
        </View>

        <View style={styles.tabs}>
          {(
            [
              ['comparacion', 'Comparación'],
              ['puntos', 'Convivencia'],
              ['guardados', `Perfiles (${conteoGuardados})`],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setVista(id)}
              style={[styles.tab, vista === id && styles.tabActiva]}
            >
              <Text style={[styles.tabTexto, vista === id && styles.tabTextoActivo]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {cargando ? (
          <View style={styles.centrado}>
            <ActivityIndicator size="large" color="#84658D" />
            <Text style={styles.subtitulo}>Calculando compatibilidad…</Text>
          </View>
        ) : error ? (
          <View style={styles.avisoError}>
            <Text style={styles.textoError}>{error}</Text>
            <Pressable style={styles.botonSecundario} onPress={() => void cargarDatos()}>
              <Text style={styles.textoSecundario}>Reintentar</Text>
            </Pressable>
          </View>
        ) : vista === 'guardados' ? (
          <>
            <Text style={styles.titulo}>Tus perfiles</Text>
            <Text style={styles.subtitulo}>Retoma tus opciones cuando quieras.</Text>

            <View style={styles.tabs}>
              <Pressable
                onPress={() => setTabGuardados('saved')}
                style={[styles.tab, tabGuardados === 'saved' && styles.tabActiva]}
              >
                <Text
                  style={[
                    styles.tabTexto,
                    tabGuardados === 'saved' && styles.tabTextoActivo,
                  ]}
                >
                  Guardados ({conteoGuardados})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTabGuardados('discarded')}
                style={[styles.tab, tabGuardados === 'discarded' && styles.tabActiva]}
              >
                <Text
                  style={[
                    styles.tabTexto,
                    tabGuardados === 'discarded' && styles.tabTextoActivo,
                  ]}
                >
                  Descartados ({conteoDescartados})
                </Text>
              </Pressable>
            </View>

            {listaFiltrada.length === 0 ? (
              <View style={styles.tarjeta}>
                <Text style={styles.subtitulo}>
                  {tabGuardados === 'saved'
                    ? 'Aún no has guardado perfiles. Guarda un perfil desde la pestaña de comparación.'
                    : 'No tienes perfiles descartados.'}
                </Text>
              </View>
            ) : (
              listaFiltrada.map((item) => (
                <Pressable
                  key={item.userId}
                  style={styles.tarjeta}
                  onPress={() => void seleccionarCandidato(item.userId)}
                >
                  <View style={styles.filaEntre}>
                    <Text style={styles.nombrePerfil}>
                      {item.fullName}, {item.age}
                    </Text>
                    {item.compatibilityScore !== null && (
                      <Text style={styles.badgeAfinidad}>
                        {item.compatibilityScore}% afín
                      </Text>
                    )}
                  </View>
                  <Text style={styles.detallePerfil}>
                    {[item.zone, item.city].filter(Boolean).join(' · ') ||
                      'Ubicación no especificada'}
                  </Text>
                </Pressable>
              ))
            )}

            <Pressable
              style={styles.botonSecundario}
              onPress={() => router.push('/buscar-roomies')}
            >
              <Text style={styles.textoSecundario}>Explorar más roomies</Text>
            </Pressable>
          </>
        ) : !candidato ? (
          <View style={styles.tarjeta}>
            <Text style={styles.titulo}>Sin candidatos para comparar</Text>
            <Text style={styles.subtitulo}>
              Todavía no hay otros perfiles disponibles en tu feed de compatibilidad.
            </Text>
            <Pressable
              style={styles.botonPrincipal}
              onPress={() => router.push('/buscar-roomies')}
            >
              <Text style={styles.textoPrincipal}>Buscar roomies</Text>
            </Pressable>
          </View>
        ) : vista === 'comparacion' ? (
          <>
            <Text style={styles.titulo}>¿Qué tanto coinciden?</Text>
            <Text style={styles.subtitulo}>
              Tú y {candidato.fullName} · Comparación por hábitos
            </Text>

            {candidatos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectorCandidatos}
              >
                {candidatos.slice(0, 8).map((c) => (
                  <Pressable
                    key={c.userId}
                    onPress={() => void seleccionarCandidato(c.userId)}
                    style={[
                      styles.chipCandidato,
                      c.userId === candidato.userId && styles.chipCandidatoActivo,
                    ]}
                  >
                    <Text
                      style={[
                        styles.textoChip,
                        c.userId === candidato.userId && styles.textoChipActivo,
                      ]}
                    >
                      {c.fullName.split(' ')[0]}
                      {c.compatibilityScore !== null ? ` · ${c.compatibilityScore}%` : ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={styles.tarjetaMenta}>
              <Text style={styles.porcentaje}>
                {candidato.compatibilityScore !== null
                  ? `${candidato.compatibilityScore}%`
                  : '—'}
              </Text>
              <Text style={styles.tituloMenta}>Compatibilidad estimada</Text>
              <Text style={styles.textoMenta}>
                {resumenAfinidad(candidato.compatibilityScore)}
              </Text>
            </View>

            <View style={styles.tarjeta}>
              <View style={styles.filaTablaCabecera}>
                <Text style={[styles.celdaDim, styles.textoCabecera]}>Hábito</Text>
                <Text style={[styles.celdaVal, styles.textoCabecera]}>Tú</Text>
                <Text style={[styles.celdaVal, styles.textoCabecera]}>
                  {candidato.fullName.split(' ')[0]}
                </Text>
              </View>
              {filasHabitos.map((fila) => (
                <View key={fila.dimension} style={styles.filaTabla}>
                  <Text style={styles.celdaDim}>{fila.etiqueta}</Text>
                  <Text style={styles.celdaVal}>{fila.tuValor}</Text>
                  <Text
                    style={[
                      styles.celdaVal,
                      fila.coincide && styles.celdaCoincide,
                    ]}
                  >
                    {fila.otroValor}
                  </Text>
                </View>
              ))}
            </View>

            {mensajeEstado && (
              <View style={styles.avisoExito}>
                <Text style={styles.textoExito}>{mensajeEstado}</Text>
              </View>
            )}

            <Pressable
              style={styles.botonPrincipal}
              onPress={() => setVista('puntos')}
            >
              <Text style={styles.textoPrincipal}>Ver puntos de convivencia</Text>
            </Pressable>

            <View style={styles.filaBotones}>
              <Pressable
                style={[styles.botonSecundario, styles.flexUno]}
                onPress={() => void guardarEstadoPerfil('saved')}
              >
                <Text style={styles.textoSecundario}>
                  {estadoActual === 'saved' ? '✓ Guardado' : 'Guardar perfil'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.botonNeutro, styles.flexUno]}
                onPress={() => void guardarEstadoPerfil('discarded')}
              >
                <Text style={styles.textoNeutro}>
                  {estadoActual === 'discarded' ? 'Descartado' : 'Descartar'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.titulo}>Lo que pueden compartir</Text>
            <Text style={styles.subtitulo}>
              Las diferencias también se pueden acordar.
            </Text>

            <View style={styles.tarjetaMenta}>
              <Text style={styles.tituloMenta}>
                {analisisConvivencia.comunes.length} puntos en común
              </Text>
              <Text style={styles.textoMenta}>
                {analisisConvivencia.comunes.length > 0
                  ? `Coinciden principalmente en: ${analisisConvivencia.comunes
                      .map((c) => c.etiqueta.toLowerCase())
                      .join(', ')}.`
                  : 'Completen ambos su encuesta para identificar hábitos coincidentes.'}
              </Text>
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.etiquetaMayus}>PARA CONVERSAR</Text>
              <Text style={styles.nombrePerfil}>
                {analisisConvivencia.principalDiferencia
                  ? `Diferencia en ${analisisConvivencia.principalDiferencia.etiqueta.toLowerCase()}`
                  : 'Sin diferencias críticas detectadas'}
              </Text>
              <Text style={styles.detallePerfil}>
                {analisisConvivencia.principalDiferencia
                  ? `Tú marcaste ${analisisConvivencia.principalDiferencia.tuValor} y ${candidato.fullName.split(' ')[0]} marcó ${analisisConvivencia.principalDiferencia.otroValor}. Vale la pena acordar expectativas desde el inicio.`
                  : 'Sus respuestas están bien alineadas en todas las dimensiones evaluadas.'}
              </Text>
            </View>

            <View style={styles.tarjeta}>
              <Text style={styles.nombrePerfil}>Sugerencia RoomLink</Text>
              <Text style={styles.detallePerfil}>
                Cuando inicien conversación, pueden formalizar sus acuerdos en la sección
                de Acuerdos de convivencia (HU-12).
              </Text>
            </View>

            {mensajeEstado && (
              <View style={styles.avisoExito}>
                <Text style={styles.textoExito}>{mensajeEstado}</Text>
              </View>
            )}

            <Pressable
              disabled={enviandoSolicitud}
              style={[
                styles.botonPrincipal,
                enviandoSolicitud && styles.deshabilitado,
              ]}
              onPress={() => void manejarEnviarSolicitud()}
            >
              <Text style={styles.textoPrincipal}>
                {enviandoSolicitud
                  ? 'Enviando solicitud…'
                  : `Enviar solicitud a ${candidato.fullName.split(' ')[0]}`}
              </Text>
            </Pressable>

            <Pressable
              style={styles.botonSecundario}
              onPress={() => setVista('comparacion')}
            >
              <Text style={styles.textoSecundario}>Volver a comparar</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F6F2F7' },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  botonVolver: { paddingVertical: 6, paddingRight: 12 },
  textoVolver: { color: '#84658D', fontSize: 15, fontWeight: '700' },
  eyebrow: { color: '#84658D', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  titulo: { color: '#2B2430', fontSize: 24, fontWeight: '700' },
  subtitulo: { color: '#786D7E', fontSize: 13, lineHeight: 19 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E9DDEA',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabActiva: { backgroundColor: '#FFFFFF' },
  tabTexto: { color: '#786D7E', fontSize: 12, fontWeight: '600' },
  tabTextoActivo: { color: '#654C6D', fontWeight: '700' },
  centrado: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  selectorCandidatos: { gap: 8, paddingVertical: 4 },
  chipCandidato: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ECE3F0',
  },
  chipCandidatoActivo: { backgroundColor: '#84658D' },
  textoChip: { color: '#654C6D', fontSize: 12, fontWeight: '600' },
  textoChipActivo: { color: '#FFFFFF' },
  tarjetaMenta: {
    backgroundColor: '#CFEFE8',
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  porcentaje: { color: '#1F6F60', fontSize: 34, fontWeight: '800' },
  tituloMenta: { color: '#1F4B43', fontSize: 15, fontWeight: '700' },
  textoMenta: { color: '#2E5D55', fontSize: 13, lineHeight: 19 },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE5EF',
    padding: 14,
    gap: 8,
  },
  filaTablaCabecera: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ECE5EF',
    paddingBottom: 8,
  },
  filaTabla: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1EAF3',
  },
  textoCabecera: { fontWeight: '700', color: '#654C6D' },
  celdaDim: { flex: 1.2, color: '#2B2430', fontSize: 12, fontWeight: '600' },
  celdaVal: { flex: 1, color: '#6E6275', fontSize: 12 },
  celdaCoincide: { color: '#2F9E82', fontWeight: '700' },
  etiquetaMayus: { color: '#84658D', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  nombrePerfil: { color: '#2B2430', fontSize: 15, fontWeight: '700' },
  detallePerfil: { color: '#6E6275', fontSize: 13, lineHeight: 19 },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeAfinidad: {
    backgroundColor: '#CFEFE8',
    color: '#1F6F60',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  botonPrincipal: {
    backgroundColor: '#84658D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  textoPrincipal: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  botonSecundario: {
    backgroundColor: '#E9DAEC',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  textoSecundario: { color: '#654C6D', fontSize: 14, fontWeight: '700' },
  botonNeutro: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3D7E7',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  textoNeutro: { color: '#6E6275', fontSize: 14, fontWeight: '600' },
  filaBotones: { flexDirection: 'row', gap: 8 },
  flexUno: { flex: 1 },
  deshabilitado: { opacity: 0.6 },
  avisoExito: {
    backgroundColor: '#DCF0E8',
    borderRadius: 12,
    padding: 12,
  },
  textoExito: { color: '#1F6F60', fontSize: 13, fontWeight: '600' },
  avisoError: {
    backgroundColor: '#FCE8E8',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  textoError: { color: '#A33D4D', fontSize: 13, fontWeight: '600' },
});
