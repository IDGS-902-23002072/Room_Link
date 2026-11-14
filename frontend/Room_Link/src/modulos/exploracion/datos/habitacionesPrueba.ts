import type { HabitacionFeed } from './habitaciones';

/**
 * Habitaciones de demostración. Se muestran solo cuando la API no responde
 * o todavía no hay habitaciones publicadas, para poder revisar el feed.
 */
export const HABITACIONES_PRUEBA: HabitacionFeed[] = [
  {
    id: 'prueba-1',
    hostId: 'prueba-anfitrion-1',
    anfitrion: 'Mariana R.',
    titulo: 'Habitación luminosa cerca de la UTL',
    renta: 2800,
    rentaTexto: '$2,800 MXN/mes',
    disponibleDesde: null,
    disponibleYa: true,
    fotos: 5,
    descripcion:
      'Cuarto amueblado con escritorio y clóset, baño compartido con una persona. Internet incluido. Ambiente tranquilo para estudiar.',
    maxCompaneros: 2,
    compatibilidad: 92,
  },
  {
    id: 'prueba-2',
    hostId: 'prueba-anfitrion-2',
    anfitrion: 'Carlos M.',
    titulo: 'Cuarto en departamento del centro',
    renta: 3500,
    rentaTexto: '$3,500 MXN/mes',
    disponibleDesde: null,
    disponibleYa: true,
    fotos: 4,
    descripcion:
      'Departamento céntrico a pasos del transporte público. Cocina equipada, lavadora compartida y servicios prorrateados.',
    maxCompaneros: 3,
    compatibilidad: 81,
  },
  {
    id: 'prueba-3',
    hostId: 'prueba-anfitrion-3',
    anfitrion: 'Valeria S.',
    titulo: 'Recámara con baño propio',
    renta: 4800,
    rentaTexto: '$4,800 MXN/mes',
    disponibleDesde: '1 dic 2026',
    disponibleYa: false,
    fotos: 6,
    descripcion:
      'Recámara amplia con baño privado y balcón. Se permiten mascotas pequeñas. Zona residencial con áreas verdes.',
    maxCompaneros: 1,
    compatibilidad: 74,
  },
  {
    id: 'prueba-4',
    hostId: 'prueba-anfitrion-4',
    anfitrion: 'Diego H.',
    titulo: 'Habitación económica para estudiantes',
    renta: 2200,
    rentaTexto: '$2,200 MXN/mes',
    disponibleDesde: '15 ene 2027',
    disponibleYa: false,
    fotos: 3,
    descripcion:
      'Cuarto sencillo en casa compartida con otros tres estudiantes. Reglas de convivencia claras y horario de silencio después de las 10 pm.',
    maxCompaneros: 3,
    compatibilidad: 58,
  },
  {
    id: 'prueba-5',
    hostId: 'prueba-anfitrion-5',
    anfitrion: 'Andrea L.',
    titulo: 'Loft compartido con terraza',
    renta: 6200,
    rentaTexto: '$6,200 MXN/mes',
    disponibleDesde: null,
    disponibleYa: true,
    fotos: 8,
    descripcion:
      'Loft moderno con terraza y estacionamiento. Ideal para profesionistas. Servicios incluidos y limpieza semanal de áreas comunes.',
    maxCompaneros: 2,
    compatibilidad: null,
  },
  {
    id: 'prueba-6',
    hostId: 'prueba-anfitrion-6',
    anfitrion: 'Luis P.',
    titulo: 'Cuarto amueblado zona norte',
    renta: 3000,
    rentaTexto: '$3,000 MXN/mes',
    disponibleDesde: null,
    disponibleYa: true,
    fotos: 4,
    descripcion:
      'Habitación amueblada con cama matrimonial y clóset. Cerca de plazas comerciales y rutas de camión. No se permite fumar.',
    maxCompaneros: 2,
    compatibilidad: 66,
  },
];
