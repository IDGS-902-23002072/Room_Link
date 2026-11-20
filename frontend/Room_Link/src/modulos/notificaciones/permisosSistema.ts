import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Vibration } from 'react-native';

import {
  listarNotificaciones,
  type NotificacionDto,
} from './api';

const CLAVE_PERMISO_NOTIF = 'roomlink.notificaciones.permiso';
const CLAVE_IDS_MOSTRADAS = 'roomlink.notificaciones.mostradas';

export type EstadoPermisoNotificacion =
  | 'granted'
  | 'denied'
  | 'never_ask_again'
  | 'undetermined';

interface ModuloExpoNotifications {
  getPermissionsAsync?: () => Promise<{
    status?: string;
    granted?: boolean;
  }>;
  requestPermissionsAsync?: () => Promise<{
    status?: string;
    granted?: boolean;
  }>;
  setNotificationChannelAsync?: (
    channelId: string,
    channel: {
      name: string;
      importance?: number;
      vibrationPattern?: number[];
      lightColor?: string;
    },
  ) => Promise<unknown>;
  scheduleNotificationAsync?: (request: {
    content: {
      title: string;
      body?: string;
      data?: Record<string, unknown>;
      sound?: boolean;
    };
    trigger: null;
  }) => Promise<string>;
}

/**
 * Carga dinámica segura de `expo-notifications` si está instalado en el build
 * nativo, con fallback directo a `PermissionsAndroid` (POST_NOTIFICATIONS API 33+)
 * y Notification Web API.
 */
function obtenerModuloExpoNotifications(): ModuloExpoNotifications | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as ModuloExpoNotifications;
  } catch {
    return null;
  }
}

const PERMISO_ANDROID_POST_NOTIFICATIONS =
  PermissionsAndroid?.PERMISSIONS?.POST_NOTIFICATIONS ??
  'android.permission.POST_NOTIFICATIONS';

/**
 * Configura el canal de notificaciones de sistema en Android 8.0+ (Oreo y superior).
 */
export async function configurarCanalAndroid(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const expoNotif = obtenerModuloExpoNotifications();
  if (expoNotif?.setNotificationChannelAsync) {
    await expoNotif
      .setNotificationChannelAsync('roomlink-default', {
        name: 'Avisos de RoomLink',
        importance: 4, // HIGH
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#81638B',
      })
      .catch(() => undefined);
  }
}

/**
 * Consulta el estado actual del permiso de notificaciones a nivel de sistema
 * (Android 13+ `POST_NOTIFICATIONS`, iOS o navegador Web).
 */
export async function consultarPermisoNotificacionesSistema(): Promise<EstadoPermisoNotificacion> {
  if (Platform.OS === 'android') {
    const versionApi =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : Number(Platform.Version);

    // En Android < 13 (API < 33) el permiso POST_NOTIFICATIONS se otorga al instalar
    if (!Number.isNaN(versionApi) && versionApi < 33) {
      return 'granted';
    }

    try {
      const concedido = await PermissionsAndroid.check(
        PERMISO_ANDROID_POST_NOTIFICATIONS,
      );
      if (concedido) return 'granted';
    } catch {
      // Continuar con fallback
    }
  }

  const expoNotif = obtenerModuloExpoNotifications();
  if (expoNotif?.getPermissionsAsync) {
    try {
      const res = await expoNotif.getPermissionsAsync();
      if (res.granted || res.status === 'granted') return 'granted';
      if (res.status === 'denied') return 'denied';
    } catch {
      // ignorar
    }
  }

  if (
    Platform.OS === 'web' &&
    typeof globalThis !== 'undefined' &&
    'Notification' in globalThis
  ) {
    const perm = (globalThis as unknown as { Notification: { permission: string } })
      .Notification.permission;
    if (perm === 'granted') return 'granted';
    if (perm === 'denied') return 'denied';
    return 'undetermined';
  }

  const guardado = await AsyncStorage.getItem(CLAVE_PERMISO_NOTIF).catch(
    () => null,
  );
  if (
    guardado === 'granted' ||
    guardado === 'denied' ||
    guardado === 'never_ask_again'
  ) {
    return guardado;
  }

  return 'undetermined';
}

/**
 * Solicita explícitamente al usuario el permiso de notificaciones del sistema
 * (`android.permission.POST_NOTIFICATIONS` en Android 13+, con diálogo racional).
 */
