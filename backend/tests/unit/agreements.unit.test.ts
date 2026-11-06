import { describe, expect, it, beforeEach } from "vitest";
import {
  Agreement,
  type AgreementRuleSet,
  type IAgreementRepository,
  type ListingRulesAndCosts,
} from "../../src/domain/index.js";
import { AgreementsService } from "../../src/modules/agreements/agreements.service.js";

/**
 * HU-12 — Acuerdos de convivencia.
 * Cubre EL-12.3 (generarAcuerdo), EL-12.4 (aceptarAcuerdo),
 * EL-12.5 (crearNuevaVersion) y EL-12.6 (validación de participantes).
 */

class FakeAgreementRepository implements IAgreementRepository {
  public agreements: Map<string, Agreement> = new Map();
  public acceptances: Array<{ id: string; userId: string; at: Date }> = [];
  public snapshots: Map<string, ListingRulesAndCosts> = new Map();

  async getListingSnapshot(
    listingId: string,
  ): Promise<ListingRulesAndCosts | null> {
    return this.snapshots.get(listingId) ?? null;
  }

  async findById(agreementId: string): Promise<Agreement | null> {
    return this.agreements.get(agreementId) ?? null;
  }

  async findByListing(listingId: string): Promise<Agreement[]> {
    return Array.from(this.agreements.values()).filter(
      (a) => a.listingId === listingId,
    );
  }

  async findByUser(userId: string): Promise<Agreement[]> {
    return Array.from(this.agreements.values()).filter((a) =>
      a.isParticipant(userId),
    );
  }

  async create(agreement: Agreement): Promise<Agreement> {
    this.agreements.set(agreement.id, agreement);
    return agreement;
  }

  async recordAcceptance(
    agreementId: string,
    userId: string,
    acceptedAt: Date,
  ): Promise<void> {
    this.acceptances.push({ id: agreementId, userId, at: acceptedAt });
  }
}

const buildSnapshot = (
  hostId: string,
  listingTitle = "Casa de Roberto",
): ListingRulesAndCosts => ({
  listingTitle,
  hostId,
  visitsPolicy: "Solo con aviso previo",
  partiesAllowed: false,
  quietHoursStart: "22:00:00",
  quietHoursEnd: "08:00:00",
  petsAllowed: false,
  smokingAllowed: false,
  commonAreasNotes: "Cocina y baño compartidos",
  extraRules: "Limpieza cada sábado",
  costs: [
    {
      kind: "rent",
      concept: "Renta mensual",
      amount: 3500,
      isIncluded: false,
      isProrated: false,
    },
  ],
});

