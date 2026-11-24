import { randomUUID } from "node:crypto";
import {
  Sanction,
  sanctionTypes,
  type ISanctionRepository,
  type SanctionType,
} from "../../domain/index.js";
import { AppError } from "../../shared/AppError.js";
import type { DomainEventPublisher } from "../auth/index.js";

const validTypes = new Set<SanctionType>(sanctionTypes);

export interface IssueSanctionInput {
  adminId: string;
  reportId?: string | null;
  userId?: string | null;
  listingId?: string | null;
  type: SanctionType;
  reason: string;
  expiresAt?: Date | null;
}

export class SanctionsService {
  constructor(
    private readonly repo: ISanctionRepository,
    private readonly events: DomainEventPublisher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issue(input: IssueSanctionInput): Promise<Sanction> {
    if (!validTypes.has(input.type)) {
      throw new AppError("Tipo de sanción inválido.", 400, "INVALID_SANCTION_TYPE");
    }
    if (input.type === "temporary_suspension" && !input.expiresAt) {
      throw new AppError(
        "La suspensión temporal requiere fecha de expiración.",
        400,
        "SANCTION_EXPIRATION_REQUIRED",
      );
    }
    if (input.expiresAt && input.expiresAt.getTime() <= this.now().getTime()) {
      throw new AppError(
        "La fecha de expiración debe ser futura.",
        400,
        "SANCTION_EXPIRATION_IN_PAST",
      );
    }
    const reason = input.reason.trim();
    if (!reason) {
      throw new AppError("El motivo es obligatorio.", 400, "SANCTION_REASON_REQUIRED");
    }
    if (reason.length > 2000) {
      throw new AppError(
        "El motivo no puede exceder 2000 caracteres.",
        400,
        "SANCTION_REASON_TOO_LONG",
      );
    }
    if (!input.userId && !input.listingId) {
      throw new AppError(
        "Debes indicar userId o listingId.",
        400,
        "SANCTION_TARGET_REQUIRED",
      );
    }

    const sanction = new Sanction({
      id: randomUUID(),
      reportId: input.reportId ?? null,
      adminId: input.adminId,
      userId: input.userId ?? null,
      listingId: input.listingId ?? null,
      type: input.type,
      reason,
      expiresAt: input.expiresAt ?? null,
      createdAt: this.now(),
    });
    const created = await this.repo.create(sanction);

    await this.events.publish({
      type: "SanctionIssuedEvent",
      aggregateId: created.id,
      payload: {
        sanctionId: created.id,
        adminId: created.adminId,
        userId: created.userId,
        listingId: created.listingId,
        type: created.type,
        reason: created.reason,
        expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      },
    });

    return created;
  }

  listForUser(userId: string) {
    return this.repo.listForUser(userId);
  }

  listActiveForUser(userId: string) {
    return this.repo.listActiveForUser(userId, this.now());
  }

  async revoke(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new AppError("Sanción no encontrada.", 404, "SANCTION_NOT_FOUND");
    }
    if (!existing.isActive(this.now())) {
      throw new AppError("La sanción ya no está vigente.", 409, "SANCTION_NOT_ACTIVE");
    }
    await this.repo.revoke(id, this.now());
  }

  /**
   * Utilidad para AuthService: devuelve la primera sanción activa que bloquea la sesión
   * del usuario, o null si no hay.
   */
  async findBlockingSession(userId: string): Promise<Sanction | null> {
    const active = await this.repo.listActiveForUser(userId, this.now());
    return active.find((s) => s.blocksSession(this.now())) ?? null;
  }
}
