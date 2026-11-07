import type { NotificationsService } from "./notifications.service.js";
import type { DomainEvent, InProcessEventBus } from "./event-bus.js";

export interface ListingHostResolver {
  (listingId: string): Promise<string | null>;
}

/**
 * Traduce eventos de dominio en notificaciones persistentes.
 * Se mantiene desacoplado de los publishers: ellos solo emiten el evento,
 * este consumer decide qué notificación generar y para quién.
 */
export class NotificationsEventConsumer {
  constructor(
    private readonly service: NotificationsService,
    private readonly resolveListingHostId: ListingHostResolver,
  ) {}

  register(bus: InProcessEventBus): () => void {
    return bus.subscribe((event) => this.handle(event));
  }

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case "UserRegisteredEvent":
        return this.onUserRegistered(event);
      case "ConnectionAcceptedEvent":
        return this.onConnectionAccepted(event);
      case "ListingModeratedEvent":
        return this.onListingModerated(event);
      case "MessageSentEvent":
        return this.onMessageSent(event);
      case "SanctionIssuedEvent":
        return this.onSanctionIssued(event);
      default:
        return;
    }
  }

  private async onUserRegistered(event: DomainEvent): Promise<void> {
    const userId = typeof event.payload.userId === "string" ? event.payload.userId : null;
    if (!userId) return;
    await this.service.createIfAllowed({
      userId,
      type: "system",
      title: "¡Bienvenido a Room_Link!",
      body: "Completa tu perfil y tu test de compatibilidad para empezar.",
      payload: { provider: event.payload.provider ?? "local" },
    });
  }

  private async onConnectionAccepted(event: DomainEvent): Promise<void> {
    const requesterId =
      typeof event.payload.requesterId === "string" ? event.payload.requesterId : null;
    if (!requesterId) return;
    await this.service.createIfAllowed({
      userId: requesterId,
      type: "connection_accepted",
      title: "Tu solicitud de conexión fue aceptada.",
      payload: {
        connectionId: event.payload.connectionId,
        addresseeId: event.payload.addresseeId,
      },
    });
  }

  private async onListingModerated(event: DomainEvent): Promise<void> {
    const listingId =
      typeof event.payload.listingId === "string" ? event.payload.listingId : null;
    if (!listingId) return;
    const hostId = await this.resolveListingHostId(listingId);
    if (!hostId) return;
    const status = String(event.payload.status ?? "");
    const titleByStatus: Record<string, string> = {
      approved: "Tu anuncio fue aprobado.",
      rejected: "Tu anuncio fue rechazado.",
      removed: "Tu anuncio fue dado de baja por moderación.",
    };
    await this.service.createIfAllowed({
      userId: hostId,
      type: "listing_moderated",
      title: titleByStatus[status] ?? "Hay una actualización de moderación en tu anuncio.",
      body: typeof event.payload.reason === "string" ? event.payload.reason : null,
      payload: { listingId, status },
    });
  }

  private async onSanctionIssued(event: DomainEvent): Promise<void> {
    const userId = typeof event.payload.userId === "string" ? event.payload.userId : null;
    if (!userId) return;
    const type = String(event.payload.type ?? "");
    const titleByType: Record<string, string> = {
      warning: "Se te emitió una advertencia.",
      temporary_suspension: "Tu cuenta fue suspendida temporalmente.",
      permanent_ban: "Tu cuenta fue baneada.",
      dismissed: "Se desestimó una sanción en tu contra.",
      listing_removed: "Uno de tus anuncios fue dado de baja.",
    };
    await this.service.createIfAllowed({
      userId,
      type: "account_sanction",
      title: titleByType[type] ?? "Se registró una sanción sobre tu cuenta.",
      body: typeof event.payload.reason === "string" ? event.payload.reason : null,
      payload: {
        sanctionId: event.payload.sanctionId,
        sanctionType: type,
        expiresAt: event.payload.expiresAt ?? null,
      },
    });
  }

  private async onMessageSent(event: DomainEvent): Promise<void> {
    const recipientId =
      typeof event.payload.recipientId === "string" ? event.payload.recipientId : null;
    if (!recipientId) return;
    await this.service.createIfAllowed({
      userId: recipientId,
      type: "new_message",
      title: "Tienes un mensaje nuevo.",
      body: typeof event.payload.preview === "string" ? event.payload.preview : null,
      payload: {
        roomId: event.payload.roomId,
        senderId: event.payload.senderId,
        messageId: event.payload.messageId,
      },
    });
  }
}
