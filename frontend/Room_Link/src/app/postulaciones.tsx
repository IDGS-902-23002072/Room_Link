import { useLocalSearchParams } from 'expo-router';

import PantallaPostulaciones from '@/modulos/postulaciones/PantallaPostulaciones';

export default function RutaPostulaciones() {
  const { listingId, titulo } = useLocalSearchParams<{
    listingId: string;
    titulo: string;
  }>();

  return (
    <PantallaPostulaciones
      listingId={String(listingId ?? '')}
      titulo={String(titulo ?? 'Tu habitación')}
    />
  );
}
