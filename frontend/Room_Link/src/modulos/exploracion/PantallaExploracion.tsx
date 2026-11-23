import { useEffect, useState } from 'react';
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
import { estilos as estilosModulo } from '../comunes/InterfazModulo';

import {
  obtenerHabitacion,
  buscarHabitaciones,
  postularseAHabitacion,
} from './api';
import {
  BuscadorHabitaciones,
  type FiltroHabitacion,
} from './componentes/BuscadorHabitaciones';
import { FichaHabitacion } from './componentes/FichaHabitacion';
import { TarjetaHabitacion } from './componentes/TarjetaHabitacion';
import { adaptarHabitacion, type HabitacionFeed } from './datos/habitaciones';

type VistaExploracion = 'resultados' | 'detalle';

export function PantallaExploracion() {
  const [vista, setVista] = useState<VistaExploracion>('resultados');
  const [habitacionActiva, setHabitacionActiva] = useState<HabitacionFeed | null>(null);
  const [habitaciones, setHabitaciones] = useState<HabitacionFeed[]>([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [total, setTotal] = useState(0);
  const [intento, setIntento] = useState(0);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<FiltroHabitacion>('Todas');
  const [postuladas, setPostuladas] = useState<Set<string>>(new Set());
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [guardadas, setGuardadas] = useState<Set<string>>(new Set());
  // Afinidad buscador ↔ anfitrión, por hostId (null = sin test o sin perfil).
  const [compatibilidades, setCompatibilidades] = useState<Record<string, number | null>>({});
  const [tieneTest, setTieneTest] = useState(false);
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  // Consulta la afinidad con cada anfitrión nuevo; sin test o sin perfil queda en null.
  const conCompatibilidad = (habitacion: HabitacionFeed): HabitacionFeed => ({
    ...habitacion, compatibilidad: compatibilidades[habitacion.hostId] ?? null,
  });

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
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const filtros = {
        texto: busqueda,
        disponibleYa: filtroActivo === 'Disponibles ya',
        ...(filtroActivo === 'Hasta $3,000' && { presupuestoMax: 3000 }),
        ...(filtroActivo === 'Hasta $5,000' && { presupuestoMax: 5000 }),
      };
      void buscarHabitaciones(pagina, filtros, controller.signal).then(({ items, total, totalPages }) => {
        if (controller.signal.aborted) return;
        setHabitaciones((actuales) => pagina === 1
          ? items.map(adaptarHabitacion)
          : [...actuales, ...items.filter((item) => !actuales.some(({ id }) => id === item.id)).map(adaptarHabitacion)]);
        setTotal(total);
        setHayMas(pagina < totalPages);
      }).catch((causa: Error) => {
        if (!controller.signal.aborted) setErrorBusqueda(causa.message);
      }).finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    }, pagina === 1 && busqueda.trim() ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [busqueda, filtroActivo, intento, pagina]);

  useEffect(() => {
    const pendientes = [...new Set(habitaciones.map(({ hostId }) => hostId))]
      .filter((id) => !(id in compatibilidades));
    if (!pendientes.length) return;
    let activo = true;
    void Promise.all(pendientes.map((id) =>
      obtenerPerfilAfinidad(id)
        .then((perfil) => [id, perfil.compatibilityScore] as const)
        .catch(() => [id, null] as const),
    )).then((pares) => {
      if (activo) setCompatibilidades((actuales) => ({ ...actuales, ...Object.fromEntries(pares) }));
    });
    return () => { activo = false; };
  }, [habitaciones, compatibilidades]);

  function cambiarBusqueda(texto: string, filtro: FiltroHabitacion) {
    if (texto === busqueda && filtro === filtroActivo) return;
    setBusqueda(texto);
    setFiltroActivo(filtro);
    setPagina(1);
    setHabitaciones([]);
    setHayMas(false);
    setTotal(0);
    setCargando(true);
    setErrorBusqueda(null);
  }

  const abrirHabitacion = async (habitacion: HabitacionFeed) => {
    setHabitacionActiva(habitacion);
    setVista('detalle');
    setError(null);
    try {
      const detalle = await obtenerHabitacion(habitacion.id);
      setHabitacionActiva(adaptarHabitacion(detalle));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la habitación.');
    }
  };

  const cargarMas = () => {
    if (cargando) return;
    setCargando(true);
    setErrorBusqueda(null);
    if (errorBusqueda) setIntento((valor) => valor + 1);
    else setPagina((valor) => valor + 1);
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
        <View style={styles.filaSuperior}>
          <Text style={styles.marca}>ROOMLINK / 04</Text>
          <Link href="/notificaciones" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Centro de notificaciones"
              style={styles.botonCampana}>
              <Text style={styles.textoCampana}>🔔 Avisos</Text>
            </Pressable>
          </Link>
        </View>

        {vista === 'resultados' ? (
          <>
            <Text style={styles.titulo}>Encuentra tu habitación</Text>
            <Text style={styles.subtitulo}>Habitaciones publicadas en renta</Text>
            <Link href="/buscar-roomies" asChild>
              <Pressable accessibilityRole="link" style={estilosModulo.boton}>
                <Text style={estilosModulo.enlace}>Buscar roomies con filtros avanzados</Text>
              </Pressable>
            </Link>
            <BuscadorHabitaciones
              busqueda={busqueda}
              filtroActivo={filtroActivo}
              alBuscar={(texto) => cambiarBusqueda(texto.slice(0, 120), filtroActivo)}
              alCambiarFiltro={(filtro) => cambiarBusqueda(busqueda, filtro)}
            />
            <View style={styles.resumen}>
              <Text style={styles.textoResumen}>
                {total} habitaciones encontradas
              </Text>
            </View>
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
            {cargando && !habitaciones.length ? (
              <Text style={styles.estado}>Cargando habitaciones…</Text>
            ) : habitaciones.length > 0 ? (
              <View style={styles.cuadricula}>
                {habitaciones.map((habitacion) => (
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
            ) : !errorBusqueda && (
              <View style={styles.vacio}>
                <Text style={styles.textoVacio}>
                  {!busqueda.trim() && filtroActivo === 'Todas'
                    ? 'Todavía no hay habitaciones publicadas.'
                    : 'No encontramos habitaciones con esos filtros.'}
                </Text>
                {(Boolean(busqueda.trim()) || filtroActivo !== 'Todas') && (
                  <Pressable
                    onPress={() => cambiarBusqueda('', 'Todas')}>
                    <Text style={styles.limpiarFiltros}>Limpiar búsqueda</Text>
                  </Pressable>
                )}
              </View>
            )}
            {errorBusqueda && <Text accessibilityRole="alert" style={styles.estado}>{errorBusqueda}</Text>}
            {(hayMas || errorBusqueda) && (
              <Pressable
                accessibilityRole="button"
                disabled={cargando}
                onPress={cargarMas}
                style={styles.botonTodos}>
                <Text style={styles.textoBotonTodos}>
                  {cargando ? 'Cargando…' : errorBusqueda ? 'Reintentar' : 'Ver más habitaciones'}
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
  filaSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  botonCampana: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E9DAEC',
  },
  textoCampana: {
    color: '#6F5B76',
    fontSize: 11,
    fontWeight: '700',
  },
  marca: {
    color: '#817987',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
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
