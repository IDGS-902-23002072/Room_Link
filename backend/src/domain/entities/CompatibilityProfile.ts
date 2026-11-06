export interface CompatibilityProfileProps {
  userId: string;
  schedule: number; // 1 (madrugador) a 5 (nocturno)
  cleanliness: number; // 1 (relajado) a 5 (impecable)
  noise: number; // 1 (silencio total) a 5 (fiestero/música)
  pets: number; // 1 (no tolera) a 5 (ama mascotas)
  smoking: number; // 1 (cero tolerancia) a 5 (fuma/tolera)
  visits: number; // 1 (sin visitas) a 5 (visitas frecuentes)
  genderPref: number; // 1 (mismo género) a 5 (sin preferencia)
  completedAt: Date;
  updatedAt: Date;
}

export type CompatibilityDimension =
  | "schedule"
  | "cleanliness"
  | "noise"
  | "pets"
  | "smoking"
  | "visits"
  | "genderPref";

export type CompatibilityAnswers = Pick<
  CompatibilityProfileProps,
  CompatibilityDimension
>;

export const compatibilityDimensions: readonly CompatibilityDimension[] = [
  "schedule",
  "cleanliness",
  "noise",
  "pets",
  "smoking",
  "visits",
  "genderPref",
];

export const defaultCompatibilityWeights: Record<CompatibilityDimension, number> = {
  schedule: 2,
  cleanliness: 3,
  noise: 3,
  pets: 2,
  smoking: 3,
  visits: 2,
  genderPref: 1,
};

export interface CompatibilitySummary {
  dimension: CompatibilityDimension;
  percentage: number;
  level: "bajo" | "medio" | "alto";
}

/**
 * Entidad de Dominio: CompatibilityProfile
 * Hábitos de convivencia y estilo de vida para cálculo de afinidad.
 */
export class CompatibilityProfile {
  private props: CompatibilityProfileProps;

  constructor(props: CompatibilityProfileProps) {
    this.validateDimensions(props);
    this.props = { ...props };
  }

  get userId(): string {
    return this.props.userId;
  }

  get schedule(): number {
    return this.props.schedule;
  }

  get cleanliness(): number {
    return this.props.cleanliness;
  }

  get noise(): number {
    return this.props.noise;
  }

  get pets(): number {
    return this.props.pets;
  }

  get smoking(): number {
    return this.props.smoking;
  }

  get visits(): number {
    return this.props.visits;
  }

  get genderPref(): number {
    return this.props.genderPref;
  }

  get completedAt(): Date {
    return this.props.completedAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get answers(): CompatibilityAnswers {
    return {
      schedule: this.schedule,
      cleanliness: this.cleanliness,
      noise: this.noise,
      pets: this.pets,
      smoking: this.smoking,
      visits: this.visits,
      genderPref: this.genderPref,
    };
  }

  public calculateSummary(): CompatibilitySummary[] {
    return compatibilityDimensions.map((dimension) => {
      const percentage = Math.round(((this.props[dimension] - 1) / 4) * 100);
      return {
        dimension,
        percentage,
        level: percentage <= 33 ? "bajo" : percentage <= 66 ? "medio" : "alto",
      };
    });
  }

  /**
   * Calcula el porcentaje de afinidad con otro perfil de compatibilidad
   * Retorna un valor entre 0 y 100.
   */
  public calculateAffinityWith(
    other: CompatibilityProfile,
    weights: Partial<Record<CompatibilityDimension, number>> = defaultCompatibilityWeights,
  ): number {
    let weightedDifference = 0;
    let totalWeight = 0;

    for (const dimension of compatibilityDimensions) {
      const weight = weights[dimension] ?? defaultCompatibilityWeights[dimension];
      weightedDifference +=
        weight * Math.abs(this.props[dimension] - other.props[dimension]);
      totalWeight += weight;
    }

    return Math.round((1 - weightedDifference / (4 * totalWeight)) * 100);
  }

  public toJSON(): Record<string, unknown> {
    return {
      userId: this.props.userId,
      schedule: this.props.schedule,
      cleanliness: this.props.cleanliness,
      noise: this.props.noise,
      pets: this.props.pets,
      smoking: this.props.smoking,
      visits: this.props.visits,
      genderPref: this.props.genderPref,
    };
  }

  private validateDimensions(props: CompatibilityProfileProps): void {
    for (const field of compatibilityDimensions) {
      const val = props[field];
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        throw new Error(
          `La dimensión de compatibilidad '${field}' debe ser un entero entre 1 y 5 (recibido: ${val})`,
        );
      }
    }
  }
}
