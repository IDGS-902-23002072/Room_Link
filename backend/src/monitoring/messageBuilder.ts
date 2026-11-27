import type { DomainEvent } from "../modules/notifications/event-bus.js";
import type { EventSource } from "./routePattern.js";

export type LogResult = "success" | "rejected" | "failed";

export interface DescribedEvent {
  module: string;
  action: string;
  result: LogResult;
  message: string;
  detail: Record<string, unknown>;
  actorId: string | null;
  source: EventSource;
}

const MODULE_BY_EVENT: Record<string, string> = {
  UserRegisteredEvent: "autenticación",
  LoginSucceededEvent: "autenticación",
  LoginFailedEvent: "autenticación",
  ConnectionRequestedEvent: "conexiones",
  ConnectionAcceptedEvent: "conexiones",
  ApplicationStatusChanged: "postulaciones",
  ListingModeratedEvent: "moderación",
  SanctionIssuedEvent: "sanciones",
  MessageSentEvent: "mensajería",
};

/** Solo claves inocuas: nunca correo, token, IP, userAgent ni cuerpo de mensaje. */
const SAFE_KEYS = new Set([
  "reason",
  "type",
  "status",
  "result",
  "listingId",
  "roomId",
  "applicationId",
  "connectionId",
  "agreementId",
  "reportId",
  "sanctionId",
  "category",
  "score",
  "version",
  "provider",
]);

export function sanitizeDetail(payload: Record<string, unknown>): Record<string, unknown> {
  const detail: Record<string, unknown> = {};
  for (const key of SAFE_KEYS) {
    const value = payload[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      detail[key] = value;
    }
  }
  return detail;
}

function resolveActor(event: DomainEvent): string | null {
  for (const key of ["adminId", "actorId", "userId"]) {
    const value = event.payload[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function failureReason(payload: Record<string, unknown>): string {
  switch (payload.reason) {
    case "invalid_password":
      return "porque la contraseña no coincide con la registrada para la cuenta";
    case "user_not_found":
      return "porque no encontró una cuenta con esos datos";
    case "locked":
      return "porque la cuenta quedó bloqueada después de varios intentos fallidos";
    case "inactive":
      return "porque la cuenta no está activa";
    default:
      return "porque las credenciales no pudieron validarse";
  }
}

function applicationMessage(payload: Record<string, unknown>): { message: string; result: LogResult } {
  switch (payload.status) {
    case "accepted":
      return {
        message:
          "Se aceptó una postulación a una habitación. El anfitrión tomó la decisión y el solicitante quedó notificado.",
        result: "success",
      };
    case "rejected":
      return {
        message:
          "Se rechazó una postulación a una habitación. El anfitrión tomó la decisión y la solicitud no continúa.",
        result: "rejected",
      };
    case "waitlisted":
      return {
        message:
          "Se movió una postulación a lista de espera. La solicitud sigue registrada sin una decisión definitiva.",
        result: "success",
      };
    default:
      return {
        message: "Se actualizó el estado de una postulación a una habitación.",
        result: "success",
      };
  }
}

/** Convierte un evento de dominio en un registro legible para la bitácora. */
export function describeDomainEvent(
  event: DomainEvent,
  source: EventSource = "real",
): DescribedEvent {
  const module = MODULE_BY_EVENT[event.type] ?? "sistema";
  const common = {
    module,
    action: event.type,
    detail: sanitizeDetail(event.payload),
    actorId: resolveActor(event),
    source,
  };

  switch (event.type) {
    case "UserRegisteredEvent":
      return {
        ...common,
        result: "success",
        message: event.payload.provider === "google"
          ? "El usuario se registró correctamente con su cuenta de Google. El sistema creó la cuenta y la vinculó al proveedor."
          : "El usuario se registró correctamente. El sistema validó los datos y creó la cuenta; ya puede iniciar sesión.",
      };
    case "LoginSucceededEvent":
      return {
        ...common,
        result: "success",
        message:
          "El usuario inició sesión correctamente. El sistema validó sus credenciales y generó una sesión activa.",
      };
    case "LoginFailedEvent":
      return {
        ...common,
        result: "rejected",
        message: `Se rechazó el inicio de sesión ${failureReason(event.payload)}. No se creó ninguna sesión.`,
      };
    case "ConnectionRequestedEvent":
      return {
        ...common,
        result: "success",
        message:
          "Se envió una solicitud de conexión correctamente. La solicitud quedó pendiente de la respuesta del otro usuario.",
      };
    case "ConnectionAcceptedEvent":
      return {
        ...common,
        result: "success",
        message:
          "Se aceptó una solicitud de conexión. Ambos usuarios quedaron vinculados y el chat habilitado.",
      };
    case "ApplicationStatusChanged": {
      const described = applicationMessage(event.payload);
      return { ...common, ...described };
    }
    case "ListingModeratedEvent":
      return {
        ...common,
        result: event.payload.status === "rejected" || event.payload.status === "removed" ? "rejected" : "success",
        message:
          "Se moderó una habitación correctamente. El administrador registró una decisión y el anuncio quedó actualizado.",
      };
    case "SanctionIssuedEvent":
      return {
        ...common,
        result: "success",
        message:
          "El administrador aplicó una sanción correctamente. La cuenta afectada quedó sujeta a la sanción registrada.",
      };
    case "MessageSentEvent":
      return {
        ...common,
        result: "success",
        message:
          "Se envió un mensaje en el chat correctamente. El sistema lo guardó en la conversación y avisó a los participantes.",
      };
    default:
      return {
        ...common,
        result: "success",
        message: `Se registró una operación del módulo ${module}. El sistema guardó el evento ${event.type} sin detalles adicionales.`,
      };
  }
}
