import { color } from '@/constants/roomlink';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
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

import { MarcaRoomLink } from '@/components/MarcaRoomLink';
import { useSesion } from '@/auth/SesionContext';

import {
  abrirSalaChat,
  enviarMensajeSala,
  marcarSalaLeida,
  normalizarHistorial,
  obtenerBandejaMensajes,
  obtenerContextoSala,
  obtenerMensajesSala,
  reportarUsuarioChat,
  validarMensaje,
  type ContextoChat,
  type ElementoBandejaChat,
  type MensajeChat,
} from './api';

type VistaChat = 'bandeja' | 'sala' | 'contexto';
type FiltroBandeja = 'all' | 'unread';

function nombreInterlocutor(item: ElementoBandejaChat): string {
  return (
    item.peer?.fullName ||
    item.peer?.name ||
    item.peer?.email ||
    item.counterpart?.fullName ||
    item.counterpart?.name ||
    item.counterpart?.email ||
    item.name ||
    (item.counterpartId ? `Roomie ${item.counterpartId.slice(0, 6)}` : 'Conexión')
  );
}

function vistaPrevia(item: ElementoBandejaChat): string {
  return item.lastMessage?.body || item.preview || 'Conversación iniciada';
}

function idSala(item: ElementoBandejaChat): string | undefined {
  return item.room?.id || item.roomId || item.id;
}

function afinidadDe(
  x?: { affinity?: number; compatibility?: number } | null,
): string | null {
  if (!x) return null;
  if (x.affinity != null) return `${x.affinity}% afín`;
  if (x.compatibility != null) return `${x.compatibility}% afín`;
  return null;
}

function noLeidosDe(item: ElementoBandejaChat): number {
  return item.unread ?? item.unreadCount ?? 0;
}

function inicialesDe(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toLocaleUpperCase('es') ?? '')
      .join('') || '?'
  );
}

