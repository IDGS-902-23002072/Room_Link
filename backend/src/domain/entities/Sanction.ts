export const sanctionTypes = [
  "warning",
  "temporary_suspension",
  "permanent_ban",
  "listing_removed",
  "dismissed",
] as const;

export type SanctionType = (typeof sanctionTypes)[number];

/** Tipos que, estando vigentes sobre el usuario, bloquean la sesión. */
export const sessionBlockingTypes: ReadonlySet<SanctionType> = new Set([
  "temporary_suspension",
  "permanent_ban",
]);

export interface SanctionProps {
  id: string;
  reportId: string | null;
  adminId: string;
  userId: string | null;
  listingId: string | null;
  type: SanctionType;
  reason: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export class Sanction {
  id: string;
  reportId: string | null;
  adminId: string;
  userId: string | null;
  listingId: string | null;
  type: SanctionType;
  reason: string;
  expiresAt: Date | null;
  createdAt: Date;

  constructor(props: SanctionProps) {
    if (!props.userId && !props.listingId) {
      throw new Error("Una sanción requiere userId o listingId.");
    }
    if (!props.reason.trim()) {
      throw new Error("La sanción requiere un motivo.");
    }
    this.id = props.id;
    this.reportId = props.reportId;
    this.adminId = props.adminId;
    this.userId = props.userId;
    this.listingId = props.listingId;
    this.type = props.type;
    this.reason = props.reason;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
  }

  /** La sanción está vigente en `at` si no expira o si `expiresAt > at`. */
  isActive(at: Date): boolean {
    if (this.type === "dismissed") return false;
    if (!this.expiresAt) return true;
    return this.expiresAt.getTime() > at.getTime();
  }

  /** ¿Bloquea la sesión del usuario en `at`? */
  blocksSession(at: Date): boolean {
    return (
      this.userId !== null &&
      sessionBlockingTypes.has(this.type) &&
      this.isActive(at)
    );
  }
}
