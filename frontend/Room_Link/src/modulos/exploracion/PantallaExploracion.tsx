import { useMemo, useState } from 'react';
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
import { perfilesRoomies, type PerfilRoomie } from './datos/perfilesRoomies';

type VistaExploracion = 'resultados' | 'perfil' | 'rapida';

const filtrosDisponibles = ['Todas', 'Mascotas', 'Sin humo', 'Orden diario'];

export function PantallaExploracion() {
  const [vista, setVista] = useState<VistaExploracion>('resultados');
  const [perfilActivo, setPerfilActivo] = useState<PerfilRoomie>(perfilesRoomies[0]);
  const [busqueda, setBusqueda] = useState('');
  const [pestanaActiva, setPestanaActiva] = useState<PestanaExploracion>('Perfil');
  const [filtroActivo, setFiltroActivo] = useState('Todas');
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [solicitudEnviada, setSolicitudEnviada] = useState(false);
  const [comparando, setComparando] = useState(false);
  const { width } = useWindowDimensions();
  const anchoContenido = Math.min(width, 460);

  const perfilesVisibles = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase('es');
    return perfilesRoomies.filter((perfil) => {
      const coincideBusqueda =
        consulta.length === 0 ||
        `${perfil.nombre} ${perfil.ciudad} ${perfil.zona} ${perfil.estilo} ${perfil.habitacion} ${perfil.preferencias.join(' ')}`
          .toLocaleLowerCase('es')
          .includes(consulta);
      const coincideFiltro =
        filtroActivo === 'Todas' ||
        perfil.preferencias.some((preferencia) =>
          preferencia.toLocaleLowerCase('es').includes(filtroActivo.toLocaleLowerCase('es')),
        );
      return coincideBusqueda && coincideFiltro;
    });
  }, [busqueda, filtroActivo]);
  const perfilesAMostrar = mostrarTodos ? perfilesVisibles : perfilesVisibles.slice(0, 4);

  const abrirPerfil = (perfil: PerfilRoomie, vistaSeleccionada: VistaExploracion) => {
    setPerfilActivo(perfil);
    setSolicitudEnviada(false);
    setComparando(false);
    setVista(vistaSeleccionada);
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
              {pestanaActiva === 'Habitaciones'
                ? 'Habitaciones disponibles · León, Guanajuato'
                : 'León, Guanajuato · Cerca de ti'}
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
                {perfilesVisibles.length}{' '}
                {pestanaActiva === 'Habitaciones'
                  ? 'habitaciones compatibles cerca de ti'
                  : 'perfiles que podrían encajar contigo'}
              </Text>
            </View>
            {perfilesVisibles.length > 0 ? (
              <View style={styles.cuadricula}>
                {perfilesAMostrar.map((perfil) => (
                  <TarjetaRoomie
                    key={perfil.id}
                    perfil={perfil}
                    mostrarHabitacion={pestanaActiva === 'Habitaciones'}
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
            {perfilesVisibles.length > 4 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setMostrarTodos((actual) => !actual)}
                style={styles.botonTodos}>
                <Text style={styles.textoBotonTodos}>
                  {mostrarTodos ? 'Mostrando todos los perfiles' : 'Ver todos los perfiles'}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
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
                ? 'Vista rápida · Perfil recomendado'
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
                alEnviarSolicitud={() => setSolicitudEnviada(true)}
                alComparar={() => setComparando((actual) => !actual)}
                alVerPerfilCompleto={() => setVista('perfil')}
                alCerrar={() => setVista('resultados')}
              />
            </View>
          </>
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
