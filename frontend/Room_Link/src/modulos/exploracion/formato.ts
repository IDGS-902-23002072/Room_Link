const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearRenta(valor: number): string {
  return `$${Math.round(valor).toLocaleString('es-MX')} MXN`;
}

// Recibe una fecha AAAA-MM-DD y devuelve, por ejemplo, "15 nov 2026".
export function formatearFecha(valor: string | null): string {
  const coincidencia = valor?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!coincidencia) return 'Disponibilidad por confirmar';
  const [, anio, mes, dia] = coincidencia;
  return `${Number(dia)} ${meses[Number(mes) - 1] ?? ''} ${anio}`;
}

export function ubicacionCorta(direccion: string | null, zona: string | null, ciudad: string | null) {
  if (zona) return ciudad ? `${zona}, ${ciudad}` : zona;
  return direccion ?? 'Ubicación no indicada';
}

export type RangoRenta = {
  nombre: string;
  rentaMinima?: number;
  rentaMaxima?: number;
};

export const rangosRenta: RangoRenta[] = [
  { nombre: 'Todas' },
  { nombre: 'Hasta $2,500', rentaMaxima: 2500 },
  { nombre: '$2,500 – $4,000', rentaMinima: 2500, rentaMaxima: 4000 },
  { nombre: 'Más de $4,000', rentaMinima: 4000 },
];
