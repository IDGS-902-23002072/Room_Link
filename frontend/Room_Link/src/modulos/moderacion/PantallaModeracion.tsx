import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { EntradaValidada } from '@/modulos/comunes/EntradaValidada';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';

import {
  decidirAnuncioModeracion,
  esDenunciaDeAnuncio,
  listarColaModeracion,
  listarDenunciasModeracion,
  listarHistorialModeracion,
  obtenerIdAnuncioDenuncia,
  resolverDenunciaModeracion,
  validarDecisionModeracion,
  type DecisionModeracion,
  type DenunciaModeracion,
  type ElementoColaModeracion,
} from './api';

type SeccionModeracion = 'queue' | 'reports' | 'history';
type FiltroHistorial = 'all' | 'approved' | 'rejected';

function etiquetaAnuncio(
  x?: { title?: string; listingTitle?: string } | null,
): string {
  return x?.title || x?.listingTitle || 'Anuncio';
}

function folioDe(
  x?: { folio?: string; listingId?: string | null; targetListingId?: string | null } | null,
): string {
  if (x?.folio) return x.folio;
  const lid = x?.listingId || x?.targetListingId;
  return lid ? `#${String(lid).slice(0, 6).toUpperCase()}` : '#—';
}

function rentaDe(x?: { monthlyRent?: number | string } | null): string {
  return x?.monthlyRent ? `$${x.monthlyRent} / mes` : 'Precio por confirmar';
}

function etiquetaEstadoHistorial(status?: string): string {
  if (status === 'approved') return 'Aprobado';
  if (status === 'rejected') return 'Rechazado';
  if (status === 'removed') return 'Dado de baja';
  return status || 'Pendiente';
}

function estiloChipEstado(status?: string) {
  if (status === 'approved') {
    return { bg: '#DCF0E8', dot: '#2F9E82', text: '#2F9E82' };
  }
  if (status === 'rejected') {
    return { bg: '#F7E3E1', dot: '#C0564F', text: '#C0564F' };
  }
  if (status === 'removed') {
    return { bg: '#F6ECD6', dot: '#C08A2C', text: '#C08A2C' };
  }
  return { bg: '#ECE3F0', dot: '#B695C0', text: '#81638B' };
}

