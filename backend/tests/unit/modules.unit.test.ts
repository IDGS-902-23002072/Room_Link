import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  User,
  Profile,
  RoomListing,
  Application,
  type IUserRepository,
  type IProfileRepository,
  type IRoomListingRepository,
  type IApplicationRepository,
} from "../../src/domain/index.js";

class InMemoryUserRepository implements IUserRepository {
  public users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }
  async create(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }
  async update(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}

class InMemoryProfileRepository implements IProfileRepository {
  public profiles: Map<string, Profile> = new Map();

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.profiles.get(userId) ?? null;
  }
  async create(profile: Profile): Promise<Profile> {
    this.profiles.set(profile.userId, profile);
    return profile;
  }
  async update(profile: Profile): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }
}

class InMemoryRoomRepository implements IRoomListingRepository {
  public rooms: Map<string, RoomListing> = new Map();

  async findById(id: string): Promise<RoomListing | null> {
    return this.rooms.get(id) ?? null;
  }
  async findPublished(limit = 20, offset = 0): Promise<RoomListing[]> {
    return Array.from(this.rooms.values())
      .filter((r) => r.status === "published")
      .slice(offset, offset + limit);
  }
  async findByHostId(hostId: string): Promise<RoomListing[]> {
    return Array.from(this.rooms.values()).filter((r) => r.hostId === hostId);
  }
  async create(room: RoomListing): Promise<RoomListing> {
    this.rooms.set(room.id, room);
    return room;
  }
  async update(room: RoomListing): Promise<void> {
    this.rooms.set(room.id, room);
  }
  async countPhotos(listingId: string): Promise<number> {
    const room = this.rooms.get(listingId);
    return room ? room.photoCount : 0;
  }
}

class InMemoryApplicationRepository implements IApplicationRepository {
  public apps: Map<string, Application> = new Map();

  async findById(id: string): Promise<Application | null> {
    return this.apps.get(id) ?? null;
  }
  async findByListingId(listingId: string): Promise<Application[]> {
    return Array.from(this.apps.values()).filter((a) => a.listingId === listingId);
  }
  async findByApplicantId(applicantId: string): Promise<Application[]> {
    return Array.from(this.apps.values()).filter((a) => a.applicantId === applicantId);
  }
  async create(app: Application): Promise<Application> {
    this.apps.set(app.id, app);
    return app;
  }
  async update(app: Application): Promise<void> {
    this.apps.set(app.id, app);
  }
}

describe("Modular Monolith MVC API", () => {
  const userRepo = new InMemoryUserRepository();
  const profileRepo = new InMemoryProfileRepository();
  const roomRepo = new InMemoryRoomRepository();
  const appRepo = new InMemoryApplicationRepository();

  const app = createApp({
    checkDatabase: async () => {},
    userRepo,
    profileRepo,
    roomRepo,
    appRepo,
  });

  describe("Auth Module", () => {
    it("registers a new user and returns public view (sanitized)", async () => {
      const res = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nuevo_estudiante@uni.edu",
          password: "password123",
          role: "seeker",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user.email).toBe("nuevo_estudiante@uni.edu");
      expect(data.user.passwordHash).toBeUndefined();
      expect(data.user.roles).toContain("seeker");
    });

    it("logs in existing user", async () => {
      const res = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nuevo_estudiante@uni.edu",
          password: "password123",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe("nuevo_estudiante@uni.edu");
    });
  });

  describe("Profile Module", () => {
    it("creates a student profile and calculates age", async () => {
      const res = await app.request("/api/v1/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-123",
          fullName: "Ana García",
          birthDate: "2002-05-15",
          occupation: "Estudiante de Ingeniería",
          bio: "Tranquila y ordenada.",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.fullName).toBe("Ana García");
      expect(data.age).toBeGreaterThanOrEqual(18);
    });
  });

  describe("Rooms Module", () => {
    let createdRoomId = "";

    it("creates a draft room listing", async () => {
      const res = await app.request("/api/v1/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: "user-123",
          title: "Cuarto amueblado a 5 min del campus",
          monthlyRent: 2800,
          description: "Incluye agua e internet.",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe("Cuarto amueblado a 5 min del campus");
      expect(data.status).toBe("draft");
      createdRoomId = data.id;
    });

    it("rejects publishing room without enough photos", async () => {
      const res = await app.request(`/api/v1/rooms/${createdRoomId}/publish`, {
        method: "PATCH",
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/al menos 3 fotografías/);
    });
  });

  describe("Applications Module", () => {
    it("submits application for a listing", async () => {
      const res = await app.request("/api/v1/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: "listing-abc",
          applicantId: "user-456",
          message: "Hola, me interesa mucho el cuarto.",
          compatibilityScore: 92.5,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe("pending");
      expect(data.compatibilityScore).toBe(92.5);
    });
  });
});
