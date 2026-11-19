import { configuracionApi, solicitud } from '@/modulos/compatibilidad/api';

export interface AceptacionAcuerdo {
  userId: string;
  acceptedAt: string | null;
}

export interface AcuerdoDto {
  id: string;
  listingId: string;
  version: number;
  supersedesAgreementId: string | null;
  hostId: string;
  roomieIds: string[];
  rulesSnapshot: Record<string, unknown>;
  acceptances: AceptacionAcuerdo[];
  fullyAccepted: boolean;
  createdAt: string;
}

export function listarAcuerdosUsuario(): Promise<{ items: AcuerdoDto[] }> {
  const { userId } = configuracionApi();
  return solicitud<{ items: AcuerdoDto[] }>(
    `/api/v1/agreements/by-user/${encodeURIComponent(userId)}`,
  );
}

export function listarAcuerdosAnuncio(
  listingId: string,
): Promise<{ items: AcuerdoDto[] }> {
  return solicitud<{ items: AcuerdoDto[] }>(
    `/api/v1/agreements/by-listing/${encodeURIComponent(listingId)}`,
  );
}

export function obtenerAcuerdo(agreementId: string): Promise<AcuerdoDto> {
  return solicitud<AcuerdoDto>(
    `/api/v1/agreements/${encodeURIComponent(agreementId)}`,
  );
}

export function crearAcuerdoConvivencia(datos: {
  listingId: string;
  roomieId: string;
  hostId?: string;
}): Promise<AcuerdoDto> {
  const { userId } = configuracionApi();
  return solicitud<AcuerdoDto>('/api/v1/agreements', {
    method: 'POST',
    body: JSON.stringify({
      listingId: datos.listingId.trim(),
      hostId: (datos.hostId ?? userId).trim(),
      roomieId: datos.roomieId.trim(),
    }),
  });
}

export function aceptarAcuerdoConvivencia(
  agreementId: string,
): Promise<AcuerdoDto> {
  return solicitud<AcuerdoDto>(
    `/api/v1/agreements/${encodeURIComponent(agreementId)}/accept`,
    { method: 'POST' },
  );
}

export function crearNuevaVersionAcuerdo(
  agreementId: string,
): Promise<AcuerdoDto> {
  return solicitud<AcuerdoDto>(
    `/api/v1/agreements/${encodeURIComponent(agreementId)}/versions`,
    { method: 'POST' },
  );
}
