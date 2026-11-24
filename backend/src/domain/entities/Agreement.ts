export interface AgreementRuleSet {
  visitsPolicy?: string | null;
  partiesAllowed?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  petsAllowed?: boolean;
  smokingAllowed?: boolean;
  commonAreasNotes?: string | null;
  extraRules?: string | null;
  costs?: Array<{
    kind: string;
    concept: string;
    amount: number;
    isIncluded: boolean;
    isProrated: boolean;
  }>;
  hostId: string;
  roomieIds: string[];
  listingTitle?: string;
  version?: number;
  supersedesAgreementId?: string | null;
}

export interface AgreementAcceptanceProps {
  userId: string;
  acceptedAt: Date | null;
}

export interface AgreementProps {
  id: string;
  listingId: string;
  rulesSnapshot: AgreementRuleSet;
  acceptances: AgreementAcceptanceProps[];
  createdAt: Date;
}

export class Agreement {
  private props: AgreementProps;

  constructor(props: AgreementProps) {
    Agreement.validateRules(props.rulesSnapshot);
    this.props = {
      ...props,
      acceptances: [...props.acceptances],
    };
  }

  get id(): string {
    return this.props.id;
  }

  get listingId(): string {
    return this.props.listingId;
  }

  get rulesSnapshot(): AgreementRuleSet {
    return this.props.rulesSnapshot;
  }

  get hostId(): string {
    return this.props.rulesSnapshot.hostId;
  }

  get roomieIds(): string[] {
    return [...this.props.rulesSnapshot.roomieIds];
  }

  get version(): number {
    return this.props.rulesSnapshot.version ?? 1;
  }

  get supersedesAgreementId(): string | null {
    return this.props.rulesSnapshot.supersedesAgreementId ?? null;
  }

  get acceptances(): AgreementAcceptanceProps[] {
    return this.props.acceptances.map((a) => ({ ...a }));
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public participants(): string[] {
    return Array.from(new Set([this.hostId, ...this.roomieIds]));
  }

  public isParticipant(userId: string): boolean {
    return this.participants().includes(userId);
  }

  /** EL-12.6 — Validación: Participantes */
  public assertParticipant(userId: string): void {
    if (!this.isParticipant(userId)) {
      throw new Error(
        "El usuario no es anfitrión ni roomie de este acuerdo y no puede aceptarlo.",
      );
    }
  }

  /** EL-12.4 — Función: aceptarAcuerdo */
  public accept(userId: string, now: Date = new Date()): void {
    this.assertParticipant(userId);
    const existing = this.props.acceptances.find((a) => a.userId === userId);
    if (existing) {
      if (existing.acceptedAt) {
        throw new Error("Este usuario ya aceptó el acuerdo.");
      }
      existing.acceptedAt = now;
      return;
    }
    this.props.acceptances.push({ userId, acceptedAt: now });
  }

  public isFullyAccepted(): boolean {
    const required = new Set(this.participants());
    const accepted = new Set(
      this.props.acceptances
        .filter((a) => a.acceptedAt !== null)
        .map((a) => a.userId),
    );
    for (const u of required) {
      if (!accepted.has(u)) return false;
    }
    return true;
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      listingId: this.props.listingId,
      version: this.version,
      supersedesAgreementId: this.supersedesAgreementId,
      hostId: this.hostId,
      roomieIds: this.roomieIds,
      rulesSnapshot: this.props.rulesSnapshot,
      acceptances: this.props.acceptances.map((a) => ({
        userId: a.userId,
        acceptedAt: a.acceptedAt ? a.acceptedAt.toISOString() : null,
      })),
      fullyAccepted: this.isFullyAccepted(),
      createdAt: this.props.createdAt.toISOString(),
    };
  }

  public static validateRules(rules: AgreementRuleSet): void {
    if (!rules || typeof rules !== "object") {
      throw new Error("El snapshot de reglas del acuerdo es obligatorio.");
    }
    if (!rules.hostId || typeof rules.hostId !== "string") {
      throw new Error("El acuerdo debe incluir el identificador del anfitrión.");
    }
    if (!Array.isArray(rules.roomieIds) || rules.roomieIds.length === 0) {
      throw new Error("El acuerdo debe incluir al menos un roomie.");
    }
    if (rules.roomieIds.includes(rules.hostId)) {
      throw new Error("El anfitrión no puede figurar también como roomie.");
    }
    const uniqueRoomies = new Set(rules.roomieIds);
    if (uniqueRoomies.size !== rules.roomieIds.length) {
      throw new Error("Hay roomies duplicados en el acuerdo.");
    }
  }
}
