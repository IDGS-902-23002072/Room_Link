import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EntradaValidada } from '@/modulos/comunes/EntradaValidada';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSesion } from '@/auth/SesionContext';
import { Accion, Aviso } from '@/modulos/comunes/InterfazModulo';
import { obtenerCortes, obtenerDashboard, recalcularCorte, type CorteDiario, type Dashboard, type Periodo } from './api';
import { fechaISO, periodoRapido, resumirCortes, validarPeriodo } from './metricas';

const vistas = [
  ['resumen', 'Resumen', 'RoomLink en números'],
  ['actividad', 'Actividad', 'Actividad y ocupación'],
  ['matching', 'Matching', 'Calidad del matching'],
] as const;
type Vista = typeof vistas[number][0];

const iconos = {
  reportes: require('@/assets/analytics/reportes.svg'),
  anuncios: require('@/assets/analytics/anuncios.svg'),
  analitica: require('@/assets/analytics/analitica.svg'),
};

const formatoNumero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const formatoMes = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });
const fecha = (valor: string) => formatoFecha.format(new Date(`${valor}T00:00:00Z`));
const numero = (valor: number | null, unidad = '') =>
  valor === null ? 'Sin datos' : `${formatoNumero.format(valor)}${unidad}`;

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <View style={st.tarjeta}>
      <Text style={st.secundario}>{titulo}</Text>
      <Text style={st.valor}>{valor}</Text>
      <Text style={st.secundario}>{detalle}</Text>
    </View>
  );
}

function Barras({ titulo, serie }: { titulo: string; serie: { month: string; total: number | null }[] }) {
  const maximo = Math.max(1, ...serie.map(({ total }) => total ?? 0));
  const ultimo = serie.findLastIndex(({ total }) => total !== null);
  const columnas = (
    <View style={[st.grafica, serie.length > 6 && { width: serie.length * 48 }]}>
      {serie.map(({ month, total }, i) => {
        const mes = formatoMes.format(new Date(`${month}-01T00:00:00Z`));
        return (
          <View accessible accessibilityLabel={`${mes} ${month.slice(0, 4)}, ${numero(total)}`} key={month} style={st.columna}>
            <Text style={st.etiquetaGrafica}>{total === null ? '—' : numero(total)}</Text>
            <View style={st.espacioBarra}>
              <View style={[st.barra, i === ultimo && st.barraActiva, {
                height: total === null ? 0 : Math.max(2, Math.round(92 * total / maximo)),
              }]} />
            </View>
            <Text style={st.etiquetaGrafica}>{mes}</Text>
          </View>
        );
      })}
    </View>
  );
  return (
    <View style={st.tarjeta}>
      <Text accessibilityRole="header" style={st.tituloTarjeta}>{titulo}</Text>
      {!serie.some(({ total }) => total !== null) ? (
        <Text style={st.secundario}>Sin cortes diarios para este periodo.</Text>
      ) : serie.length > 6 ? <ScrollView horizontal>{columnas}</ScrollView> : columnas}
    </View>
  );
}

function NavegacionAdmin({ alResumen }: { alResumen: () => void }) {
  return (
    <View style={st.pie}>
      <Link href="/moderacion" asChild>
        <Pressable accessibilityRole="link" style={st.destino}>
          <Image accessible={false} contentFit="contain" source={iconos.reportes} style={st.icono} />
          <Text style={st.etiquetaDestino}>Reportes</Text>
        </Pressable>
      </Link>
      <Link href="/anuncios" asChild>
        <Pressable accessibilityRole="link" style={st.destino}>
          <Image accessible={false} contentFit="contain" source={iconos.anuncios} style={st.icono} />
          <Text style={st.etiquetaDestino}>Anuncios</Text>
        </Pressable>
      </Link>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: true }} onPress={alResumen} style={[st.destino, st.destinoActivo]}>
        <Image accessible={false} contentFit="contain" source={iconos.analitica} style={st.icono} />
        <Text style={st.etiquetaDestino}>Analítica</Text>
      </Pressable>
    </View>
  );
}

export function PantallaAnalytics() {
  const { sesion, cargando } = useSesion();
  if (cargando) return <SafeAreaView style={st.pantalla}><ActivityIndicator color="#81638B" /></SafeAreaView>;
  if (!sesion?.usuario.roles?.includes('admin')) {
    return (
      <SafeAreaView style={st.pantalla}>
        <View style={st.contenido}>
          <Text accessibilityRole="header" style={st.titulo}>Acceso restringido</Text>
          <Text style={st.secundario}>La analítica requiere rol de administrador.</Text>
          <Link href="/perfil" style={st.enlace}>Volver al perfil</Link>
        </View>
      </SafeAreaView>
    );
  }
  return <AnalyticsAdmin key={sesion.usuario.id} />;
}

