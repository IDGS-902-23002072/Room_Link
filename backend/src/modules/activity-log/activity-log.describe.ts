/**
 * Mensajes descriptivos de la bitácora de actividad.
 *
 * Convierte un evento de dominio (por ejemplo `LoginFailedEvent`) en:
 *  - `module`: módulo de Room_Link donde ocurrió.
 *  - `outcome`: si la operación fue exitosa, rechazada por una regla o falló.
 *  - `message`: frase en español que explica qué pasó y por qué, sin datos sensibles.
 *
 * También limpia el payload antes de guardarlo: nunca se persisten correos
 * completos, agentes de usuario ni fragmentos del contenido de un mensaje.
 */

export type ActivityOutcome = "success" | "rejected" | "failed";

export interface ActivityDescription {
  module: string;
  outcome: ActivityOutcome;
  message: string;
}

type Payload = Record<string, unknown>;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** "ana.lopez@mail.com" -> "a***@mail.com". Si no parece un correo devuelve null. */
export function maskEmail(value: unknown): string | null {
  const email = text(value);
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return `${email[0]}***${email.slice(at)}`;
}

const LOGIN_FAILURE_REASONS: Record<string, string> = {
  user_not_found: "no existe una cuenta con ese correo",
  invalid_password: "la contraseña no coincide con la registrada para la cuenta",
  locked: "la cuenta está bloqueada temporalmente por intentos fallidos",
  inactive: "la cuenta no está activa",
};

const APPLICATION_STATUS: Record<string, string> = {
  pending: "pendiente de revisión",
  waitlisted: "en lista de espera",
  accepted: "aceptada",
  rejected: "rechazada",
};

const LISTING_REVIEW: Record<string, string> = {
  approved: "aprobado",
  rejected: "rechazado",
  removed: "retirado",
  pending: "devuelto a revisión",
};

const SANCTION_TYPES: Record<string, string> = {
  warning: "una advertencia",
  temporary_suspension: "una suspensión temporal",
  permanent_ban: "una suspensión permanente",
  listing_removed: "el retiro de un anuncio",
  dismissed: "el descarte del reporte sin sanción",
};

export function describeEvent(type: string, payload: Payload = {}): ActivityDescription {
  switch (type) {
    case "UserRegisteredEvent": {
      const provider = payload.provider === "google" ? "con su cuenta de Google" : "con correo y contraseña";
      return {
        module: "Autenticación",
        outcome: "success",
        message: `Se creó una cuenta nueva ${provider}. El sistema validó los datos y registró al usuario.`,
      };
    }
    case "LoginSucceededEvent":
      return {
        module: "Autenticación",
        outcome: "success",
        message:
          "El usuario inició sesión correctamente. El sistema validó sus credenciales y generó una sesión activa.",
      };
    case "LoginFailedEvent": {
      const reason = LOGIN_FAILURE_REASONS[String(payload.reason)];
      return {
        module: "Autenticación",
        outcome: "rejected",
        message: reason
          ? `Se rechazó el inicio de sesión porque ${reason}.`
          : "Se rechazó el inicio de sesión por un motivo que el sistema no clasificó.",
      };
    }
    case "ConnectionRequestedEvent":
      return {
        module: "Conexiones",
        outcome: "success",
        message: "Un usuario envió una solicitud de conexión a otro usuario compatible. Quedó pendiente de respuesta.",
      };
    case "ConnectionAcceptedEvent":
      return {
        module: "Conexiones",
        outcome: "success",
        message: "El destinatario aceptó la solicitud de conexión. Ambos usuarios quedaron conectados.",
      };
    case "ApplicationStatusChanged": {
      const status = APPLICATION_STATUS[String(payload.status)];
      return {
        module: "Postulaciones",
        outcome: "success",
        message: status
          ? `El anfitrión cambió el estado de una postulación a una habitación: quedó ${status}.`
          : "El anfitrión cambió el estado de una postulación a una habitación.",
      };
    }
    case "ListingModeratedEvent": {
      const review = LISTING_REVIEW[String(payload.status)];
      const reason = text(payload.reason);
      const base = review
        ? `Un moderador revisó un anuncio de habitación y lo dejó ${review}.`
        : "Un moderador revisó un anuncio de habitación.";
      return {
        module: "Moderación",
        outcome: "success",
        message: reason ? `${base} Motivo registrado: ${truncate(reason, 160)}` : base,
      };
    }
    case "SanctionIssuedEvent": {
      const kind = SANCTION_TYPES[String(payload.type)];
      return {
        module: "Moderación",
        outcome: "success",
        message: kind
          ? `Un administrador resolvió un reporte aplicando ${kind}.`
          : "Un administrador resolvió un reporte aplicando una sanción.",
      };
    }
    case "MessageSentEvent":
      return {
        module: "Mensajería",
        outcome: "success",
        message: "Un usuario envió un mensaje en una conversación. El mensaje quedó guardado y se avisó al destinatario.",
      };
    default:
      return {
        module: "Sistema",
        outcome: "success",
        message: `El sistema registró el evento "${truncate(type, 80)}". Este tipo de evento aún no tiene una descripción redactada.`,
      };
  }
}

/**
 * Quita del payload lo que no debe quedar en la bitácora:
 *  - correo completo -> enmascarado (`emailMasked`);
 *  - `userAgent` -> se descarta;
 *  - `ipAddress` -> ya se guarda en su propia columna;
 *  - `preview` (texto del mensaje) -> solo se conserva su longitud.
 */
export function sanitizePayload(payload: Payload): Payload {
  const clean: Payload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "email") {
      const masked = maskEmail(value);
      if (masked) clean.emailMasked = masked;
      continue;
    }
    if (key === "userAgent" || key === "ipAddress") continue;
    if (key === "preview") {
      if (typeof value === "string") clean.previewLength = value.length;
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
