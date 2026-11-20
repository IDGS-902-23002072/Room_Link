import type { PestanaPostulaciones, Postulacion } from '../types';

export const POSTULACIONES_SUBTITULO = 'Habitación en zona UTL · 5 postulaciones';

export const PESTANAS_POSTULACIONES: PestanaPostulaciones[] = [
  { id: 'nueva', label: 'Nuevas', cantidad: 3 },
  { id: 'revision', label: 'En revisión', cantidad: 2 },
  { id: 'resuelta', label: 'Resueltas' },
];

export const POSTULACIONES: Postulacion[] = [
  {
    id: 'p1',
    compatibilidad: 92,
    estado: 'nueva',
    nombre: 'Andrea Ramírez',
    detalle: 'Estudiante · Mudanza en noviembre',
  },
  {
    id: 'p2',
    compatibilidad: 88,
    estado: 'nueva',
    nombre: 'Diego Martínez',
    detalle: 'Profesionista · Mudanza flexible',
  },
  {
    id: 'p3',
    compatibilidad: 85,
    estado: 'revision',
    nombre: 'Sofía López',
    detalle: 'Estudiante · Presupuesto confirmado',
  },
];

export const ETIQUETA_ESTADO: Record<Postulacion['estado'], string> = {
  nueva: 'NUEVA',
  revision: 'EN REVISIÓN',
  resuelta: 'RESUELTA',
};
