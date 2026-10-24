import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { CompatibilityProfile } from "../../src/domain/entities/CompatibilityProfile.js";
import type {
  CompatibilityFeedCandidate,
  ConnectionRequest,
  ICompatibilityRepository,
} from "../../src/domain/repositories/ICompatibilityRepository.js";
import {
  CompatibilityError,
  CompatibilityService,
} from "../../src/modules/compatibility/compatibility.service.js";

const answers = {
  schedule: 3,
  cleanliness: 3,
  noise: 3,
  pets: 3,
  smoking: 3,
  visits: 3,
  genderPref: 3,
};

function createProfile(userId: string, value: number) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return new CompatibilityProfile({
    userId,
    schedule: value,
    cleanliness: value,
    noise: value,
    pets: value,
    smoking: value,
    visits: value,
    genderPref: value,
    completedAt: now,
    updatedAt: now,
  });
}

class InMemoryCompatibilityRepository implements ICompatibilityRepository {
  activeUsers = new Set(["viewer", "candidate"]);
  profiles = new Map<string, CompatibilityProfile>();
  connections: ConnectionRequest[] = [];
  feed: CompatibilityFeedCandidate[] = [];

  async isActiveUser(userId: string) {
    return this.activeUsers.has(userId);
  }

  async findByUserId(userId: string) {
    return this.profiles.get(userId) ?? null;
  }

  async save(profile: CompatibilityProfile) {
    this.profiles.set(profile.userId, profile);
  }

  async findFeed(_userId: string, pageSize: number, offset: number) {
    return this.feed.slice(offset, offset + pageSize);
  }

  async findCandidate(_viewerId: string, candidateId: string) {
    return this.feed.find((candidate) => candidate.userId === candidateId) ?? null;
  }

  async createConnection(
    requesterId: string,
    addresseeId: string,
    _introMessage: string | null,
  ): Promise<ConnectionRequest> {
    const request = {
      id: "connection-1",
      requesterId,
      addresseeId,
      status: "pending" as const,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    this.connections.push(request);
    return request;
  }
}

describe("Compatibility module", () => {
  it("validates that the test has exactly seven integer answers from 1 to 5", () => {
    expect(CompatibilityService.isValidAnswers(answers)).toBe(true);
    expect(
      CompatibilityService.isValidAnswers({ ...answers, noise: "3" }),
    ).toBe(false);
    expect(
      CompatibilityService.isValidAnswers({ ...answers, pets: 6 }),
    ).toBe(false);
    expect(
      CompatibilityService.isValidAnswers({ ...answers, extra: 1 }),
    ).toBe(false);
  });

  it("saves test answers and returns a percentage summary for all dimensions", async () => {
    const repository = new InMemoryCompatibilityRepository();
    const service = new CompatibilityService(repository);

    const result = await service.saveTest("viewer", answers);

    expect(repository.profiles.get("viewer")?.answers).toEqual(answers);
    expect(result.completed).toBe(true);
    expect(result.summary).toHaveLength(7);
    expect(result.summary.every(({ percentage }) => percentage === 50)).toBe(true);
  });

  it("rejects test and feed requests for inactive users", async () => {
    const service = new CompatibilityService(new InMemoryCompatibilityRepository());

    await expect(service.getTest("unknown")).rejects.toMatchObject({
      statusCode: 404,
    } satisfies Partial<CompatibilityError>);
    await expect(service.getFeed("unknown", 1)).rejects.toBeInstanceOf(
      CompatibilityError,
    );
  });

  it("serves affinity pages with twelve profiles per page", async () => {
    const repository = new InMemoryCompatibilityRepository();
    repository.profiles.set("viewer", createProfile("viewer", 3));
    repository.feed = Array.from({ length: 13 }, (_, index) => ({
      userId: `candidate-${index}`,
      fullName: `Candidate ${index}`,
      age: 24,
      city: null,
      zone: null,
      budgetMin: null,
      budgetMax: null,
      photoUrl: null,
      bio: null,
      occupation: null,
      compatibilityScore: 80,
      compatibilitySummary: null,
    }));
    const service = new CompatibilityService(repository);

    const firstPage = await service.getFeed("viewer", 1);
    const secondPage = await service.getFeed("viewer", 2);

    expect(firstPage.profiles).toHaveLength(12);
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.profiles).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);
  });

  it("validates connection targets and returns created requests", async () => {
    const repository = new InMemoryCompatibilityRepository();
    const service = new CompatibilityService(repository);

    await expect(
      service.sendConnectionRequest("viewer", "viewer", null),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.sendConnectionRequest("viewer", "missing", null),
    ).rejects.toMatchObject({ statusCode: 404 });
    const request = await service.sendConnectionRequest(
      "viewer",
      "candidate",
      "Hola",
    );
    expect(request.status).toBe("pending");
    expect(request.addresseeId).toBe("candidate");
  });

  it("exposes test saving and feed through the HTTP API", async () => {
    const repository = new InMemoryCompatibilityRepository();
    repository.feed = [
      {
        userId: "candidate",
        fullName: "Candidate Name",
        age: 24,
        city: "León",
        zone: "Centro",
        budgetMin: "3000.00",
        budgetMax: "4500.00",
        photoUrl: null,
        bio: "Perfil de prueba",
        occupation: "Diseño",
        compatibilityScore: 90,
        compatibilitySummary: null,
      },
    ];
    const app = createApp({ compatibilityRepo: repository });

    const saveResponse = await app.request("/api/v1/compatibility/viewer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    });
    const saved = await saveResponse.json();
    expect(saveResponse.status).toBe(200);
    expect(saved.completed).toBe(true);
    expect(saved.summary).toHaveLength(7);

    const feedResponse = await app.request(
      "/api/v1/compatibility/viewer/feed?page=1",
    );
    const feed = await feedResponse.json();
    expect(feedResponse.status).toBe(200);
    expect(feed.hasTest).toBe(true);
    expect(feed.pageSize).toBe(12);

    const detailResponse = await app.request(
      "/api/v1/compatibility/viewer/candidates/candidate",
    );
    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toMatchObject({
      userId: "candidate",
      compatibilityScore: 90,
    });

    const connectionResponse = await app.request(
      "/api/v1/compatibility/viewer/connections",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: "candidate", introMessage: null }),
      },
    );
    expect(connectionResponse.status).toBe(201);
    await expect(connectionResponse.json()).resolves.toMatchObject({
      requesterId: "viewer",
      addresseeId: "candidate",
      status: "pending",
    });

    const invalidResponse = await app.request(
      "/api/v1/compatibility/viewer/feed?page=0",
    );
    expect(invalidResponse.status).toBe(400);
  });
});
