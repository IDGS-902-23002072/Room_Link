import { beforeEach, describe, expect, it } from "vitest";
import {
  Agreement,
  AgreementAcceptance,
  type IAgreementRepository,
} from "../../src/domain/index.js";
import {
  AgreementsService,
  type AgreementPolicies,
} from "../../src/modules/agreements/index.js";
import type { DomainEventPublisher } from "../../src/modules/auth/index.js";

class InMemoryAgreementRepository implements IAgreementRepository {
  readonly agreements = new Map<string, Agreement>();
  readonly acceptances: AgreementAcceptance[] = [];

  async findById(id: string) {
    return this.agreements.get(id) ?? null;
  }
  async listByListingId(listingId: string) {
    return Array.from(this.agreements.values()).filter(
      (a) => a.listingId === listingId,
    );
  }
  async create(agreement: Agreement) {
    this.agreements.set(agreement.id, agreement);
    return agreement;
  }
  async findAcceptance(agreementId: string, userId: string) {
    return (
      this.acceptances.find(
        (a) => a.agreementId === agreementId && a.userId === userId,
      ) ?? null
    );
  }
  async listAcceptances(agreementId: string) {
    return this.acceptances.filter((a) => a.agreementId === agreementId);
  }
  async upsertAcceptance(acceptance: AgreementAcceptance) {
    const idx = this.acceptances.findIndex(
      (a) => a.agreementId === acceptance.agreementId && a.userId === acceptance.userId,
    );
    if (idx >= 0) this.acceptances[idx] = acceptance;
    else this.acceptances.push(acceptance);
    return acceptance;
  }
}

function buildPolicies(overrides: Partial<AgreementPolicies> = {}): AgreementPolicies {
  return {
    getListingHostId: async (listingId) => (listingId === "L1" ? "host-1" : null),
    isAcceptedApplicant: async (listingId, userId) =>
      listingId === "L1" && userId === "applicant-1",
    ...overrides,
  };
}

describe("AgreementsService", () => {
  let repo: InMemoryAgreementRepository;
  let events: Array<{ type: string }>;
  let publisher: DomainEventPublisher;
  let service: AgreementsService;
  const now = new Date("2026-11-07T10:00:00Z");

  beforeEach(() => {
    repo = new InMemoryAgreementRepository();
    events = [];
    publisher = { publish: async (event) => void events.push(event) };
    service = new AgreementsService(repo, buildPolicies(), publisher, () => now);
  });

  it("only the listing host can create an agreement", async () => {
    await expect(
      service.createForListing({
        listingId: "L1",
        hostId: "intruder",
        rulesSnapshot: { quiet_hours: "22-7" },
      }),
    ).rejects.toMatchObject({ code: "AGREEMENT_FORBIDDEN" });

    const created = await service.createForListing({
      listingId: "L1",
      hostId: "host-1",
      rulesSnapshot: { quiet_hours: "22-7" },
    });
    expect(created.id).toBeDefined();
    expect(events).toMatchObject([{ type: "AgreementCreatedEvent" }]);
  });

  it("rejects creation with unknown listing or empty rules", async () => {
    await expect(
      service.createForListing({
        listingId: "nope",
        hostId: "host-1",
        rulesSnapshot: { r: 1 },
      }),
    ).rejects.toMatchObject({ code: "LISTING_NOT_FOUND" });

    await expect(
      service.createForListing({
        listingId: "L1",
        hostId: "host-1",
        rulesSnapshot: {},
      }),
    ).rejects.toThrow();
  });

  it("accept allowed for host or accepted applicant, forbidden otherwise", async () => {
    const agreement = await service.createForListing({
      listingId: "L1",
      hostId: "host-1",
      rulesSnapshot: { r: 1 },
    });

    await expect(service.accept(agreement.id, "random")).rejects.toMatchObject({
      code: "AGREEMENT_FORBIDDEN",
    });

    const hostAcc = await service.accept(agreement.id, "host-1");
    expect(hostAcc.isAccepted()).toBe(true);

    const applicantAcc = await service.accept(agreement.id, "applicant-1");
    expect(applicantAcc.isAccepted()).toBe(true);
    // AgreementAccepted se emite por cada aceptación fresca (2) + create (1) = 3 eventos.
    expect(events.filter((e) => e.type === "AgreementAcceptedEvent")).toHaveLength(2);
  });

  it("re-accepting is idempotent and emits no extra event", async () => {
    const agreement = await service.createForListing({
      listingId: "L1",
      hostId: "host-1",
      rulesSnapshot: { r: 1 },
    });
    await service.accept(agreement.id, "host-1");
    const second = await service.accept(agreement.id, "host-1");
    expect(second.isAccepted()).toBe(true);
    expect(events.filter((e) => e.type === "AgreementAcceptedEvent")).toHaveLength(1);
  });

  it("only the host can list acceptances", async () => {
    const agreement = await service.createForListing({
      listingId: "L1",
      hostId: "host-1",
      rulesSnapshot: { r: 1 },
    });
    await service.accept(agreement.id, "applicant-1");

    await expect(
      service.listAcceptances(agreement.id, "applicant-1"),
    ).rejects.toMatchObject({ code: "AGREEMENT_FORBIDDEN" });

    const list = await service.listAcceptances(agreement.id, "host-1");
    expect(list).toHaveLength(1);
    expect(list[0]?.userId).toBe("applicant-1");
  });

  it("returns 404 for unknown agreement", async () => {
    await expect(service.getById("nope")).rejects.toMatchObject({
      code: "AGREEMENT_NOT_FOUND",
    });
    await expect(service.accept("nope", "x")).rejects.toMatchObject({
      code: "AGREEMENT_NOT_FOUND",
    });
  });
});
