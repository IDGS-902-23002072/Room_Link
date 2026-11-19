import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';

import {
  aceptarAcuerdoConvivencia,
  crearAcuerdoConvivencia,
  crearNuevaVersionAcuerdo,
  listarAcuerdosUsuario,
  type AcuerdoDto,
} from './api';

export function PantallaAcuerdos() {
  const { sesion } = useSesion();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);
  const userId = sesion?.usuario.id ?? '';

  const [acuerdos, setAcuerdos] = useState<AcuerdoDto[]>([]);
  const [mostrandoCrear, setMostrandoCrear] = useState(false);
  const [listingId, setListingId] = useState('');
  const [roomieId, setRoomieId] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    if (!sesion) return;
    setCargando(true);
    setError('');
    try {
      const res = await listarAcuerdosUsuario();
      setAcuerdos(res.items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar tus acuerdos.',
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (sesion) void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion]);

  const crear = async () => {
    if (!listingId.trim() || !roomieId.trim()) {
      setError('Indica el ID del anuncio y el ID del roomie.');
      return;
    }
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const nuevo = await crearAcuerdoConvivencia({
        listingId,
        roomieId,
      });
      setAcuerdos((actuales) => [nuevo, ...actuales]);
      setListingId('');
      setRoomieId('');
      setMostrandoCrear(false);
      setMensaje('Acuerdo de convivencia generado.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo generar el acuerdo.',
      );
    } finally {
      setCargando(false);
    }
  };

  const aceptar = async (agreementId: string) => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const actualizado = await aceptarAcuerdoConvivencia(agreementId);
      setAcuerdos((actuales) =>
        actuales.map((a) => (a.id === agreementId ? actualizado : a)),
      );
      setMensaje('Has firmado digitalmente el acuerdo.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo firmar el acuerdo.',
      );
    } finally {
      setCargando(false);
    }
  };

  const nuevaVersion = async (agreementId: string) => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const siguiente = await crearNuevaVersionAcuerdo(agreementId);
      setAcuerdos((actuales) => [siguiente, ...actuales]);
      setMensaje(`Versión v${siguiente.version} creada.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear una nueva versión.',
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
            <Text style={styles.eyebrow}>ROOMLINK / 12</Text>
            <Text style={styles.titulo}>Acuerdos de convivencia</Text>
            <Text style={styles.subtitulo}>
              Reglas claras y firma digital entre anfitrión y roomie.
            </Text>
          </View>
        </View>

        <View style={styles.filaAcciones}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setMostrandoCrear((v) => !v)}
            style={styles.botonPrimarioCompacto}>
            <Text style={styles.textoBotonPrimario}>
              {mostrandoCrear ? 'Cerrar formulario' : '+ Nuevo acuerdo'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={cargando}
            onPress={cargar}>
            <Text style={styles.enlaceAccion}>Actualizar</Text>
          </Pressable>
        </View>

        {mostrandoCrear ? (
          <View style={styles.tarjeta}>
            <Text style={styles.tituloItem}>Generar acuerdo (Anfitrión)</Text>
            <Text style={styles.metaItem}>
              Toma una instantánea inmutable de las reglas y costos del anuncio.
            </Text>
            <View style={{ gap: 6 }}>
              <Text style={styles.etiquetaCampo}>ID del anuncio (listingId)</Text>
              <TextInput
                value={listingId}
                onChangeText={setListingId}
                placeholder="UUID del anuncio publicado"
                placeholderTextColor="#B4ACBD"
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.etiquetaCampo}>ID del roomie (roomieId)</Text>
              <TextInput
                value={roomieId}
                onChangeText={setRoomieId}
                placeholder="UUID del postulante aceptado"
                placeholderTextColor="#B4ACBD"
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={cargando}
              onPress={crear}
              style={styles.botonPrimario}>
              <Text style={styles.textoBotonPrimario}>
                {cargando ? 'Generando…' : 'Crear acuerdo'}
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

        {cargando && acuerdos.length === 0 ? (
          <ActivityIndicator color="#81638B" style={{ marginVertical: 20 }} />
        ) : acuerdos.length === 0 ? (
          <View style={styles.vacio}>
            <View style={styles.vacioIcono}>
              <Text style={styles.vacioIconoTexto}>📝</Text>
            </View>
            <Text style={styles.vacioTitulo}>Sin acuerdos todavía</Text>
            <Text style={styles.vacioSubtitulo}>
              Cuando generes o te compartan un acuerdo de convivencia, podrás
              revisarlo y firmarlo aquí.
            </Text>
          </View>
        ) : (
          acuerdos.map((a) => {
            const miAceptacion = a.acceptances.find(
              (acc) => acc.userId === userId,
            );
            const yaFirme = Boolean(miAceptacion?.acceptedAt);
            const entradasSnapshot = Object.entries(a.rulesSnapshot ?? {});

            return (
              <View key={a.id} style={styles.tarjeta}>
                <View style={styles.filaEntre}>
                  <View
                    style={[
                      styles.chipEstado,
                      {
                        backgroundColor: a.fullyAccepted
                          ? '#DCF0E8'
                          : '#F6ECD6',
                      },
                    ]}>
                    <View
                      style={[
                        styles.puntoEstado,
                        {
                          backgroundColor: a.fullyAccepted
                            ? '#2F9E82'
                            : '#C08A2C',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.textoChipEstado,
                        {
                          color: a.fullyAccepted ? '#2F9E82' : '#C08A2C',
                        },
                      ]}>
                      {a.fullyAccepted
                        ? `FIRMADO · V${a.version}`
                        : `PENDIENTE DE FIRMA · V${a.version}`}
                    </Text>
                  </View>
                  <Text style={styles.metaItem}>
                    #{a.id.slice(0, 6).toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.tituloItem}>
                  Anuncio #{a.listingId.slice(0, 8).toUpperCase()}
                </Text>
                <Text style={styles.metaItem}>
                  Anfitrión: {a.hostId.slice(0, 8)} · Roomies:{' '}
                  {a.roomieIds.map((r) => r.slice(0, 8)).join(', ')}
                </Text>

                {entradasSnapshot.length > 0 ? (
                  <View style={styles.cajaReglas}>
                    <Text style={styles.etiquetaSeccion}>
                      SNAPSHOT INMUTABLE DE REGLAS
                    </Text>
                    {entradasSnapshot.map(([clave, valor]) => (
                      <Text key={clave} style={styles.textoRegla}>
                        • {clave}:{' '}
                        {typeof valor === 'object'
                          ? JSON.stringify(valor)
                          : String(valor)}
                      </Text>
                    ))}
                  </View>
                ) : null}

                <View style={styles.cajaFirmas}>
                  <Text style={styles.etiquetaSeccion}>ESTADO DE FIRMAS</Text>
                  {a.acceptances.map((acc) => (
                    <Text key={acc.userId} style={styles.textoRegla}>
                      {acc.acceptedAt ? '✓' : '○'}{' '}
                      {acc.userId === userId
                        ? 'Tú'
                        : `Usuario ${acc.userId.slice(0, 8)}`}{' '}
                      — {acc.acceptedAt ? 'Firmado' : 'Pendiente'}
                    </Text>
                  ))}
                </View>

                {!yaFirme ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={cargando}
                    onPress={() => aceptar(a.id)}
                    style={styles.botonPrimario}>
                    <Text style={styles.textoBotonPrimario}>
                      Firmar acuerdo digitalmente
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={cargando}
                  onPress={() => nuevaVersion(a.id)}
                  style={styles.botonSecundario}>
                  <Text style={styles.textoBotonSecundario}>
                    Crear nueva versión (v{a.version + 1})
                  </Text>
                </Pressable>
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
    paddingVertical: 14,
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
  etiquetaSeccion: {
    color: '#8A8294',
    fontSize: 10,
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
    paddingVertical: 11,
    fontSize: 14,
    color: '#2B2531',
  },
  cajaReglas: {
    backgroundColor: '#FAF7FC',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  cajaFirmas: {
    borderTopWidth: 1,
    borderTopColor: '#E7DDEC',
    paddingTop: 10,
    gap: 4,
  },
  textoRegla: {
    color: '#4C4556',
    fontSize: 12,
    lineHeight: 18,
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
