import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useSesion } from '@/auth/SesionContext';
import { Accion, Aviso, estilos, Opciones, PantallaModulo, Tarjeta, Texto } from '@/modulos/comunes/InterfazModulo';
import { configuracionApi, obtenerFeedAfinidad, type DimensionCompatibilidad, type PerfilAfinidad } from '@/modulos/compatibilidad/api';
import { preguntasConvivencia, preguntasHabitos } from '@/modulos/encuesta/datos/preguntas';
import { CampoPerfil } from '@/modulos/perfil/componentes/CampoPerfil';

const pestanas = [['filtros', 'Filtros generales'], ['habitos', 'Hábitos y compatibilidad'], ['guardadas', 'Búsquedas guardadas']] as const;
const ordenes = [['afinidad', 'Afinidad'], ['presupuesto', 'Presupuesto'], ['nombre', 'Nombre']] as const;
const campos = [['presupuestoMin', 'Presupuesto mínimo'], ['presupuestoMax', 'Presupuesto máximo'], ['edadMin', 'Edad mínima'], ['edadMax', 'Edad máxima']] as const;
const filtrosIniciales = { presupuestoMin: '', presupuestoMax: '', edadMin: '', edadMax: '', ciudad: '', zonas: [] as string[] };
const prioridades = [['preferencia', 'Preferencia'], ['indispensable', 'Indispensable']] as const;
const nombres = { noise: 'Ruido y descanso', smoking: 'Consumo de tabaco', cleanliness: 'Limpieza', visits: 'Visitas en casa' };
const preguntas = [...preguntasHabitos, ...preguntasConvivencia].filter(({ id }) => id in nombres);
type Filtros = typeof filtrosIniciales;
type Habitos = Partial<Record<DimensionCompatibilidad, { valor: string; prioridad: typeof prioridades[number][0] }>>;
type Criterios = { filtros: Filtros; habitos: Habitos };
type Guardada = Criterios & { id: string; nombre: string; favorita: boolean };
type Preferencias = Criterios & { guardadas: Guardada[]; perfiles: string[] };
const inicial: Preferencias = { filtros: filtrosIniciales, habitos: {}, guardadas: [], perfiles: [] };
const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

function validar(filtros: Filtros) {
  const { edadMin, edadMax, presupuestoMin, presupuestoMax } = filtros;
  if (campos.some(([clave]) => filtros[clave] && !/^\d+$/.test(filtros[clave]))) return 'Usa números enteros en los rangos.';
  if ([edadMin, edadMax].some((edad) => edad && Number(edad) < 18)) return 'La edad mínima permitida es de 18 años.';
  if ((edadMin && edadMax && Number(edadMin) > Number(edadMax)) ||
      (presupuestoMin && presupuestoMax && Number(presupuestoMin) > Number(presupuestoMax))) return 'El valor mínimo debe ser igual o menor que el máximo.';
  return '';
}

function buscar(perfiles: PerfilAfinidad[], { filtros, habitos }: Criterios, orden: typeof ordenes[number][0]) {
  const criterios = Object.entries(habitos).filter(([, habito]) => habito?.valor);
  const coincide = (perfil: PerfilAfinidad, id: string, valor: string) =>
    perfil.compatibilitySummary?.some((item) => item.dimension === id && item.percentage === Number(valor));
  const puntaje = (perfil: PerfilAfinidad) => criterios.filter(([id, criterio]) => criterio && coincide(perfil, id, criterio.valor)).length;
  return perfiles.filter((perfil) => {
    const min = perfil.budgetMin ?? perfil.budgetMax;
    const max = perfil.budgetMax ?? perfil.budgetMin;
    return (!filtros.ciudad || perfil.city === filtros.ciudad) &&
      (!filtros.zonas.length || filtros.zonas.some((zona) => zona === perfil.zone)) &&
      (!filtros.edadMin || perfil.age >= Number(filtros.edadMin)) &&
      (!filtros.edadMax || perfil.age <= Number(filtros.edadMax)) &&
      (!filtros.presupuestoMin || max !== null && Number(max) >= Number(filtros.presupuestoMin)) &&
      (!filtros.presupuestoMax || min !== null && Number(min) <= Number(filtros.presupuestoMax)) &&
      criterios.every(([id, criterio]) => !criterio || criterio.prioridad !== 'indispensable' || coincide(perfil, id, criterio.valor));
  }).sort((a, b) => {
    if (orden === 'nombre') return a.fullName.localeCompare(b.fullName, 'es');
    if (orden === 'presupuesto') return Number(a.budgetMin ?? a.budgetMax ?? Infinity) - Number(b.budgetMin ?? b.budgetMax ?? Infinity) || a.fullName.localeCompare(b.fullName, 'es');
    return puntaje(b) - puntaje(a) || (b.compatibilityScore ?? -1) - (a.compatibilityScore ?? -1);
  });
}

