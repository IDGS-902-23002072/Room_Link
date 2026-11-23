import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { RoomListing } from "../../src/domain/index.js";
import { createAuthFakes } from "../helpers/auth-fakes.js";
import { InMemoryRoomRepository } from "../helpers/in-memory-repos.js";

const HOST_A = "11111111-1111-4111-8111-111111111111";
const HOST_B = "22222222-2222-4222-8222-222222222222";

function seedRoom(
  repo: InMemoryRoomRepository,
  input: {
    id: string;
    hostId?: string;
    title: string;
    rent: number;
    status?: "draft" | "published" | "paused" | "closed";
    publishedAt?: string;
    address?: string;
    photos?: number;
  },
) {
  const room = new RoomListing({
    id: input.id,
    hostId: input.hostId ?? HOST_A,
    locationId: input.address ? `loc-${input.id}` : null,
    title: input.title,
    monthlyRent: input.rent,
    status: input.status ?? "published",
    photoCount: input.photos ?? 3,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
  });
  repo.rooms.set(room.id, room);
  if (input.address) {
    repo.locations.set(`loc-${input.id}`, {
      address: input.address,
      latitude: 21.12,
      longitude: -101.68,
    });
  }
}

describe("Feed de habitaciones publicadas (HU-04)", () => {
  let roomRepo: InMemoryRoomRepository;
  let app: ReturnType<typeof createApp>;

  const pedir = async (query = "") => {
    const res = await app.request(`/api/v1/rooms/feed${query}`);
    return { res, body: await res.json() };
  };

  beforeEach(() => {
    roomRepo = new InMemoryRoomRepository();
    app = createApp({
      checkDatabase: async () => {},
      roomRepo,
      authDependencies: createAuthFakes().dependencies,
    });

    seedRoom(roomRepo, {
      id: "r1",
      title: "Cuarto cerca del centro",
      rent: 2500,
      publishedAt: "2026-11-10T10:00:00Z",
      address: "Calle Madero 10, Centro, León",
    });
    seedRoom(roomRepo, {
      id: "r2",
      title: "Habitación amplia con baño propio",
      rent: 4200,
      hostId: HOST_B,
      publishedAt: "2026-11-12T10:00:00Z",
      address: "Blvd. Campestre 300, León",
    });
    seedRoom(roomRepo, { id: "r3", title: "Borrador sin publicar", rent: 1800, status: "draft" });
    seedRoom(roomRepo, {
      id: "r4",
      title: "Cuarto pausado",
      rent: 2000,
      status: "paused",
      publishedAt: "2026-11-09T10:00:00Z",
    });
  });

  it("es público y solo muestra habitaciones publicadas, de la más reciente a la más antigua", async () => {
    const { res, body } = await pedir();

    expect(res.status).toBe(200);
    expect(body.items.map((item: { id: string }) => item.id)).toEqual(["r2", "r1"]);
    expect(body.hasMore).toBe(false);
    expect(body.items[1]).toMatchObject({
      title: "Cuarto cerca del centro",
      monthlyRent: 2500,
      address: "Calle Madero 10, Centro, León",
      photosCount: 3,
    });
  });

  it("filtra por rango de renta", async () => {
    const { body } = await pedir("?minRent=3000&maxRent=5000");
    expect(body.items.map((item: { id: string }) => item.id)).toEqual(["r2"]);
  });

  it("busca por texto en título y dirección", async () => {
    const porTitulo = await pedir("?q=baño");
    expect(porTitulo.body.items.map((item: { id: string }) => item.id)).toEqual(["r2"]);

    const porDireccion = await pedir("?q=madero");
    expect(porDireccion.body.items.map((item: { id: string }) => item.id)).toEqual(["r1"]);
  });

  it("oculta las habitaciones del propio usuario", async () => {
    const { body } = await pedir(`?excludeHostId=${HOST_A}`);
    expect(body.items.map((item: { id: string }) => item.id)).toEqual(["r2"]);
  });

  it("pagina los resultados e indica si hay más", async () => {
    const primera = await pedir("?pageSize=1&page=1");
    expect(primera.body.items).toHaveLength(1);
    expect(primera.body.items[0].id).toBe("r2");
    expect(primera.body.hasMore).toBe(true);

    const segunda = await pedir("?pageSize=1&page=2");
    expect(segunda.body.items[0].id).toBe("r1");
    expect(segunda.body.hasMore).toBe(false);
  });

  it("rechaza parámetros inválidos", async () => {
    expect((await pedir("?minRent=5000&maxRent=1000")).res.status).toBe(400);
    expect((await pedir("?page=0")).res.status).toBe(400);
    expect((await pedir("?pageSize=500")).res.status).toBe(400);
    expect((await pedir("?minRent=abc")).res.status).toBe(400);
  });
});
