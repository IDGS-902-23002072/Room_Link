import type { Application } from "../entities/Application.js";

export interface IApplicationRepository {
  findById(id: string): Promise<Application | null>;
  findByListingId(listingId: string): Promise<Application[]>;
  findByApplicantId(applicantId: string): Promise<Application[]>;
  create(app: Application): Promise<Application>;
  update(app: Application): Promise<void>;
}
