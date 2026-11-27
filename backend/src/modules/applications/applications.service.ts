import { randomUUID } from "node:crypto";
import { Application, type IApplicationRepository } from "../../domain/index.js";

import { AppError } from "../../shared/AppError.js";
import type { DomainEventPublisher } from "../auth/auth.ports.js";

export type ApplicationDecision = "accept" | "reject" | "waitlist";

export interface CreateApplicationInput {
  listingId: string;
  applicantId: string;
  message?: string | null | undefined;
  compatibilityScore?: number | null | undefined;
}

export class ApplicationsService {
  constructor(private appRepo: IApplicationRepository, private readonly events?: DomainEventPublisher) {}

  async apply(input: CreateApplicationInput): Promise<Application> {
    const app = new Application({
      id: randomUUID(),
      listingId: input.listingId,
      applicantId: input.applicantId,
      status: "pending",
      message: input.message ?? null,
      compatibilityScore: input.compatibilityScore ?? null,
      createdAt: new Date(),
    });

    return await this.appRepo.create(app);
  }

  async getByApplicant(applicantId: string): Promise<Application[]> {
    return this.appRepo.findByApplicantId(applicantId);
  }

  async getByListing(listingId: string): Promise<Application[]> {
    return await this.appRepo.findByListingId(listingId);
  }

  async getById(id: string): Promise<Application | null> {
    return await this.appRepo.findById(id);
  }

  /** El postulante retira su propia solicitud mientras siga pendiente o en lista de espera. */
  async cancel(id: string, applicantId: string): Promise<void> {
    const app = await this.appRepo.findById(id);
    if (!app) {
      throw new AppError("Solicitud no encontrada.", 404, "APPLICATION_NOT_FOUND");
    }
    if (app.applicantId !== applicantId) {
      throw new AppError("Solo puedes cancelar tus propias postulaciones.", 403, "FORBIDDEN");
    }
    if (app.status !== "pending" && app.status !== "waitlisted") {
      throw new AppError(
        `No se puede cancelar una postulación en estado '${app.status}'.`,
        409,
        "APPLICATION_INVALID_STATE",
      );
    }
    await this.appRepo.deleteById(id);
  }

  async decide(id: string, decision: ApplicationDecision): Promise<Application> {
    const app = await this.appRepo.findById(id);
    if (!app) {
      throw new AppError("Solicitud no encontrada.", 404, "APPLICATION_NOT_FOUND");
    }

    const previousStatus = app.status;
    try {
      if (decision === "accept") app.accept();
      else if (decision === "reject") app.reject();
      else app.waitlist();
    } catch (cause) {
      if (cause instanceof Error) throw new AppError(cause.message, 409, "APPLICATION_STATUS_CONFLICT");
      throw cause;
    }

    if (!await this.appRepo.update(app, previousStatus)) {
      throw new AppError("La postulación cambió mientras la revisabas.", 409, "APPLICATION_STATUS_CONFLICT");
    }
    await this.events?.publish({
      type: "ApplicationStatusChanged",
      aggregateId: app.id,
      payload: { applicantId: app.applicantId, listingId: app.listingId, status: app.status },
    });
    return app;
  }
}
