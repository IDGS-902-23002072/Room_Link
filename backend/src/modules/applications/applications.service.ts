import { randomUUID } from "node:crypto";
import { Application, type IApplicationRepository } from "../../domain/index.js";

export interface CreateApplicationInput {
  listingId: string;
  applicantId: string;
  message?: string | null | undefined;
  compatibilityScore?: number | null | undefined;
}

export class ApplicationsService {
  constructor(private appRepo: IApplicationRepository) {}

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

  async getByListing(listingId: string): Promise<Application[]> {
    return await this.appRepo.findByListingId(listingId);
  }

  async decide(id: string, decision: "accept" | "reject"): Promise<Application> {
    const app = await this.appRepo.findById(id);
    if (!app) {
      throw new Error(`Solicitud con ID ${id} no encontrada.`);
    }

    if (decision === "accept") {
      app.accept();
    } else {
      app.reject();
    }

    await this.appRepo.update(app);
    return app;
  }
}
