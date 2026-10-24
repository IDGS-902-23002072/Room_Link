import type { DimensionCompatibilidad } from '../../compatibilidad/api';

export type Pregunta = {
  id: DimensionCompatibilidad;
  prompt: string;
  options: readonly string[];
};

export const preguntasHabitos: readonly Pregunta[] = [
  {
    id: 'schedule',
    prompt: '¿Qué tan compatible es tu horario con una rutina compartida?',
    options: ['Muy temprano', 'Temprano', 'Intermedio', 'Tarde', 'Nocturno'],
  },
  {
    id: 'cleanliness',
    prompt: '¿Qué importancia tiene para ti mantener todo limpio?',
    options: ['Poca', 'Algo', 'Moderada', 'Mucha', 'Esencial'],
  },
  {
    id: 'noise',
    prompt: '¿Qué nivel de ruido prefieres en casa?',
    options: ['Silencio', 'Muy bajo', 'Moderado', 'Con música', 'Social'],
  },
  {
    id: 'smoking',
    prompt: '¿Qué tan cómodo estás conviviendo con el tabaco?',
    options: ['Nada cómodo', 'Poco', 'Neutral', 'Cómodo', 'Fumo o tolero'],
  },
];

export const preguntasConvivencia: readonly Pregunta[] = [
  {
    id: 'pets',
    prompt: '¿Qué tanto te gustan las mascotas en casa?',
    options: ['No las tolero', 'Poco', 'Me da igual', 'Me gustan', 'Las amo'],
  },
  {
    id: 'visits',
    prompt: '¿Qué tan frecuentes te gustaría que fueran las visitas?',
    options: ['Nunca', 'Rara vez', 'Ocasionalmente', 'Frecuentemente', 'Muy frecuentes'],
  },
  {
    id: 'genderPref',
    prompt: '¿Qué preferencia tienes sobre el género de tus roomies?',
    options: ['Solo mi género', 'Mayormente mi género', 'Sin preferencia fuerte', 'Me da igual', 'Sin preferencia'],
  },
];
