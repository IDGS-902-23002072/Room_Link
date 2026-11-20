
import { Redirect } from 'expo-router';
import { useSesion } from '@/auth/SesionContext';

export default function Inicio() {
  const { sesion, cargando } = useSesion();

  if (cargando) return null;

  if (!sesion) {
    return <Redirect href="/(auth)/login" />;
  }

  const roles = sesion.usuario.roles ?? [];

  if (roles.includes('admin')) {
    return <Redirect href="/moderacion" />;
  }

  if (roles.includes('host')) {
    return <Redirect href="/anuncios" />;
  }

  if (roles.includes('seeker')) {
    return <Redirect href="/explorar" />;
  }

  return <Redirect href="/(auth)/login" />;
}
