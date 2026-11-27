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

/** Operaciones legibles para la bitácora; nunca el nombre técnico del evento. */
const ACTION_BY_EVENT: Record<string, string> = {
  UserRegisteredEvent: "Registro de cuenta",
  LoginSucceededEvent: "Inicio de sesión",
  LoginFailedEvent: "Inicio de sesión rechazado",
  ConnectionRequestedEvent: "Solicitud de conexión",
  ConnectionAcceptedEvent: "Conexión aceptada",
  ApplicationStatusChanged: "Decisión de postulación",
  ListingModeratedEvent: "Moderación de anuncio",
  SanctionIssuedEvent: "Sanción aplicada",
  MessageSentEvent: "Mensaje enviado",
};

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

interface RequestOperation {
  module: string;
  action: string;
  verb: string;
  success: string;
}

/**
 * Operaciones principales de negocio. La clave es método + patrón de ruta ya
 * saneado (sin identificadores). Nunca se guarda la URL original ni el cuerpo.
 */
const REQUEST_OPERATIONS: Record<string, RequestOperation> = {
  "POST /api/v1/auth/register": {
    module: "autenticación",
    action: "Registro de cuenta",
    verb: "crear la cuenta",
    success:
      "Se creó una cuenta nueva. El sistema validó los datos y ya se puede iniciar sesión.",
  },
  "POST /api/v1/auth/login": {
    module: "autenticación",
    action: "Inicio de sesión",
    verb: "iniciar sesión",
    success:
      "La persona inició sesión correctamente. El sistema validó sus credenciales y abrió una sesión.",
  },
  "GET /api/v1/auth/me": {
    module: "autenticación",
    action: "Consulta de sesión",
    verb: "consultar la sesión",
    success: "Se consultaron los datos de la sesión activa.",
  },
  "POST /api/v1/profiles": {
    module: "perfil",
    action: "Creación de perfil",
    verb: "guardar el perfil",
    success: "Se guardó el perfil personal con los datos enviados.",
  },
  "PUT /api/v1/profiles/:id": {
    module: "perfil",
    action: "Actualización de perfil",
    verb: "actualizar el perfil",
    success: "Se actualizó el perfil personal.",
  },
  "POST /api/v1/profiles/:id/photos": {
    module: "perfil",
    action: "Foto de perfil",
    verb: "guardar la foto",
    success: "Se guardó una foto en el perfil.",
  },
  "DELETE /api/v1/profiles/:id/photos/:id": {
    module: "perfil",
    action: "Borrado de foto",
    verb: "eliminar la foto",
    success: "Se eliminó una foto del perfil.",
  },
  "PUT /api/v1/compatibility/:id": {
    module: "compatibilidad",
    action: "Test de convivencia",
    verb: "guardar el test de convivencia",
    success:
      "Se guardaron las siete respuestas del test de convivencia y se calculó el resumen de afinidad.",
  },
  "GET /api/v1/compatibility/:id": {
    module: "compatibilidad",
    action: "Consulta del test",
    verb: "consultar el test de convivencia",
    success: "Se consultó el test de convivencia guardado.",
  },
  "GET /api/v1/compatibility/:id/feed": {
    module: "afinidades",
    action: "Feed de afinidad",
    verb: "consultar el feed de afinidad",
    success: "Se consultó el listado de perfiles recomendados por afinidad.",
  },
  "GET /api/v1/compatibility/:id/candidates/:id": {
    module: "afinidades",
    action: "Perfil candidato",
    verb: "consultar el perfil candidato",
    success: "Se consultó el detalle de un perfil candidato.",
  },
  "POST /api/v1/compatibility/:id/connections": {
    module: "conexiones",
    action: "Solicitud de conexión desde afinidad",
    verb: "enviar la solicitud de conexión",
    success:
      "Se envió una solicitud de conexión. Quedó pendiente de la respuesta del otro usuario.",
  },
  "POST /api/v1/rooms": {
    module: "habitaciones",
    action: "Creación de anuncio",
    verb: "crear el anuncio",
    success:
      "Se creó un anuncio de habitación en borrador. Todavía no está publicado.",
  },
  "GET /api/v1/rooms": {
    module: "habitaciones",
    action: "Listado de habitaciones",
    verb: "consultar las habitaciones",
    success: "Se consultó el listado de habitaciones disponibles.",
  },
  "GET /api/v1/rooms/feed": {
    module: "habitaciones",
    action: "Feed de habitaciones",
    verb: "consultar el feed de habitaciones",
    success: "Se consultó el feed de habitaciones disponibles.",
  },
  "GET /api/v1/rooms/:id": {
    module: "habitaciones",
    action: "Detalle de habitación",
    verb: "consultar la habitación",
    success: "Se consultó el detalle de una habitación.",
  },
  "PATCH /api/v1/rooms/:id/publish": {
    module: "habitaciones",
    action: "Publicación de anuncio",
    verb: "publicar el anuncio",
    success:
      "Se publicó el anuncio. La habitación ya es visible para quienes buscan alojamiento.",
  },
  "PATCH /api/v1/rooms/:id/close": {
    module: "habitaciones",
    action: "Cierre de anuncio",
    verb: "cerrar el anuncio",
    success:
      "Se cerró la publicación. El anuncio sale del listado sin borrar la información.",
  },
  "PATCH /api/v1/rooms/:id": {
    module: "habitaciones",
    action: "Edición de anuncio",
    verb: "actualizar el anuncio",
    success: "Se actualizaron los datos del anuncio.",
  },
  "GET /api/v1/rooms/:id/rules": {
    module: "reglas y costos",
    action: "Consulta de reglas",
    verb: "consultar las reglas",
    success: "Se consultaron las reglas de convivencia del anuncio.",
  },
  "PUT /api/v1/rooms/:id/rules": {
    module: "reglas y costos",
    action: "Guardado de reglas",
    verb: "guardar las reglas",
    success: "Se guardaron las reglas de convivencia del anuncio.",
  },
  "GET /api/v1/rooms/:id/costs": {
    module: "reglas y costos",
    action: "Consulta de costos",
    verb: "consultar los costos",
    success: "Se consultaron los costos del anuncio.",
  },
  "PUT /api/v1/rooms/:id/costs": {
    module: "reglas y costos",
    action: "Guardado de costos",
    verb: "guardar los costos",
    success: "Se guardaron los costos del anuncio.",
  },
  "POST /api/v1/applications": {
    module: "postulaciones",
    action: "Envío de postulación",
    verb: "enviar la postulación",
    success:
      "Se envió una postulación a una habitación. Quedó pendiente de la decisión del anfitrión.",
  },
  "GET /api/v1/applications/listing/:id": {
    module: "postulaciones",
    action: "Postulaciones del anuncio",
    verb: "consultar las postulaciones recibidas",
    success: "Se consultaron las postulaciones recibidas en un anuncio.",
  },
  "PATCH /api/v1/applications/:id/decide": {
    module: "postulaciones",
    action: "Decisión de postulación",
    verb: "resolver la postulación",
    success:
      "El anfitrión respondió la postulación. La decisión quedó registrada y notificada.",
  },
  "GET /api/v1/applications/me": {
    module: "postulaciones",
    action: "Mis postulaciones",
    verb: "consultar mis postulaciones",
    success: "Se consultaron las postulaciones enviadas por el usuario.",
  },
};

