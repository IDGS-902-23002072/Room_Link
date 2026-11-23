import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useSesion } from '@/auth/SesionContext';
import { Accion, Aviso, estilos, Opciones, PantallaModulo, Tarjeta, Texto } from '@/modulos/comunes/InterfazModulo';
import { configuracionApi, solicitud, type DimensionCompatibilidad, type PerfilAfinidad } from '@/modulos/compatibilidad/api';
import { preguntasConvivencia, preguntasHabitos } from '@/modulos/encuesta/datos/preguntas';
import { CampoPerfil } from '@/modulos/perfil/componentes/CampoPerfil';

const pestanas = [['filtros', 'Filtros generales'], ['habitos', 'Hábitos y compatibilidad'], ['guardadas', 'Búsquedas guardadas']] as const;
const ordenes = [['afinidad', 'Afinidad'], ['presupuesto', 'Presupuesto'], ['nombre', 'Nombre']] as const;
const campos = [['presupuestoMin', 'Presupuesto mínimo'], ['presupuestoMax', 'Presupuesto máximo'], ['edadMin', 'Edad mínima'], ['edadMax', 'Edad máxima']] as const;
const filtrosIniciales = { presupuestoMin: '', presupuestoMax: '', edadMin: '', edadMax: '', ciudad: '', zonas: [] as string[] };
const prioridades = [['preferencia', 'Preferencia'], ['indispensable', 'Indispensable']] as const;
const nombres = { noise: 'Ruido y descanso', smoking: 'Consumo de tabaco', cleanliness: 'Limpieza', visits: 'Visitas en casa' };
const preguntas = [...preguntasHabitos, ...preguntasConvivencia].filter(({ id }) => id in nombres);
type Contacto = { phone?: string | null; email?: string | null; instagram?: string | null; facebook?: string | null };
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

function solicitarPerfiles({ filtros, habitos }: Criterios, orden: typeof ordenes[number][0], pagina: number, signal: AbortSignal) {
  const params = new URLSearchParams({
    page: String(pagina), pageSize: '12',
    order: orden === 'nombre' ? 'name' : orden === 'presupuesto' ? 'budget' : 'compatibility',
    budgetMin: filtros.presupuestoMin, budgetMax: filtros.presupuestoMax,
    minAge: filtros.edadMin, maxAge: filtros.edadMax, city: filtros.ciudad,
  });
  for (const zona of filtros.zonas) params.append('zone', zona);
  for (const [dimension, criterio] of Object.entries(habitos)) {
    if (!criterio.valor) continue;
    params.set(dimension, String(Number(criterio.valor) / 25 + 1));
    params.set(`${dimension}Required`, String(criterio.prioridad === 'indispensable'));
  }
  return solicitud<{ items: PerfilAfinidad[]; total: number; totalPages: number }>(`/api/v1/search/profiles?${params}`, { signal });
}

