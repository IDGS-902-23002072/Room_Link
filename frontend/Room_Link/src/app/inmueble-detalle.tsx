import { useLocalSearchParams } from 'expo-router';

import { PantallaDetalleInmueble } from '@/modulos/inmueble/PantallaDetalleInmueble';

export default function RutaDetalleInmueble() {
  const params = useLocalSearchParams<{
    listingId?: string;
    tab?: 'reglas' | 'costos' | 'zona';
  }>();

  return (
    <PantallaDetalleInmueble
      listingId={typeof params.listingId === 'string' ? params.listingId : ''}
      tabInicial={
        params.tab === 'costos' || params.tab === 'zona' ? params.tab : 'reglas'
      }
    />
  );
}
