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
import { enviarSolicitudConexion } from '@/modulos/compatibilidad/api';

import {
  cancelarConexion,
  listarConexiones,
  responderConexion,
  type ConexionDto,
  type DireccionConexion,
} from './api';

function etiquetaEstado(status: ConexionDto['status']): string {
  if (status === 'accepted') return 'ACEPTADA';
  if (status === 'rejected') return 'RECHAZADA';
  if (status === 'cancelled') return 'CANCELADA';
  return 'PENDIENTE';
}

function coloresEstado(status: ConexionDto['status']) {
  if (status === 'accepted') {
    return { bg: '#DCF0E8', dot: '#2F9E82', text: '#2F9E82' };
  }
  if (status === 'rejected' || status === 'cancelled') {
    return { bg: '#F7E3E1', dot: '#C0564F', text: '#C0564F' };
  }
  return { bg: '#F6ECD6', dot: '#C08A2C', text: '#C08A2C' };
}

export function PantallaConexiones() {
  const { sesion } = useSesion();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);
  const userId = sesion?.usuario.id ?? '';

  const [direccion, setDireccion] = useState<DireccionConexion>('incoming');
  const [conexiones, setConexiones] = useState<ConexionDto[]>([]);
  const [mostrandoNueva, setMostrandoNueva] = useState(false);
  const [candidateId, setCandidateId] = useState('');
  const [introMessage, setIntroMessage] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = async (dir = direccion) => {
    if (!sesion) return;
    setCargando(true);
    setError('');
    try {
      const lista = await listarConexiones(dir);
      setConexiones(lista);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las conexiones.',
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (sesion) void cargar(direccion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccion, sesion]);

  const enviarNueva = async () => {
    if (!candidateId.trim()) {
      setError('Indica el ID del usuario con quien deseas conectar.');
      return;
    }
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      await enviarSolicitudConexion(
        candidateId.trim(),
        introMessage.trim() || null,
      );
      setCandidateId('');
      setIntroMessage('');
      setMostrandoNueva(false);
      setMensaje('Solicitud de conexión enviada.');
      void cargar(direccion);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar la solicitud.',
      );
    } finally {
      setCargando(false);
    }
  };

  const responder = async (id: string, decision: 'accept' | 'reject') => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const actualizada = await responderConexion(id, decision);
      setConexiones((actuales) =>
        actuales.map((c) => (c.id === id ? actualizada : c)),
      );
      setMensaje(
        decision === 'accept'
          ? 'Conexión aceptada. Ya pueden conversar en Chats.'
          : 'Solicitud rechazada.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo responder la solicitud.',
      );
    } finally {
      setCargando(false);
    }
  };

  const cancelar = async (id: string) => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const actualizada = await cancelarConexion(id);
      setConexiones((actuales) =>
        actuales.map((c) => (c.id === id ? actualizada : c)),
      );
      setMensaje('Solicitud cancelada.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cancelar la solicitud.',
      );
    } finally {
      setCargando(false);
    }
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
            <Text style={styles.eyebrow}>ROOMLINK / CONEXIONES</Text>
            <Text style={styles.titulo}>Solicitudes de conexión</Text>
            <Text style={styles.subtitulo}>
              Acepta, rechaza o gestiona tus conexiones con otros roomies.
            </Text>
          </View>
        </View>

        <View style={styles.segmento}>
          {(
            [
              { key: 'incoming', label: 'Recibidas' },
              { key: 'outgoing', label: 'Enviadas' },
              { key: 'all', label: 'Todas' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => {
                setDireccion(t.key);
                setMensaje('');
              }}
              style={[
                styles.segmentoItem,
                direccion === t.key && styles.segmentoItemActivo,
              ]}>
              <Text
                style={[
                  styles.segmentoTexto,
                  direccion === t.key && styles.segmentoTextoActivo,
                ]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.filaAcciones}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMostrandoNueva((v) => !v)}
            style={styles.botonPrimarioCompacto}>
            <Text style={styles.textoBotonPrimario}>
              {mostrandoNueva ? 'Cerrar' : '+ Conectar con ID'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={cargando}
            onPress={() => cargar(direccion)}>
            <Text style={styles.enlaceAccion}>Actualizar</Text>
          </Pressable>
        </View>

        {mostrandoNueva ? (
          <View style={styles.tarjeta}>
            <Text style={styles.tituloItem}>Enviar solicitud de conexión</Text>
            <EntradaValidada
              value={candidateId}
              onChangeText={setCandidateId}
              placeholder="UUID del candidato (candidateId)"
              placeholderTextColor="#B4ACBD"
              style={styles.input}
              autoCapitalize="none"
            />
            <EntradaValidada
              value={introMessage}
              onChangeText={setIntroMessage}
              placeholder="Mensaje de presentación (opcional)"
              placeholderTextColor="#B4ACBD"
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={cargando}
              onPress={enviarNueva}
              style={styles.botonPrimario}>
              <Text style={styles.textoBotonPrimario}>
                {cargando ? 'Enviando…' : 'Enviar solicitud'}
              </Text>
            </Pressable>
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

        {cargando && conexiones.length === 0 ? (
          <ActivityIndicator color="#81638B" style={{ marginVertical: 20 }} />
        ) : conexiones.length === 0 ? (
          <View style={styles.vacio}>
            <View style={styles.vacioIcono}>
              <Text style={styles.vacioIconoTexto}>🤝</Text>
            </View>
            <Text style={styles.vacioTitulo}>Sin solicitudes en esta vista</Text>
            <Text style={styles.vacioSubtitulo}>
              Explora perfiles afines o comparte tu identificador para conectar
              con tus futuros roomies.
            </Text>
          </View>
        ) : (
          conexiones.map((c) => {
            const chip = coloresEstado(c.status);
            const esEntrante = c.addresseeId === userId;
            const esSaliente = c.requesterId === userId;
            const contraparteId = esEntrante ? c.requesterId : c.addresseeId;

            return (
              <View key={c.id} style={styles.tarjeta}>
                <View style={styles.filaEntre}>
                  <View style={[styles.chipEstado, { backgroundColor: chip.bg }]}>
                    <View
                      style={[styles.puntoEstado, { backgroundColor: chip.dot }]}
                    />
                    <Text style={[styles.textoChipEstado, { color: chip.text }]}>
                      {etiquetaEstado(c.status)}
                    </Text>
                  </View>
                  <Text style={styles.metaItem}>
                    {esEntrante ? 'Recibida' : 'Enviada'} · #
                    {c.id.slice(0, 6).toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.tituloItem}>
                  Roomie #{contraparteId.slice(0, 8).toUpperCase()}
                </Text>
                <Text style={styles.metaItem}>ID completo: {contraparteId}</Text>

                {c.introMessage ? (
                  <View style={styles.cajaMensaje}>
                    <Text style={styles.textoMensaje}>“{c.introMessage}”</Text>
                  </View>
                ) : null}

                {c.status === 'pending' && esEntrante ? (
                  <View style={styles.filaBotones}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={cargando}
                      onPress={() => responder(c.id, 'accept')}
                      style={[styles.botonPrimario, { flex: 1 }]}>
                      <Text style={styles.textoBotonPrimario}>Aceptar</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={cargando}
                      onPress={() => responder(c.id, 'reject')}
                      style={[styles.botonSecundario, { flex: 1 }]}>
                      <Text style={styles.textoBotonSecundario}>Rechazar</Text>
                    </Pressable>
                  </View>
                ) : null}

                {c.status === 'pending' && esSaliente ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={cargando}
                    onPress={() => cancelar(c.id)}
                    style={styles.botonSecundario}>
                    <Text style={styles.textoBotonSecundario}>
                      Cancelar solicitud
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
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
  filaAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  botonPrimarioCompacto: {
    backgroundColor: '#81638B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  botonPrimario: {
    backgroundColor: '#81638B',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonPrimario: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  botonSecundario: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D8CADF',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonSecundario: {
    color: '#2B2531',
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
    gap: 10,
  },
  filaEntre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: 8,
  },
  chipEstado: {
    flexDirection: 'row',
    alignItems: 'center',
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
    letterSpacing: 0.5,
  },
  tituloItem: {
    color: '#2B2531',
    fontSize: 16,
    fontWeight: '800',
  },
  metaItem: {
    color: '#8A8294',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#FAF7FC',
    borderWidth: 1.5,
    borderColor: '#E7DDEC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#2B2531',
  },
  cajaMensaje: {
    backgroundColor: '#FAF7FC',
    borderRadius: 12,
    padding: 12,
  },
  textoMensaje: {
    color: '#4C4556',
    fontSize: 13,
    fontStyle: 'italic',
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
