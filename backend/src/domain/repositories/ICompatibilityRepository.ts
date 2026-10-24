import type { CompatibilityProfile } from "../entities/CompatibilityProfile.js";

export interface CompatibilityFeedCandidate {
  userId: string;
  fullName: string;
  age: number;
  city: string | null;
  zone: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  photoUrl: string | null;
  bio: string | null;
  occupation: string | null;
  compatibilityScore: number | null;
  compatibilitySummary: ReturnType<CompatibilityProfile["calculateSummary"]> | null;
}

export interface ConnectionRequest {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: Date;
}

export interface ICompatibilityRepository {
  isActiveUser(userId: string): Promise<boolean>;
  findByUserId(userId: string): Promise<CompatibilityProfile | null>;
  save(profile: CompatibilityProfile): Promise<void>;
  findFeed(
    userId: string,
    pageSize: number,
    offset: number,
  ): Promise<CompatibilityFeedCandidate[]>;
  findCandidate(
    viewerId: string,
    candidateId: string,
  ): Promise<CompatibilityFeedCandidate | null>;
  createConnection(
    requesterId: string,
    addresseeId: string,
    introMessage: string | null,
  ): Promise<ConnectionRequest>;
}
