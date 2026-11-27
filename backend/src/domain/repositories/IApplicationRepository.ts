import type { ApplicationStatus } from "../entities/User.js";
import type { Application } from "../entities/Application.js";

export interface IApplicationRepository {
  findById(id: string): Promise<Application | null>;
  findByListingId(listingId: string): Promise<Application[]>;
  findByApplicantId(applicantId: string): Promise<Application[]>;
  create(app: Application): Promise<Application>;
  update(app: Application, previousStatus: ApplicationStatus): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
}
