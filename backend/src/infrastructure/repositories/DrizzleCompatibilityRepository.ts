import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  ne,
  or,
} from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import {
  CompatibilityProfile,
  compatibilityDimensions,
  defaultCompatibilityWeights,
  type CompatibilityDimension,
} from "../../domain/entities/CompatibilityProfile.js";
import type {
  CompatibilityFeedCandidate,
  ConnectionRequest,
  ICompatibilityRepository,
} from "../../domain/repositories/ICompatibilityRepository.js";
import * as schema from "../../db/schema/index.js";

const dbDimensionToDomain: Record<
  (typeof schema.compatDimensionWeights.$inferSelect)["dimension"],
  CompatibilityDimension
> = {
  schedule: "schedule",
  cleanliness: "cleanliness",
  noise: "noise",
  pets: "pets",
  smoking: "smoking",
  visits: "visits",
  gender_pref: "genderPref",
};

export class DrizzleCompatibilityRepository implements ICompatibilityRepository {
  constructor(private readonly db: MySql2Database<typeof schema>) {}

  async isActiveUser(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.authUsers.id })
      .from(schema.authUsers)
      .where(and(eq(schema.authUsers.id, userId), eq(schema.authUsers.status, "active")))
      .limit(1);
    return row !== undefined;
  }

  async findByUserId(userId: string): Promise<CompatibilityProfile | null> {
    const [row] = await this.db
      .select()
      .from(schema.compatProfiles)
      .where(eq(schema.compatProfiles.userId, userId))
      .limit(1);

    return row ? this.toEntity(row) : null;
  }

  async save(profile: CompatibilityProfile): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const answers = profile.answers;
      await transaction
        .insert(schema.compatProfiles)
        .values({
          userId: profile.userId,
          schedule: answers.schedule,
          cleanliness: answers.cleanliness,
          noise: answers.noise,
          pets: answers.pets,
          smoking: answers.smoking,
          visits: answers.visits,
          genderPref: answers.genderPref,
          completedAt: profile.completedAt,
          updatedAt: profile.updatedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            schedule: answers.schedule,
            cleanliness: answers.cleanliness,
            noise: answers.noise,
            pets: answers.pets,
            smoking: answers.smoking,
            visits: answers.visits,
            genderPref: answers.genderPref,
            completedAt: profile.completedAt,
            updatedAt: profile.updatedAt,
          },
        });

      await transaction.insert(schema.coreOutboxEvents).values({
        eventType: "CompatibilityTestUpdatedEvent",
        aggregateId: profile.userId,
        payload: profile.answers,
      });

      await transaction
        .delete(schema.matchAffinityScores)
        .where(
          or(
            eq(schema.matchAffinityScores.userA, profile.userId),
            eq(schema.matchAffinityScores.userB, profile.userId),
          ),
        );

      await this.rebuildUserCache(transaction, profile.userId);
    });
  }

  async findFeed(
    userId: string,
    pageSize: number,
    offset: number,
  ): Promise<CompatibilityFeedCandidate[]> {
    const hasTest = (await this.findByUserId(userId)) !== null;
    if (hasTest) {
      await this.ensureUserCache(userId);
    }
    return this.queryCandidates(userId, hasTest, { pageSize, offset });
  }

  async findCandidate(
    viewerId: string,
    candidateId: string,
  ): Promise<CompatibilityFeedCandidate | null> {
    const hasTest = (await this.findByUserId(viewerId)) !== null;
    if (hasTest) {
      await this.ensureUserCache(viewerId);
    }
    const [candidate] = await this.queryCandidates(viewerId, hasTest, { candidateId });
    return candidate ?? null;
  }

  async createConnection(
    requesterId: string,
    addresseeId: string,
    introMessage: string | null,
  ): Promise<ConnectionRequest> {
    if (requesterId === addresseeId) {
      throw new Error("No puedes enviarte una solicitud a ti mismo.");
    }

    const pairLow = requesterId.localeCompare(addresseeId) < 0 ? requesterId : addresseeId;
    const pairHigh = pairLow === requesterId ? addresseeId : requesterId;

    return this.db.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(schema.connConnections)
        .where(
          and(
            eq(schema.connConnections.activePairLow, pairLow),
            eq(schema.connConnections.activePairHigh, pairHigh),
          ),
        )
        .limit(1);

      if (existing?.status === "pending" || existing?.status === "accepted") {
        return {
          id: existing.id,
          requesterId: existing.requesterId,
          addresseeId: existing.addresseeId,
          status: existing.status,
          createdAt: new Date(existing.createdAt),
        };
      }

      if (existing) {
        await transaction
          .update(schema.connConnections)
          .set({ activePairLow: null, activePairHigh: null })
          .where(eq(schema.connConnections.id, existing.id));
      }

      const request = {
        id: randomUUID(),
        requesterId,
        addresseeId,
        status: "pending" as const,
        introMessage,
        activePairLow: pairLow,
        activePairHigh: pairHigh,
      };
      await transaction.insert(schema.connConnections).values(request);

      return { ...request, createdAt: new Date() };
    });
  }

  private async ensureUserCache(userId: string): Promise<void> {
    const [candidateTotal] = await this.db
      .select({ value: count() })
      .from(schema.compatProfiles)
      .innerJoin(
        schema.authUsers,
        and(
          eq(schema.authUsers.id, schema.compatProfiles.userId),
          eq(schema.authUsers.status, "active"),
        ),
      )
      .innerJoin(
        schema.profileProfiles,
        eq(schema.profileProfiles.userId, schema.compatProfiles.userId),
      )
      .where(ne(schema.compatProfiles.userId, userId));

    const [cachedTotal] = await this.db
      .select({ value: count() })
      .from(schema.matchAffinityScores)
      .where(eq(schema.matchAffinityScores.userA, userId));

    if (Number(candidateTotal?.value ?? 0) !== Number(cachedTotal?.value ?? 0)) {
      await this.db.transaction(async (transaction) => {
        await transaction
          .delete(schema.matchAffinityScores)
          .where(eq(schema.matchAffinityScores.userA, userId));
        await this.rebuildUserCache(transaction, userId);
      });
    }
  }

  private async rebuildUserCache(
    transaction: Parameters<
      Parameters<MySql2Database<typeof schema>["transaction"]>[0]
    >[0],
    userId: string,
  ): Promise<void> {
    const [viewer] = await transaction
      .select({ profile: schema.compatProfiles })
      .from(schema.compatProfiles)
      .innerJoin(
        schema.authUsers,
        and(
          eq(schema.authUsers.id, schema.compatProfiles.userId),
          eq(schema.authUsers.status, "active"),
        ),
      )
      .where(eq(schema.compatProfiles.userId, userId))
      .limit(1);

    if (!viewer) {
      return;
    }

    const candidates = await transaction
      .select({ profile: schema.compatProfiles })
      .from(schema.compatProfiles)
      .innerJoin(
        schema.authUsers,
        and(
          eq(schema.authUsers.id, schema.compatProfiles.userId),
          eq(schema.authUsers.status, "active"),
        ),
      )
      .innerJoin(
        schema.profileProfiles,
        eq(schema.profileProfiles.userId, schema.compatProfiles.userId),
      )
      .where(ne(schema.compatProfiles.userId, userId));

    const weightRows = await transaction.select().from(schema.compatDimensionWeights);
    const weights: Partial<Record<CompatibilityDimension, number>> = {};
    for (const row of weightRows) {
      weights[dbDimensionToDomain[row.dimension]] = Number(row.weight);
    }

    const viewerEntity = this.toEntity(viewer.profile);
    const now = new Date();
    const scoreRows = candidates.flatMap(({ profile }) => {
      const candidate = this.toEntity(profile);
      const score = String(viewerEntity.calculateAffinityWith(candidate, weights));
      return [
        { userA: userId, userB: candidate.userId, score, computedAt: now },
        { userA: candidate.userId, userB: userId, score, computedAt: now },
      ];
    });

    for (let index = 0; index < scoreRows.length; index += 500) {
      const batch = scoreRows.slice(index, index + 500);
      if (batch.length > 0) {
        await transaction.insert(schema.matchAffinityScores).values(batch);
      }
    }
  }

  private async queryCandidates(
    viewerId: string,
    hasTest: boolean,
    options: { pageSize?: number; offset?: number; candidateId?: string },
  ): Promise<CompatibilityFeedCandidate[]> {
    const conditions = [
      eq(schema.authUsers.status, "active"),
      ne(schema.authUsers.id, viewerId),
      ...(options.candidateId
        ? [eq(schema.authUsers.id, options.candidateId)]
        : []),
      ...(hasTest ? [isNotNull(schema.compatProfiles.userId)] : []),
    ];

    const query = this.db
      .select({
        userId: schema.authUsers.id,
        fullName: schema.profileProfiles.fullName,
        birthDate: schema.profileProfiles.birthDate,
        city: schema.geoZones.city,
        zone: schema.geoZones.name,
        budgetMin: schema.profileHousingPreferences.budgetMin,
        budgetMax: schema.profileHousingPreferences.budgetMax,
        photoUrl: schema.profilePhotos.url,
        bio: schema.profileProfiles.bio,
        occupation: schema.profileProfiles.occupation,
        compatibilityScore: schema.matchAffinityScores.score,
        profile: schema.compatProfiles,
      })
      .from(schema.authUsers)
      .innerJoin(
        schema.profileProfiles,
        eq(schema.profileProfiles.userId, schema.authUsers.id),
      )
      .leftJoin(
        schema.profilePhotos,
        and(
          eq(schema.profilePhotos.userId, schema.authUsers.id),
          eq(schema.profilePhotos.position, 1),
        ),
      )
      .leftJoin(
        schema.profileHousingPreferences,
        eq(schema.profileHousingPreferences.userId, schema.authUsers.id),
      )
      .leftJoin(
        schema.geoZones,
        eq(schema.geoZones.id, schema.profileHousingPreferences.desiredZoneId),
      )
      .leftJoin(
        schema.compatProfiles,
        eq(schema.compatProfiles.userId, schema.authUsers.id),
      )
      .leftJoin(
        schema.matchAffinityScores,
        and(
          eq(schema.matchAffinityScores.userA, viewerId),
          eq(schema.matchAffinityScores.userB, schema.authUsers.id),
        ),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.matchAffinityScores.score), asc(schema.profileProfiles.fullName));

    const rows = options.candidateId
      ? await query.limit(1)
      : await query.limit(options.pageSize ?? 12).offset(options.offset ?? 0);
    return rows.map((row) => {
      const birthDate = new Date(row.birthDate);
      const now = new Date();
      let age = now.getFullYear() - birthDate.getFullYear();
      if (
        now.getMonth() < birthDate.getMonth() ||
        (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate())
      ) {
        age -= 1;
      }

      return {
        userId: row.userId,
        fullName: row.fullName,
        age,
        city: row.city,
        zone: row.zone,
        budgetMin: row.budgetMin === null ? null : String(row.budgetMin),
        budgetMax: row.budgetMax === null ? null : String(row.budgetMax),
        photoUrl: row.photoUrl,
        bio: row.bio,
        occupation: row.occupation,
        compatibilityScore:
          row.compatibilityScore === null ? null : Number(row.compatibilityScore),
        compatibilitySummary: row.profile
          ? this.toEntity(row.profile).calculateSummary()
          : null,
      };
    });
  }

  private toEntity(row: typeof schema.compatProfiles.$inferSelect): CompatibilityProfile {
    return new CompatibilityProfile({
      ...row,
      completedAt: new Date(row.completedAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}
