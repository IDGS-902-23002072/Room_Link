import { useEffect, useRef, useState } from 'react';
import { Link } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  eliminarFoto,
  guardarGaleriaLocal,
  leerGaleriaLocal,
  MAX_FOTOS,
  obtenerGaleria,
  reordenarGaleria,
  subirFotos,
  type FotoPerfil,
} from './api';
import { TarjetaFoto } from './componentes/TarjetaFoto';
import { seleccionarFotos } from './seleccionFotos';

function pedirConfirmacion(mensaje: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(true);
    return Promise.resolve(window.confirm(mensaje));
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Eliminar foto',
      mensaje,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function mensajeDeError(error: unknown, respaldo: string) {
  return error instanceof Error && error.message ? error.message : respaldo;
}

export function PantallaGaleriaFotos() {
  const [fotos, setFotos] = useState<FotoPerfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [estadoOperacion, setEstadoOperacion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const { width } = useWindowDimensions();
  const ocupadoRef = useRef(false);
  const fotosRef = useRef<FotoPerfil[]>([]);

  const anchoContenido = Math.min(width, 460);
  const anchoTarjeta = Math.max(
    120,
    Math.floor((anchoContenido - 44 - 8) / 2),
  );

  const aplicarFotos = (siguientes: FotoPerfil[]) => {
    fotosRef.current = siguientes;
    setFotos(siguientes);
  };

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const remotas = await obtenerGaleria();
        if (!activo) return;
        aplicarFotos(remotas);
        setSinConexion(false);
        await guardarGaleriaLocal(remotas);
      } catch (err) {
        const cache = await leerGaleriaLocal();
        if (!activo) return;
        aplicarFotos(cache);
        setSinConexion(true);
        setError(
          `${mensajeDeError(
            err,
            'No pudimos cargar tus fotos.',
          )} Mostrando las fotos guardadas en este dispositivo.`,
        );
      } finally {
        if (activo) setCargando(false);
      }
    };

    void cargar();

    return () => {
      activo = false;
    };
  }, []);

  const aplicarResultado = async (
    siguientes: FotoPerfil[],
    mensaje: string,
  ) => {
    aplicarFotos(siguientes);
    await guardarGaleriaLocal(siguientes);
    setSinConexion(false);
    setError(null);
    setAviso(mensaje);
  };

  const conBloqueo = async (
    texto: string,
    operacion: () => Promise<void>,
  ) => {
    if (ocupadoRef.current) return;

    ocupadoRef.current = true;
    setOcupado(true);
    setEstadoOperacion(texto);
    setError(null);
    setAviso(null);
    try {
      await operacion();
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
      setEstadoOperacion(null);
    }
  };

  const agregarFotos = () => {
    void conBloqueo('Abriendo galería…', async () => {
      const actuales = fotosRef.current;
      if (actuales.length >= MAX_FOTOS) {
        setError('Máximo 6 fotos.');
        return;
      }

      let resultado;
      try {
        resultado = await seleccionarFotos(MAX_FOTOS - actuales.length);
      } catch (err) {
        setError(
          mensajeDeError(err, 'No pudimos abrir tu galería. Intenta de nuevo.'),
        );
        return;
      }

      if (resultado.cancelado) return;
      if (resultado.archivos.length === 0) {
        if (resultado.errores.length > 0) {
          setError(resultado.errores.join(' '));
        }
        return;
      }

      const cantidad = resultado.archivos.length;
      setEstadoOperacion(
        cantidad === 1 ? 'Subiendo foto…' : `Subiendo ${cantidad} fotos…`,
      );

      try {
        const siguientes = await subirFotos(resultado.archivos);
        await aplicarResultado(
          siguientes,
          cantidad === 1 ? 'Foto agregada.' : `${cantidad} fotos agregadas.`,
        );
        if (resultado.errores.length > 0) {
          setError(resultado.errores.join(' '));
        }
      } catch (err) {
        setError(
          mensajeDeError(
            err,
            'No pudimos subir las fotos. Revisa tu conexión e intenta de nuevo.',
          ),
        );
      }
    });
  };

  const intentarAgregar = () => {
    if (fotosRef.current.length >= MAX_FOTOS) {
      setAviso(null);
      setError('Máximo 6 fotos.');
      return;
    }
    agregarFotos();
  };

  const guardarOrden = (siguientes: FotoPerfil[], mensaje: string) => {
    void conBloqueo('Guardando cambios…', async () => {
      try {
        const actualizadas = await reordenarGaleria(
          siguientes.map((foto) => foto.id),
        );
        await aplicarResultado(actualizadas, mensaje);
      } catch (err) {
        setError(
          mensajeDeError(
            err,
            'No pudimos guardar el orden de las fotos. Intenta de nuevo.',
          ),
        );
      }
    });
  };

  const marcarPrincipal = (id: string) => {
    const actuales = fotosRef.current;
    const indice = actuales.findIndex((foto) => foto.id === id);
    if (indice <= 0) return;

    const siguientes: FotoPerfil[] = [
      actuales[indice]!,
      ...actuales.slice(0, indice),
      ...actuales.slice(indice + 1),
    ];
    guardarOrden(siguientes, 'Foto principal actualizada.');
  };

  const moverFoto = (indice: number, direccion: -1 | 1) => {
    const actuales = fotosRef.current;
    const destino = indice + direccion;
    if (destino < 0 || destino >= actuales.length) return;

    const siguientes = [...actuales];
    [siguientes[indice], siguientes[destino]] = [
      siguientes[destino]!,
      siguientes[indice]!,
    ];
    guardarOrden(siguientes, 'Orden de las fotos actualizado.');
  };

  const eliminar = (foto: FotoPerfil) => {
    void (async () => {
      if (ocupadoRef.current) return;

      const actuales = fotosRef.current;
      const indice = actuales.findIndex((item) => item.id === foto.id);
      if (indice < 0) return;

      const confirmado = await pedirConfirmacion(
        `¿Eliminar la foto ${indice + 1}? Esta acción no se puede deshacer.`,
      );
      if (!confirmado) return;

      await conBloqueo('Eliminando foto…', async () => {
        try {
          const siguientes = await eliminarFoto(foto.id);
          await aplicarResultado(siguientes, 'Foto eliminada.');
        } catch (err) {
          setError(
            mensajeDeError(
              err,
              'No pudimos eliminar la foto. Intenta de nuevo.',
            ),
          );
        }
      });
    })();
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
        showsVerticalScrollIndicator={false}>
        <Link href="/perfil" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [
              styles.volver,
              pressed && styles.presionado,
            ]}>
            <Text style={styles.textoVolver}>‹ Mi perfil</Text>
          </Pressable>
        </Link>

        <View style={styles.encabezado}>
          <View style={styles.encabezadoTexto}>
            <Text style={styles.marca}>ROOMLINK / 05 · GALERÍA</Text>
            <Text style={styles.titulo}>Galería de fotos</Text>
            <Text style={styles.subtitulo}>
              Hasta 6 fotos. La primera es tu foto principal.
            </Text>
          </View>
          <View style={styles.contadorCapsula}>
            <Text
              accessibilityLiveRegion="polite"
              style={styles.contadorTexto}>
              {fotos.length}/{MAX_FOTOS}
            </Text>
          </View>
        </View>

        <View style={styles.tarjeta}>
          <View style={styles.filaTituloSeccion}>
            <Text style={styles.tituloSeccion}>Tus fotos</Text>
            {fotos.length === MAX_FOTOS && (
              <View style={styles.insigniaCompleta}>
                <Text style={styles.textoInsigniaCompleta}>COMPLETO</Text>
              </View>
            )}
          </View>
          <Text style={styles.ayudaSeccion}>
            Toca ★ para elegir la principal y usa ‹ › para cambiar el orden.
          </Text>

          {cargando ? (
            <Text style={styles.estado}>Cargando tus fotos…</Text>
          ) : (
            <>
              {fotos.length === 0 && (
                <View style={styles.estadoVacio}>
                  <View style={styles.iconoVacio}>
                    <Text style={styles.iconoVacioTexto}>▧</Text>
                  </View>
                  <Text style={styles.tituloVacio}>Aún no tienes fotos</Text>
                  <Text style={styles.textoVacio}>
                    Muestra tu espacio y tu estilo de vida con hasta 6 fotos.
                  </Text>
                </View>
              )}

              <View style={styles.grid}>
                {fotos.map((foto, indice) => (
                  <TarjetaFoto
                    key={foto.id}
                    foto={foto}
                    indice={indice}
                    total={fotos.length}
                    ancho={anchoTarjeta}
                    ocupada={ocupado}
                    alEliminar={() => eliminar(foto)}
                    alMarcarPrincipal={() => marcarPrincipal(foto.id)}
                    alMoverDerecha={() => moverFoto(indice, 1)}
                    alMoverIzquierda={() => moverFoto(indice, -1)}
                  />
                ))}

                {fotos.length < MAX_FOTOS && (
                  <Pressable
                    accessibilityLabel="Agregar foto"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: ocupado }}
                    disabled={ocupado}
                    onPress={intentarAgregar}
                    style={({ pressed }) => [
                      styles.agregar,
                      {
                        width: anchoTarjeta,
                        minHeight: anchoTarjeta + 20,
                      },
                      pressed && !ocupado && styles.presionado,
                    ]}>
                    <View style={styles.iconoAgregar}>
                      <Text style={styles.iconoAgregarTexto}>
                        {ocupado ? '…' : '+'}
                      </Text>
                    </View>
                    <Text style={styles.tituloAgregar}>
                      {ocupado ? 'Procesando…' : 'Agregar foto'}
                    </Text>
                    <Text style={styles.textoAgregar}>
                      JPG, PNG o WEBP{'\n'}Máx. 5 MB por foto
                    </Text>
                  </Pressable>
                )}
              </View>

              {ocupado && estadoOperacion && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.estadoOperacion}>
                  {estadoOperacion}
                </Text>
              )}

              {fotos.length === MAX_FOTOS && (
                <Pressable
                  accessibilityLabel="Máximo 6 fotos"
                  accessibilityRole="button"
                  onPress={intentarAgregar}
                  style={({ pressed }) => [
                    styles.completo,
                    pressed && styles.presionado,
                  ]}>
                  <Text style={styles.completoTitulo}>Máximo 6 fotos</Text>
                  <Text style={styles.completoTexto}>
                    Elimina una foto para poder subir otra.
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        {sinConexion && (
          <View accessibilityRole="alert" style={styles.mensajeAviso}>
            <Text style={styles.textoAviso}>
              Sin conexión con el servidor: estás viendo una copia guardada en
              este dispositivo.
            </Text>
          </View>
        )}
        {error && (
          <View accessibilityRole="alert" style={styles.mensajeError}>
            <Text style={styles.textoError}>{error}</Text>
          </View>
        )}
        {aviso && (
          <View accessibilityRole="alert" style={styles.mensajeExito}>
            <Text style={styles.textoExito}>{aviso}</Text>
          </View>
        )}

        <View style={styles.nota}>
          <Text style={styles.notaTitulo}>Una buena galería</Text>
          <Text style={styles.notaTexto}>
            La foto principal será la que vean primero otros roomies. Elige
            imágenes donde se vea tu espacio, tus hobbies o tu día a día.
          </Text>
        </View>

        <Text style={styles.notaLocal}>
          Tus fotos se guardan en tu cuenta de RoomLink.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  areaSegura: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FBF9FC',
  },
  contenido: {
    flexGrow: 1,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 44,
  },
  volver: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 10,
    marginBottom: 8,
  },
  textoVolver: {
    color: '#84658D',
    fontSize: 11,
    fontWeight: '600',
  },
  presionado: {
    opacity: 0.72,
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  encabezadoTexto: {
    flex: 1,
    minWidth: 0,
  },
  marca: {
    color: '#817987',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  titulo: {
    color: '#28232D',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitulo: {
    color: '#817987',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  contadorCapsula: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E9DAEC',
    marginTop: 16,
  },
  contadorTexto: {
    color: '#6F5B76',
    fontSize: 10,
    fontWeight: '700',
  },
  tarjeta: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EBF1',
    marginTop: 12,
  },
  filaTituloSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tituloSeccion: {
    color: '#28232D',
    fontSize: 12,
    fontWeight: '700',
  },
  ayudaSeccion: {
    color: '#817987',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },
  insigniaCompleta: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#E9DAEC',
  },
  textoInsigniaCompleta: {
    color: '#6F5B76',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  estado: {
    color: '#817987',
    fontSize: 12,
    textAlign: 'center',
    padding: 22,
  },
  estadoOperacion: {
    color: '#84658D',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  estadoVacio: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 4,
  },
  iconoVacio: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F3EBF5',
    marginBottom: 8,
  },
  iconoVacioTexto: {
    color: '#84658D',
    fontSize: 19,
  },
  tituloVacio: {
    color: '#28232D',
    fontSize: 12,
    fontWeight: '700',
  },
  textoVacio: {
    color: '#817987',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 3,
    maxWidth: 260,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  agregar: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D8C9DD',
    borderRadius: 14,
    backgroundColor: '#FAF6FB',
  },
  iconoAgregar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#E9DAEC',
    marginBottom: 7,
  },
  iconoAgregarTexto: {
    color: '#84658D',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 23,
  },
  tituloAgregar: {
    color: '#6F5B76',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  textoAgregar: {
    color: '#817987',
    fontSize: 8,
    lineHeight: 12,
    textAlign: 'center',
    marginTop: 3,
  },
  completo: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: '#F3EBF5',
    marginTop: 10,
  },
  completoTitulo: {
    color: '#6F5B76',
    fontSize: 11,
    fontWeight: '700',
  },
  completoTexto: {
    color: '#817987',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
    marginTop: 2,
  },
  mensajeAviso: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E9DAEC',
    marginTop: 12,
  },
  textoAviso: {
    color: '#6F5B76',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  mensajeError: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FCE8E8',
    marginTop: 12,
  },
  textoError: {
    color: '#8A3030',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  mensajeExito: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#9BDFDA',
    marginTop: 12,
  },
  textoExito: {
    color: '#25363A',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  nota: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#F3EBF5',
    marginTop: 12,
  },
  notaTitulo: {
    color: '#6F5B76',
    fontSize: 11,
    fontWeight: '700',
  },
  notaTexto: {
    color: '#6F5B76',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },
  notaLocal: {
    color: '#817987',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
    marginTop: 12,
  },
});
