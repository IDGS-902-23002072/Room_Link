export type Pregunta = {
  id: string;
  prompt: string;
  options: readonly string[];
  initial: string;
};

export const preguntasHabitos: readonly Pregunta[] = [
  {
    id: 'wake-up',
    prompt: '¿Cuándo empieza tu día?',
    options: ['Temprano', 'Más tarde', 'Variable'],
    initial: 'Temprano',
  },
  {
    id: 'tidiness',
    prompt: '¿Qué tan ordenado eres?',
    options: ['Muy ordenado', 'Flexible', 'Relajado'],
    initial: 'Muy ordenado',
  },
  {
    id: 'atmosphere',
    prompt: '¿Qué ambiente prefieres?',
    options: ['Tranquilo', 'Con música', 'Social'],
    initial: 'Tranquilo',
  },
];

export const preguntasConvivencia: readonly Pregunta[] = [
  {
    id: 'pets',
    prompt: '¿Vivirías con mascotas?',
    options: ['Sí', 'No', 'Depende'],
    initial: 'Sí',
  },
  {
    id: 'smoking',
    prompt: '¿Cómo te sientes con el tabaco?',
    options: ['Sin humo', 'Exterior', 'Sin problema'],
    initial: 'Sin humo',
  },
  {
    id: 'roommates',
    prompt: '¿Con quién prefieres compartir?',
    options: ['Cualquier género', 'Mujeres', 'Hombres'],
    initial: 'Cualquier género',
  },
  {
    id: 'visits',
    prompt: '¿Qué visitas te resultan cómodas?',
    options: ['Ocasionales', 'Frecuentes', 'Acordadas'],
    initial: 'Ocasionales',
  },
];
