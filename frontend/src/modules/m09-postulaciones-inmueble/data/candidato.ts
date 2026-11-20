import type { DatoCandidato, PerfilCandidato } from '../types';

export const CANDIDATO_SUBTITULO = 'Postulación · Habitación en zona UTL';

export const PERFIL_CANDIDATO: PerfilCandidato = {
  iniciales: 'AR',
  nombre: 'Andrea Ramírez',
  edad: 23,
  compatibilidad: 92,
  identidadVerificada: true,
};

export const DATOS_CANDIDATO: DatoCandidato[] = [
  { id: 'presupuesto', titulo: 'Su presupuesto', detalle: '$3,000 – $4,500 · Renta: $3,500' },
  { id: 'mudanza', titulo: 'Fecha de mudanza', detalle: '1 de noviembre · Estancia de 6 meses' },
];

export const MENSAJE_CANDIDATO =
  '“Hola, me interesa el espacio. Estudio diseño y busco una convivencia tranquila.”';
