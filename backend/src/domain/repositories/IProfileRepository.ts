import type { Profile } from "../entities/Profile.js";

export interface IProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>;
  create(profile: Profile): Promise<Profile>;
  update(profile: Profile): Promise<void>;
}
