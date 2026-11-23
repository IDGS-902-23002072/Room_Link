import type { DomainEventPublisher, EmailNotifier } from "./auth.ports.js";

export class ConsoleEmailNotifier implements EmailNotifier {
  async sendPasswordReset(input: { email: string; token: string; expiresAt: Date }): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      console.info("Password reset requested", {
        email: input.email,
        token: input.token,
        expiresAt: input.expiresAt.toISOString(),
      });
    }
  }
}

export class AsyncEventPublisher implements DomainEventPublisher {
  constructor(private readonly delegate: DomainEventPublisher) {}

  async publish(event: { type: string; aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    await Promise.resolve();
    await this.delegate.publish(event);
  }
}
