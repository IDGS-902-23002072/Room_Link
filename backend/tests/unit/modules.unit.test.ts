
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

import type {
  RoomPhotoInput,
  RoomPhotoRecord,
} from "../../src/domain/index.js";

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
import { createAuthFakes } from "../helpers/auth-fakes.js";

class InMemoryUserRepository implements IUserRepository {
  public users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
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

  async findPublished(
    limit = 20,
    offset = 0
  ): Promise<RoomListing[]> {
    return Array.from(this.rooms.values())
      .filter((room) => room.status === "published")
      .slice(offset, offset + limit);
  }

  async findByHostId(hostId: string): Promise<RoomListing[]> {
    return Array.from(this.rooms.values()).filter(
      (room) => room.hostId === hostId
    );
  }

  async create(room: RoomListing): Promise<RoomListing> {
    this.rooms.set(room.id, room);
    return room;
  }

  async createWithLocationAndPhotos(
    room: RoomListing,
    location: {
      address: string;
      latitude: number;
      longitude: number;
    },
    photos: RoomPhotoInput[]
  ): Promise<RoomListing> {
    room.setPhotoCount(photos.length);

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

  async findPhotoById(
    listingId: string,
    photoId: string
  ): Promise<RoomPhotoRecord | null> {
    return null;
  }

  // En este repositorio simulado todavía no almacenamos fotografías.
  async findFirstPhotoByListingId(
    listingId: string
  ): Promise<RoomPhotoRecord | null> {
    return null;
  }
}

class InMemoryApplicationRepository
  implements IApplicationRepository
{
  public apps: Map<string, Application> = new Map();

  async findById(id: string): Promise<Application | null> {
    return this.apps.get(id) ?? null;
  }

  async findByListingId(listingId: string): Promise<Application[]> {
    return Array.from(this.apps.values()).filter(
      (application) => application.listingId === listingId
    );
  }

  async findByApplicantId(applicantId: string): Promise<Application[]> {
    return Array.from(this.apps.values()).filter(
      (application) => application.applicantId === applicantId
    );
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
  const authFakes = createAuthFakes();

  const app = createApp({
    checkDatabase: async () => {},
    userRepo,
    profileRepo,
    roomRepo,
    appRepo,
    authDependencies: authFakes.dependencies,
  });

  describe("Auth Module", () => {
    it("registers a new user and returns public view (sanitized)", async () => {
      const res = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nuevo_estudiante@uni.edu",
          password: "password123",
          termsAccepted: true,
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
      // Recuperamos el usuario creado en la prueba de registro.
      const host = await userRepo.findByEmail(
        "nuevo_estudiante@uni.edu"
      );

      expect(host).not.toBeNull();

      // FormData permite enviar campos y archivos en una sola petición.
      const formData = new FormData();

      formData.append("hostId", host!.id);
      formData.append(
        "titulo",
        "Cuarto amueblado a 5 min del campus"
      );
      formData.append("renta", "2800");
      formData.append(
        "descripcion",
        "Incluye agua e internet."
      );
      formData.append(
        "ubicacion",
        "Calle de prueba 123, León, Guanajuato"
      );
      formData.append("latitude", "21.1221");
      formData.append("longitude", "-101.683");

      const res = await app.request("/api/v1/rooms", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      // Si falla, Vitest mostrará el mensaje del backend.
      expect(res.status, JSON.stringify(data)).toBe(201);
      expect(data.title).toBe(
        "Cuarto amueblado a 5 min del campus"
      );
      expect(data.status).toBe("draft");

      createdRoomId = data.id;
    });

    it("rejects publishing room without enough photos", async () => {
      const res = await app.request(
        `/api/v1/rooms/${createdRoomId}/publish`,
        {
          method: "PATCH",
        }
      );

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
