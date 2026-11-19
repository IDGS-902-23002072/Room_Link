import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory } from 'expo-file-system';
import { createURL } from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Share, Switch, View } from 'react-native';

import { useSesion } from '@/auth/SesionContext';
import { obtenerMisPublicaciones, type PublicacionBD } from '@/modulos/anuncios/api';
import { Accion, Aviso, estilos, Opciones, PantallaModulo, Tarjeta, Texto } from '@/modulos/comunes/InterfazModulo';
import { solicitud } from '@/modulos/compatibilidad/api';
import { CampoPerfil } from '@/modulos/perfil/componentes/CampoPerfil';
import {
  aceptarAcuerdoConvivencia, crearAcuerdoConvivencia, crearNuevaVersionAcuerdo,
  listarAcuerdosAnuncio, listarAcuerdosUsuario, obtenerAcuerdo, type AcuerdoDto,
} from './api';

const pestanas = [['vigentes', 'Vigentes'], ['crear', 'Crear acuerdo'], ['revisar', 'Revisar y aceptar']] as const;
const categorias = [['limpieza', 'Limpieza'], ['pagos', 'Pagos'], ['visitas', 'Visitas'], ['ruido', 'Ruido']] as const;
type Categoria = typeof categorias[number][0];
type Borrador = {
  nombre: string;
  inicio: string;
  anuncioId: string;
  roomieId: string;
  normas: Partial<Record<Categoria, { titulo: string; texto: string }>>;
};
type Postulacion = { applicantId: string; status: string };
const inicial: Borrador = { nombre: '', inicio: '', anuncioId: '', roomieId: '', normas: {} };
const formato = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function titulo(item: AcuerdoDto) {
  return typeof item.rulesSnapshot.listingTitle === 'string' ? item.rulesSnapshot.listingTitle : 'Acuerdo de convivencia';
}

function fecha(valor: string | null | undefined) {
  return valor ? formato.format(new Date(valor)) : '';
}

function participantes(item: AcuerdoDto) {
  return [...new Set([item.hostId, ...item.roomieIds])];
}

function reglas(item: AcuerdoDto): [string, string][] {
  const datos = item.rulesSnapshot;
  const costos = Array.isArray(datos.costs) ? datos.costs.flatMap((costo: { concept?: string; amount?: number }) =>
    typeof costo.amount === 'number' ? [`${costo.concept || 'Cargo'} · ${dinero.format(costo.amount)}`] : []).join('\n') : '';
  const texto = (clave: string) => typeof datos[clave] === 'string' ? datos[clave] as string : '';
  const permiso = (clave: string) => typeof datos[clave] === 'boolean' ? datos[clave] ? 'Permitido' : 'No permitido' : '';
  const filas: [string, string][] = [
    ['Limpieza y espacios comunes', texto('commonAreasNotes')], ['Renta y servicios', costos],
    ['Visitas', texto('visitsPolicy')], ['Horario de silencio', [texto('quietHoursStart'), texto('quietHoursEnd')].filter(Boolean).join(' – ')],
    ['Fiestas', permiso('partiesAllowed')], ['Mascotas', permiso('petsAllowed')],
    ['Tabaco', permiso('smokingAllowed')], ['Otras normas', texto('extraRules')],
  ];
  return filas.filter(([, contenido]) => contenido);
}

function versionesPorHogar(acuerdos: AcuerdoDto[]) {
  const grupos = new Map<string, { vigente?: AcuerdoDto; pendiente?: AcuerdoDto }>();
  for (const item of acuerdos) {
    const clave = JSON.stringify([item.listingId, item.hostId, [...item.roomieIds].sort()]);
    const grupo = grupos.get(clave) ?? {};
    const estado = item.fullyAccepted ? 'vigente' : 'pendiente';
    if (!grupo[estado] || item.version > grupo[estado].version) grupo[estado] = item;
    grupos.set(clave, grupo);
  }
  return [...grupos.values()].map(({ vigente, pendiente }) => ({
    vigente, pendiente: pendiente && (!vigente || pendiente.version > vigente.version) ? pendiente : undefined,
  }));
}

async function nombresDe(ids: string[]) {
  const resultados = await Promise.all([...new Set(ids)].map(async (id) => {
    try {
      const perfil = await solicitud<{ fullName: string }>(`/api/v1/profiles/${encodeURIComponent(id)}`);
      return [id, perfil.fullName] as const;
    } catch { return [id, ''] as const; }
  }));
  return Object.fromEntries(resultados);
}

