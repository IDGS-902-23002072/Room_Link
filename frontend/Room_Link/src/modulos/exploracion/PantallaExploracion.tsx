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

import {
  BuscadorRoomies,
  type PestanaExploracion,
} from './componentes/BuscadorRoomies';
import { FichaRoomie } from './componentes/FichaRoomie';
import { TarjetaRoomie } from './componentes/TarjetaRoomie';
import type { PerfilRoomie } from './datos/perfilesRoomies';
import {
  enviarSolicitudConexion,
  obtenerFeedAfinidad,
  obtenerPerfilAfinidad,
  type FeedAfinidad,
  type PerfilAfinidad,
} from '../compatibilidad/api';

type VistaExploracion = 'resultados' | 'perfil' | 'rapida';

const filtrosDisponibles = ['Todas', 'Mascotas', 'Tabaco', 'Limpieza'];

const nombresDimension: Record<string, string> = {
  schedule: 'Horarios',
  cleanliness: 'Limpieza',
  noise: 'Ruido',
  pets: 'Mascotas',
  smoking: 'Tabaco',
  visits: 'Visitas',
  genderPref: 'Género',
};

function adaptarPerfil(perfil: PerfilAfinidad): PerfilRoomie {
  const nombre = perfil.fullName.trim() || 'Roomie';
  const preferencias =
    perfil.compatibilitySummary?.map(
      ({ dimension, percentage }) => `${nombresDimension[dimension]} ${percentage}%`,
    ) ?? [];
  const presupuesto =
    perfil.budgetMin || perfil.budgetMax
      ? `$${perfil.budgetMin ?? '0'} – $${perfil.budgetMax ?? 'sin límite'} MXN`
      : 'Sin presupuesto indicado';

  return {
    id: perfil.userId,
    iniciales: nombre
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toLocaleUpperCase('es') ?? '')
      .join(''),
    nombre,
    edad: perfil.age,
    compatibilidad: perfil.compatibilityScore,
    ciudad: perfil.city ?? 'Ubicación no indicada',
    zona: perfil.zone ?? 'Zona no indicada',
    estilo: perfil.occupation ?? 'Ocupación no indicada',
    ocupacion: perfil.occupation ?? 'Ocupación no indicada',
    preferencias,
    presupuesto,
    bio: perfil.bio ?? 'Este perfil aún no tiene una descripción.',
    fotoUrl: perfil.photoUrl,
  };
}

