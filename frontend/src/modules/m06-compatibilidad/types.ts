export interface Roomie {
  id: string;
  name: string;
  zone: string;
  affinity: number; // 0 a 100
}

export interface HabitComparison {
  id: string;
  habit: string; // Limpieza, Horario, Mascotas, Visitas
  you: string;
  other: string;
}

export interface TitledMessage {
  title: string;
  description: string;
}

export interface CompatibilityResult {
  roomie: Roomie;
  affinityMessage: string;
  habits: HabitComparison[];
  commonPointsCount: number;
  commonPointsSummary: string;
  talkingPoint: TitledMessage;
  suggestion: TitledMessage;
}

export type SavedProfileStatus = 'saved' | 'discarded';

export interface SavedProfile {
  id: string;
  name: string;
  status: SavedProfileStatus;
  affinity?: number; // los descartados no la muestran
  detail: string;
  actionLabel: string; // "Ver perfil" | "Restaurar"
}

export type M06StackParamList = {
  Compatibility: undefined;
  SharedPoints: undefined;
  SavedProfiles: undefined;
};