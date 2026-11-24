import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE_ALMACEN = 'roomlink.sesion';

export interface UsuarioSesion {
  id: string;
  email: string;
  roles: string[];
  status?: string;
  isEmailVerified?: boolean;
}

export interface Sesion {
  token: string;
  usuario: UsuarioSesion;
}

// Caché en memoria para acceso síncrono (los api.ts leen el userId/token sin await).
let sesionActual: Sesion | null = null;
const oyentes = new Set<() => void>();

function notificar() {
  for (const oyente of oyentes) oyente();
}

/** Suscribe un listener a los cambios de sesión (lo usa el SesionContext). */
export function suscribirSesion(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function obtenerSesion(): Sesion | null {
  return sesionActual;
}

export function obtenerToken(): string | null {
  return sesionActual?.token ?? null;
}

export function obtenerUserId(): string | null {
  return sesionActual?.usuario.id ?? null;
}

/** Carga la sesión persistida al arrancar la app. */
export async function cargarSesionPersistida(): Promise<Sesion | null> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_ALMACEN);
    sesionActual = crudo ? (JSON.parse(crudo) as Sesion) : null;
  } catch {
    sesionActual = null;
  }
  notificar();
  return sesionActual;
}

export async function guardarSesion(sesion: Sesion): Promise<void> {
  sesionActual = sesion;
  try {
    await AsyncStorage.setItem(CLAVE_ALMACEN, JSON.stringify(sesion));
  } catch {
    // Si falla el almacenamiento, la sesión sigue viva en memoria para esta ejecución.
  }
  notificar();
}

export async function limpiarSesion(): Promise<void> {
  sesionActual = null;
  try {
    await AsyncStorage.removeItem(CLAVE_ALMACEN);
  } catch {
    // ignorar
  }
  notificar();
}
