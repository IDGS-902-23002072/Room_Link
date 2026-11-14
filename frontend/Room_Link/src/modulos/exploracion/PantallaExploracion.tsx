import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { obtenerPerfilAfinidad } from '../compatibilidad/api';

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

type VistaExploracion = 'resultados' | 'detalle' | 'rapida';

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
  const [enviando, setEnviando] = useState(false);
  // Afinidad buscador ↔ anfitrión, por hostId (null = sin test o sin perfil).
  const [compatibilidades, setCompatibilidades] = useState<Record<string, number | null>>({});
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

  const conCompatibilidad = (habitacion: HabitacionFeed): HabitacionFeed => ({
    ...habitacion,
    compatibilidad: compatibilidades[habitacion.hostId] ?? null,
  });

  useEffect(() => {
    let activo = true;
    obtenerHabitacionesPublicadas(1)
      .then((resultado) => {
        if (!activo) return;
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
          setError(
            cause instanceof Error ? cause.message : 'No se pudo cargar el feed de habitaciones.',
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

  const abrirHabitacion = async (
    habitacion: HabitacionFeed,
    vistaSeleccionada: VistaExploracion,
  ) => {
    setHabitacionActiva(habitacion);
    setVista(vistaSeleccionada);
    setError(null);
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

  const postularse = async (mensaje: string | null) => {
    if (!habitacionActiva || enviando || postuladas.has(habitacionActiva.id)) return;
    setEnviando(true);
    setError(null);
    try {
      await postularseAHabitacion(
        habitacionActiva.id,
        mensaje,
        compatibilidades[habitacionActiva.hostId] ?? null,
      );
      setPostuladas((actuales) => new Set(actuales).add(habitacionActiva.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la postulación.');
    } finally {
      setEnviando(false);
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
            {cargando ? (
              <Text style={styles.estado}>Cargando habitaciones…</Text>
            ) : habitacionesVisibles.length > 0 ? (
              <View style={styles.cuadricula}>
                {habitacionesVisibles.map((habitacion) => (
                  <TarjetaHabitacion
                    key={habitacion.id}
                    habitacion={conCompatibilidad(habitacion)}
                    postulada={postuladas.has(habitacion.id)}
                    alAbrir={() => abrirHabitacion(habitacion, 'detalle')}
                    alVerRapido={() => abrirHabitacion(habitacion, 'rapida')}
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
              {vista === 'rapida' ? 'Un vistazo a la habitación' : 'Detalle de la habitación'}
            </Text>
            <Text style={styles.subtitulo}>
              {vista === 'rapida'
                ? 'Vista rápida del anuncio'
                : 'Revisa la información y postúlate'}
            </Text>
            <View style={styles.ficha}>
              <FichaHabitacion
                habitacion={conCompatibilidad(habitacionActiva)}
                vistaRapida={vista === 'rapida'}
                postulada={postuladas.has(habitacionActiva.id)}
                enviando={enviando}
                alPostularse={postularse}
                alVerDetalle={() => setVista('detalle')}
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
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 92,
  },
  marca: {
    color: '#817987',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 5,
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
    marginTop: 3,
  },
  resumen: {
    marginTop: 10,
    marginBottom: 7,
  },
  textoResumen: {
    color: '#817987',
    fontSize: 9,
  },
  estado: {
    color: '#817987',
    fontSize: 12,
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
    fontSize: 11,
  },
  cuadricula: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  botonTodos: {
    minHeight: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#84658D',
    marginTop: 12,
  },
  textoBotonTodos: {
    color: '#FFFFFF',
    fontSize: 10,
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
    color: '#817987',
    fontSize: 11,
    textAlign: 'center',
  },
  limpiarFiltros: {
    color: '#84658D',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 10,
  },
  volver: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
  },
  textoVolver: {
    color: '#84658D',
    fontSize: 11,
    fontWeight: '600',
  },
  ficha: {
    padding: 10,
    borderRadius: 15,
    backgroundColor: '#F6F1F7',
    marginTop: 13,
  },
});