function ContactoPerfil({ usuarioId }: { usuarioId: string }) {
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void solicitud<Contacto>(`/api/v1/profiles/${encodeURIComponent(usuarioId)}`, { signal: controller.signal })
      .then((datos) => { if (!controller.signal.aborted) setContacto(datos); })
      .catch(() => { if (!controller.signal.aborted) setError('No pudimos consultar los datos de contacto.'); });
    return () => controller.abort();
  }, [usuarioId]);
  return <>
    <Aviso error>{error}</Aviso>
    {contacto?.phone && <Texto>Teléfono {contacto.phone}</Texto>}
    {contacto?.email && <Texto>Correo {contacto.email}</Texto>}
    {contacto?.instagram && <Texto>Instagram {contacto.instagram}</Texto>}
    {contacto?.facebook && <Texto>Facebook {contacto.facebook}</Texto>}
  </>;
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
  const [hayMas, setHayMas] = useState(false);
  const [total, setTotal] = useState(0);
  const [catalogo, setCatalogo] = useState<{ name: string; city: string }[]>([]);
  const [errorZonas, setErrorZonas] = useState('');
  const [intentoZonas, setIntentoZonas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [iniciada, setIniciada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errorFeed, setErrorFeed] = useState('');
  const [nombre, setNombre] = useState('');
  const [favoritas, setFavoritas] = useState(false);
  const [edicion, setEdicion] = useState<string | null>(null);
  const [perfilAbierto, setPerfilAbierto] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<{ items: PerfilAfinidad[]; total: number } | null>(null);
  const [errorVistaPrevia, setErrorVistaPrevia] = useState('');

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
    const controller = new AbortController();
    void solicitud<{ name: string; city: string }[]>('/api/v1/search/zones', { signal: controller.signal })
      .then((zonas) => { if (!controller.signal.aborted) setCatalogo(zonas); })
      .catch((causa: Error) => { if (!controller.signal.aborted) setErrorZonas(causa.message); });
    return () => controller.abort();
  }, [intentoZonas]);

  const { filtros: aplicados, habitos: habitosAplicados } = datos;
  useEffect(() => {
    if (!iniciada) return;
    const controller = new AbortController();
    void solicitarPerfiles({ filtros: aplicados, habitos: habitosAplicados }, orden, pagina, controller.signal)
      .then(({ items, total, totalPages }) => {
        if (controller.signal.aborted) return;
        setPerfiles((anteriores) => pagina === 1 ? items : [...anteriores, ...items.filter((item) => !anteriores.some(({ userId }) => userId === item.userId))]);
        setHayMas(pagina < totalPages);
        setTotal(total);
      }).catch((causa: Error) => { if (!controller.signal.aborted) setErrorFeed(causa.message); })
      .finally(() => { if (!controller.signal.aborted) setCargando(false); });
    return () => controller.abort();
  }, [aplicados, habitosAplicados, iniciada, intentoFeed, orden, pagina]);

  useEffect(() => {
    if (!iniciada || pestana !== 'habitos') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void solicitarPerfiles({ filtros: aplicados, habitos }, 'afinidad', 1, controller.signal)
        .then((datos) => {
          if (!controller.signal.aborted) {
            setVistaPrevia(datos);
            setErrorVistaPrevia('');
          }
        })
        .catch((causa: Error) => {
          if (!controller.signal.aborted) {
            setVistaPrevia(null);
            setErrorVistaPrevia(causa.message);
          }
        });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [aplicados, habitos, iniciada, pestana]);

  function reiniciarResultados() {
    setPagina(1);
    setPerfiles([]);
    setTotal(0);
    setHayMas(false);
    setCargando(true);
    setErrorFeed('');
    setIntentoFeed((actual) => actual + 1);
  }

  async function guardar(partes: Partial<Preferencias>) {
    if (guardando || !iniciada) return false;
    const siguiente = { ...datos, ...partes };
    setGuardando(true);
    setError('');
    try {
      await AsyncStorage.setItem(clave, JSON.stringify(siguiente));
      setDatos(siguiente);
      if (partes.filtros || partes.habitos) reiniciarResultados();
      return true;
    } catch {
      setError('No pudimos guardar los cambios en este dispositivo.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  const ciudades = [...new Set([filtros.ciudad, ...catalogo.map(({ city }) => city)])].filter(Boolean).sort();
  const zonas = [...new Set([...filtros.zonas, ...catalogo.filter(({ city }) => !filtros.ciudad || city === filtros.ciudad).map(({ name }) => name)])].sort();
  const resultados = perfiles;
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
          <Aviso error>{errorZonas}</Aviso>
          {errorZonas && <Accion alPulsar={() => { setErrorZonas(''); setIntentoZonas((valor) => valor + 1); }} texto="Reintentar zonas" />}
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
        <Tarjeta titulo={`${total} ${total === 1 ? 'perfil encontrado' : 'perfiles encontrados'}`}>
          <Resumen {...datos} />
          <Opciones alCambiar={(valor) => { if (valor !== orden) { setOrden(valor); reiniciarResultados(); } }} opciones={ordenes} valor={orden} />
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
            {abierto && <>
              <Texto>{perfil.bio || 'Este perfil todavía no tiene una biografía.'}</Texto>
              <ContactoPerfil usuarioId={perfil.userId} />
            </>}
          </Tarjeta>;
        })}
        <Aviso error>{errorFeed}</Aviso>
        {(hayMas || errorFeed) && <Accion alPulsar={() => {
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
          <Aviso error>{errorVistaPrevia}</Aviso>
          {vistaPrevia && <Texto>{vistaPrevia.total} coincidencias</Texto>}
          {vistaPrevia?.items.slice(0, 3).map((item) => <Texto key={item.userId} secundario>{item.fullName}</Texto>)}
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
