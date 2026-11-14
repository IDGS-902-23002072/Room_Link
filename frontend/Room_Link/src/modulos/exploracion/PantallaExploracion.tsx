import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  obtenerFeedHabitaciones,
  type HabitacionFeed,
} from '../habitaciones/api';
import { BuscadorHabitaciones } from './componentes/BuscadorHabitaciones';
import { DetalleHabitacion } from './componentes/DetalleHabitacion';
import { TarjetaHabitacion } from './componentes/TarjetaHabitacion';
import { rangosRenta, type RangoRenta } from './formato';

const RETRASO_BUSQUEDA_MS = 400;

export function PantallaExploracion() {
  const [habitaciones, setHabitaciones] = useState<HabitacionFeed[]>([]);
  const [habitacionActiva, setHabitacionActiva] = useState<HabitacionFeed | null>(null);
  const [postuladas, setPostuladas] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [rango, setRango] = useState<RangoRenta>(rangosRenta[0]!);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  // Evita que una respuesta lenta pise a una búsqueda más reciente.
  const consultaActual = useRef(0);

  const cargarPrimeraPagina = useCallback(async (texto: string, rangoElegido: RangoRenta) => {
    const consulta = ++consultaActual.current;
    setCargando(true);
    setError(null);
    try {
      const resultado = await obtenerFeedHabitaciones(1, {
        busqueda: texto,
        ...(rangoElegido.rentaMinima !== undefined && { rentaMinima: rangoElegido.rentaMinima }),
        ...(rangoElegido.rentaMaxima !== undefined && { rentaMaxima: rangoElegido.rentaMaxima }),
      });
      if (consulta !== consultaActual.current) return;
      setHabitaciones(resultado.items);
      setHayMas(resultado.hasMore);
      setPagina(1);
    } catch (cause) {
      if (consulta !== consultaActual.current) return;
      setHabitaciones([]);
      setHayMas(false);
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el feed.');
    } finally {
      if (consulta === consultaActual.current) setCargando(false);
    }
  }, []);

  // Busca al cargar la pantalla y cada vez que cambian la búsqueda o el rango de renta.
  useEffect(() => {
    const temporizador = setTimeout(
      () => void cargarPrimeraPagina(busqueda, rango),
      busqueda ? RETRASO_BUSQUEDA_MS : 0,
    );
    return () => clearTimeout(temporizador);
  }, [busqueda, rango, cargarPrimeraPagina]);

  const cargarMas = async () => {
    if (!hayMas || cargandoMas) return;
    const consulta = consultaActual.current;
    setCargandoMas(true);
    setError(null);
    try {
      const resultado = await obtenerFeedHabitaciones(pagina + 1, {
        busqueda,
        ...(rango.rentaMinima !== undefined && { rentaMinima: rango.rentaMinima }),
        ...(rango.rentaMaxima !== undefined && { rentaMaxima: rango.rentaMaxima }),
      });
      if (consulta !== consultaActual.current) return;
      setHabitaciones((actuales) => [...actuales, ...resultado.items]);
      setHayMas(resultado.hasMore);
      setPagina(pagina + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar más habitaciones.');
    } finally {
      setCargandoMas(false);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setRango(rangosRenta[0]!);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.areaSegura}>
      <ScrollView
        contentContainerStyle={[styles.contenido, { width: anchoContenido }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.marca}>ROOMLINK / 04</Text>

        {habitacionActiva ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setHabitacionActiva(null)}
              style={styles.volver}>
              <Text style={styles.textoVolver}>‹  Habitaciones disponibles</Text>
            </Pressable>
            <DetalleHabitacion
              alPostularse={() =>
                setPostuladas((actuales) => new Set(actuales).add(habitacionActiva.id))
              }
              habitacion={habitacionActiva}
              yaPostulada={postuladas.has(habitacionActiva.id)}
            />
          </>
        ) : (
          <>
            <Text style={styles.titulo}>Encuentra tu cuarto</Text>
            <Text style={styles.subtitulo}>
              Habitaciones publicadas por anfitriones, de las más recientes a las más antiguas
            </Text>
            <BuscadorHabitaciones
              alBuscar={setBusqueda}
              alElegirRango={setRango}
              busqueda={busqueda}
              rangoActivo={rango}
            />

            {!cargando && !error && (
              <Text style={styles.resumen}>
                {habitaciones.length}{' '}
                {habitaciones.length === 1 ? 'habitación' : 'habitaciones'} cargadas
              </Text>
            )}

            {cargando ? (
              <View style={styles.estado}>
                <ActivityIndicator color="#84658D" />
                <Text style={styles.textoEstado}>Buscando habitaciones…</Text>
              </View>
            ) : habitaciones.length > 0 ? (
              <View style={styles.lista}>
                {habitaciones.map((habitacion) => (
                  <TarjetaHabitacion
                    alAbrir={() => setHabitacionActiva(habitacion)}
                    habitacion={habitacion}
                    key={habitacion.id}
                  />
                ))}
              </View>
            ) : !error ? (
              <View style={styles.vacio}>
                <Text style={styles.textoVacio}>
                  No hay habitaciones disponibles con esos filtros.
                </Text>
                <Pressable accessibilityRole="button" onPress={limpiarFiltros}>
                  <Text style={styles.limpiarFiltros}>Limpiar filtros</Text>
                </Pressable>
              </View>
            ) : null}

            {hayMas && !cargando && (
              <Pressable
                accessibilityRole="button"
                disabled={cargandoMas}
                onPress={cargarMas}
                style={styles.botonMas}>
                <Text style={styles.textoBotonMas}>
                  {cargandoMas ? 'Cargando…' : 'Ver más habitaciones'}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {error && !habitacionActiva && (
          <View accessibilityRole="alert" style={styles.error}>
            <Text style={styles.textoError}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void cargarPrimeraPagina(busqueda, rango)}>
              <Text style={styles.reintentar}>Reintentar</Text>
            </Pressable>
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
    color: '#817987',
    fontSize: 9,
    marginBottom: 8,
  },
  lista: {
    gap: 12,
  },
  estado: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  textoEstado: {
    color: '#817987',
    fontSize: 12,
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
  botonMas: {
    minHeight: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#84658D',
    marginTop: 14,
  },
  textoBotonMas: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
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
  reintentar: {
    color: '#8A3030',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
});
