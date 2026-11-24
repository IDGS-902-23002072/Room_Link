import { useLocalSearchParams } from 'expo-router';

import { useSesion } from '@/auth/SesionContext';
import PantallaPostulaciones from '@/modulos/postulaciones/PantallaPostulaciones';

export default function RutaPostulaciones() {
  const { listingId, titulo } = useLocalSearchParams<{
    listingId: string;
    titulo: string;
  }>();

  const { sesion, cargando } = useSesion();
  if (cargando || !sesion || !listingId) return null;

  return (
    <PantallaPostulaciones
      key={listingId}
      listingId={String(listingId ?? '')}
      titulo={String(titulo ?? 'Tu habitación')}
    />
  );
}
