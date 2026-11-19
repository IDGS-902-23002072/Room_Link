export type Habit = {
  id: string;
  label: string;
  you: string;
  other: string;
};

export type Roomie = {
  id: string;
  name: string;
  zone: string;
  affinity: number;
};

export type CompatibilityResult = {
  roomie: Roomie;
  affinity: number;
  summary: string;
  habits: Habit[];
  commonPoints: { count: number; description: string };
  talkingPoint: { title: string; description: string };
  suggestion: { title: string; description: string };
};

export type SavedStatus = 'saved' | 'discarded';

export type SavedProfile = {
  id: string;
  name: string;
  status: SavedStatus;
  affinity?: number;
  detail: string;
  actionLabel: string;
};
