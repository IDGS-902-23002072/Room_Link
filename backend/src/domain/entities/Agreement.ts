export interface AgreementProps {
  id: string;
  listingId: string;
  rulesSnapshot: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Acuerdo de convivencia creado por el host de un listing. El `rulesSnapshot`
 * es un documento inmutable: cualquier cambio a las reglas implica crear un
 * nuevo `Agreement` y pedir aceptaciones nuevas.
 */
export class Agreement {
  id: string;
  listingId: string;
  rulesSnapshot: Record<string, unknown>;
  createdAt: Date;

  constructor(props: AgreementProps) {
    if (!props.listingId) throw new Error("listingId es obligatorio.");
    if (!props.rulesSnapshot || Object.keys(props.rulesSnapshot).length === 0) {
      throw new Error("El snapshot de reglas no puede estar vacío.");
    }
    this.id = props.id;
    this.listingId = props.listingId;
    this.rulesSnapshot = props.rulesSnapshot;
    this.createdAt = props.createdAt;
  }
}

export interface AgreementAcceptanceProps {
  agreementId: string;
  userId: string;
  acceptedAt: Date | null;
}

export class AgreementAcceptance {
  agreementId: string;
  userId: string;
  acceptedAt: Date | null;

  constructor(props: AgreementAcceptanceProps) {
    this.agreementId = props.agreementId;
    this.userId = props.userId;
    this.acceptedAt = props.acceptedAt;
  }

  isAccepted(): boolean {
    return this.acceptedAt !== null;
  }
}
