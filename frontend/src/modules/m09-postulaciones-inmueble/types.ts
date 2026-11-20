export type EstadoPostulacion = 'nueva' | 'revision' | 'resuelta';

export interface Postulacion {
  id: string;
  /** Porcentaje de compatibilidad, 0 a 100 */
  compatibilidad: number;
  estado: EstadoPostulacion;
  nombre: string;
  detalle: string;
}

export interface PestanaPostulaciones {
  id: EstadoPostulacion;
  label: string;
  /** Contador que se muestra junto al nombre (opcional) */
  cantidad?: number;
}

export interface DatoCandidato {
  id: string;
  titulo: string;
  detalle: string;
}

export interface PerfilCandidato {
  iniciales: string;
  nombre: string;
  edad: number;
  compatibilidad: number;
  identidadVerificada: boolean;
}

export type AccionDecision = 'aceptar' | 'espera' | 'rechazar';
