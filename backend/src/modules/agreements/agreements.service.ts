import { randomUUID } from "node:crypto";
import {
  Agreement,
  AgreementAcceptance,
  type IAgreementRepository,
} from "../../domain/index.js";
import { AppError } from "../../shared/AppError.js";
import type { DomainEventPublisher } from "../auth/index.js";

/**
 * Policies externas que agreements necesita para validar sin acoplarse a otros módulos.
 */
export interface AgreementPolicies {
  /** Devuelve el hostId del listing, o null si no existe. */
  getListingHostId(listingId: string): Promise<string | null>;
  /** Indica si `userId` tiene una application `accepted` para `listingId`. */
  isAcceptedApplicant(listingId: string, userId: string): Promise<boolean>;
}

export class AgreementsService {
  constructor(
    private readonly repo: IAgreementRepository,
    private readonly policies: AgreementPolicies,
    private readonly events: DomainEventPublisher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createForListing(input: {
    listingId: string;
    hostId: string;
    rulesSnapshot: Record<string, unknown>;
  }): Promise<Agreement> {
    const owner = await this.policies.getListingHostId(input.listingId);
    if (!owner) {
      throw new AppError("Listing no encontrado.", 404, "LISTING_NOT_FOUND");
    }
    if (owner !== input.hostId) {
      throw new AppError(
        "Solo el anfitrión del listing puede crear un acuerdo.",
        403,
        "AGREEMENT_FORBIDDEN",
      );
    }
    const agreement = new Agreement({
      id: randomUUID(),
      listingId: input.listingId,
      rulesSnapshot: input.rulesSnapshot,
      createdAt: this.now(),
    });
    const created = await this.repo.create(agreement);
    await this.events.publish({
      type: "AgreementCreatedEvent",
      aggregateId: created.id,
      payload: {
        agreementId: created.id,
        listingId: created.listingId,
        hostId: input.hostId,
      },
    });
    return created;
  }

  async getById(id: string): Promise<Agreement> {
    const agreement = await this.repo.findById(id);
    if (!agreement) {
      throw new AppError("Acuerdo no encontrado.", 404, "AGREEMENT_NOT_FOUND");
    }
    return agreement;
  }

  async accept(agreementId: string, userId: string): Promise<AgreementAcceptance> {
    const agreement = await this.getById(agreementId);
    const hostId = await this.policies.getListingHostId(agreement.listingId);
    const isHost = hostId === userId;
    const isApplicant = await this.policies.isAcceptedApplicant(agreement.listingId, userId);
    if (!isHost && !isApplicant) {
      throw new AppError(
        "Solo el anfitrión o un postulante aceptado puede firmar este acuerdo.",
        403,
        "AGREEMENT_FORBIDDEN",
      );
    }
    const existing = await this.repo.findAcceptance(agreementId, userId);
    if (existing?.isAccepted()) {
      return existing;
    }
    const acceptance = await this.repo.upsertAcceptance(
      new AgreementAcceptance({
        agreementId,
        userId,
        acceptedAt: this.now(),
      }),
    );
    await this.events.publish({
      type: "AgreementAcceptedEvent",
      aggregateId: agreementId,
      payload: {
        agreementId,
        userId,
        listingId: agreement.listingId,
      },
    });
    return acceptance;
  }

  async listAcceptances(agreementId: string, requesterId: string) {
    const agreement = await this.getById(agreementId);
    const hostId = await this.policies.getListingHostId(agreement.listingId);
    if (hostId !== requesterId) {
      throw new AppError(
        "Solo el anfitrión puede ver las aceptaciones del acuerdo.",
        403,
        "AGREEMENT_FORBIDDEN",
      );
    }
    return this.repo.listAcceptances(agreementId);
  }
}
