export type PerfilRoomie = {
  id: string;
  iniciales: string;
  nombre: string;
  edad: number;
  compatibilidad: number;
  ciudad: string;
  zona: string;
  estilo: string;
  ocupacion: string;
  preferencias: string[];
  presupuesto: string;
  habitacion: string;
  bio: string;
  recomendada: boolean;
};

export const perfilesRoomies: readonly PerfilRoomie[] = [
  {
    id: 'andrea',
    iniciales: 'AR',
    nombre: 'Andrea Ramírez',
    edad: 23,
    compatibilidad: 92,
    ciudad: 'León',
    zona: 'Centro',
    estilo: 'Sin humo · Mascotas',
    ocupacion: 'Diseñadora, amante del café y de los gatos.',
    preferencias: ['Sin humo', 'Mascotas bienvenidas', 'Orden diario'],
    presupuesto: '$3,000 – $4,500 MXN',
    habitacion: 'Habitación privada · Servicios incluidos',
    bio: 'Busco un lugar tranquilo cerca de la universidad. Me gusta cocinar y cuidar mis plantas.',
    recomendada: true,
  },
  {
    id: 'diego',
    iniciales: 'DM',
    nombre: 'Diego',
    edad: 25,
    compatibilidad: 68,
    ciudad: 'León',
    zona: 'Tecnológico',
    estilo: 'Orden · Tranquilidad',
    ocupacion: 'Ingeniero de software. Trabajo la mayor parte del día.',
    preferencias: ['No fumar', 'Sin fiestas entre semana', 'Orden compartido'],
    presupuesto: '$3,500 – $5,000 MXN',
    habitacion: 'Habitación amueblada · Baño compartido',
    bio: 'Me gusta mantener las áreas comunes ordenadas y tener acuerdos claros de convivencia.',
    recomendada: false,
  },
  {
    id: 'sofia',
    iniciales: 'SL',
    nombre: 'Sofía',
    edad: 22,
    compatibilidad: 85,
    ciudad: 'León',
    zona: 'Estadio',
    estilo: 'Estudiante · UTLeón',
    ocupacion: 'Estudiante y aficionada a la fotografía.',
    preferencias: ['Mascotas', 'Limpieza semanal', 'Visitas acordadas'],
    presupuesto: '$2,800 – $4,200 MXN',
    habitacion: 'Habitación privada · Cerca del transporte',
    bio: 'Busco roomie para compartir un departamento luminoso y con buena conexión de transporte.',
    recomendada: true,
  },
  {
    id: 'valeria',
    iniciales: 'VC',
    nombre: 'Valeria',
    edad: 24,
    compatibilidad: 83,
    ciudad: 'León',
    zona: 'Arbide',
    estilo: 'Arquitecta · Lectura',
    ocupacion: 'Arquitecta. Suelo trabajar desde casa algunos días.',
    preferencias: ['Ambiente tranquilo', 'Sin humo', 'Cocina compartida'],
    presupuesto: '$3,200 – $4,800 MXN',
    habitacion: 'Habitación amplia · Espacio para escritorio',
    bio: 'Valoro la comunicación y un espacio cómodo donde cada quien pueda tener su rutina.',
    recomendada: false,
  },
  {
    id: 'elena',
    iniciales: 'EP',
    nombre: 'Elena',
    edad: 26,
    compatibilidad: 79,
    ciudad: 'León',
    zona: 'San Isidro',
    estilo: 'Cocina · Tranquilidad',
    ocupacion: 'Nutrióloga. Disfruto cocinar y salir a caminar.',
    preferencias: ['Cocina compartida', 'Orden diario', 'Mascotas'],
    presupuesto: '$3,000 – $4,000 MXN',
    habitacion: 'Habitación privada · Cocina equipada',
    bio: 'Me gustaría compartir con alguien que disfrute un ambiente amable y tranquilo.',
    recomendada: false,
  },
  {
    id: 'mateo',
    iniciales: 'MG',
    nombre: 'Mateo',
    edad: 24,
    compatibilidad: 76,
    ciudad: 'León',
    zona: 'Jardines del Moral',
    estilo: 'Música · Flexible',
    ocupacion: 'Músico y estudiante de producción de audio.',
    preferencias: ['Horarios acordados', 'Visitas ocasionales', 'Sin humo'],
    presupuesto: '$3,200 – $4,600 MXN',
    habitacion: 'Habitación amueblada · Áreas comunes amplias',
    bio: 'Busco un espacio respetuoso donde compartir gastos y mantener buena comunicación.',
    recomendada: false,
  },
];