function Resumen({ filtros, habitos }: Criterios) {
  const partes = [
    filtros.ciudad, filtros.zonas.join(', '),
    (filtros.presupuestoMin || filtros.presupuestoMax) && `${filtros.presupuestoMin ? moneda.format(Number(filtros.presupuestoMin)) : 'Sin mínimo'} a ${filtros.presupuestoMax ? moneda.format(Number(filtros.presupuestoMax)) : 'sin máximo'} MXN`,
    (filtros.edadMin || filtros.edadMax) && `${filtros.edadMin || '18'} a ${filtros.edadMax || 'sin máximo'} años`,
  ].filter(Boolean);
  return <>
    <Texto secundario>{partes.join(' · ') || 'Todas las ciudades, edades y presupuestos'}</Texto>
    {preguntas.map(({ id, options }) => {
      const criterio = habitos[id];
      if (!criterio?.valor) return null;
      return <Texto key={id} secundario>{nombres[id as keyof typeof nombres]} · {options[Number(criterio.valor) / 25]} ({criterio.prioridad})</Texto>;
    })}
  </>;
}

export function PantallaBusquedaRoomies() {
  const id = useSesion().sesion?.usuario.id;
  if (!id) return null;
  return <Busqueda key={id} usuarioId={id} />;
}

function Busqueda({ usuarioId }: { usuarioId: string }) {
  const clave = `@roomlink/search:${usuarioId}`;
  const [pestana, setPestana] = useState<typeof pestanas[number][0]>('filtros');
  const [orden, setOrden] = useState<typeof ordenes[number][0]>('afinidad');
  const [datos, setDatos] = useState<Preferencias>(inicial);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [habitos, setHabitos] = useState<Habitos>({});
  const [perfiles, setPerfiles] = useState<PerfilAfinidad[]>([]);
  const [pagina, setPagina] = useState(1);
  const [intentoFeed, setIntentoFeed] = useState(0);
  const [hayMas, setHayMas] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [iniciada, setIniciada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorFeed, setErrorFeed] = useState('');
  const [nombre, setNombre] = useState('');
  const [favoritas, setFavoritas] = useState(false);
  const [edicion, setEdicion] = useState<string | null>(null);
  const [perfilAbierto, setPerfilAbierto] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    void AsyncStorage.getItem(clave).then((valor) => {
      if (!activo || !valor) return;
      const anteriores = { ...inicial, ...JSON.parse(valor) } as Preferencias;
      setDatos(anteriores);
      setFiltros(anteriores.filtros);
      setHabitos(anteriores.habitos);
    }).catch(() => {
      if (activo) setError('No pudimos recuperar tus búsquedas guardadas.');
    }).finally(() => {
      if (activo) setIniciada(true);
    });
    return () => { activo = false; };
  }, [clave]);

  useEffect(() => {
    let activo = true;
    void obtenerFeedAfinidad(pagina).then(({ profiles, hasMore }) => {
      if (!activo) return;
      setPerfiles((anteriores) => [...new Map([...anteriores, ...profiles.filter((perfil) => perfil.userId !== usuarioId)].map((perfil) => [perfil.userId, perfil])).values()]);
      setHayMas(hasMore);
    }).catch((causa: Error) => { if (activo) setErrorFeed(causa.message); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intentoFeed, pagina, usuarioId]);

  async function guardar(partes: Partial<Preferencias>) {
    if (guardando || !iniciada) return false;
    const siguiente = { ...datos, ...partes };
    setGuardando(true);
    setError('');
    try {
      await AsyncStorage.setItem(clave, JSON.stringify(siguiente));
      setDatos(siguiente);
      return true;
    } catch {
      setError('No pudimos guardar los cambios en este dispositivo.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  const ciudades = [...new Set([filtros.ciudad, ...perfiles.map(({ city }) => city)])].filter((item): item is string => Boolean(item)).sort();
  const zonas = [...new Set([...filtros.zonas, ...perfiles.filter(({ city }) => !filtros.ciudad || city === filtros.ciudad).map(({ zone }) => zone)])].filter((item): item is string => Boolean(item)).sort();
  const resultados = buscar(perfiles, datos, orden);
  const muestra = buscar(perfiles, { filtros: datos.filtros, habitos }, orden);
  const bloquear = guardando || !iniciada;

  async function guardarBusqueda() {
    const titulo = nombre.trim();
    if (!titulo) return;
    const guardadas = edicion
      ? datos.guardadas.map((item) => item.id === edicion ? { ...item, nombre: titulo } : item)
      : [{ id: String(Date.now()), nombre: titulo, favorita: false, filtros: datos.filtros, habitos: datos.habitos }, ...datos.guardadas];
    if (await guardar({ guardadas })) {
      setNombre('');
      setEdicion(null);
      setFavoritas(false);
    }
  }

  return (
    <PantallaModulo detalle="Encuentra personas compatibles con tu presupuesto, zona y hábitos de convivencia." titulo="Buscar roomies" volver="/explorar">
      <Opciones alCambiar={setPestana} opciones={pestanas} valor={pestana} />
      <Aviso error>{error}</Aviso>
      {!iniciada && <Aviso>Cargando tus preferencias…</Aviso>}
      {pestana === 'filtros' && <>
        <Tarjeta titulo="Filtros generales">
          <View style={estilos.fila}>{campos.map(([claveCampo, etiqueta]) => (
            <View key={claveCampo} style={busqueda.campo}>
              <CampoPerfil alCambiar={(valor) => setFiltros({ ...filtros, [claveCampo]: valor })} etiqueta={etiqueta} keyboardType="number-pad" maxLength={claveCampo.startsWith('edad') ? 3 : 10} valor={filtros[claveCampo]} />
            </View>
          ))}</View>
          <Texto>Ciudad</Texto>
          <Opciones alCambiar={(ciudad) => setFiltros({ ...filtros, ciudad, zonas: [] })} opciones={[[ '', 'Todas'], ...ciudades.map((ciudad) => [ciudad, ciudad] as const)]} valor={filtros.ciudad} />
          <Texto>Zonas de interés</Texto>
          <View style={estilos.fila}>{zonas.map((zona) => (
            <Accion alPulsar={() => setFiltros({ ...filtros, zonas: filtros.zonas.includes(zona) ? filtros.zonas.filter((item) => item !== zona) : [...filtros.zonas, zona] })} key={zona} seleccionada={filtros.zonas.includes(zona)} texto={zona} />
          ))}</View>
          {!zonas.length && <Texto secundario>Las zonas disponibles aparecen al cargar los perfiles.</Texto>}
          <Accion alPulsar={() => {
            const mensaje = validar(filtros);
            if (mensaje) setError(mensaje);
            else void guardar({ filtros });
          }} deshabilitada={bloquear} primaria texto="Aplicar filtros" />
          <Accion alPulsar={() => { void guardar({ filtros: filtrosIniciales }).then((ok) => { if (ok) setFiltros(filtrosIniciales); }); }} deshabilitada={bloquear} texto="Restablecer filtros" />
          <Accion alPulsar={() => setPestana('guardadas')} texto="Guardar búsqueda actual" />
        </Tarjeta>
        <Tarjeta titulo={`${resultados.length} ${resultados.length === 1 ? 'perfil encontrado' : 'perfiles encontrados'}${hayMas ? ' entre los cargados' : ''}`}>
          <Resumen {...datos} />
          <Opciones alCambiar={setOrden} opciones={ordenes} valor={orden} />
          {cargando && <Texto secundario>Buscando perfiles…</Texto>}
          {!cargando && !errorFeed && !resultados.length && <Texto secundario>Prueba con otros criterios o carga más perfiles.</Texto>}
        </Tarjeta>
        {resultados.map((perfil) => {
          const guardado = datos.perfiles.includes(perfil.userId);
          const abierto = perfilAbierto === perfil.userId;
          return <Tarjeta key={perfil.userId} titulo={`${perfil.fullName}, ${perfil.age}`}>
            {perfil.photoUrl && <Image accessibilityIgnoresInvertColors source={{ uri: /^https?:/i.test(perfil.photoUrl) ? perfil.photoUrl : `${configuracionApi().baseUrl}/${perfil.photoUrl.replace(/^\/+/, '')}` }} style={busqueda.foto} />}
            <Texto secundario>{[perfil.occupation, perfil.city, perfil.zone].filter(Boolean).join(' · ')}</Texto>
            {perfil.compatibilityScore !== null && <Texto>{Math.round(perfil.compatibilityScore)} % compatible</Texto>}
            {(perfil.budgetMin !== null || perfil.budgetMax !== null) && <Texto>{[...new Set([perfil.budgetMin, perfil.budgetMax].filter(Boolean))].map((monto) => moneda.format(Number(monto))).join(' – ')} MXN / mes</Texto>}
            <View style={estilos.fila}>
              <Accion alPulsar={() => setPerfilAbierto(abierto ? null : perfil.userId)} texto={abierto ? 'Cerrar perfil' : 'Ver perfil'} />
              <Accion alPulsar={() => void guardar({ perfiles: guardado ? datos.perfiles.filter((item) => item !== perfil.userId) : [...datos.perfiles, perfil.userId] })} deshabilitada={bloquear} seleccionada={guardado} texto={guardado ? 'Guardado' : 'Guardar perfil'} />
            </View>
            {abierto && <Texto>{perfil.bio || 'Este perfil todavía no tiene una biografía.'}</Texto>}
          </Tarjeta>;
        })}
        <Aviso error>{errorFeed}</Aviso>
        {hayMas && <Accion alPulsar={() => {
          setCargando(true);
          setErrorFeed('');
          if (errorFeed) setIntentoFeed((valor) => valor + 1);
          else setPagina((valor) => valor + 1);
        }} deshabilitada={cargando} texto={errorFeed ? 'Reintentar' : 'Cargar más perfiles'} />}
      </>}
      {pestana === 'habitos' && <>
        <Aviso>Un criterio indispensable excluye a quien no lo cumple o no lo ha informado. Las preferencias influyen en el orden de afinidad.</Aviso>
        {preguntas.map(({ id, options }) => {
          const criterio = habitos[id] ?? { valor: '', prioridad: 'preferencia' };
          return <Tarjeta key={id} titulo={nombres[id as keyof typeof nombres]}>
            <Opciones alCambiar={(valor) => setHabitos({ ...habitos, [id]: { ...criterio, valor } })} opciones={[[ '', 'Sin criterio'], ...options.map((texto, posicion) => [String(posicion * 25), texto] as const)]} valor={criterio.valor} />
            {criterio.valor !== '' && <Opciones alCambiar={(prioridad) => setHabitos({ ...habitos, [id]: { ...criterio, prioridad } })} opciones={prioridades} valor={criterio.prioridad} />}
          </Tarjeta>;
        })}
        <Tarjeta titulo="Vista previa">
          <Texto>{muestra.length} coincidencias entre los perfiles cargados</Texto>
          {muestra.slice(0, 3).map((item) => <Texto key={item.userId} secundario>{item.fullName}</Texto>)}
          <Accion alPulsar={() => { void guardar({ habitos }).then((ok) => { if (ok) setPestana('filtros'); }); }} deshabilitada={bloquear} primaria texto="Aplicar hábitos" />
          <Accion alPulsar={() => setHabitos(datos.habitos)} texto="Cancelar cambios" />
        </Tarjeta>
      </>}
      {pestana === 'guardadas' && <>
        <Tarjeta titulo={edicion ? 'Renombrar búsqueda' : 'Guardar búsqueda actual'}>
          {!edicion && <Resumen {...datos} />}
          <CampoPerfil alCambiar={setNombre} etiqueta="Nombre" maxLength={80} valor={nombre} />
          <Accion alPulsar={() => void guardarBusqueda()} deshabilitada={bloquear || !nombre.trim()} primaria texto={edicion ? 'Guardar nombre' : 'Guardar búsqueda'} />
          {edicion && <Accion alPulsar={() => { setEdicion(null); setNombre(''); }} texto="Cancelar" />}
        </Tarjeta>
        <View style={estilos.fila}>
          <Accion alPulsar={() => setFavoritas(false)} seleccionada={!favoritas} texto="Todas" />
          <Accion alPulsar={() => setFavoritas(true)} seleccionada={favoritas} texto="Favoritas" />
        </View>
        {datos.guardadas.filter((item) => !favoritas || item.favorita).map((item) => <Tarjeta key={item.id} titulo={item.nombre}>
          <Resumen {...item} />
          <Accion alPulsar={() => {
            void guardar({ filtros: item.filtros, habitos: item.habitos }).then((ok) => {
              if (!ok) return;
              setFiltros(item.filtros);
              setHabitos(item.habitos);
              setPestana('filtros');
            });
          }} deshabilitada={bloquear} primaria texto="Ver resultados" />
          <View style={estilos.fila}>
            <Accion alPulsar={() => void guardar({ guardadas: datos.guardadas.map((guardada) => guardada.id === item.id ? { ...item, favorita: !item.favorita } : guardada) })} deshabilitada={bloquear} seleccionada={item.favorita} texto={item.favorita ? '★ Favorita' : '☆ Favorita'} />
            <Accion alPulsar={() => { setEdicion(item.id); setNombre(item.nombre); }} texto="Renombrar" />
            <Accion alPulsar={() => void guardar({ guardadas: datos.guardadas.filter((guardada) => guardada.id !== item.id) })} deshabilitada={bloquear} texto="Eliminar" />
          </View>
        </Tarjeta>)}
        {!datos.guardadas.some((item) => !favoritas || item.favorita) && <Aviso>{favoritas ? 'Aún no tienes búsquedas favoritas.' : 'Aún no tienes búsquedas guardadas.'}</Aviso>}
      </>}
    </PantallaModulo>
  );
}

const busqueda = StyleSheet.create({
  campo: { flexBasis: '46%', flexGrow: 1 },
  foto: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#EEE4F1' },
});
