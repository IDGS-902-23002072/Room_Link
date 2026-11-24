import { useSesion } from '@/auth/SesionContext';
import { PantallaAnuncios } from '@/modulos/anuncios/PantallaAnuncios';
import PantallaConvertirseArrendador from '@/modulos/anuncios/PantallaConvertirseArrendador';

export default function RutaAnuncios() {
  const { sesion } = useSesion();
  const esArrendador = sesion?.usuario.roles?.includes('host') ?? false;

  // Registro exhaustivo de arrendador (RNF-03.4): solo los host ven Mis
  // publicaciones; el resto ve el onboarding para convertirse en arrendador.
  return esArrendador ? <PantallaAnuncios /> : <PantallaConvertirseArrendador />;
}
