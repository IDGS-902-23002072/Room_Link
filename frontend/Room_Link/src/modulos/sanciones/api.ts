import { solicitud } from '../compatibilidad/api';

export type TipoSancion =
  | 'warning'
  | 'temporary_suspension'
  | 'permanent_ban'
  | 'listing_removed'
  | 'dismissed';

export interface SancionDto {
  id: string;
  reportId: string | null;
  adminId: string;
  userId: string | null;
  listingId: string | null;
  type: TipoSancion;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
}

export function listarSancionesUsuario(userId: string): Promise<SancionDto[]> {
  return solicitud<SancionDto[]>(
    `/api/v1/sanctions?userId=${encodeURIComponent(userId.trim())}`,
  );
}

export function emitirSancion(datos: {
  userId?: string | null;
  listingId?: string | null;
  reportId?: string | null;
  type: TipoSancion;
  reason: string;
  expiresAt?: string | null;
}): Promise<SancionDto> {
  return solicitud<SancionDto>('/api/v1/sanctions', {
    method: 'POST',
    body: JSON.stringify({
      userId: datos.userId?.trim() || null,
      listingId: datos.listingId?.trim() || null,
      reportId: datos.reportId?.trim() || null,
      type: datos.type,
      reason: datos.reason.trim(),
      expiresAt: datos.expiresAt?.trim() || null,
    }),
  });
}

export function revocarSancion(sanctionId: string): Promise<{ ok: boolean }> {
  return solicitud<{ ok: boolean }>(
    `/api/v1/sanctions/${encodeURIComponent(sanctionId)}`,
    { method: 'DELETE' },
  );
}
