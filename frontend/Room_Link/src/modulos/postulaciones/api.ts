// M09 — Postulaciones de una habitación (vista del arrendador/host).
// Consume el backend de `applications` (ya existente):
//   GET   /api/v1/applications/listing/:listingId  → lista de postulaciones (gateada al host dueño)
//   PATCH /api/v1/applications/:id/decide          → { decision: 'accept' | 'reject' }
// y el perfil público del candidato para la pantalla de detalle (M09.2).

import { solicitud } from '../compatibilidad/api';

export interface Postulacion {
  id: string;
  listingId: string;
  applicantId: string;
  status: 'pending' | 'accepted' | 'rejected' | string;
  message: string | null;
  compatibilityScore: number | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface PerfilCandidato {
  userId: string;
  fullName: string;
  age: number;
  occupation: string | null;
  bio: string | null;
  identityStatus: string;
  isVerified: boolean;
}

export type Decision = 'accept' | 'reject';

export function listarPostulaciones(listingId: string) {
  return solicitud<Postulacion[]>(
    `/api/v1/applications/listing/${encodeURIComponent(listingId)}`,
  );
}

export function decidirPostulacion(id: string, decision: Decision) {
  return solicitud<Postulacion>(
    `/api/v1/applications/${encodeURIComponent(id)}/decide`,
    { method: 'PATCH', body: JSON.stringify({ decision }) },
  );
}

export function obtenerPerfilCandidato(userId: string) {
  return solicitud<PerfilCandidato>(
    `/api/v1/profiles/${encodeURIComponent(userId)}`,
  );
}
