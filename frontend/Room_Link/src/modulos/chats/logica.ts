export interface MensajeOrdenable {
  id: number;
}

export function validarMensaje(cuerpo: string): {
  error: string | null;
  body: string;
} {
  const normalizado = cuerpo.trim();
  if (normalizado.length < 1 || normalizado.length > 4000) {
    return {
      error: 'El mensaje debe tener entre 1 y 4000 caracteres.',
      body: normalizado,
    };
  }
  return { error: null, body: normalizado };
}

export function normalizarHistorial<T extends MensajeOrdenable>(
  mensajes: T[],
): T[] {
  return [...mensajes].sort((a, b) => a.id - b.id);
}
