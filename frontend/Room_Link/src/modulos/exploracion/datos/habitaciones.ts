import type { HabitacionDetalle, HabitacionResumen } from '../api';

/** Modelo de presentación de una habitación del feed. */
export type HabitacionFeed = {
  id: string;
  hostId: string;
  anfitrion: string | null;
  ubicacion?: string;
  titulo: string;
  renta: number;
  rentaTexto: string;
  disponibleDesde: string | null;
  disponibleYa: boolean;
  fotos: number;
  fotosDetalle?: HabitacionDetalle['photos'];
  descripcion: string | null;
  maxCompaneros: number | null;
  /** Afinidad (0-100) entre el buscador y el anfitrión; null si no hay test o perfil. */
  compatibilidad: number | null;
};

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export function formatearRenta(monto: number) {
  const entero = String(Math.round(monto)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${entero} MXN/mes`;
}

/** Convierte 'YYYY-MM-DD' a '14 nov 2026' sin depender de la zona horaria. */
function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return fecha;
  return `${dia} ${MESES[mes - 1] ?? ''} ${anio}`;
}

function estaDisponibleYa(fecha: string | null) {
  if (!fecha) return true;
  const hoy = new Date();
  const hoyTexto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
    hoy.getDate(),
  ).padStart(2, '0')}`;
  return fecha <= hoyTexto;
}

export function adaptarHabitacion(
  habitacion: HabitacionResumen | HabitacionDetalle,
): HabitacionFeed {
  const detalle = habitacion as Partial<HabitacionDetalle>;
  return {
    id: habitacion.id,
    hostId: habitacion.hostId,
    anfitrion: habitacion.hostName ?? null,
    ubicacion: [habitacion.zone, habitacion.city].filter(Boolean).join(' · '),
    titulo: habitacion.title.trim() || 'Habitación sin título',
    renta: habitacion.monthlyRent,
    rentaTexto: formatearRenta(habitacion.monthlyRent),
    disponibleDesde: habitacion.availableFrom
      ? formatearFecha(habitacion.availableFrom)
      : null,
    disponibleYa: estaDisponibleYa(habitacion.availableFrom),
    fotos: habitacion.photosCount,
    fotosDetalle: detalle.photos,
    descripcion: detalle.description ?? null,
    maxCompaneros: detalle.maxRoommates ?? null,
    compatibilidad: null,
  };
}