export async function solicitarPermisoNotificacionesSistema(): Promise<EstadoPermisoNotificacion> {
  await configurarCanalAndroid();

  if (Platform.OS === 'android') {
    const versionApi =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : Number(Platform.Version);

    if (!Number.isNaN(versionApi) && versionApi < 33) {
      await AsyncStorage.setItem(CLAVE_PERMISO_NOTIF, 'granted').catch(
        () => undefined,
      );
      return 'granted';
    }

    try {
      const resultado = await PermissionsAndroid.request(
        PERMISO_ANDROID_POST_NOTIFICATIONS,
        {
          title: 'Permiso de notificaciones de RoomLink',
          message:
            'RoomLink necesita permiso para mostrarte alertas de nuevos mensajes, solicitudes de conexión y acuerdos de convivencia en tu dispositivo Android.',
          buttonNeutral: 'Preguntar luego',
          buttonNegative: 'Rechazar',
          buttonPositive: 'Permitir',
        },
      );

      const estado: EstadoPermisoNotificacion =
        resultado === PermissionsAndroid.RESULTS.GRANTED
          ? 'granted'
          : resultado === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
            ? 'never_ask_again'
            : 'denied';

      await AsyncStorage.setItem(CLAVE_PERMISO_NOTIF, estado).catch(
        () => undefined,
      );
      return estado;
    } catch {
      // Si falla PermissionsAndroid, intentar vía expo-notifications si existe
    }
  }

  const expoNotif = obtenerModuloExpoNotifications();
  if (expoNotif?.requestPermissionsAsync) {
    try {
      const res = await expoNotif.requestPermissionsAsync();
      const estado: EstadoPermisoNotificacion =
        res.granted || res.status === 'granted' ? 'granted' : 'denied';
      await AsyncStorage.setItem(CLAVE_PERMISO_NOTIF, estado).catch(
        () => undefined,
      );
      return estado;
    } catch {
      // continuar
    }
  }

  if (
    Platform.OS === 'web' &&
    typeof globalThis !== 'undefined' &&
    'Notification' in globalThis
  ) {
    try {
      const WebNotification = (
        globalThis as unknown as {
          Notification: {
            requestPermission: () => Promise<string>;
          };
        }
      ).Notification;
      const perm = await WebNotification.requestPermission();
      const estado: EstadoPermisoNotificacion =
        perm === 'granted' ? 'granted' : 'denied';
      await AsyncStorage.setItem(CLAVE_PERMISO_NOTIF, estado).catch(
        () => undefined,
      );
      return estado;
    } catch {
      return 'denied';
    }
  }

  return 'denied';
}

/**
 * Emite una notificación local a nivel de sistema operativo (Android / Web / iOS)
 * cuando el permiso está concedido.
 */
export async function mostrarNotificacionSistema(input: {
  id?: string;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
}): Promise<boolean> {
  const permiso = await consultarPermisoNotificacionesSistema();
  if (permiso !== 'granted') return false;

  const expoNotif = obtenerModuloExpoNotifications();
  if (expoNotif?.scheduleNotificationAsync) {
    try {
      await expoNotif.scheduleNotificationAsync({
        content: {
          title: input.title,
          body: input.body ?? undefined,
          data: input.payload ?? {},
          sound: true,
        },
        trigger: null,
      });
      return true;
    } catch {
      // Fallback
    }
  }

  if (
    Platform.OS === 'web' &&
    typeof globalThis !== 'undefined' &&
    'Notification' in globalThis
  ) {
    try {
      const WebNotification = (
        globalThis as unknown as {
          Notification: new (
            title: string,
            options?: { body?: string; tag?: string },
          ) => unknown;
        }
      ).Notification;
      new WebNotification(input.title, {
        body: input.body ?? undefined,
        tag: input.id,
      });
      return true;
    } catch {
      return false;
    }
  }

  if (Platform.OS === 'android') {
    try {
      Vibration.vibrate(200);
    } catch {
      // ignorar si no hay vibrador
    }
    return true;
  }

  return false;
}

async function leerIdsMostradas(): Promise<Set<string>> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_IDS_MOSTRADAS);
    if (!crudo) return new Set();
    const arr = JSON.parse(crudo) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function guardarIdsMostradas(ids: Set<string>): Promise<void> {
  try {
    const recortadas = [...ids].slice(-200);
    await AsyncStorage.setItem(
      CLAVE_IDS_MOSTRADAS,
      JSON.stringify(recortadas),
    );
  } catch {
    // ignorar
  }
}

/**
 * Sincroniza las notificaciones no leídas del backend con la bandeja del sistema
 * Android / Web, disparando una notificación nativa por cada aviso nuevo que
 * no haya sido notificado aún en este dispositivo.
 */
export async function sincronizarNotificacionesSistema(
  onNuevaNotificacion?: (nuevas: NotificacionDto[], unreadCount: number) => void,
): Promise<void> {
  const permiso = await consultarPermisoNotificacionesSistema();
  if (permiso !== 'granted') return;

  try {
    const res = await listarNotificaciones({ unreadOnly: true, limit: 20 });
    const mostradas = await leerIdsMostradas();
    const nuevas: NotificacionDto[] = [];

    for (const item of res.items) {
      if (!mostradas.has(item.id)) {
        mostradas.add(item.id);
        nuevas.push(item);
        await mostrarNotificacionSistema({
          id: item.id,
          title: item.title,
          body: item.body,
          payload: item.payload,
        });
      }
    }

    if (nuevas.length > 0) {
      await guardarIdsMostradas(mostradas);
    }

    onNuevaNotificacion?.(nuevas, res.unreadCount);
  } catch {
    // Silenciar errores de red durante el sondeo en segundo plano
  }
}
