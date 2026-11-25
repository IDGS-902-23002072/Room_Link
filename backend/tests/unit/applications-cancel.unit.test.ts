import { beforeEach, describe, expect, it } from "vitest";
import { ApplicationsService } from "../../src/modules/applications/applications.service.js";
import { Application } from "../../src/domain/index.js";
import { InMemoryApplicationRepository } from "../helpers/in-memory-repos.js";

const SEEKER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const LISTING = "33333333-3333-4333-8333-333333333333";

type Status = "pending" | "waitlisted" | "accepted" | "rejected";

function seed(
  repo: InMemoryApplicationRepository,
  id: string,
  status: Status,
  applicantId = SEEKER,
) {
  repo.items.set(
    id,
    new Application({
      id,
      listingId: LISTING,
      applicantId,
      status,
      createdAt: new Date("2026-11-01T00:00:00Z"),
    }),
  );
}

describe("ApplicationsService.cancel — el postulante retira su solicitud (M09)", () => {
  let repo: InMemoryApplicationRepository;
  let service: ApplicationsService;

  beforeEach(() => {
    repo = new InMemoryApplicationRepository();
    service = new ApplicationsService(repo);
  });

  it("cancela una postulación pendiente propia (se elimina)", async () => {
    seed(repo, "a1", "pending");
    await service.cancel("a1", SEEKER);
    expect(await repo.findById("a1")).toBeNull();
  });

  it("cancela una en lista de espera", async () => {
    seed(repo, "a2", "waitlisted");
    await service.cancel("a2", SEEKER);
    expect(await repo.findById("a2")).toBeNull();
  });

  it("rechaza cancelar la postulación de otro usuario (403)", async () => {
    seed(repo, "a3", "pending", OTHER);
    await expect(service.cancel("a3", SEEKER)).rejects.toMatchObject({ status: 403 });
    expect(await repo.findById("a3")).not.toBeNull();
  });

  it("no permite cancelar una postulación aceptada (409)", async () => {
    seed(repo, "a4", "accepted");
    await expect(service.cancel("a4", SEEKER)).rejects.toMatchObject({ status: 409 });
    expect(await repo.findById("a4")).not.toBeNull();
  });

  it("devuelve 404 si la postulación no existe", async () => {
    await expect(service.cancel("nope", SEEKER)).rejects.toMatchObject({ status: 404 });
  });
});
