import { useSesion } from '@/auth/SesionContext';
import { PantallaAnuncios } from '@/modulos/anuncios/PantallaAnuncios';
import PantallaConvertirseArrendador from '@/modulos/anuncios/PantallaConvertirseArrendador';

export default function RutaAnuncios() {
  const { sesion } = useSesion();
  const roles = sesion?.usuario.roles ?? [];
  const puedeGestionar = roles.includes('host') || roles.includes('admin');

  // Registro exhaustivo de arrendador (RNF-03.4): los roles autorizados ven Mis
  // publicaciones; el resto ve el onboarding para convertirse en arrendador.
  return puedeGestionar ? <PantallaAnuncios /> : <PantallaConvertirseArrendador />;
}