function formatearHora(iso?: string): string {
  if (!iso) return '';
  try {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function PantallaChats({ roomIdInicial }: { roomIdInicial?: string }) {
  const { sesion } = useSesion();
  const userId = sesion?.usuario.id ?? null;
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  const [vista, setVista] = useState<VistaChat>('bandeja');
  const [filtro, setFiltro] = useState<FiltroBandeja>('all');
  const [busqueda, setBusqueda] = useState('');
  const [conversaciones, setConversaciones] = useState<ElementoBandejaChat[]>([]);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [contexto, setContexto] = useState<ContextoChat | null>(null);
  const [salaActiva, setSalaActiva] = useState<{
    roomId: string;
    titulo: string;
    subtitulo: string;
    counterpartId: string | null;
  } | null>(null);

  const [mostrarManual, setMostrarManual] = useState(false);
  const [idManual, setIdManual] = useState('');
  const [tipoManual, setTipoManual] = useState<'room' | 'connection' | 'application'>('room');
  const [textoMensaje, setTextoMensaje] = useState('');
  const [cargadaBandeja, setCargadaBandeja] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const cargaSala = useRef(0);
  const salaInicialAbierta = useRef<string | undefined>(undefined);

  const ejecutar = useCallback(async (operacion: () => Promise<void>) => {
    if (!sesion) {
      setError('Inicia sesión para abrir tus conversaciones.');
      return;
    }
    setCargando(true);
    setError('');
    setAviso('');
    try {
      await operacion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  }, [sesion]);

  const cargarBandeja = useCallback(() =>
    ejecutar(async () => {
      const lista = await obtenerBandejaMensajes();
      setConversaciones(lista);
      setCargadaBandeja(true);
    }), [ejecutar]);

  useFocusEffect(useCallback(() => {
    if (sesion && !roomIdInicial && !cargadaBandeja) void cargarBandeja();
  }, [sesion, roomIdInicial, cargadaBandeja, cargarBandeja]));

  const abrirSala = useCallback((entrada: ElementoBandejaChat | string) => {
    const roomId = typeof entrada === 'string' ? entrada.trim() : idSala(entrada);
    if (!roomId) {
      setError('No se encontró el identificador de la sala.');
      return;
    }
    const titulo =
      typeof entrada === 'string'
        ? `Sala ${roomId.slice(0, 8)}`
        : nombreInterlocutor(entrada);
    const subtitulo =
      typeof entrada === 'string'
        ? 'Conversación directa'
        : afinidadDe(entrada.peer) || afinidadDe(entrada) || 'Habitación compartida';
    const counterpartId =
      typeof entrada === 'string' ? null : entrada.counterpartId ?? null;

    setMensajes([]);
    setContexto(null);
    setTextoMensaje('');
    setSalaActiva({ roomId, titulo, subtitulo, counterpartId });
    setVista('sala');
    const carga = ++cargaSala.current;
    void ejecutar(async () => {
      const historial = await obtenerMensajesSala(roomId);
      if (carga === cargaSala.current) setMensajes(normalizarHistorial(historial));
      await marcarSalaLeida(roomId).catch(() => undefined);
    });
  }, [ejecutar]);

  useEffect(() => {
    if (!roomIdInicial) salaInicialAbierta.current = undefined;
    if (sesion && roomIdInicial && salaInicialAbierta.current !== roomIdInicial) {
      salaInicialAbierta.current = roomIdInicial;
      abrirSala(roomIdInicial);
    }
  }, [sesion, roomIdInicial, abrirSala]);

  const abrirPorIdManual = () => {
    const limpio = idManual.trim();
    if (!limpio) return;
    if (tipoManual === 'room') {
      abrirSala(limpio);
      return;
    }
    void ejecutar(async () => {
      const sala = await abrirSalaChat(
        tipoManual === 'connection'
          ? { connectionId: limpio }
          : { applicationId: limpio },
      );
      setIdManual('');
      abrirSala(sala.id);
    });
  };

  const enviar = () => {
    if (!salaActiva) return;
    const validacion = validarMensaje(textoMensaje);
    if (validacion.error) {
      setError(validacion.error);
      return;
    }
    void ejecutar(async () => {
      const nuevo = await enviarMensajeSala(salaActiva.roomId, validacion.body);
      setMensajes((actuales) => normalizarHistorial([...actuales, nuevo]));
      setTextoMensaje('');
    });
  };

  const verContexto = () => {
    if (!salaActiva) return;
    void ejecutar(async () => {
      const datos = await obtenerContextoSala(salaActiva.roomId);
      setContexto(datos);
      setVista('contexto');
    });
  };

  const reportarInterlocutor = () => {
    const targetId = contexto?.counterpartId || salaActiva?.counterpartId;
    if (!targetId) {
      setError('No pudimos identificar al usuario de esta conversación.');
      return;
    }
    void ejecutar(async () => {
      await reportarUsuarioChat(targetId, 'inappropriate', 'Reporte desde contexto de chat');
      setAviso('Reporte enviado al equipo de moderación.');
    });
  };

  const esMio = (m: MensajeChat): boolean =>
    m.mine === true || m.direction === 'out' || (userId !== null && m.senderId === userId);

  const filtradas = conversaciones.filter((item) => {
    if (filtro === 'unread' && noLeidosDe(item) === 0) return false;
    if (
      busqueda.trim() &&
      !`${nombreInterlocutor(item)} ${vistaPrevia(item)}`
        .toLocaleLowerCase('es')
        .includes(busqueda.trim().toLocaleLowerCase('es'))
    ) {
      return false;
    }
    return true;
  });

  const totalNoLeidos = conversaciones.reduce(
    (acc, item) => acc + (noLeidosDe(item) > 0 ? 1 : 0),
    0,
  );

  /* ----------------------------------------------------------- Vista Bandeja */
  if (vista === 'bandeja') {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
        <ScrollView
          contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <MarcaRoomLink />
          <View style={styles.filaEncabezado}>
            <Text accessibilityRole="header" style={styles.titulo}>Tus conversaciones</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Link href="/conexiones" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botonRecargar,
                    pressed && styles.presionado,
                  ]}>
                  <Text style={styles.textoBotonRecargar}>Solicitudes</Text>
                </Pressable>
              </Link>
              <Pressable
                accessibilityRole="button"
                onPress={cargarBandeja}
                disabled={cargando}
                style={({ pressed }) => [
                  styles.botonRecargar,
                  pressed && styles.presionado,
                ]}>
                <Text style={styles.textoBotonRecargar}>
                  {cargando ? '…' : 'Actualizar'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.buscadorWrap}>
            <Text style={styles.iconoBuscar}>⌕</Text>
            <EntradaValidada
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar conversación"
              placeholderTextColor={color.secundario}
              style={styles.buscadorInput}
            />
          </View>

          <View style={styles.segmento}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filtro === 'all' }}
              onPress={() => setFiltro('all')}
              style={[
                styles.segmentoItem,
                filtro === 'all' && styles.segmentoItemActivo,
              ]}>
              <Text
                style={[
                  styles.segmentoTexto,
                  filtro === 'all' && styles.segmentoTextoActivo,
                ]}>
                Todas
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filtro === 'unread' }}
              onPress={() => setFiltro('unread')}
              style={[
                styles.segmentoItem,
                filtro === 'unread' && styles.segmentoItemActivo,
              ]}>
              <Text
                style={[
                  styles.segmentoTexto,
                  filtro === 'unread' && styles.segmentoTextoActivo,
                ]}>
                No leídos
              </Text>
              {totalNoLeidos > 0 ? (
                <View
                  style={[
                    styles.segmentoBadge,
                    filtro === 'unread' && styles.segmentoBadgeActivo,
                  ]}>
                  <Text
                    style={[
                      styles.segmentoBadgeTexto,
                      filtro === 'unread' && styles.segmentoBadgeTextoActivo,
                    ]}>
                    {totalNoLeidos}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {!cargadaBandeja ? (
            <Pressable
              accessibilityRole="button"
              onPress={cargarBandeja}
              disabled={cargando}
              style={styles.botonPrimario}>
              {cargando ? (
                <ActivityIndicator color={color.blanco} />
              ) : (
                <Text style={styles.textoBotonPrimario}>Cargar bandeja</Text>
              )}
            </Pressable>
          ) : null}

          {error ? (
            <View accessibilityRole="alert" style={styles.avisoError}>
              <Text style={styles.textoAvisoError}>{error}</Text>
            </View>
          ) : null}
          {aviso ? (
            <View accessibilityRole="alert" style={styles.avisoOk}>
              <Text style={styles.textoAvisoOk}>{aviso}</Text>
            </View>
          ) : null}

          {cargadaBandeja && filtradas.length === 0 ? (
            <View style={styles.vacio}>
              <View style={styles.vacioIcono}>
                <Text style={styles.vacioIconoTexto}>💬</Text>
              </View>
              <Text style={styles.vacioTitulo}>Sin conversaciones todavía</Text>
              <Text style={styles.vacioSubtitulo}>
                Cuando una conexión o postulación sea aceptada, la verás aquí.
              </Text>
            </View>
          ) : null}

          {filtradas.map((item, idx) => {
            const noLeidos = noLeidosDe(item);
            const nombre = nombreInterlocutor(item);
            const hora =
              item.lastMessage?.time || formatearHora(item.lastMessage?.sentAt);
            const afinidad = afinidadDe(item.peer) || afinidadDe(item);
            return (
              <Pressable
                key={idSala(item) ?? idx}
                accessibilityRole="button"
                onPress={() => abrirSala(item)}
                style={({ pressed }) => [
                  styles.tarjeta,
                  pressed && styles.presionado,
                ]}>
                <View style={styles.filaTarjeta}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTexto}>{inicialesDe(nombre)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.filaEntre}>
                      <Text style={styles.nombreItem}>{nombre}</Text>
                      <View style={styles.filaHoraBadge}>
                        {hora ? <Text style={styles.horaItem}>{hora}</Text> : null}
                        {noLeidos > 0 ? (
                          <View style={styles.badgeNuevos}>
                            <Text style={styles.badgeNuevosTexto}>
                              {noLeidos} NUEVOS
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.previewItem} numberOfLines={1}>
                      {vistaPrevia(item)}
                    </Text>
                    {afinidad ? (
                      <Text style={styles.metaItem}>{afinidad}</Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.heroTeal}>
            <Text style={styles.heroTitulo}>Conversaciones con consentimiento</Text>
            <Text style={styles.heroSubtitulo}>
              Solo tus conexiones o postulaciones aceptadas pueden abrir una sala
              de chat contigo.
            </Text>
          </View>

          {mostrarManual ? (
            <View style={styles.tarjeta}>
              <Text style={styles.etiquetaCampo}>
                Abrir conversación por identificador
              </Text>
              <View style={styles.segmento}>
                {(
                  [
                    { key: 'room', label: 'ID Sala' },
                    { key: 'connection', label: 'ID Conexión' },
                    { key: 'application', label: 'ID Postulación' },
                  ] as const
                ).map((t) => (
                  <Pressable
                    key={t.key}
                    onPress={() => setTipoManual(t.key)}
                    style={[
                      styles.segmentoItem,
                      tipoManual === t.key && styles.segmentoItemActivo,
                    ]}>
                    <Text
                      style={[
                        styles.segmentoTexto,
                        tipoManual === t.key && styles.segmentoTextoActivo,
                      ]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <EntradaValidada
                value={idManual}
                onChangeText={setIdManual}
                placeholder={
                  tipoManual === 'room'
                    ? 'UUID de la sala (room-id)'
                    : tipoManual === 'connection'
                      ? 'UUID de la conexión aceptada'
                      : 'UUID de la postulación aceptada'
                }
                placeholderTextColor={color.secundario}
                style={styles.input}
                autoCapitalize="none"
              />
              <Pressable
                accessibilityRole="button"
                disabled={!idManual.trim() || cargando}
                onPress={abrirPorIdManual}
                style={[
                  styles.botonSecundario,
                  (!idManual.trim() || cargando) && styles.deshabilitado,
                ]}>
                <Text style={styles.textoBotonSecundario}>Abrir sala</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="link"
              onPress={() => setMostrarManual(true)}
              style={styles.enlaceCentrado}>
              <Text style={styles.textoEnlaceMuted}>
                Abrir una conversación por ID
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ----------------------------------------------------------- Vista Sala */
  if (vista === 'sala') {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
        <View style={[styles.contenedorSala, { width: anchoContenido }]}>
          <View style={styles.encabezadoNavegacion}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setVista('bandeja');
                void cargarBandeja();
              }}
              style={styles.botonVolver}>
              <Text style={styles.textoVolver}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.tituloSala}>
                {salaActiva?.titulo || 'Conversación'}
              </Text>
              <Text style={styles.subtitulo}>
                {salaActiva?.subtitulo || 'Habitación compartida'}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={verContexto}
            style={styles.enlacePerfil}>
            <Text style={styles.textoEnlacePerfil}>
              Ver perfil y espacio compartido ›
            </Text>
          </Pressable>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.hiloMensajes}
            showsVerticalScrollIndicator={false}>
            {mensajes.length === 0 && !cargando ? (
              <View style={styles.vacio}>
                <View style={styles.vacioIcono}>
                  <Text style={styles.vacioIconoTexto}>👋</Text>
                </View>
                <Text style={styles.vacioTitulo}>Aún no hay mensajes</Text>
                <Text style={styles.vacioSubtitulo}>
                  Rompe el hielo: salúdale y coordina una visita.
                </Text>
              </View>
            ) : null}

            {mensajes.map((m, index) => {
              const mio = esMio(m);
              const esUltimoMio = index === mensajes.length - 1 && mio;
              const estadoLectura = esUltimoMio
                ? m.readAt || m.status === 'read'
                  ? 'Leído'
                  : 'Enviado'
                : null;
              const hora = formatearHora(m.sentAt);
              return (
                <View
                  key={m.id ?? index}
                  style={[
                    styles.filaBurbuja,
                    mio ? styles.filaBurbujaMia : styles.filaBurbujaAjena,
                  ]}>
                  <View
                    style={[
                      styles.burbuja,
                      mio ? styles.burbujaMia : styles.burbujaAjena,
                    ]}>
                    <Text
                      style={[
                        styles.textoBurbuja,
                        mio && styles.textoBurbujaMia,
                      ]}>
                      {m.body}
                    </Text>
                  </View>
                  {estadoLectura || hora ? (
                    <Text style={styles.metaBurbuja}>
                      {[hora, estadoLectura].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              );
            })}

            {error ? (
              <View accessibilityRole="alert" style={styles.avisoError}>
                <Text style={styles.textoAvisoError}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.compositorWrap}>
            <View style={styles.compositor}>
              <EntradaValidada
                value={textoMensaje}
                onChangeText={setTextoMensaje}
                placeholder="Escribe un mensaje…"
                placeholderTextColor={color.secundario}
                style={styles.compositorInput}
                multiline
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enviar mensaje"
                disabled={cargando || !textoMensaje.trim()}
                onPress={enviar}
                style={[
                  styles.botonEnviar,
                  (cargando || !textoMensaje.trim()) && styles.deshabilitado,
                ]}>
                <Text style={styles.textoBotonEnviar}>➤</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ----------------------------------------------------------- Vista Contexto */
  const peer = contexto?.peer || contexto?.counterpart || {};
  const listing = contexto?.listing || contexto?.room || {};
  const connection = contexto?.connection || {};
  const nombrePeer =
    peer.fullName ||
    peer.name ||
    peer.email ||
    salaActiva?.titulo ||
    (contexto?.counterpartId
      ? `Roomie ${contexto.counterpartId.slice(0, 6)}`
      : 'Conexión');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.encabezadoNavegacion}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setVista('sala')}
            style={styles.botonVolver}>
            <Text style={styles.textoVolver}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <MarcaRoomLink />
            <Text style={styles.titulo}>Detalles de la conexión</Text>
            <Text style={styles.subtitulo}>Información de la conversación</Text>
          </View>
        </View>

        <View style={styles.tarjeta}>
          <View style={styles.filaTarjeta}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTexto}>{inicialesDe(nombrePeer)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.nombreItem}>{nombrePeer}</Text>
              <Text style={styles.metaItem}>
                {afinidadDe(contexto?.peer) ||
                  afinidadDe(contexto) ||
                  'Perfil de la conexión'}{' '}
                · Conversación verificada
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.tarjeta, { padding: 0, overflow: 'hidden' }]}>
          <View style={styles.portadaEspacio}>
            <Text style={styles.portadaIcono}>⌂</Text>
            <Text style={styles.portadaTexto}>Vista ilustrativa del espacio</Text>
          </View>
          <View style={{ padding: 16, gap: 6 }}>
            <Text style={styles.nombreItem}>
              {listing.title ||
                (contexto?.listingId
                  ? `Anuncio #${contexto.listingId.slice(0, 6).toUpperCase()}`
                  : 'Habitación compartida')}
            </Text>
            <Text style={styles.metaItem}>
              {listing.monthlyRent
                ? `$${listing.monthlyRent} MXN / mes`
                : 'Espacio vinculado a la conversación'}
            </Text>
          </View>
        </View>

        <View style={styles.tarjeta}>
          <View style={styles.chipExito}>
            <View style={styles.puntoExito} />
            <Text style={styles.textoChipExito}>
              {connection.status === 'accepted' || !connection.status
                ? 'CONEXIÓN ACEPTADA'
                : connection.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.metaItem}>
            {connection.acceptedAt ||
              connection.date ||
              (contexto?.connectionId
                ? `Conexión #${contexto.connectionId.slice(0, 8)}`
                : contexto?.applicationId
                  ? `Postulación #${contexto.applicationId.slice(0, 8)}`
                  : 'Conexión activa')}
          </Text>
          <Link href="/acuerdos" asChild>
            <Pressable
              accessibilityRole="button"
              style={styles.botonSecundario}>
              <Text style={styles.textoBotonSecundario}>
                Ver acuerdos de convivencia
              </Text>
            </Pressable>
          </Link>
        </View>

        {error ? (
          <View accessibilityRole="alert" style={styles.avisoError}>
            <Text style={styles.textoAvisoError}>{error}</Text>
          </View>
        ) : null}
        {aviso ? (
          <View accessibilityRole="alert" style={styles.avisoOk}>
            <Text style={styles.textoAvisoOk}>{aviso}</Text>
          </View>
        ) : null}

        <View style={styles.filaAccionesContexto}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAviso('Notificaciones de esta sala silenciadas.')}>
            <Text style={styles.textoEnlaceMuted}>Silenciar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={reportarInterlocutor}>
            <Text style={styles.textoEnlacePrimario}>Reportar usuario</Text>
          </Pressable>
        </View>
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
  contenedorSala: {
    flex: 1,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 92,
  },
  filaEncabezado: {
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
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
  titulo: {
    color: color.tinta,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.85,
  },
  tituloSala: {
    color: color.tinta,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitulo: {
    color: color.secundario,
    fontSize: 14,
    marginTop: 2,
  },
  botonRecargar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: color.borde,
  },
  textoBotonRecargar: {
    color: color.accion,
    fontSize: 12,
    fontWeight: '700',
  },
  buscadorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: color.blanco,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: color.borde,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  iconoBuscar: {
    color: color.secundario,
    fontSize: 16,
  },
  buscadorInput: {
    flex: 1,
    color: color.tinta,
    fontSize: 15,
    paddingVertical: 10,
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
  botonPrimario: {
    backgroundColor: color.accion,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonPrimario: {
    color: color.blanco,
    fontSize: 15,
    fontWeight: '800',
  },
  botonSecundario: {
    backgroundColor: color.blanco,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: color.borde,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonSecundario: {
    color: color.tinta,
    fontSize: 15,
    fontWeight: '800',
  },
  tarjeta: {
    backgroundColor: color.blanco,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: color.borde,
    padding: 16,
    gap: 12,
  },
  filaTarjeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  filaEntre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filaHoraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.lavanda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: {
    color: color.accion,
    fontSize: 15,
    fontWeight: '800',
  },
  nombreItem: {
    color: color.tinta,
    fontSize: 15,
    fontWeight: '800',
  },
  horaItem: {
    color: color.secundario,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeNuevos: {
    backgroundColor: color.accion,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeNuevosTexto: {
    color: color.blanco,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  previewItem: {
    color: color.tinta,
    fontSize: 13,
  },
  metaItem: {
    color: color.secundario,
    fontSize: 12,
  },
  heroTeal: {
    backgroundColor: color.menta,
    borderRadius: 18,
    padding: 20,
    gap: 6,
  },
  heroTitulo: {
    color: color.tinta,
    fontSize: 17,
    fontWeight: '800',
  },
  heroSubtitulo: {
    color: color.accion,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.94,
  },
  etiquetaCampo: {
    color: color.tinta,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: color.fondo,
    borderWidth: 1.5,
    borderColor: color.borde,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: color.tinta,
  },
  enlaceCentrado: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  textoEnlaceMuted: {
    color: color.secundario,
    fontSize: 13,
    fontWeight: '700',
  },
  textoEnlacePrimario: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '700',
  },
  enlacePerfil: {
    paddingVertical: 10,
  },
  textoEnlacePerfil: {
    color: color.accion,
    fontSize: 13,
    fontWeight: '700',
  },
  hiloMensajes: {
    gap: 12,
    paddingVertical: 12,
  },
  filaBurbuja: {
    maxWidth: '82%',
    gap: 3,
  },
  filaBurbujaMia: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  filaBurbujaAjena: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  burbuja: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  burbujaMia: {
    backgroundColor: color.accion,
    borderBottomRightRadius: 6,
  },
  burbujaAjena: {
    backgroundColor: color.blanco,
    borderWidth: 1,
    borderColor: color.borde,
    borderBottomLeftRadius: 6,
  },
  textoBurbuja: {
    color: color.tinta,
    fontSize: 15,
    lineHeight: 21,
  },
  textoBurbujaMia: {
    color: color.blanco,
  },
  metaBurbuja: {
    color: color.secundario,
    fontSize: 11,
    paddingHorizontal: 4,
  },
  compositorWrap: {
    paddingVertical: 10,
  },
  compositor: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: color.blanco,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: color.borde,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  compositorInput: {
    flex: 1,
    color: color.tinta,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 110,
  },
  botonEnviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.accion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonEnviar: {
    color: color.blanco,
    fontSize: 16,
    fontWeight: '800',
  },
  portadaEspacio: {
    height: 130,
    backgroundColor: '#DFF3F1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  portadaIcono: {
    color: color.accion,
    fontSize: 32,
  },
  portadaTexto: {
    color: color.accion,
    fontSize: 12,
    fontWeight: '700',
  },
  chipExito: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: color.menta,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  puntoExito: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: color.accion,
  },
  textoChipExito: {
    color: color.accion,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  filaAccionesContexto: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
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
  presionado: {
    opacity: 0.82,
  },
  deshabilitado: {
    opacity: 0.45,
  },
});