describe("AgreementsService (Roberto, HU-12)", () => {
  let repo: FakeAgreementRepository;
  let service: AgreementsService;
  const host = "host-1";
  const roomie = "roomie-2";
  const listing = "listing-9";

  beforeEach(() => {
    repo = new FakeAgreementRepository();
    repo.snapshots.set(listing, buildSnapshot(host));
    service = new AgreementsService(repo);
  });

  describe("generarAcuerdo — EL-12.3", () => {
    it("crea un acuerdo v1 con snapshot de reglas y costos", async () => {
      const agreement = await service.generarAcuerdo({
        listingId: listing,
        hostId: host,
        roomieId: roomie,
      });
      expect(agreement.version).toBe(1);
      expect(agreement.hostId).toBe(host);
      expect(agreement.roomieIds).toEqual([roomie]);
      expect(agreement.rulesSnapshot.costs?.[0]?.amount).toBe(3500);
      expect(agreement.acceptances).toHaveLength(0);
      expect(repo.agreements.size).toBe(1);
    });

    it("rechaza cuando el host indicado no coincide con el del listing", async () => {
      await expect(
        service.generarAcuerdo({
          listingId: listing,
          hostId: "otro-host",
          roomieId: roomie,
        }),
      ).rejects.toThrow(/no coincide/);
    });

    it("rechaza cuando el listing no existe", async () => {
      await expect(
        service.generarAcuerdo({
          listingId: "no-existe",
          hostId: host,
          roomieId: roomie,
        }),
      ).rejects.toThrow(/No existe el listing/);
    });

    it("rechaza cuando host y roomie son la misma persona", async () => {
      await expect(
        service.generarAcuerdo({
          listingId: listing,
          hostId: host,
          roomieId: host,
        }),
      ).rejects.toThrow(/no puede figurar/);
    });
  });

  describe("aceptarAcuerdo — EL-12.4 / EL-12.6", () => {
    it("acepta al anfitrión y al roomie, y queda fullyAccepted", async () => {
      const agreement = await service.generarAcuerdo({
        listingId: listing,
        hostId: host,
        roomieId: roomie,
      });
      const afterHost = await service.aceptarAcuerdo(agreement.id, host);
      expect(afterHost.isFullyAccepted()).toBe(false);
      const afterRoomie = await service.aceptarAcuerdo(agreement.id, roomie);
      expect(afterRoomie.isFullyAccepted()).toBe(true);
      expect(repo.acceptances).toHaveLength(2);
    });

    it("rechaza a un usuario que no es participante (EL-12.6)", async () => {
      const agreement = await service.generarAcuerdo({
        listingId: listing,
        hostId: host,
        roomieId: roomie,
      });
      await expect(
        service.aceptarAcuerdo(agreement.id, "extrano"),
      ).rejects.toThrow(/no es anfitrión ni roomie/);
      expect(repo.acceptances).toHaveLength(0);
    });

    it("rechaza una doble aceptación del mismo usuario", async () => {
      const agreement = await service.generarAcuerdo({
        listingId: listing,
        hostId: host,
        roomieId: roomie,
      });
      await service.aceptarAcuerdo(agreement.id, host);
      await expect(
        service.aceptarAcuerdo(agreement.id, host),
      ).rejects.toThrow(/ya aceptó/);
    });

    it("404 cuando el acuerdo no existe", async () => {
      await expect(
        service.aceptarAcuerdo("no-existe", host),
      ).rejects.toThrow(/no encontrado/);
    });
  });

  describe("crearNuevaVersion — EL-12.5", () => {
    it("incrementa la versión y referencia al anterior", async () => {
      const first = await service.generarAcuerdo({
        listingId: listing,
        hostId: host,
        roomieId: roomie,
      });
      const next = await service.crearNuevaVersion(first.id);
      expect(next.version).toBe(2);
      expect(next.supersedesAgreementId).toBe(first.id);
      expect(next.roomieIds).toEqual([roomie]);
      expect(next.acceptances).toHaveLength(0);
    });

    it("re-snapshota las reglas actuales del listing", async () => {
      const first = await service.generarAcuerdo({
        listingId: listing,
        hostId: host,
        roomieId: roomie,
      });
      const updatedSnapshot = buildSnapshot(host);
      updatedSnapshot.petsAllowed = true;
      updatedSnapshot.costs = [
        {
          kind: "rent",
          concept: "Renta mensual",
          amount: 4000,
          isIncluded: false,
          isProrated: false,
        },
      ];
      repo.snapshots.set(listing, updatedSnapshot);
      const next = await service.crearNuevaVersion(first.id);
      expect(next.rulesSnapshot.petsAllowed).toBe(true);
      expect(next.rulesSnapshot.costs?.[0]?.amount).toBe(4000);
    });
  });

  describe("entidad Agreement — invariantes", () => {
    it("rechaza un snapshot con roomieIds vacíos", () => {
      const rules: AgreementRuleSet = {
        hostId: host,
        roomieIds: [],
      };
      expect(
        () =>
          new Agreement({
            id: "a",
            listingId: listing,
            rulesSnapshot: rules,
            acceptances: [],
            createdAt: new Date(),
          }),
      ).toThrow(/al menos un roomie/);
    });

    it("rechaza roomieIds duplicados", () => {
      const rules: AgreementRuleSet = {
        hostId: host,
        roomieIds: [roomie, roomie],
      };
      expect(
        () =>
          new Agreement({
            id: "a",
            listingId: listing,
            rulesSnapshot: rules,
            acceptances: [],
            createdAt: new Date(),
          }),
      ).toThrow(/duplicados/);
    });
  });
});