function AnalyticsAdmin() {
  const [vista, setVista] = useState<Vista>('resumen');
  const [hoy] = useState(() => fechaISO(new Date()));
  const [periodo, setPeriodo] = useState(() => periodoRapido('mes'));
  const [opcion, setOpcion] = useState<'mes' | '90' | 'manual'>('mes');
  const [borrador, setBorrador] = useState(periodo);
  const [editar, setEditar] = useState(false);
  const [reporte, setReporte] = useState(false);
  const [intento, setIntento] = useState(0);
  const [respuesta, setRespuesta] = useState<{
    clave: string; dashboard: Dashboard | null; cortes: CorteDiario[]; error: string; errorCortes: string;
  } | null>(null);
  const [errorPeriodo, setErrorPeriodo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [errorRecalculo, setErrorRecalculo] = useState('');
  const [recalculando, setRecalculando] = useState(false);
  const { start, end } = periodo;
  const clave = `${start}:${end}:${intento}`;

  useEffect(() => {
    const controlador = new AbortController();
    const { signal } = controlador;
    const fechas = { start, end };
    void Promise.allSettled([obtenerDashboard(fechas, signal), obtenerCortes(fechas, signal)])
      .then(([dashboard, cortes]) => {
        if (signal.aborted) return;
        setRespuesta({
          clave,
          dashboard: dashboard.status === 'fulfilled' ? dashboard.value : null,
          cortes: cortes.status === 'fulfilled' ? cortes.value : [],
          error: dashboard.status === 'rejected' ? String(dashboard.reason?.message ?? 'No se pudo cargar el dashboard.') : '',
          errorCortes: cortes.status === 'rejected' ? String(cortes.reason?.message ?? 'No se pudieron cargar los cortes diarios.') : '',
        });
      });
    return () => controlador.abort();
  }, [clave, start, end]);

  function navegar(destino: Vista) {
    setVista(destino);
    setReporte(false);
  }

  function aplicar(siguiente: Periodo, tipo: typeof opcion) {
    const error = validarPeriodo(siguiente);
    setErrorPeriodo(error);
    if (error) return;
    setPeriodo(siguiente);
    setBorrador(siguiente);
    setOpcion(tipo);
    setEditar(false);
    setMensaje('');
    setErrorRecalculo('');
  }

  async function recalcular() {
    setRecalculando(true);
    setMensaje('');
    setErrorRecalculo('');
    try {
      await recalcularCorte(end);
      setMensaje(`Corte del ${fecha(end)} recalculado.`);
      setIntento((valor) => valor + 1);
    } catch (error) {
      setErrorRecalculo(error instanceof Error ? error.message : 'No se pudo recalcular el corte.');
    } finally {
      setRecalculando(false);
    }
  }

  const resultado = respuesta?.clave === clave ? respuesta : null;
  const dash = resultado?.dashboard;
  const estadisticas = dash && resumirCortes(resultado.cortes, dash.monthlyUsers);
  const titulo = vistas.find(([id]) => id === vista)?.[2];
  let contenido: ReactNode;
  if (dash && estadisticas) {
    const { kpis } = dash;
    if (vista === 'resumen') contenido = <>
      <Indicador titulo="Usuarios registrados" valor={numero(kpis.usersRegistered)} detalle="Altas del periodo seleccionado" />
      <Indicador titulo="Conexiones aceptadas" valor={numero(kpis.connectionsAccepted)} detalle={`${numero(kpis.connectionsSent)} solicitudes enviadas en el periodo`} />
      <Indicador titulo="Habitaciones activas" valor={numero(kpis.activeRooms)} detalle="Anuncios con estado publicado" />
      <View style={[st.tarjeta, st.destacada]}>
        <Text style={st.tituloTarjeta}>Tiempo promedio de cierre</Text>
        <Text style={st.texto}>{numero(kpis.avgDaysToClose, ' días')}</Text>
      </View>
      <Accion texto="Ver actividad mensual" alPulsar={() => navegar('actividad')} />
    </>;
    else if (vista === 'actividad') contenido = <>
      <Barras titulo="Publicaciones por mes" serie={dash.monthlyListings} />
      <Indicador titulo="Anuncios cerrados" valor={numero(estadisticas.cierres)} detalle="Cierres registrados en los cortes disponibles" />
      <View style={st.tarjetaEnmarcada}>
        <Text style={st.tituloTarjeta}>Anuncios activos · {numero(kpis.activeRooms)}</Text>
        <Text style={st.secundario}>La API no informa cuántas habitaciones están ocupadas.</Text>
      </View>
      <Accion texto={reporte ? 'Ocultar reporte mensual' : 'Consultar reporte mensual'} alPulsar={() => setReporte(!reporte)} />
      {reporte && <>
        <Barras titulo="Usuarios registrados por mes" serie={dash.monthlyUsers} />
        <Barras titulo="Cierres por mes · cortes disponibles" serie={estadisticas.cierresPorMes} />
      </>}
    </>;
    else contenido = <>
      <Indicador titulo="Afinidad media en postulaciones" valor={numero(estadisticas.afinidad, '%')} detalle={
        estadisticas.diasConAfinidad ? `Promedio de los cortes de ${estadisticas.diasConAfinidad} días con afinidad registrada` : 'Aún no hay cortes con puntuaciones de afinidad'
      } />
      <Indicador titulo="Tasa de aceptación" valor={numero(kpis.connectionAcceptanceRate, '%')} detalle="Conexiones aceptadas respecto a las enviadas en el periodo" />
      <Barras titulo="Conexiones aceptadas por mes · cortes disponibles" serie={estadisticas.conexionesPorMes} />
      <View style={st.tarjetaEnmarcada}>
        <Text style={st.tituloTarjeta}>Muestra del periodo</Text>
        <Text style={st.secundario}>{numero(kpis.connectionsAccepted)} conexiones aceptadas</Text>
      </View>
      <Accion texto={reporte ? 'Ocultar reporte de compatibilidad' : 'Ver reporte de compatibilidad'} alPulsar={() => setReporte(!reporte)} />
      {reporte && <View style={st.tarjeta}>
        <Text style={st.tituloTarjeta}>Afinidad por día</Text>
        {resultado.cortes.some(({ avgAffinityScore }) => avgAffinityScore !== null)
          ? resultado.cortes.filter(({ avgAffinityScore }) => avgAffinityScore !== null).map((corte) => (
            <Text style={st.texto} key={corte.metricDate}>{fecha(corte.metricDate)} · {numero(corte.avgAffinityScore, '%')}</Text>
          ))
          : <Text style={st.secundario}>Sin puntuaciones registradas.</Text>}
      </View>}
    </>;
  }

  return (
    <SafeAreaView style={st.pantalla}>
      <ScrollView key={vista} contentContainerStyle={st.contenido} keyboardShouldPersistTaps="handled">
        <View style={st.cabecera}>
          <Text style={st.marca}>ROOMLINK / ADMINISTRACIÓN</Text>
          <Link href="/perfil" style={st.enlace}>‹ Perfil</Link>
        </View>
        <Text accessibilityRole="header" style={st.titulo}>{titulo}</Text>
        <Text style={st.secundario}>{fecha(start)} – {fecha(end)}</Text>
        <View accessibilityRole="tablist" style={st.segmentos}>
          {vistas.map(([id, etiqueta]) => (
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: id === vista }} key={id} onPress={() => navegar(id)} style={[st.segmento, id === vista && st.segmentoActivo]}>
              <Text style={[st.etiquetaSegmento, id === vista && st.activo]}>{etiqueta}</Text>
            </Pressable>
          ))}
        </View>
        <View style={st.periodos}>
          {([['mes', 'Este mes'], ['90', 'Últimos 90 días'], ['manual', 'Elegir fechas']] as const).map(([id, etiqueta]) => (
            <Pressable
              accessibilityRole="button" accessibilityState={{ selected: id === opcion, disabled: recalculando }}
              disabled={recalculando} key={id} style={[st.periodo, id === opcion && st.periodoActivo]}
              onPress={() => id === 'manual' ? setEditar(!editar) : aplicar(periodoRapido(id), id)}
            >
              <Text style={[st.etiquetaSegmento, id === opcion && st.activo]}>{etiqueta}</Text>
            </Pressable>
          ))}
        </View>
        {editar && <View style={st.tarjeta}>
          {([['start', 'Desde'], ['end', 'Hasta']] as const).map(([campo, etiqueta]) => (
            <View key={campo}>
              <Text style={st.secundario}>{etiqueta}</Text>
              <EntradaValidada accessibilityLabel={`${etiqueta}, AAAA-MM-DD`} autoCapitalize="none" maxLength={10}
                onChangeText={(valor) => setBorrador({ ...borrador, [campo]: valor })} placeholder="AAAA-MM-DD"
                style={st.entrada} value={borrador[campo]} />
            </View>
          ))}
          <Aviso error>{errorPeriodo}</Aviso>
          <Accion texto="Aplicar fechas" alPulsar={() => aplicar(borrador, 'manual')} deshabilitada={recalculando} />
        </View>}
        {!resultado && <ActivityIndicator accessibilityLabel="Cargando métricas" color="#81638B" style={st.carga} />}
        <Aviso error>{resultado?.error}</Aviso>
        {contenido}
        {resultado?.errorCortes && <Aviso error>{resultado.errorCortes}</Aviso>}
        {(resultado?.error || resultado?.errorCortes) && <Accion texto="Reintentar" alPulsar={() => setIntento((valor) => valor + 1)} />}
        {dash && vista !== 'resumen' && (
          <View style={st.tarjetaEnmarcada}>
            <Text style={st.secundario}>{estadisticas?.ultimoCorte ? `Último corte disponible: ${fecha(estadisticas.ultimoCorte)} · ${resultado.cortes.length} días con corte` : 'Sin cortes diarios para estas fechas.'}</Text>
            {end <= hoy && (
              <Accion texto={recalculando ? 'Recalculando…' : `Recalcular corte del ${fecha(end)}`} alPulsar={() => void recalcular()} deshabilitada={recalculando} />
            )}
            <Aviso>{mensaje}</Aviso>
            <Aviso error>{errorRecalculo}</Aviso>
          </View>
        )}
      </ScrollView>
      <NavegacionAdmin alResumen={() => navegar('resumen')} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FAF8FB' },
  contenido: { width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16, gap: 10 },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  marca: { fontSize: 10, color: '#81638B', fontWeight: '700' },
  titulo: { color: '#2C2433', fontSize: 24, fontWeight: '700' },
  secundario: { color: '#6E5F74', fontSize: 12, lineHeight: 17 },
  texto: { color: '#2C2433', fontSize: 14, lineHeight: 20 },
  enlace: { color: '#72537D', fontSize: 13, fontWeight: '700' },
  segmentos: { flexDirection: 'row', backgroundColor: '#EEE6F0', borderRadius: 18, padding: 2 },
  segmento: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: 4, borderRadius: 16 },
  segmentoActivo: { backgroundColor: '#DAC9DF' },
  etiquetaSegmento: { color: '#6E5F74', fontSize: 11, textAlign: 'center' },
  activo: { color: '#5D4168', fontWeight: '700' },
  periodos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  periodo: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 14 },
  periodoActivo: { backgroundColor: '#DAC9DF' },
  tarjeta: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, gap: 5 },
  destacada: { backgroundColor: '#9CE0DA' },
  tarjetaEnmarcada: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E8DEEB', gap: 8 },
  tituloTarjeta: { color: '#2C2433', fontSize: 15, fontWeight: '700' },
  valor: { color: '#81638B', fontSize: 30, fontWeight: '700' },
  carga: { minHeight: 56 },
  entrada: { minHeight: 44, borderWidth: 1, borderColor: '#E8DEEB', borderRadius: 10, paddingHorizontal: 10, color: '#2C2433', marginVertical: 4 },
  grafica: { flexDirection: 'row', gap: 5, alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 10 },
  columna: { flex: 1, alignItems: 'center', gap: 3 },
  espacioBarra: { height: 92, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barra: { width: '76%', maxWidth: 36, borderRadius: 5, backgroundColor: '#B695C0' },
  barraActiva: { backgroundColor: '#81638B' },
  etiquetaGrafica: { fontSize: 10, color: '#6E5F74', textAlign: 'center' },
  pie: { marginHorizontal: 24, marginBottom: 6, width: '88%', maxWidth: 412, alignSelf: 'center', flexDirection: 'row', gap: 2, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8 },
  destino: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', padding: 4, borderRadius: 16 },
  destinoActivo: { backgroundColor: '#DAC9DF' },
  icono: { width: 20, height: 20 },
  etiquetaDestino: { fontSize: 10, color: '#66516D', marginTop: 2 },
});
