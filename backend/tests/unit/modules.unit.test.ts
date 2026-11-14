
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";


import type {
  RoomPhotoInput,
  RoomPhotoRecord,
  RoomLocationInput,
  RoomPhotoMetadata,
  RoomPhotoUpdateItem,
} from "../../src/domain/index.js";


import {
  User,
  Profile,
  RoomListing,
  Application,
  type IUserRepository,
  type IProfileRepository,
  type IRoomListingRepository,
  type RoomFeedFilters,
  type RoomFeedItem,
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
  public photos: Map<string, RoomPhotoRecord[]> = new Map();
  public locations: Map<string, RoomLocationInput> = new Map();

  async findById(id: string): Promise<RoomListing | null> {
    return this.rooms.get(id) ?? null;
  }

  async findPublishedFeed(
    filters: RoomFeedFilters,
    limit: number,
    offset: number,
  ): Promise<RoomFeedItem[]> {
    const term = filters.search?.toLocaleLowerCase("es");
    return Array.from(this.rooms.values())
      .filter((room) => room.status === "published")
      .filter((room) => filters.minRent === undefined || room.monthlyRent >= filters.minRent)
      .filter((room) => filters.maxRent === undefined || room.monthlyRent <= filters.maxRent)
      .filter((room) => !filters.excludeHostId || room.hostId !== filters.excludeHostId)
      .filter((room) => {
        if (!term) return true;
        const address = room.locationId ? this.locations.get(room.locationId)?.address : "";
        return `${room.title} ${room.description ?? ""} ${address ?? ""}`
          .toLocaleLowerCase("es")
          .includes(term);
      })
      .sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? b.createdAt.getTime()) -
          (a.publishedAt?.getTime() ?? a.createdAt.getTime()),
      )
      .slice(offset, offset + limit)
      .map((room) => ({
        id: room.id,
        hostId: room.hostId,
        hostName: null,
        title: room.title,
        description: room.description ?? null,
        monthlyRent: room.monthlyRent,
        availableFrom: room.availableFrom ?? null,
        maxRoommates: room.maxRoommates ?? null,
        photoCount: room.photoCount,
        address: room.locationId ? (this.locations.get(room.locationId)?.address ?? null) : null,
        zone: null,
        city: null,
        publishedAt: room.publishedAt ?? null,
      }));
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
    location: RoomLocationInput,
    photos: RoomPhotoInput[]
  ): Promise<RoomListing> {
    room.setPhotoCount(photos.length);
    this.rooms.set(room.id, room);

    if (room.locationId) {
      this.locations.set(room.locationId, location);
    }

    this.photos.set(
      room.id,
      photos.map((photo, index) => ({
        id: crypto.randomUUID(),
        listingId: room.id,
        position: index + 1,
        ...photo,
      }))
    );

    return room;
  }

  async update(room: RoomListing): Promise<void> {
    this.rooms.set(room.id, room);
  }

  async countPhotos(listingId: string): Promise<number> {
    return this.photos.get(listingId)?.length ?? 0;
  }

  async findPhotoById(
    listingId: string,
    photoId: string
  ): Promise<RoomPhotoRecord | null> {
    return (
      this.photos.get(listingId)?.find((photo) => photo.id === photoId) ?? null
    );
  }

  async findFirstPhotoByListingId(
    listingId: string
  ): Promise<RoomPhotoRecord | null> {
    return this.photos.get(listingId)?.[0] ?? null;
  }

  async findLocationById(
    id: string
  ): Promise<RoomLocationInput | null> {
    return this.locations.get(id) ?? null;
  }

  async findPhotosByListingId(
    listingId: string
  ): Promise<RoomPhotoMetadata[]> {
    return (this.photos.get(listingId) ?? []).map(
      ({ id, listingId, fileName, mimeType, position }) => ({
        id,
        listingId,
        fileName,
        mimeType,
        position,
      })
    );
  }

  async updateWithLocationAndPhotos(
    room: RoomListing,
    location: RoomLocationInput,
    photos: RoomPhotoUpdateItem[]
  ): Promise<void> {
    if (!room.locationId) {
      throw new Error("La habitación no tiene ubicación.");
    }

    if (photos.length > 10) {
      throw new Error("Una habitación no puede tener más de 10 fotografías.");
    }

    const fotosActuales = this.photos.get(room.id) ?? [];
    const fotosActualizadas: RoomPhotoRecord[] = [];

    for (const [index, item] of photos.entries()) {
      if (item.type === "existing") {
        const foto = fotosActuales.find(
          (actual) => actual.id === item.id
        );

        if (!foto) {
          throw new Error(
            `La fotografía ${item.id} no pertenece a esta habitación.`
          );
        }

        fotosActualizadas.push({
          ...foto,
          position: index + 1,
        });
      } else {
        fotosActualizadas.push({
          id: crypto.randomUUID(),
          listingId: room.id,
          position: index + 1,
          ...item.photo,
        });
      }
    }

    room.setPhotoCount(fotosActualizadas.length);

    this.rooms.set(room.id, room);
    this.locations.set(room.locationId, location);
    this.photos.set(room.id, fotosActualizadas);
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

  // Token de sesión compartido por los tests que llegan tras el login.
  let sessionToken = "";
  const authHeaders = (extra: Record<string, string> = {}) => ({
    ...extra,
    Authorization: `Bearer ${sessionToken}`,
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

      sessionToken = data.token;
    });

    it("rejects protected routes without session", async () => {
      const res = await app.request("/api/v1/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "X", birthDate: "2000-01-01" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Profile Module", () => {
    it("creates a student profile for the authenticated user", async () => {
      const res = await app.request("/api/v1/profiles", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
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

    it("creates a draft room listing (hostId taken from session)", async () => {
      const host = await userRepo.findByEmail("nuevo_estudiante@uni.edu");
      expect(host).not.toBeNull();

      const formData = new FormData();
      // No se envía hostId: el backend lo toma de la sesión.
      formData.append("titulo", "Cuarto amueblado a 5 min del campus");
      formData.append("renta", "2800");
      formData.append("descripcion", "Incluye agua e internet.");
      formData.append("ubicacion", "Calle de prueba 123, León, Guanajuato");
      formData.append("latitude", "21.1221");
      formData.append("longitude", "-101.683");

      const res = await app.request("/api/v1/rooms", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      const data = await res.json();

      expect(res.status, JSON.stringify(data)).toBe(201);
      expect(data.title).toBe("Cuarto amueblado a 5 min del campus");
      expect(data.status).toBe("draft");

      createdRoomId = data.id;
    });

    it("rejects publishing room without enough photos", async () => {
      const res = await app.request(`/api/v1/rooms/${createdRoomId}/publish`, {
        method: "PATCH",
        headers: authHeaders(),
      });

      expect(res.status).toBe(400);

      const data = await res.json();

      expect(data.error).toMatch(/al menos 3 fotografías/);
    });

    it("rejects publish without session", async () => {
      const res = await app.request(`/api/v1/rooms/${createdRoomId}/publish`, {
        method: "PATCH",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Applications Module", () => {
    it("submits application for a listing (applicantId from session)", async () => {
      const res = await app.request("/api/v1/applications", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          listingId: "listing-abc",
          message: "Hola, me interesa mucho el cuarto.",
          compatibilityScore: 92.5,
        }),
      });

      expect(res.status).toBe(201);

      const data = await res.json();

      expect(data.status).toBe("pending");
      expect(data.compatibilityScore).toBe(92.5);
    });

    it("rejects application without session", async () => {
      const res = await app.request("/api/v1/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: "listing-abc" }),
      });
      expect(res.status).toBe(401);
    });
  });
});
