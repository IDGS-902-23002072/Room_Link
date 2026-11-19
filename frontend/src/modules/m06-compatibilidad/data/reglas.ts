import type { GrupoRegla } from '../../../navigation/types';

export const GRUPOS_REGLAS: GrupoRegla[] = [
  {
    id: 'visitas',
    titulo: 'Visitas',
    opciones: [
      { id: 'hasta22', label: 'Hasta las 22 h' },
      { id: 'convenir', label: 'A convenir' },
    ],
    seleccionInicial: 'hasta22',
  },
  {
    id: 'areasComunes',
    titulo: 'Áreas comunes',
    opciones: [
      { id: 'semanal', label: 'Limpieza semanal' },
      { id: 'turnos', label: 'Por turnos' },
    ],
    seleccionInicial: 'semanal',
  },
  {
    id: 'mascotas',
    titulo: 'Mascotas',
    opciones: [
      { id: 'permitidas', label: 'Permitidas' },
      { id: 'noPermitidas', label: 'No permitidas' },
    ],
    seleccionInicial: 'permitidas',
  },
];

export const REGLAS_ADICIONALES_INICIAL = 'Respetar el descanso después de las 23 h.';