export function PantallaModeracion() {
  const { sesion } = useSesion();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  const esAdmin = Boolean(sesion?.usuario.roles?.includes('admin'));

  const [seccion, setSeccion] = useState<SeccionModeracion>('queue');
  const [cola, setCola] = useState<ElementoColaModeracion[]>([]);
  const [denuncias, setDenuncias] = useState<DenunciaModeracion[]>([]);
  const [historial, setHistorial] = useState<ElementoColaModeracion[]>([]);
  const [seleccionado, setSeleccionado] = useState<ElementoColaModeracion | null>(null);
  const [decision, setDecision] = useState<DecisionModeracion>('approved');
  const [motivo, setMotivo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroHistorial, setFiltroHistorial] = useState<FiltroHistorial>('all');
  const [cargado, setCargado] = useState({
    queue: false,
    reports: false,
    history: false,
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const ejecutar = async (operacion: () => Promise<string | void>) => {
    if (!sesion || !esAdmin) {
      setError('Se requiere una sesión de administrador.');
      return;
    }
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const msg = await operacion();
      if (msg) setMensaje(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  };

  const cargarCola = () =>
    ejecutar(async () => {
      setCola(await listarColaModeracion());
      setCargado((c) => ({ ...c, queue: true }));
    });

  const cargarDenuncias = () =>
    ejecutar(async () => {
      setDenuncias(await listarDenunciasModeracion());
      setCargado((c) => ({ ...c, reports: true }));
    });

  const cargarHistorial = () =>
    ejecutar(async () => {
      setHistorial(await listarHistorialModeracion());
      setCargado((c) => ({ ...c, history: true }));
    });

  useEffect(() => {
    if (!sesion || !esAdmin) return;
    if (seccion === 'queue' && !cargado.queue) void cargarCola();
    if (seccion === 'reports' && !cargado.reports) void cargarDenuncias();
    if (seccion === 'history' && !cargado.history) void cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion, sesion, esAdmin]);

  const decidir = (
    listingId: string,
    siguienteDecision: DecisionModeracion,
    siguienteMotivo: string,
  ) => {
    const errorValidacion = validarDecisionModeracion(
      siguienteDecision,
      siguienteMotivo,
    );
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }
    void ejecutar(async () => {
      await decidirAnuncioModeracion(
        listingId,
        siguienteDecision,
        siguienteMotivo,
      );
      setCola(await listarColaModeracion());
      setSeleccionado(null);
      setMotivo('');
      setDecision('approved');
      return 'Decisión registrada.';
    });
  };

  const descartarDenuncia = (reportId: string) => {
    void ejecutar(async () => {
      await resolverDenunciaModeracion(reportId, 'dismissed');
      setDenuncias(await listarDenunciasModeracion());
      return 'Denuncia descartada.';
    });
  };

  if (!esAdmin) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
        <View style={[styles.contenido, { width: anchoContenido }]}>
          <Text style={styles.eyebrow}>ROOMLINK / ADMINISTRACIÓN</Text>
          <Text style={styles.titulo}>Acceso restringido</Text>
          <Text style={styles.subtitulo}>
            Esta sección requiere permisos de administrador (rol admin).
          </Text>
          <View style={styles.tarjeta}>
            <Text style={styles.textoBloque}>
              Tu cuenta actual ({sesion?.usuario.email ?? 'sin sesión'}) no cuenta
              con el rol de administrador necesario para moderar anuncios y
              denuncias.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.botonPrimario}>
              <Text style={styles.textoBotonPrimario}>Volver</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const encabezados: Record<
    SeccionModeracion,
    { title: string; subtitle: string }
  > = {
    queue: {
      title: 'Anuncios por revisar',
      subtitle: 'Administración · Calidad de la oferta',
    },
    reports: {
      title: 'Denuncias de anuncios',
      subtitle: 'Administración · Reportes de contenido',
    },
    history: {
      title: 'Historial de moderación',
      subtitle: 'Administración · Registro de decisiones',
    },
  };
  const h = encabezados[seccion];

  const renderCola = () => {
    if (seleccionado) {
      const requiereMotivo = decision !== 'approved';
      return (
        <View style={styles.tarjeta}>
          <Text style={styles.etiquetaSeccion}>
            REVISAR {folioDe(seleccionado)}
          </Text>
          <Text style={styles.tituloItem}>{etiquetaAnuncio(seleccionado)}</Text>
          <Text style={styles.metaItem}>{rentaDe(seleccionado)}</Text>

          <View style={styles.segmento}>
            {(
              [
                { key: 'approved', label: 'Aprobar' },
                { key: 'rejected', label: 'Corregir' },
                { key: 'removed', label: 'Retirar' },
              ] as const
            ).map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setDecision(t.key)}
                style={[
                  styles.segmentoItem,
                  decision === t.key && styles.segmentoItemActivo,
                ]}>
                <Text
                  style={[
                    styles.segmentoTexto,
                    decision === t.key && styles.segmentoTextoActivo,
                  ]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {requiereMotivo ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.etiquetaCampo}>Motivo</Text>
              <EntradaValidada
                value={motivo}
                onChangeText={setMotivo}
                placeholder="Explica la decisión al anunciante"
                placeholderTextColor="#B4ACBD"
                style={styles.input}
              />
            </View>
          ) : null}

          {error ? (
            <View accessibilityRole="alert" style={styles.avisoError}>
              <Text style={styles.textoAvisoError}>{error}</Text>
            </View>
          ) : null}
          {mensaje ? (
            <View accessibilityRole="alert" style={styles.avisoOk}>
              <Text style={styles.textoAvisoOk}>{mensaje}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={cargando}
            onPress={() =>
              decidir(
                seleccionado.listingId || seleccionado.id || '',
                decision,
                motivo,
              )
            }
            style={[
              decision === 'removed' ? styles.botonPeligro : styles.botonPrimario,
              cargando && styles.deshabilitado,
            ]}>
            {cargando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotonPrimario}>
                {decision === 'removed'
                  ? 'Retirar publicación'
                  : decision === 'rejected'
                    ? 'Solicitar correcciones'
                    : 'Aprobar anuncio'}
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="link"
            onPress={() => {
              setSeleccionado(null);
              setMotivo('');
              setDecision('approved');
            }}
            style={styles.enlaceCentrado}>
            <Text style={styles.textoEnlaceMuted}>Cancelar</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        {!cargado.queue ? (
          <Pressable
            accessibilityRole="button"
            onPress={cargarCola}
            disabled={cargando}
            style={styles.botonPrimario}>
            <Text style={styles.textoBotonPrimario}>
              {cargando ? 'Cargando…' : 'Cargar cola'}
            </Text>
          </Pressable>
        ) : null}

        {error ? (
          <View accessibilityRole="alert" style={styles.avisoError}>
            <Text style={styles.textoAvisoError}>{error}</Text>
          </View>
        ) : null}
        {mensaje ? (
          <View accessibilityRole="alert" style={styles.avisoOk}>
            <Text style={styles.textoAvisoOk}>{mensaje}</Text>
          </View>
        ) : null}

        {cargado.queue && cola.length === 0 ? (
          <View style={styles.vacio}>
            <View style={styles.vacioIcono}>
              <Text style={styles.vacioIconoTexto}>✓</Text>
            </View>
            <Text style={styles.vacioTitulo}>Cola al día</Text>
            <Text style={styles.vacioSubtitulo}>
              No hay anuncios pendientes de revisión.
            </Text>
          </View>
        ) : null}

        {cola.map((item, idx) => (
          <View key={item.listingId ?? item.id ?? idx} style={styles.tarjeta}>
            <View style={styles.portada}>
              <Text style={styles.portadaIcono}>⌂</Text>
              <Text style={styles.portadaTexto}>Vista ilustrativa</Text>
            </View>
            <View style={[styles.chipEstado, { backgroundColor: '#ECE3F0' }]}>
              <View style={[styles.puntoEstado, { backgroundColor: '#B695C0' }]} />
              <Text style={[styles.textoChipEstado, { color: '#81638B' }]}>
                PENDIENTE · {folioDe(item)}
              </Text>
            </View>
            <Text style={styles.tituloItem}>{etiquetaAnuncio(item)}</Text>
            <Text style={styles.metaItem}>
              {rentaDe(item)}
              {item.publishedAt ? ` · ${item.publishedAt}` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSeleccionado(item)}
              style={styles.botonPrimario}>
              <Text style={styles.textoBotonPrimario}>
                Revisar anuncio {folioDe(item)}
              </Text>
            </Pressable>
          </View>
        ))}
      </>
    );
  };

  const renderDenuncias = () => {
    const denunciasAnuncios = denuncias.filter(esDenunciaDeAnuncio);
    return (
      <>
        {!cargado.reports ? (
          <Pressable
            accessibilityRole="button"
            onPress={cargarDenuncias}
            disabled={cargando}
            style={styles.botonPrimario}>
            <Text style={styles.textoBotonPrimario}>
              {cargando ? 'Cargando…' : 'Cargar denuncias'}
            </Text>
          </Pressable>
        ) : null}

        {error ? (
          <View accessibilityRole="alert" style={styles.avisoError}>
            <Text style={styles.textoAvisoError}>{error}</Text>
          </View>
        ) : null}
        {mensaje ? (
          <View accessibilityRole="alert" style={styles.avisoOk}>
            <Text style={styles.textoAvisoOk}>{mensaje}</Text>
          </View>
        ) : null}

        {cargado.reports && denunciasAnuncios.length === 0 ? (
          <View style={styles.vacio}>
            <View style={styles.vacioIcono}>
              <Text style={styles.vacioIconoTexto}>🛡️</Text>
            </View>
            <Text style={styles.vacioTitulo}>Sin denuncias</Text>
            <Text style={styles.vacioSubtitulo}>
              No hay anuncios denunciados por revisar.
            </Text>
          </View>
        ) : null}

        {denunciasAnuncios.map((report, idx) => {
          const idAnuncio = obtenerIdAnuncioDenuncia(report);
          return (
            <View key={report.id ?? idAnuncio ?? idx} style={styles.tarjeta}>
              <View style={[styles.chipEstado, { backgroundColor: '#F7E3E1' }]}>
                <View style={[styles.puntoEstado, { backgroundColor: '#C0564F' }]} />
                <Text style={[styles.textoChipEstado, { color: '#C0564F' }]}>
                  {report.count ? `${report.count} DENUNCIAS` : 'DENUNCIA'}
                </Text>
              </View>
              <Text style={styles.tituloItem}>
                {report.reason || report.title || 'Anuncio denunciado'}
              </Text>
              {report.detail || report.description ? (
                <Text style={styles.metaItem}>
                  {report.detail || report.description}
                </Text>
              ) : null}

              <View style={styles.bloqueSeparado}>
                <Text style={styles.etiquetaSeccion}>CONTENIDO DENUNCIADO</Text>
                <Text style={styles.textoBloque}>
                  {etiquetaAnuncio(report)} · {folioDe(report)}
                </Text>
              </View>

              {report.evidence ? (
                <View style={styles.bloqueSeparado}>
                  <Text style={styles.etiquetaSeccion}>EVIDENCIA DEL REPORTE</Text>
                  <Text style={styles.textoBloque}>{report.evidence}</Text>
                </View>
              ) : null}

              {idAnuncio ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    disabled={cargando}
                    onPress={() =>
                      decidir(
                        idAnuncio,
                        'removed',
                        report.reason || 'Reporte confirmado',
                      )
                    }
                    style={styles.botonPeligro}>
                    <Text style={styles.textoBotonPrimario}>
                      Retirar publicación
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={cargando}
                    onPress={() =>
                      decidir(
                        idAnuncio,
                        'rejected',
                        report.reason || 'Información no verificable',
                      )
                    }
                    style={styles.botonSecundario}>
                    <Text style={styles.textoBotonSecundario}>
                      Solicitar correcciones
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {report.id ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => descartarDenuncia(report.id)}
                  style={styles.enlaceCentrado}>
                  <Text style={styles.textoEnlaceMuted}>Descartar denuncia</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </>
    );
  };

  const renderHistorial = () => {
    const filas = historial.filter((item) => {
      const estado = item.decision || item.status;
      if (filtroHistorial === 'approved' && estado !== 'approved') return false;
      if (filtroHistorial === 'rejected' && estado === 'approved') return false;
      if (
        busqueda.trim() &&
        !`${etiquetaAnuncio(item)} ${folioDe(item)}`
          .toLocaleLowerCase('es')
          .includes(busqueda.trim().toLocaleLowerCase('es'))
      ) {
        return false;
      }
      return true;
    });

    return (
      <>
        <View style={styles.buscadorWrap}>
          <Text style={styles.iconoBuscar}>⌕</Text>
          <EntradaValidada
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por anuncio o folio"
            placeholderTextColor="#B4ACBD"
            style={styles.buscadorInput}
          />
        </View>

        <View style={styles.segmento}>
          {(
            [
              { key: 'all', label: 'Todos' },
              { key: 'approved', label: 'Aprobados' },
              { key: 'rejected', label: 'Rechazados' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setFiltroHistorial(t.key)}
              style={[
                styles.segmentoItem,
                filtroHistorial === t.key && styles.segmentoItemActivo,
              ]}>
              <Text
                style={[
                  styles.segmentoTexto,
                  filtroHistorial === t.key && styles.segmentoTextoActivo,
                ]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {!cargado.history ? (
          <Pressable
            accessibilityRole="button"
            onPress={cargarHistorial}
            disabled={cargando}
            style={styles.botonPrimario}>
            <Text style={styles.textoBotonPrimario}>
              {cargando ? 'Cargando…' : 'Cargar historial'}
            </Text>
          </Pressable>
        ) : null}

        {error ? (
          <View accessibilityRole="alert" style={styles.avisoError}>
            <Text style={styles.textoAvisoError}>{error}</Text>
          </View>
        ) : null}
        {mensaje ? (
          <View accessibilityRole="alert" style={styles.avisoOk}>
            <Text style={styles.textoAvisoOk}>{mensaje}</Text>
          </View>
        ) : null}

        {cargado.history && filas.length === 0 ? (
          <View style={styles.vacio}>
            <View style={styles.vacioIcono}>
              <Text style={styles.vacioIconoTexto}>📊</Text>
            </View>
            <Text style={styles.vacioTitulo}>Sin decisiones</Text>
            <Text style={styles.vacioSubtitulo}>
              Aquí queda el registro de cada moderación.
            </Text>
          </View>
        ) : null}

        {filas.map((item, idx) => {
          const estado = item.decision || item.status;
          const chip = estiloChipEstado(estado);
          return (
            <View key={item.id ?? item.listingId ?? idx} style={styles.tarjeta}>
              <View style={styles.filaEntre}>
                <View style={[styles.chipEstado, { backgroundColor: chip.bg }]}>
                  <View style={[styles.puntoEstado, { backgroundColor: chip.dot }]} />
                  <Text style={[styles.textoChipEstado, { color: chip.text }]}>
                    {etiquetaEstadoHistorial(estado).toUpperCase()}
                  </Text>
                </View>
                {item.date || item.reviewedAt ? (
                  <Text style={styles.metaItem}>
                    {item.date || item.reviewedAt}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.tituloItem}>{etiquetaAnuncio(item)}</Text>
              <Text style={styles.metaItem}>
                Folio {folioDe(item)}
                {item.moderator || item.reviewerId
                  ? ` · ${item.moderator || item.reviewerId}`
                  : ''}
                {item.reason ? ` · ${item.reason}` : ''}
              </Text>
            </View>
          );
        })}
      </>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.encabezadoNavegacion}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.botonVolver}>
            <Text style={styles.textoVolver}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ROOMLINK / ADMINISTRACIÓN</Text>
            <Text style={styles.titulo}>{h.title}</Text>
            <Text style={styles.subtitulo}>{h.subtitle}</Text>
          </View>
        </View>

        <View style={styles.segmento}>
          {(
            [
              { key: 'queue', label: 'Cola' },
              { key: 'reports', label: 'Denuncias' },
              { key: 'history', label: 'Historial' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => {
                setSeccion(t.key);
                setSeleccionado(null);
                setError('');
                setMensaje('');
              }}
              style={[
                styles.segmentoItem,
                seccion === t.key && styles.segmentoItemActivo,
              ]}>
              <Text
                style={[
                  styles.segmentoTexto,
                  seccion === t.key && styles.segmentoTextoActivo,
                ]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {seccion === 'queue' ? renderCola() : null}
        {seccion === 'reports' ? renderDenuncias() : null}
        {seccion === 'history' ? renderHistorial() : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  areaSegura: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ECE6F1',
  },
  contenido: {
    flexGrow: 1,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 14,
  },
  encabezadoNavegacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  botonVolver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7DDEC',
  },
  textoVolver: {
    color: '#81638B',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  eyebrow: {
    color: '#8A8294',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  titulo: {
    color: '#2B2531',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitulo: {
    color: '#8A8294',
    fontSize: 14,
    marginTop: 2,
  },
  segmento: {
    flexDirection: 'row',
    backgroundColor: '#ECE3F0',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentoItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 999,
  },
  segmentoItemActivo: {
    backgroundColor: '#B695C0',
  },
  segmentoTexto: {
    color: '#8A8294',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentoTextoActivo: {
    color: '#FFFFFF',
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7DDEC',
    padding: 16,
    gap: 12,
  },
  portada: {
    height: 110,
    backgroundColor: '#EFE7F2',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  portadaIcono: {
    color: '#81638B',
    fontSize: 28,
  },
  portadaTexto: {
    color: '#81638B',
    fontSize: 12,
    fontWeight: '700',
  },
  chipEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  puntoEstado: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  textoChipEstado: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  tituloItem: {
    color: '#2B2531',
    fontSize: 17,
    fontWeight: '800',
  },
  metaItem: {
    color: '#8A8294',
    fontSize: 13,
  },
  etiquetaSeccion: {
    color: '#8A8294',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  etiquetaCampo: {
    color: '#4C4556',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FAF7FC',
    borderWidth: 1.5,
    borderColor: '#E7DDEC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#2B2531',
  },
  bloqueSeparado: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7DDEC',
  },
  textoBloque: {
    color: '#4C4556',
    fontSize: 13,
    lineHeight: 19,
  },
  filaEntre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  botonPrimario: {
    backgroundColor: '#81638B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPeligro: {
    backgroundColor: '#C0564F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonPrimario: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  botonSecundario: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D8CADF',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonSecundario: {
    color: '#2B2531',
    fontSize: 15,
    fontWeight: '800',
  },
  enlaceCentrado: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  textoEnlaceMuted: {
    color: '#8A8294',
    fontSize: 13,
    fontWeight: '700',
  },
  buscadorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E7DDEC',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  iconoBuscar: {
    color: '#8A8294',
    fontSize: 16,
  },
  buscadorInput: {
    flex: 1,
    color: '#2B2531',
    fontSize: 15,
    paddingVertical: 10,
  },
  vacio: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  vacioIcono: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ECE3F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacioIconoTexto: {
    fontSize: 24,
    color: '#81638B',
  },
  vacioTitulo: {
    color: '#2B2531',
    fontSize: 17,
    fontWeight: '800',
  },
  vacioSubtitulo: {
    color: '#8A8294',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 19,
  },
  avisoError: {
    backgroundColor: '#F7E3E1',
    borderRadius: 14,
    padding: 12,
  },
  textoAvisoError: {
    color: '#C0564F',
    fontSize: 13,
    fontWeight: '700',
  },
  avisoOk: {
    backgroundColor: '#DCF0E8',
    borderRadius: 14,
    padding: 12,
  },
  textoAvisoOk: {
    color: '#2F9E82',
    fontSize: 13,
    fontWeight: '700',
  },
  deshabilitado: {
    opacity: 0.45,
  },
});
