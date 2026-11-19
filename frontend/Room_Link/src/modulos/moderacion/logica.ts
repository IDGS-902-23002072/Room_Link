export interface DenunciaFiltrable {
  listingId?: string | null;
  targetListingId?: string | null;
  targetUserId?: string | null;
  targetMessageId?: number | null;
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

export function esDenunciaDeAnuncio(denuncia: DenunciaFiltrable): boolean {
  const idAnuncio = denuncia.listingId || denuncia.targetListingId;
  return Boolean(idAnuncio) && !denuncia.targetUserId && !denuncia.targetMessageId;
}

export function obtenerIdAnuncioDenuncia(
  denuncia: DenunciaFiltrable,
): string | null {
  return denuncia.listingId || denuncia.targetListingId || null;
}
