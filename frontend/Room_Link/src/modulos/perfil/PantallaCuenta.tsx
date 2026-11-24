import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { solicitarRecuperacion } from '@/auth/api-auth';
import { useSesion } from '@/auth/SesionContext';
import { Accion, Aviso, estilos, Opciones, PantallaModulo, Tarjeta, Texto } from '@/modulos/comunes/InterfazModulo';
import { actualizarPreferenciasNotificaciones, obtenerPreferenciasNotificaciones, type PreferenciaNotificacion } from '@/modulos/notificaciones/api';
import {
  consultarPermisoNotificacionesSistema, mostrarNotificacionSistema, solicitarPermisoNotificacionesSistema,
  type EstadoPermisoNotificacion,
} from '@/modulos/notificaciones/permisosSistema';

const alertas = [
  ['new_message', 'Nuevos mensajes'],
  ['agreement_pending', 'Acuerdos de convivencia'],
  ['system', 'Avisos de RoomLink'],
] as const;
const idiomas = [['es-MX', 'Español'], ['en-US', 'Inglés']] as const;
const zonas = [['America/Mexico_City', 'Ciudad de México'], ['America/Tijuana', 'Tijuana'], ['America/Cancun', 'Cancún']] as const;
const inicial = { idioma: 'es-MX', zona: 'America/Mexico_City', visible: true, pausada: false, perfiles: true };
const permisoTexto = { granted: 'Permitidas', denied: 'Denegadas', never_ask_again: 'Bloqueadas en ajustes', undetermined: 'Sin decidir' };

function Interruptor({ texto, activo, cambiar }: { texto: string; activo: boolean; cambiar: (valor: boolean) => void }) {
  return (
    <View style={[estilos.fila, cuenta.fila]}>
      <View style={cuenta.etiqueta}><Texto>{texto}</Texto></View>
      <Switch accessibilityLabel={texto} onValueChange={cambiar} trackColor={{ false: '#D8CDD9', true: '#81638B' }} value={activo} />
    </View>
  );
}

