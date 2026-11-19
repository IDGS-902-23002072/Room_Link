import { CompatibilityResult, SavedProfile } from '../../m06-compatibilidad/types';

export const compatibilityMock: CompatibilityResult = {
  roomie: { id: 'r1', name: 'Andrea', zone: 'Zona Universidad', affinity: 92 },
  affinityMessage: 'Una buena base para conversar.',
  habits: [
    { id: 'h1', habit: 'Limpieza', you: 'Diaria', other: 'Diaria' },
    { id: 'h2', habit: 'Horario', you: '7:00 h', other: '7:30 h' },
    { id: 'h3', habit: 'Mascotas', you: 'Sí', other: 'Sí' },
    { id: 'h4', habit: 'Visitas', you: 'Pocas', other: 'Frecuentes' },
  ],
  commonPointsCount: 3,
  commonPointsSummary: 'Ambos valoran el orden, aceptan mascotas y no fuman.',
  talkingPoint: {
    title: 'Frecuencia de visitas',
    description: 'Tú prefieres pocas; Andrea suele recibir amistades.',
  },
  suggestion: {
    title: 'Una sugerencia para empezar',
    description: 'Acordar días y horarios de visita.',
  },
};

export const savedProfilesMock: SavedProfile[] = [
  {
    id: 'p1',
    name: 'Andrea Ramírez',
    status: 'saved',
    affinity: 92,
    detail: 'Zona Universidad · Ver perfil',
    actionLabel: 'Ver perfil',
  },
  {
    id: 'p2',
    name: 'Diego Martínez',
    status: 'saved',
    affinity: 88,
    detail: 'Centro · Ver perfil',
    actionLabel: 'Ver perfil',
  },
  {
    id: 'p3',
    name: 'Luis Hernández',
    status: 'discarded',
    detail: 'Presupuesto fuera de rango · Restaurar',
    actionLabel: 'Restaurar',
  },
];

export const savedCount = 8;
export const discardedCount = 3;
