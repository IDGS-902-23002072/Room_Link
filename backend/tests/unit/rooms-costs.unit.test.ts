import { beforeEach, describe, expect, it } from "vitest";
import { RoomsService } from "../../src/modules/rooms/rooms.service.js";
import { RoomListing } from "../../src/domain/index.js";
import { InMemoryRoomRepository } from "../helpers/in-memory-repos.js";

const HOST = "11111111-1111-4111-8111-111111111111";

function seedRoom(repo: InMemoryRoomRepository, id: string, rent: number) {
  const room = new RoomListing({
    id,
    hostId: HOST,
    locationId: null,
    title: "Cuarto de prueba",
    monthlyRent: rent,
    status: "published",
    photoCount: 3,
    publishedAt: new Date("2026-11-10T00:00:00Z"),
    createdAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
  });
  repo.rooms.set(room.id, room);
}

describe("RoomsService.saveCostItems — costos incluidos vs renta (M08)", () => {
  let repo: InMemoryRoomRepository;
  let service: RoomsService;

  beforeEach(() => {
    repo = new InMemoryRoomRepository();
    service = new RoomsService(repo);
    seedRoom(repo, "r1", 2340);
  });

  it("rechaza un costo incluido en la renta que supera la renta mensual", async () => {
    await expect(
      service.saveCostItems("r1", [
        { kind: "service", concept: "Luz", amount: 30000, isIncluded: true, isProrated: false },
      ]),
    ).rejects.toThrow(/incluidos en la renta no pueden superar/i);
  });

  it("[SLI 8.3] rechaza cuando la SUMA de los incluidos supera la renta aunque cada uno no", async () => {
    await expect(
      service.saveCostItems("r1", [
        { kind: "service", concept: "Luz", amount: 1500, isIncluded: true, isProrated: false },
        { kind: "maintenance", concept: "Agua", amount: 1500, isIncluded: true, isProrated: false },
      ]),
    ).rejects.toThrow(/incluidos en la renta/i);
  });

  it("permite costos incluidos cuya suma no supera la renta", async () => {
    const items = await service.saveCostItems("r1", [
      { kind: "service", concept: "Luz", amount: 1000, isIncluded: true, isProrated: false },
      { kind: "maintenance", concept: "Agua", amount: 800, isIncluded: true, isProrated: false },
    ]);
    expect(items).toHaveLength(2);
  });

  it("no limita los costos NO incluidos (cargos aparte)", async () => {
    const items = await service.saveCostItems("r1", [
      { kind: "deposit", concept: "Depósito", amount: 5000, isIncluded: false, isProrated: false },
    ]);
    expect(items[0]).toMatchObject({ concept: "Depósito", amount: 5000 });
  });
});
