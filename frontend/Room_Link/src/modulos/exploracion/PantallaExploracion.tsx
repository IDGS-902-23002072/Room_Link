import { useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { obtenerPerfilAfinidad, obtenerTestCompatibilidad } from '../compatibilidad/api';

import {
  obtenerHabitacion,
  obtenerHabitacionesPublicadas,
  postularseAHabitacion,
  TAMANO_PAGINA,
} from './api';
import {
  BuscadorHabitaciones,
  type FiltroHabitacion,
} from './componentes/BuscadorHabitaciones';
import { FichaHabitacion } from './componentes/FichaHabitacion';
import { TarjetaHabitacion } from './componentes/TarjetaHabitacion';
import { adaptarHabitacion, type HabitacionFeed } from './datos/habitaciones';
import { HABITACIONES_PRUEBA } from './datos/habitacionesPrueba';

type VistaExploracion = 'resultados' | 'detalle';

function coincideFiltro(habitacion: HabitacionFeed, filtro: FiltroHabitacion) {
  switch (filtro) {
    case 'Disponibles ya':
      return habitacion.disponibleYa;
    case 'Hasta $3,000':
      return habitacion.renta <= 3000;
    case 'Hasta $5,000':
      return habitacion.renta <= 5000;
    default:
      return true;
  }
}

export function PantallaExploracion() {
  const [vista, setVista] = useState<VistaExploracion>('resultados');
  const [habitacionActiva, setHabitacionActiva] = useState<HabitacionFeed | null>(null);
  const [habitaciones, setHabitaciones] = useState<HabitacionFeed[]>([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<FiltroHabitacion>('Todas');
  const [postuladas, setPostuladas] = useState<Set<string>>(new Set());
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [guardadas, setGuardadas] = useState<Set<string>>(new Set());
  // Afinidad buscador ↔ anfitrión, por hostId (null = sin test o sin perfil).
  const [compatibilidades, setCompatibilidades] = useState<Record<string, number | null>>({});
  const [tieneTest, setTieneTest] = useState(false);
  const [avisoPrueba, setAvisoPrueba] = useState<string | null>(null);
  const modoPrueba = avisoPrueba !== null;
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  // Consulta la afinidad con cada anfitrión nuevo; sin test o sin perfil queda en null.
  const cargarCompatibilidades = (hostIds: string[], yaCargadas: Record<string, number | null>) => {
    const pendientes = [...new Set(hostIds)].filter((id) => !(id in yaCargadas));
    if (pendientes.length === 0) return;
    Promise.all(
      pendientes.map((id) =>
        obtenerPerfilAfinidad(id)
          .then((perfil) => [id, perfil.compatibilityScore] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((pares) => {
      setCompatibilidades((actuales) => ({ ...actuales, ...Object.fromEntries(pares) }));
    });
  };

  const conCompatibilidad = (habitacion: HabitacionFeed): HabitacionFeed =>
    modoPrueba
      ? habitacion
      : { ...habitacion, compatibilidad: compatibilidades[habitacion.hostId] ?? null };

  const mostrarDatosPrueba = (motivo: string) => {
    setHabitaciones(HABITACIONES_PRUEBA);
    setHayMas(false);
    setPagina(1);
    setError(null);
    setAvisoPrueba(motivo);
  };

  useEffect(() => {
    let activo = true;
    obtenerTestCompatibilidad()
      .then((resultado) => {
        if (activo) setTieneTest(resultado.completed);
      })
      .catch(() => {
        // Sin API o sin usuario configurado se ofrece completar el test.
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;
    obtenerHabitacionesPublicadas(1)
      .then((resultado) => {
        if (!activo) return;
        if (resultado.length === 0) {
          mostrarDatosPrueba('Aún no hay habitaciones publicadas.');
          return;
        }
        setHabitaciones(resultado.map(adaptarHabitacion));
        cargarCompatibilidades(
          resultado.map((habitacion) => habitacion.hostId),
          {},
        );
        setHayMas(resultado.length === TAMANO_PAGINA);
        setPagina(1);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (activo) {
          mostrarDatosPrueba(
            cause instanceof Error
              ? `No se pudo conectar con la API: ${cause.message}`
              : 'No se pudo cargar el feed de habitaciones.',
          );
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const habitacionesVisibles = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es');
    return habitaciones.filter((habitacion) => {
      const coincideBusqueda =
        consulta.length === 0 ||
        `${habitacion.titulo} ${habitacion.descripcion ?? ''}`
          .toLocaleLowerCase('es')
          .includes(consulta);
      return coincideBusqueda && coincideFiltro(habitacion, filtroActivo);
    });
  }, [busqueda, filtroActivo, habitaciones]);

  const abrirHabitacion = async (habitacion: HabitacionFeed) => {
    setHabitacionActiva(habitacion);
    setVista('detalle');
    setError(null);
    if (modoPrueba) return;
    try {
      const detalle = await obtenerHabitacion(habitacion.id);
      setHabitacionActiva(adaptarHabitacion(detalle));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la habitación.');
    }
  };

  const cargarMas = async () => {
    if (!hayMas || cargandoMas) return;
    const siguientePagina = pagina + 1;
    setCargandoMas(true);
    setError(null);
    try {
      const resultado = await obtenerHabitacionesPublicadas(siguientePagina);
      setHabitaciones((actuales) => [...actuales, ...resultado.map(adaptarHabitacion)]);
      cargarCompatibilidades(
        resultado.map((habitacion) => habitacion.hostId),
        compatibilidades,
      );
      setHayMas(resultado.length === TAMANO_PAGINA);
      setPagina(siguientePagina);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudieron cargar más habitaciones.',
      );
    } finally {
      setCargandoMas(false);
    }
  };

  const alternarGuardada = (id: string) => {
    setGuardadas((actuales) => {
      const siguientes = new Set(actuales);
      if (!siguientes.delete(id)) siguientes.add(id);
      return siguientes;
    });
  };

  const postularse = async (habitacion: HabitacionFeed, mensaje: string | null) => {
    if (enviandoId !== null || postuladas.has(habitacion.id)) return;
    setEnviandoId(habitacion.id);
    setError(null);
    if (modoPrueba) {
      setPostuladas((actuales) => new Set(actuales).add(habitacion.id));
      setEnviandoId(null);
      return;
    }
    try {
      await postularseAHabitacion(
        habitacion.id,
        mensaje,
        compatibilidades[habitacion.hostId] ?? null,
      );
      setPostuladas((actuales) => new Set(actuales).add(habitacion.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la postulación.');
    } finally {
      setEnviandoId(null);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.marca}>ROOMLINK / 04</Text>

        {vista === 'resultados' ? (
          <>
            <Text style={styles.titulo}>Encuentra tu habitación</Text>
            <Text style={styles.subtitulo}>Habitaciones publicadas en renta</Text>
            <BuscadorHabitaciones
              busqueda={busqueda}
              filtroActivo={filtroActivo}
              alBuscar={setBusqueda}
              alCambiarFiltro={setFiltroActivo}
            />
            <View style={styles.resumen}>
              <Text style={styles.textoResumen}>
                {habitacionesVisibles.length} habitaciones disponibles
              </Text>
            </View>
            {modoPrueba && (
              <View style={styles.avisoPrueba}>
                <Text style={styles.tituloAvisoPrueba}>Datos de prueba</Text>
                <Text style={styles.textoAvisoPrueba}>{avisoPrueba}</Text>
              </View>
            )}
            <View style={styles.aviso}>
              <View style={styles.contenidoAviso}>
                <Text style={styles.tituloAviso}>
                  {tieneTest ? 'Tu test de convivencia' : 'Mejora tus recomendaciones'}
                </Text>
                <Text style={styles.textoAviso}>
                  {tieneTest
                    ? 'Revisa o edita tus respuestas para ver qué tan compatible eres con cada anfitrión.'
                    : 'Completa el test para ver tu compatibilidad con los anfitriones.'}
                </Text>
              </View>
              <Link href="/encuesta" asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.botonTest,
                    pressed && styles.botonTestPresionado,
                  ]}>
                  <Text style={styles.textoBotonTest}>
                    {tieneTest ? 'Editar mi test' : 'Completar test'}
                  </Text>
                </Pressable>
              </Link>
            </View>
            {cargando ? (
              <Text style={styles.estado}>Cargando habitaciones…</Text>
            ) : habitacionesVisibles.length > 0 ? (
              <View style={styles.cuadricula}>
                {habitacionesVisibles.map((habitacion) => (
                  <TarjetaHabitacion
                    key={habitacion.id}
                    habitacion={conCompatibilidad(habitacion)}
                    postulada={postuladas.has(habitacion.id)}
                    enviando={enviandoId === habitacion.id}
                    guardada={guardadas.has(habitacion.id)}
                    alAbrir={() => abrirHabitacion(habitacion)}
                    alAlternarGuardada={() => alternarGuardada(habitacion.id)}
                    alPostularme={() => postularse(habitacion, null)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.vacio}>
                <Text style={styles.textoVacio}>
                  {habitaciones.length === 0
                    ? 'Todavía no hay habitaciones publicadas.'
                    : 'No encontramos habitaciones con esos filtros.'}
                </Text>
                {habitaciones.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setBusqueda('');
                      setFiltroActivo('Todas');
                    }}>
                    <Text style={styles.limpiarFiltros}>Limpiar búsqueda</Text>
                  </Pressable>
                )}
              </View>
            )}
            {hayMas && (
              <Pressable
                accessibilityRole="button"
                onPress={cargarMas}
                style={styles.botonTodos}>
                <Text style={styles.textoBotonTodos}>
                  {cargandoMas ? 'Cargando…' : 'Ver más habitaciones'}
                </Text>
              </Pressable>
            )}
          </>
        ) : habitacionActiva ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setVista('resultados')}
              style={styles.volver}>
              <Text style={styles.textoVolver}>‹  Explorar habitaciones</Text>
            </Pressable>
            <Text style={styles.titulo}>
              Detalle de la habitación
            </Text>
            <Text style={styles.subtitulo}>
              Revisa la información y postúlate
            </Text>
            <View style={styles.ficha}>
              <FichaHabitacion
                habitacion={conCompatibilidad(habitacionActiva)}
                postulada={postuladas.has(habitacionActiva.id)}
                enviando={enviandoId === habitacionActiva.id}
                alPostularse={(mensaje) => postularse(habitacionActiva, mensaje)}
                alCerrar={() => setVista('resultados')}
              />
            </View>
          </>
        ) : (
          <Text style={styles.estado}>Cargando habitación…</Text>
        )}
        {error && (
          <View accessibilityRole="alert" style={styles.error}>
            <Text style={styles.textoError}>{error}</Text>
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
    backgroundColor: '#FBF9FC',
  },
  contenido: {
    flexGrow: 1,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 92,
  },
  marca: {
    color: '#817987',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  titulo: {
    color: '#28232D',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitulo: {
    color: '#6B6372',
    fontSize: 14,
    marginTop: 4,
  },
  resumen: {
    marginTop: 16,
    marginBottom: 10,
  },
  avisoPrueba: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF4D6',
    marginBottom: 8,
  },
  tituloAvisoPrueba: {
    color: '#7A5B00',
    fontSize: 13,
    fontWeight: '700',
  },
  textoAvisoPrueba: {
    color: '#7A5B00',
    fontSize: 12,
    marginTop: 2,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#E9DAEC',
    marginBottom: 4,
    paddingLeft: 16,
    marginTop: 14,
  },
  contenidoAviso: {
    flex: 1,
    gap: 3,
  },
  tituloAviso: {
    color: '#6F5B76',
    fontSize: 14,
    fontWeight: '700',
  },
  textoAviso: {
    color: '#5E4466',
    fontSize: 12,
    lineHeight: 16,
  },
  botonTest: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#84658D',
  },
  botonTestPresionado: {
    opacity: 0.75,
  },
  textoBotonTest: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  textoResumen: {
    color: '#6B6372',
    fontSize: 13,
  },
  estado: {
    color: '#6B6372',
    fontSize: 14,
    textAlign: 'center',
    padding: 18,
  },
  error: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#FCE8E8',
    marginTop: 10,
  },
  textoError: {
    color: '#8A3030',
    fontSize: 13,
  },
  cuadricula: {
    gap: 20,
  },
  botonTodos: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#84658D',
    marginTop: 16,
  },
  textoBotonTodos: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  vacio: {
    alignItems: 'center',
    padding: 22,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  textoVacio: {
    color: '#6B6372',
    fontSize: 14,
    textAlign: 'center',
  },
  limpiarFiltros: {
    color: '#84658D',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  volver: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
  },
  textoVolver: {
    color: '#84658D',
    fontSize: 14,
    fontWeight: '600',
  },
  ficha: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#F6F1F7',
    marginTop: 13,
  },
});
