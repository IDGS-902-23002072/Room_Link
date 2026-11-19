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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';

import {
  actualizarPreferenciasNotificaciones,
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  obtenerPreferenciasNotificaciones,
  type NotificacionDto,
  type PreferenciaNotificacion,
  type TipoNotificacion,
} from './api';

type VistaNotificaciones = 'all' | 'unread' | 'preferences';

const ETIQUETAS_TIPO: Record<TipoNotificacion, string> = {
  application_status_changed: 'Estado de postulación',
  connection_request: 'Solicitud de conexión',
  connection_accepted: 'Conexión aceptada',
  new_message: 'Nuevo mensaje',
  agreement_pending: 'Acuerdo de convivencia',
  listing_moderated: 'Moderación de anuncio',
  account_sanction: 'Sanción de cuenta',
  system: 'Sistema',
};

function formatearFecha(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function PantallaNotificaciones() {
  const { sesion } = useSesion();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  const [vista, setVista] = useState<VistaNotificaciones>('all');
  const [items, setItems] = useState<NotificacionDto[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [preferencias, setPreferencias] = useState<PreferenciaNotificacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarLista = async (soloNoLeidas = vista === 'unread') => {
    if (!sesion) return;
    setCargando(true);
    setError('');
    try {
      const res = await listarNotificaciones({
        unreadOnly: soloNoLeidas,
        limit: 50,
      });
      setItems(res.items);
      setNoLeidas(res.unreadCount);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las notificaciones.',
      );
    } finally {
      setCargando(false);
    }
  };

  const cargarPreferencias = async () => {
    if (!sesion) return;
    setCargando(true);
    setError('');
    try {
      const res = await obtenerPreferenciasNotificaciones();
      setPreferencias(res.preferences);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las preferencias.',
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!sesion) return;
    if (vista === 'preferences') {
      void cargarPreferencias();
    } else {
      void cargarLista(vista === 'unread');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, sesion]);

  const marcarUna = async (n: NotificacionDto) => {
    if (n.readAt) return;
    try {
      await marcarNotificacionLeida(n.id);
      const ahora = new Date().toISOString();
      setItems((actuales) =>
        vista === 'unread'
          ? actuales.filter((i) => i.id !== n.id)
          : actuales.map((i) => (i.id === n.id ? { ...i, readAt: ahora } : i)),
      );
      setNoLeidas((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo marcar como leída.',
      );
    }
  };

  const marcarTodas = async () => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const res = await marcarTodasNotificacionesLeidas();
      const ahora = new Date().toISOString();
      setItems((actuales) =>
        vista === 'unread'
          ? []
          : actuales.map((i) => ({ ...i, readAt: i.readAt ?? ahora })),
      );
      setNoLeidas(0);
      setMensaje(
        res.updated > 0
          ? `${res.updated} notificaciones marcadas como leídas.`
          : 'Todas las notificaciones ya estaban leídas.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron marcar las notificaciones.',
      );
    } finally {
      setCargando(false);
    }
  };

  const alternarPreferencia = async (
    pref: PreferenciaNotificacion,
    canal: 'inApp' | 'email',
  ) => {
    const siguiente: PreferenciaNotificacion = {
      ...pref,
      [canal]: !pref[canal],
    };
    setPreferencias((actuales) =>
      actuales.map((p) => (p.type === pref.type ? siguiente : p)),
    );
    setError('');
    setMensaje('');
    try {
      await actualizarPreferenciasNotificaciones([siguiente]);
      setMensaje('Preferencias actualizadas.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la preferencia.',
      );
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.encabezadoNavegacion}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.botonVolver}>
            <Text style={styles.textoVolver}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>ROOMLINK / 14</Text>
            <Text style={styles.titulo}>Notificaciones</Text>
            <Text style={styles.subtitulo}>
              Avisos de conexiones, mensajes, acuerdos y actividad.
            </Text>
          </View>
        </View>

        <View style={styles.segmento}>
          <Pressable
            onPress={() => {
              setVista('all');
              setMensaje('');
            }}
            style={[
              styles.segmentoItem,
              vista === 'all' && styles.segmentoItemActivo,
            ]}>
            <Text
              style={[
                styles.segmentoTexto,
                vista === 'all' && styles.segmentoTextoActivo,
              ]}>
              Todas
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setVista('unread');
              setMensaje('');
            }}
            style={[
              styles.segmentoItem,
              vista === 'unread' && styles.segmentoItemActivo,
            ]}>
            <Text
              style={[
                styles.segmentoTexto,
                vista === 'unread' && styles.segmentoTextoActivo,
              ]}>
              No leídas
            </Text>
            {noLeidas > 0 ? (
              <View
                style={[
                  styles.segmentoBadge,
                  vista === 'unread' && styles.segmentoBadgeActivo,
                ]}>
                <Text
                  style={[
                    styles.segmentoBadgeTexto,
                    vista === 'unread' && styles.segmentoBadgeTextoActivo,
                  ]}>
                  {noLeidas}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => {
              setVista('preferences');
              setMensaje('');
            }}
            style={[
              styles.segmentoItem,
              vista === 'preferences' && styles.segmentoItemActivo,
            ]}>
            <Text
              style={[
                styles.segmentoTexto,
                vista === 'preferences' && styles.segmentoTextoActivo,
              ]}>
              Ajustes
            </Text>
          </Pressable>
        </View>

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

        {vista !== 'preferences' ? (
          <>
            <View style={styles.filaAcciones}>
              <Text style={styles.metaResumen}>
                {noLeidas} {noLeidas === 1 ? 'sin leer' : 'sin leer'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={cargando}
                  onPress={() => cargarLista(vista === 'unread')}>
                  <Text style={styles.enlaceAccion}>Actualizar</Text>
                </Pressable>
                {noLeidas > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={cargando}
                    onPress={marcarTodas}>
                    <Text style={styles.enlaceAccion}>Marcar todas leídas</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {cargando ? (
              <ActivityIndicator color="#81638B" style={{ marginVertical: 20 }} />
            ) : items.length === 0 ? (
              <View style={styles.vacio}>
                <View style={styles.vacioIcono}>
                  <Text style={styles.vacioIconoTexto}>🔔</Text>
                </View>
                <Text style={styles.vacioTitulo}>Todo al día</Text>
                <Text style={styles.vacioSubtitulo}>
                  {vista === 'unread'
                    ? 'No tienes notificaciones pendientes por leer.'
                    : 'Aquí aparecerán tus avisos de mensajes, conexiones y acuerdos.'}
                </Text>
              </View>
            ) : (
              items.map((n) => {
                const sinLeer = n.readAt === null;
                return (
                  <Pressable
                    key={n.id}
                    accessibilityRole="button"
                    onPress={() => marcarUna(n)}
                    style={[
                      styles.tarjeta,
                      sinLeer && styles.tarjetaSinLeer,
                    ]}>
                    <View style={styles.filaEntre}>
                      <View style={styles.chipTipo}>
                        {sinLeer ? <View style={styles.puntoSinLeer} /> : null}
                        <Text style={styles.textoChipTipo}>
                          {ETIQUETAS_TIPO[n.type] ?? n.type}
                        </Text>
                      </View>
                      <Text style={styles.fechaTexto}>
                        {formatearFecha(n.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.tituloItem}>{n.title}</Text>
                    {n.body ? (
                      <Text style={styles.cuerpoItem}>{n.body}</Text>
                    ) : null}
                    {sinLeer ? (
                      <Text style={styles.toqueMarcar}>
                        Toca para marcar como leída
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </>
        ) : (
          <View style={styles.tarjeta}>
            <Text style={styles.tituloItem}>Preferencias de entrega</Text>
            <Text style={styles.cuerpoItem}>
              Elige qué notificaciones quieres recibir dentro de la app y por
              correo electrónico.
            </Text>
            {cargando && preferencias.length === 0 ? (
              <ActivityIndicator color="#81638B" />
            ) : (
              preferencias.map((pref) => (
                <View key={pref.type} style={styles.filaPreferencia}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombrePref}>
                      {ETIQUETAS_TIPO[pref.type] ?? pref.type}
                    </Text>
                    <Text style={styles.codigoPref}>{pref.type}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: pref.inApp }}
                    onPress={() => alternarPreferencia(pref, 'inApp')}
                    style={[
                      styles.toggleBtn,
                      pref.inApp && styles.toggleBtnActivo,
                    ]}>
                    <Text
                      style={[
                        styles.toggleTexto,
                        pref.inApp && styles.toggleTextoActivo,
                      ]}>
                      In-App {pref.inApp ? '✓' : '✕'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: pref.email }}
                    onPress={() => alternarPreferencia(pref, 'email')}
                    style={[
                      styles.toggleBtn,
                      pref.email && styles.toggleBtnActivo,
                    ]}>
                    <Text
                      style={[
                        styles.toggleTexto,
                        pref.email && styles.toggleTextoActivo,
                      ]}>
                      Email {pref.email ? '✓' : '✕'}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  segmentoBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#DAC9DF',
    alignItems: 'center',
  },
  segmentoBadgeActivo: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  segmentoBadgeTexto: {
    color: '#81638B',
    fontSize: 10,
    fontWeight: '800',
  },
  segmentoBadgeTextoActivo: {
    color: '#FFFFFF',
  },
  filaAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaResumen: {
    color: '#8A8294',
    fontSize: 13,
    fontWeight: '700',
  },
  enlaceAccion: {
    color: '#81638B',
    fontSize: 13,
    fontWeight: '700',
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7DDEC',
    padding: 16,
    gap: 8,
  },
  tarjetaSinLeer: {
    borderColor: '#B695C0',
    borderWidth: 1.5,
  },
  filaEntre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chipTipo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFE7F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  puntoSinLeer: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#81638B',
  },
  textoChipTipo: {
    color: '#81638B',
    fontSize: 11,
    fontWeight: '800',
  },
  fechaTexto: {
    color: '#B4ACBD',
    fontSize: 11,
    fontWeight: '600',
  },
  tituloItem: {
    color: '#2B2531',
    fontSize: 15,
    fontWeight: '800',
  },
  cuerpoItem: {
    color: '#4C4556',
    fontSize: 13,
    lineHeight: 19,
  },
  toqueMarcar: {
    color: '#81638B',
    fontSize: 11,
    fontWeight: '700',
  },
  filaPreferencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E7DDEC',
  },
  nombrePref: {
    color: '#2B2531',
    fontSize: 13,
    fontWeight: '700',
  },
  codigoPref: {
    color: '#8A8294',
    fontSize: 11,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ECE3F0',
  },
  toggleBtnActivo: {
    backgroundColor: '#81638B',
  },
  toggleTexto: {
    color: '#6F5B76',
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTextoActivo: {
    color: '#FFFFFF',
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
});
