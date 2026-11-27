import { Image } from 'expo-image';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';
import { CargandoHabitaciones } from '@/components/CargandoHabitaciones';
import { MarcaRoomLink } from '@/components/MarcaRoomLink';
import { color } from '@/constants/roomlink';

import { obtenerPerfilAfinidad, obtenerTestCompatibilidad } from '../compatibilidad/api';
import { Accion, Aviso } from '../comunes/InterfazModulo';
import { obtenerHabitacion, obtenerHabitacionesPublicadas, obtenerMisPostulaciones, postularseAHabitacion } from './api';
import { BuscadorHabitaciones, type FiltroHabitacion } from './componentes/BuscadorHabitaciones';
import { FichaHabitacion } from './componentes/FichaHabitacion';
import { TarjetaHabitacion } from './componentes/TarjetaHabitacion';
import { adaptarHabitacion, type HabitacionFeed } from './datos/habitaciones';

const rentaMaxima: Partial<Record<FiltroHabitacion, number>> = {
  'Hasta $3,000': 3000,
  'Hasta $5,000': 5000,
};

export function PantallaExploracion() {
  const { sesion } = useSesion();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroHabitacion>('Todas');
  const [habitaciones, setHabitaciones] = useState<HabitacionFeed[]>([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorFeed, setErrorFeed] = useState('');
  const [intentoFeed, reintentarFeed] = useState(0);
  const [detalle, setDetalle] = useState<HabitacionFeed | null>(null);
  const [postuladas, setPostuladas] = useState<Set<string>>(new Set());
  const [estadoPostulaciones, setEstadoPostulaciones] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [guardadas, setGuardadas] = useState<Set<string>>(new Set());
  const [afinidades, setAfinidades] = useState<Record<string, number | null>>({});
  const [tieneTest, setTieneTest] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const envio = useRef(false);
  const solicitudFeed = useRef<AbortController | null>(null);
  const solicitudPostulaciones = useRef<AbortController | null>(null);
  const solicitudDetalle = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const texto = busqueda.trim();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const resultado = await obtenerHabitacionesPublicadas(pagina, {
          texto, presupuestoMax: rentaMaxima[filtro], disponibleYa: filtro === 'Disponibles ya',
        }, controller.signal);
        if (controller.signal.aborted) return;
        const items = resultado.items.map(adaptarHabitacion);
        setHabitaciones((anteriores) => pagina === 1 ? items : [...anteriores, ...items]);
        setHayMas(resultado.hayMas);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setErrorFeed(cause instanceof Error ? cause.message : 'No pudimos cargar las habitaciones.');
        }
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }, pagina === 1 ? 250 : 0);
    solicitudFeed.current = controller;
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [texto, filtro, pagina, intentoFeed]);

  useEffect(() => () => solicitudDetalle.current?.abort(), []);

  const cargarPostulaciones = useCallback(() => {
    solicitudPostulaciones.current?.abort();
    const controller = new AbortController();
    solicitudPostulaciones.current = controller;
    setEstadoPostulaciones('cargando');
    obtenerMisPostulaciones(controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      setPostuladas((actuales) => new Set([...actuales, ...items.map(({ listingId }) => listingId)]));
      setEstadoPostulaciones('listo');
    }).catch(() => {
      if (!controller.signal.aborted) setEstadoPostulaciones('error');
    });
  }, []);

  useFocusEffect(useCallback(() => {
    let activo = true;
    obtenerTestCompatibilidad().then((test) => {
      if (activo) setTieneTest(test.completed);
    }).catch(() => undefined);
    cargarPostulaciones();
    return () => {
      activo = false;
      solicitudPostulaciones.current?.abort();
    };
  }, [cargarPostulaciones]));

  useEffect(() => {
    if (!tieneTest) return;
    let activo = true;
    const ids = [...new Set(habitaciones.map(({ hostId }) => hostId))].filter((id) => !(id in afinidades));
    if (ids.length) {
      void Promise.all(ids.map(async (id) => {
        const perfil = await obtenerPerfilAfinidad(id).catch(() => null);
        return [id, perfil?.compatibilityScore ?? null] as const;
      })).then((entradas) => {
        if (activo) setAfinidades((actual) => ({ ...actual, ...Object.fromEntries(entradas) }));
      });
    }
    return () => { activo = false; };
  }, [afinidades, habitaciones, tieneTest]);

  function cambiarBusqueda(nuevaBusqueda: string, nuevoFiltro: FiltroHabitacion) {
    setBusqueda(nuevaBusqueda);
    setFiltro(nuevoFiltro);
    if (nuevaBusqueda.trim() === texto && nuevoFiltro === filtro) return;
    solicitudFeed.current?.abort();
    setPagina(1);
    setHabitaciones([]);
    setHayMas(false);
    setErrorFeed('');
    setCargando(true);
  }

  function solicitarPagina(siguiente: number) {
    setCargando(true);
    setErrorFeed('');
    if (siguiente === pagina) reintentarFeed((actual) => actual + 1);
    else setPagina(siguiente);
  }

  function bloqueo(habitacion: HabitacionFeed) {
    if (habitacion.hostId === sesion?.usuario.id) return 'Tu anuncio';
    if (estadoPostulaciones === 'cargando') return 'Consultando…';
    if (estadoPostulaciones === 'error') return 'Postulación no disponible';
  }

  async function abrirHabitacion(habitacion: HabitacionFeed) {
    solicitudDetalle.current?.abort();
    const controller = new AbortController();
    solicitudDetalle.current = controller;
    setDetalle(habitacion);
    setErrorAccion('');
    scroll.current?.scrollTo({ y: 0, animated: false });
    try {
      const datos = adaptarHabitacion(await obtenerHabitacion(habitacion.id, controller.signal));
      if (!controller.signal.aborted) {
        setDetalle({ ...datos, anfitrion: habitacion.anfitrion, ubicacion: habitacion.ubicacion });
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setErrorAccion(cause instanceof Error ? cause.message : 'No pudimos cargar el detalle.');
      }
    }
  }

  const cerrarDetalle = useCallback(() => {
    solicitudDetalle.current?.abort();
    setDetalle(null);
    setErrorAccion('');
  }, []);

  const mostrandoDetalle = detalle !== null;
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || !mostrandoDetalle) return;
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      cerrarDetalle();
      return true;
    });
    return () => suscripcion.remove();
  }, [cerrarDetalle, mostrandoDetalle]));

  async function postularse(habitacion: HabitacionFeed, mensaje: string | null) {
    if (envio.current || bloqueo(habitacion) || postuladas.has(habitacion.id)) return;
    envio.current = true;
    setEnviandoId(habitacion.id);
    setErrorAccion('');
    try {
      await postularseAHabitacion(habitacion.id, mensaje);
      setPostuladas((actuales) => new Set(actuales).add(habitacion.id));
    } catch (cause) {
      if (cause instanceof Error && 'code' in cause && cause.code === 'APPLICATION_ALREADY_SENT') {
        setPostuladas((actuales) => new Set(actuales).add(habitacion.id));
      } else {
        setErrorAccion(cause instanceof Error ? cause.message : 'No se pudo enviar la postulación.');
      }
    } finally {
      envio.current = false;
      setEnviandoId(null);
    }
  }

  function alternarGuardada(id: string) {
    setGuardadas((actuales) => {
      const siguientes = new Set(actuales);
      if (!siguientes.delete(id)) siguientes.add(id);
      return siguientes;
    });
  }

  const tieneFiltros = Boolean(texto) || filtro !== 'Todas';
  const conAfinidad = (habitacion: HabitacionFeed) => ({
    ...habitacion, compatibilidad: afinidades[habitacion.hostId] ?? null,
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.area}>
      <ScrollView ref={scroll} stickyHeaderIndices={[0]} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.barra}>
          <MarcaRoomLink />
          <Link href="/notificaciones" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Centro de notificaciones"
              style={({ pressed }) => [styles.campana, pressed && styles.presionado]}>
              <Image source={require('@/assets/images/tabIcons/bell.png')} style={styles.icono} />
            </Pressable>
          </Link>
        </View>
        {detalle ? (
          <>
            <Accion texto="‹  Explorar habitaciones" alPulsar={cerrarDetalle} />
            <Aviso error>{errorAccion}</Aviso>
            <FichaHabitacion
              key={detalle.id}
              habitacion={conAfinidad(detalle)}
              postulada={postuladas.has(detalle.id)}
              bloqueoPostulacion={bloqueo(detalle)}
              enviando={enviandoId === detalle.id}
              alPostularse={(mensaje) => void postularse(detalle, mensaje)}
              alCerrar={cerrarDetalle}
            />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Image source={require('@/assets/images/interior-roomlink.webp')} contentFit="cover" style={styles.heroImagen} />
              <View style={styles.heroTexto}>
                <Text style={styles.eyebrow}>TU SIGUIENTE CAPÍTULO</Text>
                <Text accessibilityRole="header" style={styles.titulo}>Un espacio.
Tu nueva vida.</Text>
                <Text style={styles.subtitulo}>Encuentra el lugar y las personas con quienes quieres compartirlo.</Text>
              </View>
            </View>
            <BuscadorHabitaciones
              busqueda={busqueda}
              filtroActivo={filtro}
              alBuscar={(valor) => cambiarBusqueda(valor, filtro)}
              alCambiarFiltro={(valor) => cambiarBusqueda(busqueda, valor)}
            />
            <View style={styles.accesos}>
              <Link href="/buscar-roomies" style={styles.enlace}>Encuentra roomies  ↗</Link>
              <Link href="/encuesta" style={[styles.enlace, styles.enlaceAfinidad]}>
                {tieneTest ? 'Mi compatibilidad  ↗' : 'Descubre tu compatibilidad  ↗'}
              </Link>
            </View>
            <View style={styles.resultados}>
              <Text accessibilityRole="header" style={styles.seccion}>Habitaciones en renta</Text>
              {habitaciones.length > 0 && <Text style={styles.contador}>{habitaciones.length} visibles</Text>}
            </View>
            <Aviso error>{errorAccion}</Aviso>
            {habitaciones.map((habitacion) => (
              <TarjetaHabitacion
                key={habitacion.id}
                habitacion={conAfinidad(habitacion)}
                postulada={postuladas.has(habitacion.id)}
                bloqueoPostulacion={bloqueo(habitacion)}
                enviando={enviandoId === habitacion.id}
                guardada={guardadas.has(habitacion.id)}
                alAbrir={() => void abrirHabitacion(habitacion)}
                alAlternarGuardada={() => alternarGuardada(habitacion.id)}
                alPostularme={() => void postularse(habitacion, null)}
              />
            ))}
            {cargando ? (
              habitaciones.length === 0 ? <CargandoHabitaciones /> : <ActivityIndicator accessibilityLabel="Cargando más habitaciones" color={color.accion} style={styles.estado} />
            ) : errorFeed ? (
              <>
                <Aviso error>{errorFeed}</Aviso>
                <Accion texto="Reintentar búsqueda" alPulsar={() => solicitarPagina(pagina)} />
              </>
            ) : habitaciones.length === 0 ? (
              <View style={styles.estado}>
                <Text accessibilityRole="header" style={styles.seccion}>{tieneFiltros ? 'Probemos otra búsqueda' : 'Tu próximo hogar está por llegar'}</Text>
                <Text style={styles.subtitulo}>
                  {tieneFiltros ? 'No encontramos habitaciones con esos filtros.' : 'Todavía no hay habitaciones publicadas.'}
                </Text>
                {tieneFiltros && <Accion texto="Limpiar búsqueda" alPulsar={() => cambiarBusqueda('', 'Todas')} />}
              </View>
            ) : hayMas ? (
              <Accion texto="Ver más habitaciones" alPulsar={() => solicitarPagina(pagina + 1)} />
            ) : null}
          </>
        )}
        {estadoPostulaciones === 'error' && (
          <Accion
            texto="Reintentar consulta de postulaciones"
            alPulsar={cargarPostulaciones}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, backgroundColor: color.blanco },
  contenido: {
    width: '100%', maxWidth: 520, alignSelf: 'center',
    paddingHorizontal: 20, paddingTop: 0, paddingBottom: 40, gap: 20,
  },
  barra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color.blanco, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.borde },
  campana: {
    width: 46, height: 46, alignItems: 'center', justifyContent: 'center',
    borderColor: color.borde, borderWidth: 1, borderRadius: 24, backgroundColor: color.blanco,
  },
  icono: { width: 23, height: 23 },
  presionado: { opacity: 0.7 },
  hero: { backgroundColor: color.superficie, borderRadius: 8, overflow: 'hidden', marginHorizontal: -20 },
  heroImagen: { width: '100%', height: 280 },
  heroTexto: { paddingHorizontal: 24, paddingVertical: 28, gap: 12 },
  eyebrow: { color: color.secundario, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  titulo: { color: color.tinta, fontSize: 38, fontWeight: '600', letterSpacing: -1.4 },
  subtitulo: { color: color.secundario, fontSize: 15, lineHeight: 22 },
  accesos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  enlace: {
    color: color.tinta, backgroundColor: color.superficie, padding: 14,
    borderRadius: 8, fontSize: 13, fontWeight: '700', minHeight: 44, overflow: 'hidden',
  },
  enlaceAfinidad: { color: color.tinta, backgroundColor: color.superficie },
  resultados: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 8 },
  seccion: { color: color.tinta, fontSize: 22, fontWeight: '600', letterSpacing: -0.45 },
  contador: { color: color.secundario, fontSize: 13, fontWeight: '600' },
  estado: { padding: 18, gap: 12, borderRadius: 18, backgroundColor: color.fondo },
});
