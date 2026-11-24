import { useLocalSearchParams } from 'expo-router';

import { PantallaCompatibilidadDetalle } from '@/modulos/compatibilidad/PantallaCompatibilidadDetalle';

export default function RutaCompatibilidadDetalle() {
  const params = useLocalSearchParams<{
    candidateId?: string;
    vista?: 'comparacion' | 'puntos' | 'guardados';
  }>();

  return (
    <PantallaCompatibilidadDetalle
      candidateIdInicial={typeof params.candidateId === 'string' ? params.candidateId : undefined}
      vistaInicial={
        params.vista === 'puntos' || params.vista === 'guardados'
          ? params.vista
          : 'comparacion'
      }
    />
  );
}
