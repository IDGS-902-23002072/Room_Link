import type { Application } from "../../domain/index.js";

export interface ApplicationResponseDto {
  id: string;
  listingId: string;
  applicantId: string;
  status: string;
  message: string | null;
  compatibilityScore: number | null;
  createdAt: string;
  decidedAt: string | null;
}

/**
 * Vista / Serializador para el módulo de Solicitudes (Applications).
 */
export class ApplicationView {
  public static toResponse(app: Application): ApplicationResponseDto {
    return {
      id: app.id,
      listingId: app.listingId,
      applicantId: app.applicantId,
      status: app.status,
      message: app.message ?? null,
      compatibilityScore: app.compatibilityScore ?? null,
      createdAt: app.toJSON().createdAt as string,
      decidedAt: app.toJSON().decidedAt ? String(app.toJSON().decidedAt) : null,
    };
  }

  public static toList(apps: Application[]): ApplicationResponseDto[] {
    return apps.map((a) => this.toResponse(a));
  }
}
