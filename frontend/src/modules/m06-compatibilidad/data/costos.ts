import type { ConceptoCosto } from '../../../navigation/types';

export const COSTOS_SUBTITULO = 'Habitación en zona UTL · MXN';

export const CONCEPTOS_COSTO: ConceptoCosto[] = [
  { id: 'renta', etiqueta: 'Renta mensual', valor: '$3,500' },
  { id: 'servicios', etiqueta: 'Servicios incluidos', valor: 'Agua e internet' },
  {
    id: 'deposito',
    etiqueta: 'Depósito de garantía',
    valor: '$3,500 · Reembolsable según acuerdo',
    destacado: true,
  },
  { id: 'mantenimiento', etiqueta: 'Mantenimiento mensual', valor: '$200', destacado: true },
];

export const TOTAL_MENSUAL = '$3,700';
export const TOTAL_DETALLE = 'Al ingresar: $7,200 con depósito. Luz según consumo.';