export function PantallaExploracion() {
  const [vista, setVista] = useState<VistaExploracion>('resultados');
  const [perfilActivo, setPerfilActivo] = useState<PerfilRoomie | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilRoomie[]>([]);
  const [feed, setFeed] = useState<FeedAfinidad | null>(null);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [pestanaActiva, setPestanaActiva] = useState<PestanaExploracion>('Perfil');
  const [filtroActivo, setFiltroActivo] = useState('Todas');
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [comparando, setComparando] = useState(false);
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  useEffect(() => {
    let activo = true;
    obtenerFeedAfinidad(1)
      .then((resultado) => {
        if (!activo) return;
        setFeed(resultado);
        setPerfiles(resultado.profiles.map(adaptarPerfil));
        setPagina(1);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (activo) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar el feed.');
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const perfilesVisibles = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es');
    return perfiles.filter((perfil) => {
      const coincideBusqueda =
        consulta.length === 0 ||
        `${perfil.nombre} ${perfil.ciudad} ${perfil.zona} ${perfil.estilo} ${perfil.preferencias.join(' ')}`
          .toLocaleLowerCase('es')
          .includes(consulta);
      const coincideFiltro =
        filtroActivo === 'Todas' ||
        perfil.preferencias.some((preferencia) =>
          preferencia.toLocaleLowerCase('es').includes(filtroActivo.toLocaleLowerCase('es')),
        );
      return coincideBusqueda && coincideFiltro;
    });
  }, [busqueda, filtroActivo, perfiles]);

  const abrirPerfil = async (perfil: PerfilRoomie, vistaSeleccionada: VistaExploracion) => {
    setPerfilActivo(perfil);
    setSolicitudEnviada(false);
    setComparando(false);
    setVista(vistaSeleccionada);
    setError(null);
    try {
      const detalle = await obtenerPerfilAfinidad(perfil.id);
      setPerfilActivo(adaptarPerfil(detalle));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el perfil.');
    }
  };

  const cargarMas = async () => {
    if (!feed?.hasMore || cargandoMas) return;
    const siguientePagina = pagina + 1;
    setCargandoMas(true);
    setError(null);
    try {
      const resultado = await obtenerFeedAfinidad(siguientePagina);
      setFeed(resultado);
      setPerfiles((actuales) => [
        ...actuales,
        ...resultado.profiles.map(adaptarPerfil),
      ]);
      setPagina(siguientePagina);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar más perfiles.');
    } finally {
      setCargandoMas(false);
    }
  };

  const solicitarConexion = async () => {
    if (!perfilActivo || solicitudEnviada) return;
    setError(null);
    try {
      await enviarSolicitudConexion(perfilActivo.id);
      setSolicitudEnviada(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.');
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
            <Text style={styles.titulo}>Encuentra tu gente</Text>
            <Text style={styles.subtitulo}>
              Perfiles ordenados por afinidad
            </Text>
            <BuscadorRoomies
              busqueda={busqueda}
              pestanaActiva={pestanaActiva}
              alBuscar={setBusqueda}
              alCambiarPestana={setPestanaActiva}
            />
            {pestanaActiva === 'Filtros' && (
              <View style={styles.filtros}>
                {filtrosDisponibles.map((filtro) => {
                  const activo = filtroActivo === filtro;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                      key={filtro}
                      onPress={() => setFiltroActivo(filtro)}
                      style={[styles.filtro, activo && styles.filtroActivo]}>
                      <Text style={[styles.textoFiltro, activo && styles.textoFiltroActivo]}>
                        {filtro}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={styles.resumen}>
              <Text style={styles.textoResumen}>
                {perfilesVisibles.length} perfiles cargados
              </Text>
            </View>
            {!feed?.hasTest && (
              <View style={styles.aviso}>
                <Text style={styles.textoAviso}>
                  Completa el test de compatibilidad para ordenar los perfiles por afinidad.
                </Text>
              </View>
            )}
            {cargando ? (
              <Text style={styles.estado}>Cargando perfiles…</Text>
            ) : perfilesVisibles.length > 0 ? (
              <View style={styles.cuadricula}>
                {perfilesVisibles.map((perfil) => (
                  <TarjetaRoomie
                    key={perfil.id}
                    perfil={perfil}
                    mostrarPreferencias={pestanaActiva === 'Preferencias'}
                    alAbrir={() => abrirPerfil(perfil, 'perfil')}
                    alVerRapido={() => abrirPerfil(perfil, 'rapida')}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.vacio}>
                <Text style={styles.textoVacio}>No encontramos perfiles con esos filtros.</Text>
                <Pressable
                  onPress={() => {
                    setBusqueda('');
                    setFiltroActivo('Todas');
                  }}>
                  <Text style={styles.limpiarFiltros}>Limpiar búsqueda</Text>
                </Pressable>
              </View>
            )}
            {feed?.hasMore && (
              <Pressable
                accessibilityRole="button"
                onPress={cargarMas}
                style={styles.botonTodos}>
                <Text style={styles.textoBotonTodos}>
                  {cargandoMas ? 'Cargando…' : 'Ver más perfiles'}
                </Text>
              </Pressable>
            )}
          </>
        ) : perfilActivo ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setVista('resultados')}
              style={styles.volver}>
              <Text style={styles.textoVolver}>‹  Explorar perfiles</Text>
            </Pressable>
            <Text style={styles.titulo}>
              {vista === 'rapida' ? 'Un vistazo a' : 'Conoce a'}{' '}
              {perfilActivo.nombre.split(' ')[0]}
            </Text>
            <Text style={styles.subtitulo}>
              {vista === 'rapida'
                ? 'Vista rápida del perfil'
                : 'Un estilo de vida parecido al tuyo'}
            </Text>
            <View style={styles.ficha}>
              <FichaRoomie
                perfil={perfilActivo}
                pestanaActiva={pestanaActiva}
                vistaRapida={vista === 'rapida'}
                solicitudEnviada={solicitudEnviada}
                comparando={comparando}
                alCambiarPestana={setPestanaActiva}
                alAbrirVistaRapida={() => setVista('rapida')}
                alEnviarSolicitud={solicitarConexion}
                alComparar={() => setComparando((actual) => !actual)}
                alVerPerfilCompleto={() => setVista('perfil')}
                alCerrar={() => setVista('resultados')}
              />
            </View>
          </>
        ) : <Text style={styles.estado}>Cargando perfil…</Text>}
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
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  filtro: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE8F0',
  },
  filtroActivo: {
    backgroundColor: '#E9DAEC',
    borderColor: '#E9DAEC',
  },
  textoFiltro: {
    color: '#6F5B76',
    fontSize: 9,
  },
  textoFiltroActivo: {
    color: '#84658D',
    fontWeight: '600',
  },
  resumen: {
    marginTop: 10,
    marginBottom: 7,
  },
  aviso: {
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#E9DAEC',
    marginTop: 10,
  },
  textoAviso: {
    color: '#6F5B76',
    fontSize: 11,
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
  textoResumen: {
    color: '#817987',
    fontSize: 9,
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
