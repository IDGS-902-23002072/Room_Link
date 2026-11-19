import { solicitud } from '../compatibilidad/api';

export type TipoNotificacion =
  | 'application_status_changed'
  | 'connection_request'
  | 'connection_accepted'
  | 'new_message'
  | 'agreement_pending'
  | 'listing_moderated'
  | 'account_sanction'
  | 'system';

export interface NotificacionDto {
  id: string;
  userId: string;
  type: TipoNotificacion;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface RespuestaListadoNotificaciones {
  items: NotificacionDto[];
  unreadCount: number;
}

export interface PreferenciaNotificacion {
  userId?: string;
  type: TipoNotificacion;
  inApp: boolean;
  email: boolean;
}

export function listarNotificaciones(opciones?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<RespuestaListadoNotificaciones> {
  const params = new URLSearchParams();
  if (opciones?.unreadOnly) params.set('unreadOnly', 'true');
  if (opciones?.limit) params.set('limit', String(opciones.limit));
  if (opciones?.offset) params.set('offset', String(opciones.offset));
  const qs = params.toString();
  return solicitud<RespuestaListadoNotificaciones>(
    `/api/v1/notifications${qs ? `?${qs}` : ''}`,
  );
}

export function marcarNotificacionLeida(id: string): Promise<{ ok: boolean }> {
  return solicitud<{ ok: boolean }>(
    `/api/v1/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  );
}

export function marcarTodasNotificacionesLeidas(): Promise<{ updated: number }> {
  return solicitud<{ updated: number }>('/api/v1/notifications/mark-all-read', {
    method: 'POST',
  });
}

export function obtenerPreferenciasNotificaciones(): Promise<{
  preferences: PreferenciaNotificacion[];
}> {
  return solicitud<{ preferences: PreferenciaNotificacion[] }>(
    '/api/v1/notifications/preferences',
  );
}

export function actualizarPreferenciasNotificaciones(
  preferences: PreferenciaNotificacion[],
): Promise<{ preferences: PreferenciaNotificacion[] }> {
  return solicitud<{ preferences: PreferenciaNotificacion[] }>(
    '/api/v1/notifications/preferences',
    {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    },
  );
}
