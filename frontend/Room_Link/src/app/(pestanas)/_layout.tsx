import { Redirect } from 'expo-router';

import { useOnboarding } from '@/auth/useOnboarding';
import NavegacionPestanas from '@/components/navegacion-pestanas';

export default function LayoutPestanas() {
  const { completo, cargando } = useOnboarding();

  // Onboarding obligatorio (bugs #0 y #12): sin perfil + encuesta no se accede
  // a las pestañas; se fuerza el flujo de onboarding.
  if (cargando) return null;
  if (!completo) return <Redirect href="/onboarding" />;

  return <NavegacionPestanas />;
}
