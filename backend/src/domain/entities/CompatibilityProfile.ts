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

  /**
   * Calcula el porcentaje de afinidad con otro perfil de compatibilidad
   * Retorna un valor entre 0 y 100.
   */
  public calculateAffinityWith(other: CompatibilityProfile): number {
    const dimensions: (keyof Pick<
      CompatibilityProfileProps,
      "schedule" | "cleanliness" | "noise" | "pets" | "smoking" | "visits"
    >)[] = ["schedule", "cleanliness", "noise", "pets", "smoking", "visits"];

    let totalDiff = 0;
    const maxDiffPerDimension = 4; // Entre 1 y 5 la dif máx es 4

    for (const dim of dimensions) {
      totalDiff += Math.abs(this.props[dim] - other.props[dim]);
    }

    const maxTotalDiff = dimensions.length * maxDiffPerDimension; // 6 * 4 = 24
    const score = (1 - totalDiff / maxTotalDiff) * 100;
    return Math.round(score * 100) / 100;
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
    const fields: (keyof Pick<
      CompatibilityProfileProps,
      "schedule" | "cleanliness" | "noise" | "pets" | "smoking" | "visits" | "genderPref"
    >)[] = [
      "schedule",
      "cleanliness",
      "noise",
      "pets",
      "smoking",
      "visits",
      "genderPref",
    ];

    for (const field of fields) {
      const val = props[field];
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        throw new Error(
          `La dimensión de compatibilidad '${field}' debe ser un entero entre 1 y 5 (recibido: ${val})`,
        );
      }
    }
  }
}
