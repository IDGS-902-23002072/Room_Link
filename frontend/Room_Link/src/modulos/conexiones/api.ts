import { solicitud } from '@/modulos/compatibilidad/api';

export type DireccionConexion = 'incoming' | 'outgoing' | 'all';
export type EstadoConexion = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface ConexionDto {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: EstadoConexion;
  introMessage: string | null;
  responseMessage: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export function listarConexiones(
  direction: DireccionConexion = 'all',
): Promise<ConexionDto[]> {
  return solicitud<ConexionDto[]>(
    `/api/v1/connections?direction=${encodeURIComponent(direction)}`,
  );
}

export function responderConexion(
  connectionId: string,
  decision: 'accept' | 'reject',
  responseMessage: string | null = null,
): Promise<ConexionDto> {
  return solicitud<ConexionDto>(
    `/api/v1/connections/${encodeURIComponent(connectionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ decision, responseMessage }),
    },
  );
}

export function cancelarConexion(connectionId: string): Promise<ConexionDto> {
  return solicitud<ConexionDto>(
    `/api/v1/connections/${encodeURIComponent(connectionId)}`,
    { method: 'DELETE' },
  );
}
