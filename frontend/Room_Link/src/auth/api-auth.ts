import { solicitud } from '@/modulos/compatibilidad/api';
import {
  cargarSesionPersistida,
  guardarSesion,
  limpiarSesion,
  obtenerSesion,
  obtenerToken,
  type Sesion,
  type UsuarioSesion,
} from './sesion';

interface RespuestaLogin {
  token: string;
  user: UsuarioSesion;
}

interface RespuestaMensaje {
  message?: string;
}

/** Registro de cuenta (HU-01 / EL-01.7). */
export async function registrar(email: string, password: string): Promise<string> {
  const r = await solicitud<RespuestaMensaje>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, termsAccepted: true }),
  });
  return r.message ?? 'Cuenta creada correctamente.';
}

/** Inicio de sesión: guarda token + usuario en la sesión persistida. */
export async function iniciarSesion(email: string, password: string): Promise<Sesion> {
  const r = await solicitud<RespuestaLogin>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const sesion: Sesion = { token: r.token, usuario: r.user };
  await guardarSesion(sesion);
  return sesion;
}

export async function iniciarSesionGoogle(idToken: string, termsAccepted: boolean): Promise<void> {
  const { token, user } = await solicitud<RespuestaLogin>('/api/v1/auth/oauth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken, termsAccepted }),
  });
  await guardarSesion({ token, usuario: user });
}

/** Solicita el enlace de recuperación (HU-01 / EL-01.8). */
export async function solicitarRecuperacion(email: string): Promise<string> {
  const r = await solicitud<RespuestaMensaje>('/api/v1/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return r.message ?? 'Si el correo existe, te enviamos un enlace de recuperación.';
}

/** Restablece la contraseña con el token del enlace. */
export async function restablecerPassword(token: string, password: string): Promise<string> {
  const r = await solicitud<RespuestaMensaje>('/api/v1/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
  return r.message ?? 'Contraseña actualizada. Ya podés iniciar sesión.';
}

/** Cierra la sesión (intenta invalidar en el backend; siempre limpia local). */
export async function cerrarSesion(): Promise<void> {
  try {
    if (obtenerToken()) {
      await solicitud('/api/v1/auth/logout', { method: 'POST' });
    }
  } catch {
    // Aunque falle el backend, limpiamos la sesión local.
  }
  await limpiarSesion();
}

export { cargarSesionPersistida };

/**
 * Registro exhaustivo de arrendador (RNF-03.4): solicita el rol `host` al
 * backend (tras aceptar términos; el backend valida la verificación de
 * identidad) y actualiza los roles en la sesión local para que la app
 * desbloquee las pantallas de arrendador.
 */
export async function convertirseEnArrendador(
  aceptaTerminos: boolean,
): Promise<string[]> {
  const r = await solicitud<{ roles: string[] }>('/api/v1/auth/become-host', {
    method: 'POST',
    body: JSON.stringify({ acceptedTerms: aceptaTerminos }),
  });
  const actual = obtenerSesion();
  if (actual) {
    await guardarSesion({
      ...actual,
      usuario: { ...actual.usuario, roles: r.roles },
    });
  }
  return r.roles;
}
