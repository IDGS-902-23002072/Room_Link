import { solicitud } from '@/modulos/compatibilidad/api';

export interface SalaChat {
  id: string;
  connectionId?: string | null;
  applicationId?: string | null;
  memberIds: string[];
  createdAt: string;
}

export interface MensajeChat {
  id: number;
  roomId: string;
  senderId: string;
  body: string;
  sentAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  status?: string;
  mine?: boolean;
  direction?: 'in' | 'out';
}

export interface ElementoBandejaChat {
  room?: SalaChat;
  roomId?: string;
  id?: string;
  counterpartId: string | null;
  peer?: {
    id?: string;
    fullName?: string;
    name?: string;
    email?: string;
    affinity?: number;
    compatibility?: number;
  };
  counterpart?: {
    id?: string;
    fullName?: string;
    name?: string;
    email?: string;
  };
  name?: string;
  affinity?: number;
  compatibility?: number;
  lastMessage: (MensajeChat & { time?: string }) | null;
  preview?: string;
  unreadCount: number;
  unread?: number;
}

export interface ContextoChat {
  roomId: string;
  counterpartId: string | null;
  connectionId?: string | null;
  applicationId?: string | null;
  listingId?: string | null;
  peer?: {
    fullName?: string;
    name?: string;
    email?: string;
    affinity?: number;
    compatibility?: number;
  };
  counterpart?: {
    fullName?: string;
    name?: string;
    email?: string;
  };
  listing?: {
    id?: string;
    title?: string;
    monthlyRent?: number | string;
  };
  room?: {
    id?: string;
    title?: string;
    monthlyRent?: number | string;
  };
  connection?: {
    id?: string;
    status?: string;
    acceptedAt?: string;
    date?: string;
  };
  affinity?: number;
  compatibility?: number;
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

export function normalizarHistorial(mensajes: MensajeChat[]): MensajeChat[] {
  return [...mensajes].sort((a, b) => a.id - b.id);
}

export function obtenerBandejaMensajes(): Promise<ElementoBandejaChat[]> {
  return solicitud<ElementoBandejaChat[]>('/api/v1/messages');
}

export function abrirSalaChat(origen: {
  connectionId?: string;
  applicationId?: string;
}): Promise<SalaChat> {
  return solicitud<SalaChat>('/api/v1/messages/rooms', {
    method: 'POST',
    body: JSON.stringify(origen),
  });
}

export function obtenerMensajesSala(
  roomId: string,
  limit = 50,
  beforeId?: number,
): Promise<MensajeChat[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeId !== undefined) {
    params.set('beforeId', String(beforeId));
  }
  return solicitud<MensajeChat[]>(
    `/api/v1/messages/rooms/${encodeURIComponent(roomId)}/messages?${params.toString()}`,
  );
}

export function enviarMensajeSala(
  roomId: string,
  body: string,
): Promise<MensajeChat> {
  return solicitud<MensajeChat>(
    `/api/v1/messages/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    },
  );
}

export function marcarSalaEntregada(
  roomId: string,
): Promise<{ updated: number }> {
  return solicitud<{ updated: number }>(
    `/api/v1/messages/rooms/${encodeURIComponent(roomId)}/delivered`,
    { method: 'PATCH' },
  );
}

export function marcarSalaLeida(roomId: string): Promise<{ updated: number }> {
  return solicitud<{ updated: number }>(
    `/api/v1/messages/rooms/${encodeURIComponent(roomId)}/read`,
    { method: 'PATCH' },
  );
}

export function obtenerContextoSala(roomId: string): Promise<ContextoChat> {
  return solicitud<ContextoChat>(
    `/api/v1/messages/rooms/${encodeURIComponent(roomId)}/context`,
  );
}

export type MotivoDenunciaMensaje =
  | 'fraud'
  | 'harassment'
  | 'spam'
  | 'inappropriate'
  | 'fake_profile'
  | 'other';

export function reportarMensajeChat(
  messageId: number,
  reason: MotivoDenunciaMensaje,
  description?: string,
): Promise<{ id: string; status: string }> {
  return solicitud<{ id: string; status: string }>(
    `/api/v1/moderation/reports/messages/${encodeURIComponent(String(messageId))}`,
    {
      method: 'POST',
      body: JSON.stringify({ reason, description }),
    },
  );
}

export function reportarUsuarioChat(
  userId: string,
  reason: MotivoDenunciaMensaje,
  description?: string,
): Promise<{ id: string; status: string }> {
  return solicitud<{ id: string; status: string }>(
    `/api/v1/moderation/reports/users/${encodeURIComponent(userId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ reason, description }),
    },
  );
}