const normalizedRoute = (route: string): string =>
  route.replace(/`/g, "").replace(/:[A-Za-z0-9_]+/g, ":id");

const rejectionReason = (status: number): string => {
  if (status === 400) return "los datos enviados no son válidos";
  if (status === 401) return "la sesión no es válida o no se envió";
  if (status === 403) return "la cuenta no tiene permiso para esta operación";
  if (status === 404) return "no se encontró el recurso solicitado";
  if (status === 409) return "la operación entra en conflicto con el estado actual";
  if (status === 413) return "el archivo o cuerpo enviado es demasiado grande";
  if (status === 422) return "faltan datos obligatorios";
  return "la aplicación rechazó la petición";
};

/** Convierte una petición HTTP en una explicación corta para la bitácora. */
export function describeRequest(
  method: string,
  routePattern: string,
  status: number,
  moduleFallback = "sistema",
): DescribedEvent {
  const key = `${method.toUpperCase()} ${normalizedRoute(routePattern)}`;
  const operation = REQUEST_OPERATIONS[key];
  const result: LogResult = status >= 500 ? "failed" : status >= 400 ? "rejected" : "success";

  if (!operation) {
    const verb = `atender la petición ${method.toUpperCase()} ${normalizedRoute(routePattern)}`;
    return {
      module: moduleFallback,
      action: `${method.toUpperCase()} ${normalizedRoute(routePattern)}`,
      result,
      message:
        result === "success"
          ? `La aplicación atendió la petición ${method.toUpperCase()} ${normalizedRoute(routePattern)} y respondió correctamente.`
          : result === "rejected"
            ? `No se pudo ${verb} porque ${rejectionReason(status)}.`
            : `No se pudo ${verb} porque el servidor tuvo un error interno.`,
      detail: { status, route: normalizedRoute(routePattern) },
      actorId: null,
      source: "real",
    };
  }

  const message =
    result === "success"
      ? operation.success
      : result === "rejected"
        ? `No se pudo ${operation.verb} porque ${rejectionReason(status)}.`
        : `No se pudo ${operation.verb} porque el servidor tuvo un error interno.`;

  return {
    module: operation.module,
    action: operation.action,
    result,
    message,
    detail: { status, route: normalizedRoute(routePattern) },
    actorId: null,
    source: "real",
  };
}

/** Explica un sondeo de disponibilidad sin guardar IPs ni datos de la petición. */
export function describeProbe(
  target: "/health" | "/ready",
  status: "up" | "down",
  httpStatus: number,
): string {
  const action = target === "/health" ? "atender las peticiones" : "conectarse a la base principal";
  return status === "up"
    ? `El sondeo de ${target} fue correcto (HTTP ${httpStatus}): la aplicación puede ${action}.`
    : `El sondeo de ${target} falló (HTTP ${httpStatus}): la aplicación no pudo ${action} en este momento.`;
}

/** Convierte un evento de dominio en un registro legible para la bitácora. */
export function describeDomainEvent(
  event: DomainEvent,
  source: EventSource = "real",
): DescribedEvent {
  const module = MODULE_BY_EVENT[event.type] ?? "sistema";
  const common = {
    module,
    action: ACTION_BY_EVENT[event.type] ?? event.type,
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
