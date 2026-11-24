import { color } from '@/constants/roomlink';

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Platform,
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
import {
  consultarPermisoNotificacionesSistema,
  mostrarNotificacionSistema,
  solicitarPermisoNotificacionesSistema,
  type EstadoPermisoNotificacion,
} from './permisosSistema';

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
  const [permisoSistema, setPermisoSistema] =
    useState<EstadoPermisoNotificacion>('undetermined');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    void consultarPermisoNotificacionesSistema().then(setPermisoSistema);
  }, []);

  const pedirPermisoSistema = async () => {
    setError('');
    setMensaje('');
    const resultado = await solicitarPermisoNotificacionesSistema();
    setPermisoSistema(resultado);
    if (resultado === 'granted') {
      setMensaje('Permiso de notificaciones del sistema Android/OS activado.');
      await mostrarNotificacionSistema({
        title: 'RoomLink · Notificaciones activas',
        body: 'Recibirás alertas de mensajes, conexiones y acuerdos en tu dispositivo.',
      });
    } else if (resultado === 'never_ask_again') {
      setError(
        'El permiso fue bloqueado permanentemente. Habilítalo desde los Ajustes de Android.',
      );
    } else {
      setError('No se concedió el permiso de notificaciones del sistema.');
    }
  };

  const probarNotificacionSistema = async () => {
    const enviada = await mostrarNotificacionSistema({
      title: 'Prueba de notificación RoomLink',
      body: 'Las notificaciones a nivel de sistema Android están funcionando.',
    });
    if (enviada) {
      setMensaje('Notificación de prueba enviada al sistema.');
    } else {
      setError('Activa primero el permiso de notificaciones del sistema.');
    }
  };

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

        <View style={styles.tarjetaPermisoSistema}>
          <View style={styles.filaEntre}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tituloItem}>
                Notificaciones del sistema ({Platform.OS === 'android' ? 'Android' : Platform.OS.toUpperCase()})
              </Text>
              <Text style={styles.cuerpoItem}>
                {permisoSistema === 'granted'
                  ? 'Permiso POST_NOTIFICATIONS concedido. Recibirás alertas nativas en tu dispositivo.'
                  : permisoSistema === 'never_ask_again'
                    ? 'Permiso bloqueado en Android. Abre los ajustes del sistema para habilitarlo.'
                    : 'Activa los permisos del sistema Android para recibir avisos aunque no estés en esta pantalla.'}
              </Text>
            </View>
            <View
              style={[
                styles.chipTipo,
                {
                  backgroundColor:
                    permisoSistema === 'granted' ? color.menta : color.crema,
                },
              ]}>
              <Text
                style={[
                  styles.textoChipTipo,
                  {
                    color:
                      permisoSistema === 'granted' ? color.accion : color.cremaTexto,
                  },
                ]}>
                {permisoSistema === 'granted' ? 'ACTIVO' : 'PENDIENTE'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {permisoSistema !== 'granted' ? (
              <Pressable
                accessibilityRole="button"
                onPress={pedirPermisoSistema}
                style={styles.botonPermiso}>
                <Text style={styles.textoBotonPermiso}>
                  Permitir notificaciones Android
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={probarNotificacionSistema}
                style={styles.botonPermisoSecundario}>
                <Text style={styles.textoBotonPermisoSecundario}>
                  Enviar notificación de prueba
                </Text>
              </Pressable>
            )}

            {permisoSistema === 'never_ask_again' && Platform.OS !== 'web' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void Linking.openSettings();
                }}
                style={styles.botonPermisoSecundario}>
                <Text style={styles.textoBotonPermisoSecundario}>
                  Abrir ajustes de Android
                </Text>
              </Pressable>
            ) : null}
          </View>
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
              <ActivityIndicator color={color.accion} style={{ marginVertical: 20 }} />
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
              <ActivityIndicator color={color.accion} />
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
    backgroundColor: color.blanco,
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
    backgroundColor: color.blanco,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.borde,
  },
  textoVolver: {
    color: color.accion,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  eyebrow: {
    color: color.secundario,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  titulo: {
    color: color.tinta,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitulo: {
    color: color.secundario,
    fontSize: 14,
    marginTop: 2,
  },
  segmento: {
    flexDirection: 'row',
    backgroundColor: color.menta,
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
    backgroundColor: color.accion,
  },
  segmentoTexto: {
    color: color.secundario,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentoTextoActivo: {
    color: color.blanco,
  },
  segmentoBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: color.lavanda,
    alignItems: 'center',
  },
  segmentoBadgeActivo: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  segmentoBadgeTexto: {
    color: color.accion,
    fontSize: 10,
    fontWeight: '800',
  },
  segmentoBadgeTextoActivo: {
    color: color.blanco,
  },
  filaAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaResumen: {
    color: color.secundario,
    fontSize: 13,
    fontWeight: '700',
  },
  enlaceAccion: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '700',
  },
  tarjeta: {
    backgroundColor: color.blanco,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: color.borde,
    padding: 16,
    gap: 8,
  },
  tarjetaSinLeer: {
    borderColor: color.accion,
    borderWidth: 1.5,
  },
  tarjetaPermisoSistema: {
    backgroundColor: color.blanco,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: color.borde,
    padding: 16,
    gap: 10,
  },
  botonPermiso: {
    backgroundColor: color.accion,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonPermiso: {
    color: color.blanco,
    fontSize: 13,
    fontWeight: '800',
  },
  botonPermisoSecundario: {
    backgroundColor: color.fondo,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.borde,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonPermisoSecundario: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: color.lavanda,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  puntoSinLeer: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: color.accion,
  },
  textoChipTipo: {
    color: color.accion,
    fontSize: 11,
    fontWeight: '800',
  },
  fechaTexto: {
    color: color.secundario,
    fontSize: 11,
    fontWeight: '600',
  },
  tituloItem: {
    color: color.tinta,
    fontSize: 15,
    fontWeight: '800',
  },
  cuerpoItem: {
    color: color.tinta,
    fontSize: 13,
    lineHeight: 19,
  },
  toqueMarcar: {
    color: color.accion,
    fontSize: 11,
    fontWeight: '700',
  },
  filaPreferencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: color.borde,
  },
  nombrePref: {
    color: color.tinta,
    fontSize: 13,
    fontWeight: '700',
  },
  codigoPref: {
    color: color.secundario,
    fontSize: 11,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: color.menta,
  },
  toggleBtnActivo: {
    backgroundColor: color.accion,
  },
  toggleTexto: {
    color: color.accion,
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTextoActivo: {
    color: color.blanco,
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
    backgroundColor: color.menta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacioIconoTexto: {
    fontSize: 24,
  },
  vacioTitulo: {
    color: color.tinta,
    fontSize: 17,
    fontWeight: '800',
  },
  vacioSubtitulo: {
    color: color.secundario,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 19,
  },
  avisoError: {
    backgroundColor: color.rosa,
    borderRadius: 14,
    padding: 12,
  },
  textoAvisoError: {
    color: color.rosaTexto,
    fontSize: 13,
    fontWeight: '700',
  },
  avisoOk: {
    backgroundColor: color.menta,
    borderRadius: 14,
    padding: 12,
  },
  textoAvisoOk: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '700',
  },
});
