import { randomUUID } from "node:crypto";
import {
  Agreement,
  type AgreementRuleSet,
  type IAgreementRepository,
} from "../../domain/index.js";

export class AgreementsService {
  constructor(private readonly repo: IAgreementRepository) {}

  /**
   * EL-12.3 — Función: generarAcuerdo(habitacion_id, anfitrion_id, roomie_id).
   * Toma un snapshot de las reglas y costos del listing y crea un acuerdo v1
   * entre el anfitrión y el roomie, sin aceptaciones aún.
   */
  async generarAcuerdo(input: {
    listingId: string;
    hostId: string;
    roomieId: string;
  }): Promise<Agreement> {
    if (!input.listingId || !input.hostId || !input.roomieId) {
      throw new Error("listingId, hostId y roomieId son obligatorios.");
    }
    if (input.hostId === input.roomieId) {
      throw new Error("El anfitrión no puede figurar como roomie.");
    }

    const snapshot = await this.repo.getListingSnapshot(input.listingId);
    if (!snapshot) {
      throw new Error(`No existe el listing ${input.listingId}.`);
    }
    if (snapshot.hostId !== input.hostId) {
      throw new Error(
        "El usuario indicado como anfitrión no coincide con el anfitrión del listing.",
      );
    }

    const rulesSnapshot: AgreementRuleSet = {
      visitsPolicy: snapshot.visitsPolicy,
      partiesAllowed: snapshot.partiesAllowed,
      quietHoursStart: snapshot.quietHoursStart,
      quietHoursEnd: snapshot.quietHoursEnd,
      petsAllowed: snapshot.petsAllowed,
      smokingAllowed: snapshot.smokingAllowed,
      commonAreasNotes: snapshot.commonAreasNotes,
      extraRules: snapshot.extraRules,
      costs: snapshot.costs,
      listingTitle: snapshot.listingTitle,
      hostId: input.hostId,
      roomieIds: [input.roomieId],
      version: 1,
      supersedesAgreementId: null,
    };

    const agreement = new Agreement({
      id: randomUUID(),
      listingId: input.listingId,
      rulesSnapshot,
      acceptances: [],
      createdAt: new Date(),
    });

    return await this.repo.create(agreement);
  }

  /** EL-12.4 — Función: aceptarAcuerdo(acuerdo_id, usuario_id). */
  async aceptarAcuerdo(
    agreementId: string,
    userId: string,
  ): Promise<Agreement> {
    const agreement = await this.repo.findById(agreementId);
    if (!agreement) {
      throw new Error(`Acuerdo ${agreementId} no encontrado.`);
    }
    const now = new Date();
    // La entidad valida que el usuario sea participante (EL-12.6).
    agreement.accept(userId, now);
    await this.repo.recordAcceptance(agreementId, userId, now);
    return agreement;
  }

  /** EL-12.5 — Función: crearNuevaVersion(acuerdo_id). */
  async crearNuevaVersion(agreementId: string): Promise<Agreement> {
    const previous = await this.repo.findById(agreementId);
    if (!previous) {
      throw new Error(`Acuerdo ${agreementId} no encontrado.`);
    }

    const snapshot = await this.repo.getListingSnapshot(previous.listingId);
    if (!snapshot) {
      throw new Error(`No existe el listing ${previous.listingId}.`);
    }

    const newRules: AgreementRuleSet = {
      visitsPolicy: snapshot.visitsPolicy,
      partiesAllowed: snapshot.partiesAllowed,
      quietHoursStart: snapshot.quietHoursStart,
      quietHoursEnd: snapshot.quietHoursEnd,
      petsAllowed: snapshot.petsAllowed,
      smokingAllowed: snapshot.smokingAllowed,
      commonAreasNotes: snapshot.commonAreasNotes,
      extraRules: snapshot.extraRules,
      costs: snapshot.costs,
      listingTitle: snapshot.listingTitle,
      hostId: previous.hostId,
      roomieIds: previous.roomieIds,
      version: previous.version + 1,
      supersedesAgreementId: previous.id,
    };

    const next = new Agreement({
      id: randomUUID(),
      listingId: previous.listingId,
      rulesSnapshot: newRules,
      acceptances: [],
      createdAt: new Date(),
    });

    return await this.repo.create(next);
  }

  async getAgreement(agreementId: string): Promise<Agreement> {
    const agreement = await this.repo.findById(agreementId);
    if (!agreement) {
      throw new Error(`Acuerdo ${agreementId} no encontrado.`);
    }
    return agreement;
  }

  async listAgreementsForListing(listingId: string): Promise<Agreement[]> {
    return this.repo.findByListing(listingId);
  }

  async listAgreementsForUser(userId: string): Promise<Agreement[]> {
    return this.repo.findByUser(userId);
  }
}
