import { solicitud } from '@/modulos/compatibilidad/api';

export type DecisionModeracion = 'approved' | 'rejected' | 'removed';
export type EstadoRevisionAnuncio = 'pending' | DecisionModeracion;
export type EstadoDenuncia = 'open' | 'in_review' | 'resolved' | 'dismissed';
export type TipoObjetivoDenuncia = 'listing' | 'user' | 'message';
export type MotivoDenunciaAnuncio = 'fraud' | 'spam' | 'inappropriate' | 'other';
export type MotivoDenunciaGeneral =
  | MotivoDenunciaAnuncio
  | 'harassment'
  | 'fake_profile';

export interface ElementoColaModeracion {
  id?: string;
  listingId: string;
  title?: string;
  listingTitle?: string;
  folio?: string;
  monthlyRent?: number | string;
  publishedAt?: string;
  status: EstadoRevisionAnuncio;
  reviewerId?: string | null;
  reason?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  date?: string;
  moderator?: string;
  decision?: DecisionModeracion;
}

export interface DenunciaModeracion {
  id: string;
  reporterId: string;
  targetType?: TipoObjetivoDenuncia;
  listingId?: string | null;
  targetListingId?: string | null;
  targetUserId?: string | null;
  targetMessageId?: number | null;
  reason: MotivoDenunciaGeneral;
  description?: string | null;
  detail?: string | null;
  evidence?: string | null;
  title?: string;
  listingTitle?: string;
  folio?: string;
  count?: number;
  status: EstadoDenuncia;
  createdAt: string;
  resolvedAt?: string | null;
}

export function validarDecisionModeracion(
  decision: string,
  reason: string,
): string | null {
  if (!['approved', 'rejected', 'removed'].includes(decision)) {
    return 'Selecciona una decisión válida.';
  }
  if (decision !== 'approved' && !reason.trim()) {
    return 'El rechazo o la baja requieren un motivo.';
  }
  return null;
}

export function esDenunciaDeAnuncio(denuncia: DenunciaModeracion): boolean {
  const idAnuncio = denuncia.listingId || denuncia.targetListingId;
  return Boolean(idAnuncio) && !denuncia.targetUserId && !denuncia.targetMessageId;
}

export function obtenerIdAnuncioDenuncia(
  denuncia: DenunciaModeracion,
): string | null {
  return denuncia.listingId || denuncia.targetListingId || null;
}

export function listarColaModeracion(): Promise<ElementoColaModeracion[]> {
  return solicitud<ElementoColaModeracion[]>('/api/v1/moderation/admin/queue');
}

export function encolarAnuncioModeracion(
  listingId: string,
): Promise<ElementoColaModeracion> {
  return solicitud<ElementoColaModeracion>(
    `/api/v1/moderation/admin/queue/${encodeURIComponent(listingId)}`,
    { method: 'POST' },
  );
}

export function decidirAnuncioModeracion(
  listingId: string,
  decision: DecisionModeracion,
  reason?: string,
): Promise<ElementoColaModeracion> {
  return solicitud<ElementoColaModeracion>(
    `/api/v1/moderation/admin/queue/${encodeURIComponent(listingId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        decision,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      }),
    },
  );
}

export function listarDenunciasModeracion(filtro?: {
  targetType?: TipoObjetivoDenuncia;
  status?: EstadoDenuncia;
}): Promise<DenunciaModeracion[]> {
  const params = new URLSearchParams();
  if (filtro?.targetType) params.set('targetType', filtro.targetType);
  if (filtro?.status) params.set('status', filtro.status);
  const qs = params.toString();
  return solicitud<DenunciaModeracion[]>(
    `/api/v1/moderation/admin/reports${qs ? `?${qs}` : ''}`,
  );
}

export function resolverDenunciaModeracion(
  reportId: string,
  status: 'resolved' | 'dismissed',
): Promise<DenunciaModeracion> {
  return solicitud<DenunciaModeracion>(
    `/api/v1/moderation/admin/reports/${encodeURIComponent(reportId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export function listarHistorialModeracion(): Promise<ElementoColaModeracion[]> {
  return solicitud<ElementoColaModeracion[]>(
    '/api/v1/moderation/admin/history',
  );
}

export function denunciarAnuncio(
  listingId: string,
  reason: MotivoDenunciaAnuncio,
  description?: string,
): Promise<DenunciaModeracion> {
  return solicitud<DenunciaModeracion>(
    `/api/v1/moderation/reports/listings/${encodeURIComponent(listingId)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        reason,
        ...(description?.trim() ? { description: description.trim() } : {}),
      }),
    },
  );
}