async function guardarDocumento(contenido: string, version: number) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/plain;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `acuerdo-v${version}.txt`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'Documento preparado.';
  }
  const carpeta = await Directory.pickDirectoryAsync();
  carpeta.createFile(`acuerdo-v${version}-${Date.now()}.txt`, 'text/plain').write(contenido);
  return 'Documento guardado.';
}

export function PantallaAcuerdos() {
  const { sesion } = useSesion();
  const { acuerdo } = useLocalSearchParams<{ acuerdo?: string }>();
  if (!sesion) return null;
  return <Acuerdos acuerdoInicial={acuerdo} key={sesion.usuario.id} usuarioId={sesion.usuario.id} />;
}

function Acuerdos({ usuarioId, acuerdoInicial }: { usuarioId: string; acuerdoInicial?: string }) {
  const clave = `@roomlink/agreement-draft:${usuarioId}`;
  const [pestana, setPestana] = useState<typeof pestanas[number][0]>(acuerdoInicial ? 'revisar' : 'vigentes');
  const [acuerdos, setAcuerdos] = useState<AcuerdoDto[]>([]);
  const [anuncios, setAnuncios] = useState<PublicacionBD[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [borrador, setBorrador] = useState(inicial);
  const [categoria, setCategoria] = useState<Categoria>('limpieza');
  const [postulantes, setPostulantes] = useState<string[]>([]);
  const [cargandoRoomies, setCargandoRoomies] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [todos, setTodos] = useState(false);
  const [detalleId, setDetalleId] = useState('');
  const [revisionId, setRevisionId] = useState(acuerdoInicial ?? '');
  const [codigo, setCodigo] = useState('');
  const [cambio, setCambio] = useState<string | null>(null);
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [intento, setIntento] = useState(0);
  const [borradorListo, setBorradorListo] = useState(false);

  function abrirRevision(id: string) {
    setRevisionId(id);
    setAcepto(false);
    setCambio(null);
    setPestana('revisar');
  }

  useEffect(() => {
    let activo = true;
    void AsyncStorage.getItem(clave).then((texto) => {
      if (activo && texto) setBorrador({ ...inicial, ...JSON.parse(texto) });
    }).catch(() => { if (activo) setError('No pudimos recuperar el borrador local.'); })
      .finally(() => { if (activo) setBorradorListo(true); });
    return () => { activo = false; };
  }, [clave]);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      const [propios, publicaciones] = await Promise.all([listarAcuerdosUsuario(), obtenerMisPublicaciones()]);
      const porAnuncio = await Promise.all(publicaciones.map(({ id }) => listarAcuerdosAnuncio(id)));
      const encontrados = new Map([...propios.items, ...porAnuncio.flatMap(({ items }) => items)]
        .filter((item) => participantes(item).includes(usuarioId)).map((item) => [item.id, item]));
      if (acuerdoInicial && !encontrados.has(acuerdoInicial)) {
        const invitacion = await obtenerAcuerdo(acuerdoInicial);
        if (!participantes(invitacion).includes(usuarioId)) throw new Error('El acuerdo indicado no está disponible para tu cuenta.');
        encontrados.set(invitacion.id, invitacion);
      }
      const lista = [...encontrados.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const personas = await nombresDe(lista.flatMap(participantes));
      if (!activo) return;
      setAnuncios(publicaciones);
      setAcuerdos(lista);
      setNombres((previos) => ({ ...previos, ...personas }));
      if (acuerdoInicial) abrirRevision(acuerdoInicial);
    }
    void cargar().catch((causa: Error) => { if (activo) setError(causa.message); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [acuerdoInicial, intento, usuarioId]);

  useEffect(() => {
    if (!borrador.anuncioId) return;
    let activo = true;
    const ruta = `/api/v1/applications/listing/${encodeURIComponent(borrador.anuncioId)}`;
    void solicitud<Postulacion[]>(ruta).then(async (items) => {
      const ids = items.filter((item) => item.status === 'accepted').map((item) => item.applicantId);
      const personas = await nombresDe(ids);
      if (!activo) return;
      setPostulantes(ids);
      setNombres((previos) => ({ ...previos, ...personas }));
    }).catch((causa: Error) => { if (activo) setError(causa.message); })
      .finally(() => { if (activo) setCargandoRoomies(false); });
    return () => { activo = false; };
  }, [borrador.anuncioId]);

  const grupos = versionesPorHogar(acuerdos);
  const vigentes = grupos.flatMap(({ vigente }) => vigente ? [vigente] : []);
  const pendientes = grupos.flatMap(({ pendiente }) => pendiente ? [pendiente] : []);
  const visibles = todos ? acuerdos : vigentes;
  const detalle = visibles.find((item) => item.id === detalleId) ?? visibles[0];
  const revision = acuerdos.find((item) => item.id === revisionId);
  const norma = borrador.normas[categoria] ?? { titulo: '', texto: '' };

  function agregar(item: AcuerdoDto) {
    setAcuerdos((anteriores) => [item, ...anteriores.filter(({ id }) => id !== item.id)]);
  }

  async function ejecutar(accion: () => Promise<string | void>) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setAviso('');
    try { setAviso(await accion() ?? ''); }
    catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudo completar la operación.'); }
    finally { setOcupado(false); }
  }

  function guardarBorrador(siguiente: Borrador) {
    void ejecutar(async () => {
      await AsyncStorage.setItem(clave, JSON.stringify(siguiente));
      setBorrador(siguiente);
      return 'Borrador guardado en este dispositivo.';
    });
  }

  function etiquetaPersona(id: string, item: AcuerdoDto) {
    return id === usuarioId ? 'Tú' : nombres[id] || (id === item.hostId ? 'Anfitrión' : `Roomie · ${id.slice(0, 8)}`);
  }

  function registro(item: AcuerdoDto) {
    return participantes(item).map((id) => {
      const aceptacion = item.acceptances.find(({ userId }) => userId === id)?.acceptedAt;
      return <Texto key={id}>{etiquetaPersona(id, item)} · {aceptacion ? `Aceptó el ${fecha(aceptacion)}` : 'Pendiente de aceptación'}</Texto>;
    });
  }

  function exportar(item: AcuerdoDto) {
    const contenido = [
      `${titulo(item)} · Versión ${item.version}`, `Creado el ${fecha(item.createdAt)}`,
      ...reglas(item).map(([claveRegla, texto]) => `${claveRegla}\n${texto}`),
      'Registro de aceptación',
      ...participantes(item).map((id) => {
        const aceptacion = item.acceptances.find(({ userId }) => userId === id)?.acceptedAt;
        return `${etiquetaPersona(id, item)}: ${aceptacion ? fecha(aceptacion) : 'Pendiente'}`;
      }),
    ].join('\n\n');
    return guardarDocumento(contenido, item.version);
  }

  function compartir(item: AcuerdoDto, mensaje: string) {
    void ejecutar(async () => {
      const link = createURL('/acuerdos', { queryParams: { acuerdo: item.id } });
      await Share.share({ message: `${mensaje}\n${link}\nCódigo de revisión: ${item.id}` });
    });
  }

  function verReglas(item: AcuerdoDto) {
    const contenido = reglas(item);
    return <Tarjeta titulo={`${titulo(item)} · Versión ${item.version}`}>
      <Texto secundario>Creado el {fecha(item.createdAt)}</Texto>
      {contenido.length ? contenido.map(([claveRegla, texto]) => <View key={claveRegla}><Texto>{claveRegla}</Texto><Texto secundario>{texto}</Texto></View>) : <Texto secundario>Sin normas adicionales.</Texto>}
      <Accion alPulsar={() => void ejecutar(() => exportar(item))} deshabilitada={ocupado} texto="Descargar documento" />
    </Tarjeta>;
  }

  return (
    <PantallaModulo detalle="Redacta, revisa y consulta los compromisos de convivencia de tu hogar." titulo="Acuerdos de convivencia" volver="/perfil">
      <Opciones alCambiar={setPestana} opciones={pestanas} valor={pestana} />
      <Aviso error>{error}</Aviso>
      <Aviso>{aviso}</Aviso>
      {cargando && <Aviso>Cargando acuerdos…</Aviso>}
      {!cargando && error && <Accion alPulsar={() => { setError(''); setCargando(true); setIntento((valor) => valor + 1); }} texto="Actualizar datos" />}

      {pestana === 'crear' && <>
        <Tarjeta titulo="Información del acuerdo">
          <CampoPerfil alCambiar={(nombre) => setBorrador({ ...borrador, nombre })} etiqueta="Nombre del borrador" maxLength={160} valor={borrador.nombre} />
          <CampoPerfil alCambiar={(inicio) => setBorrador({ ...borrador, inicio })} etiqueta="Inicio propuesto" placeholder="AAAA-MM-DD" maxLength={10} valor={borrador.inicio} />
          <Texto>Anuncio del hogar</Texto>
          <Opciones alCambiar={(anuncioId) => {
            if (anuncioId === borrador.anuncioId) return;
            setPostulantes([]);
            setCargandoRoomies(true);
            setBorrador({ ...borrador, anuncioId, roomieId: '' });
          }} opciones={anuncios.map(({ id, title }) => [id, title] as const)} valor={borrador.anuncioId} />
          {!cargando && !anuncios.length && <Texto secundario>Necesitas un anuncio propio para enviar un acuerdo.</Texto>}
          <Texto>Roomie con solicitud aceptada</Texto>
          <Opciones alCambiar={(roomieId) => setBorrador({ ...borrador, roomieId })} opciones={postulantes.map((id) => [id, nombres[id] || `Roomie · ${id.slice(0, 8)}`] as const)} valor={borrador.roomieId} />
          {cargandoRoomies && <Texto secundario>Cargando postulaciones…</Texto>}
          {!cargandoRoomies && borrador.anuncioId && !postulantes.length && <Texto secundario>Este anuncio todavía no tiene postulaciones aceptadas.</Texto>}
        </Tarjeta>
        <Tarjeta titulo="Normas internas del borrador">
          <Opciones alCambiar={setCategoria} opciones={categorias} valor={categoria} />
          <CampoPerfil alCambiar={(valor) => setBorrador({ ...borrador, normas: { ...borrador.normas, [categoria]: { ...norma, titulo: valor } } })} etiqueta="Título de la norma" maxLength={120} valor={norma.titulo} />
          <CampoPerfil alCambiar={(texto) => setBorrador({ ...borrador, normas: { ...borrador.normas, [categoria]: { ...norma, texto } } })} etiqueta="Descripción y compromisos" maxLength={2000} multiline valor={norma.texto} />
          <Accion alPulsar={() => {
            const normas = { ...borrador.normas };
            delete normas[categoria];
            guardarBorrador({ ...borrador, normas });
          }} deshabilitada={ocupado || !borrador.normas[categoria]} texto="Eliminar norma" />
          <Accion alPulsar={() => guardarBorrador(borrador)} deshabilitada={ocupado || !borradorListo} texto="Guardar borrador" />
        </Tarjeta>
        <Tarjeta titulo="Enviar a revisión">
          <Texto secundario>La versión enviada usa las reglas del anuncio. El nombre, la fecha y las normas que redactes aquí quedan en tu borrador local.</Texto>
          <Accion alPulsar={() => void ejecutar(async () => {
            const { anuncioId, roomieId } = borrador;
            const existentes = await listarAcuerdosAnuncio(anuncioId);
            const anterior = existentes.items.filter((item) => item.hostId === usuarioId && item.roomieIds.length === 1 && item.roomieIds.includes(roomieId)).sort((a, b) => b.version - a.version)[0];
            const item = anterior ?? await crearAcuerdoConvivencia({ listingId: anuncioId, roomieId });
            agregar(item);
            abrirRevision(item.id);
            return anterior ? 'Ya existe un acuerdo para este hogar.' : 'Acuerdo listo para revisión.';
          })} deshabilitada={ocupado || !postulantes.includes(borrador.roomieId)} primaria texto="Enviar reglas del anuncio a revisión" />
        </Tarjeta>
      </>}

      {pestana === 'revisar' && <>
        <Tarjeta titulo="Acuerdos por revisar">
          {pendientes.map((item) => <Accion alPulsar={() => abrirRevision(item.id)} key={item.id} seleccionada={revisionId === item.id} texto={`${titulo(item)} · v${item.version}`} />)}
          {!pendientes.length && !revision && <Texto secundario>Sin acuerdos pendientes. Si te invitaron, abre el enlace o usa el código de revisión.</Texto>}
          <CampoPerfil alCambiar={setCodigo} autoCapitalize="none" etiqueta="Código de revisión" maxLength={80} valor={codigo} />
          <Accion alPulsar={() => void ejecutar(async () => {
            const item = await obtenerAcuerdo(codigo.trim());
            if (!participantes(item).includes(usuarioId)) throw new Error('El acuerdo no está disponible para tu cuenta.');
            const personas = await nombresDe(participantes(item));
            setNombres((previos) => ({ ...previos, ...personas }));
            agregar(item);
            abrirRevision(item.id);
            setCodigo('');
          })} deshabilitada={ocupado || !codigo.trim()} texto="Abrir acuerdo" />
        </Tarjeta>
        {revision && <>
          {verReglas(revision)}
          <Tarjeta titulo="Estado de aceptación">
            <Texto>{revision.fullyAccepted ? 'Aceptado por todos los integrantes' : 'Pendiente de aceptación'}</Texto>
            {registro(revision)}
            {!revision.fullyAccepted && Platform.OS !== 'web' && <Accion alPulsar={() => compartir(revision, `Te comparto el acuerdo «${titulo(revision)}» para revisión.`)} deshabilitada={ocupado} texto="Compartir enlace o recordatorio" />}
          </Tarjeta>
          {!revision.acceptances.some(({ userId, acceptedAt }) => userId === usuarioId && acceptedAt) && <Tarjeta titulo="Tu respuesta">
            <View style={estilos.fila}>
              <Switch accessibilityLabel="He leído y acepto las normas de esta versión" onValueChange={setAcepto} value={acepto} />
              <Texto>He leído y acepto las normas.</Texto>
            </View>
            <Accion alPulsar={() => void ejecutar(async () => {
              agregar(await aceptarAcuerdoConvivencia(revision.id));
              setAcepto(false);
              return 'Aceptación registrada.';
            })} deshabilitada={ocupado || !acepto} primaria texto={`Aceptar versión ${revision.version}`} />
            {Platform.OS !== 'web' && <Accion alPulsar={() => setCambio(cambio === null ? '' : null)} texto={cambio === null ? 'Solicitar un cambio' : 'Cerrar solicitud'} />}
            {cambio !== null && <>
              <CampoPerfil alCambiar={setCambio} etiqueta="Cambio sugerido" maxLength={1000} multiline valor={cambio} />
              <Accion alPulsar={() => compartir(revision, `Propongo este cambio para «${titulo(revision)}»:\n${cambio.trim()}`)} deshabilitada={ocupado || !cambio.trim()} texto="Compartir propuesta" />
            </>}
          </Tarjeta>}
        </>}
      </>}

      {pestana === 'vigentes' && <>
        <Tarjeta titulo="Resumen de tu hogar">
          <Texto>{vigentes.length} vigentes · {pendientes.length} pendientes</Texto>
          <View style={estilos.fila}>
            <Accion alPulsar={() => setTodos(false)} seleccionada={!todos} texto="Solo vigentes" />
            <Accion alPulsar={() => setTodos(true)} seleccionada={todos} texto="Todas las versiones" />
          </View>
          {visibles.map((item) => <Accion alPulsar={() => setDetalleId(item.id)} key={item.id} seleccionada={detalle?.id === item.id} texto={`${titulo(item)} · v${item.version}`} />)}
          {!cargando && !visibles.length && <Texto secundario>Aún no hay acuerdos para mostrar.</Texto>}
        </Tarjeta>
        {pendientes.map((item) => <Tarjeta key={item.id} titulo="En revisión">
          <Texto>{titulo(item)} · v{item.version}</Texto>
          <Accion alPulsar={() => abrirRevision(item.id)} texto="Revisar estado" />
        </Tarjeta>)}
        {detalle && <>
          {verReglas(detalle)}
          <Tarjeta titulo="Registro de aceptación">
            {registro(detalle)}
            {detalle.hostId === usuarioId && grupos.some((grupo) => grupo.vigente?.id === detalle.id && !grupo.pendiente) &&
              <Accion alPulsar={() => void ejecutar(async () => {
                const siguiente = await crearNuevaVersionAcuerdo(detalle.id);
                agregar(siguiente);
                abrirRevision(siguiente.id);
                return 'Actualización lista para revisión.';
              })} deshabilitada={ocupado} primaria texto="Crear nueva versión desde el anuncio" />}
          </Tarjeta>
        </>}
      </>}
    </PantallaModulo>
  );
}