export function PantallaCuenta() {
  const { sesion } = useSesion();
  const router = useRouter();
  const id = sesion?.usuario.id;
  const clave = id ? `@roomlink/account:${id}` : null;
  const [local, setLocal] = useState(inicial);
  const [preferencias, setPreferencias] = useState<PreferenciaNotificacion[] | null>(null);
  const [guardadas, setGuardadas] = useState<PreferenciaNotificacion[] | null>(null);
  const [permiso, setPermiso] = useState<EstadoPermisoNotificacion>('undetermined');
  const [ocupada, setOcupada] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!clave) return;
    let activo = true;
    void Promise.allSettled([
      AsyncStorage.getItem(clave),
      obtenerPreferenciasNotificaciones(),
      consultarPermisoNotificacionesSistema(),
    ]).then(([ajustes, remotas, sistema]) => {
      if (!activo) return;
      if (ajustes.status === 'fulfilled' && ajustes.value) {
        try { setLocal({ ...inicial, ...JSON.parse(ajustes.value) }); } catch { setLocal(inicial); }
      }
      if (remotas.status === 'fulfilled') {
        setPreferencias(remotas.value.preferences);
        setGuardadas(remotas.value.preferences);
      } else {
        setError('No pudimos cargar las preferencias de notificación.');
      }
      if (sistema.status === 'fulfilled') setPermiso(sistema.value);
      setCargando(false);
    });
    return () => { activo = false; };
  }, [clave, intento]);

  async function ejecutar(operacion: () => Promise<string>) {
    setOcupada(true);
    setError('');
    setAviso('');
    try { setAviso(await operacion()); }
    catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudo completar la operación.'); }
    finally { setOcupada(false); }
  }

  return (
    <PantallaModulo detalle="Gestiona tu cuenta y elige los avisos que quieres recibir." titulo="Cuenta y notificaciones" volver="/perfil">
      {cargando ? <Aviso>Cargando preferencias…</Aviso> : <>
        <Tarjeta titulo="Preferencias de cuenta">
          <Texto>Idioma preferido</Texto>
          <Opciones alCambiar={(idioma) => setLocal({ ...local, idioma })} opciones={idiomas} valor={local.idioma as typeof idiomas[number][0]} />
          <Texto>Zona horaria preferida</Texto>
          <Opciones alCambiar={(zona) => setLocal({ ...local, zona })} opciones={zonas} valor={local.zona as typeof zonas[number][0]} />
          <Interruptor activo={local.visible} cambiar={(visible) => setLocal({ ...local, visible })} texto="Mostrar mi perfil en búsquedas" />
          <Interruptor activo={local.pausada} cambiar={(pausada) => setLocal({ ...local, pausada })} texto="Pausar mi búsqueda de roomies" />
          <Texto secundario>Estas preferencias se guardan en este dispositivo. El servicio de búsqueda aún no aplica los ajustes de visibilidad.</Texto>
        </Tarjeta>
        <Tarjeta titulo="Notificaciones">
          {alertas.map(([tipo, texto]) => {
            const preferencia = preferencias?.find(({ type }) => type === tipo);
            if (!preferencia) return null;
            return <Interruptor activo={preferencia.inApp} cambiar={(inApp) => setPreferencias((actuales) => actuales?.map((item) => item.type === tipo ? { ...item, inApp } : item) ?? null)} key={tipo} texto={texto} />;
          })}
          {!preferencias && <Accion alPulsar={() => { setCargando(true); setError(''); setIntento((valor) => valor + 1); }} texto="Volver a cargar preferencias" />}
          <Interruptor activo={local.perfiles} cambiar={(perfiles) => setLocal({ ...local, perfiles })} texto="Perfiles compatibles (preferencia local)" />
          <Accion alPulsar={() => {
            if (!clave) return;
            void ejecutar(async () => {
              const cambios = preferencias?.filter(({ type, inApp }) => guardadas?.find((item) => item.type === type)?.inApp !== inApp) ?? [];
              if (cambios.length) await actualizarPreferenciasNotificaciones(cambios);
              setGuardadas(preferencias);
              await AsyncStorage.setItem(clave, JSON.stringify(local));
              return 'Preferencias guardadas.';
            });
          }} deshabilitada={ocupada} primaria texto={ocupada ? 'Procesando…' : 'Guardar preferencias'} />
        </Tarjeta>
      </>}
      <Tarjeta titulo="Permiso del dispositivo">
        <Texto>Notificaciones {permisoTexto[permiso].toLowerCase()}.</Texto>
        <Accion alPulsar={() => void ejecutar(async () => {
          const siguiente = await solicitarPermisoNotificacionesSistema();
          setPermiso(siguiente);
          if (siguiente !== 'granted') return 'Revisa el permiso en los ajustes del dispositivo.';
          const mostrado = await mostrarNotificacionSistema({ title: 'RoomLink', body: 'Notificación de prueba' });
          return mostrado ? 'Notificación de prueba enviada.' : 'Este dispositivo no pudo mostrar la notificación de prueba.';
        })} deshabilitada={ocupada} texto={permiso === 'granted' ? 'Enviar aviso de prueba' : 'Solicitar permiso'} />
        <Accion alPulsar={() => router.push('/notificaciones')} texto="Abrir centro de notificaciones" />
      </Tarjeta>
      <Tarjeta titulo="Seguridad de la cuenta">
        <Texto>{sesion?.usuario.email}</Texto>
        <Accion alPulsar={() => {
          if (sesion?.usuario.email) void ejecutar(() => solicitarRecuperacion(sesion.usuario.email));
        }} deshabilitada={ocupada || !sesion?.usuario.email} texto="Cambiar contraseña" />
      </Tarjeta>
      <Aviso error>{error}</Aviso>
      <Aviso>{aviso}</Aviso>
    </PantallaModulo>
  );
}

const cuenta = StyleSheet.create({
  fila: { justifyContent: 'space-between', flexWrap: 'nowrap' },
  etiqueta: { flex: 1 },
});
