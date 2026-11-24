import nodemailer from "nodemailer";
import type { EmailNotifier } from "./auth.ports.js";

export class SmtpMailer implements EmailNotifier {
  private readonly transport;

  constructor(smtpUrl: string, private readonly from: string, private readonly webOrigin: URL) {
    const url = URL.canParse(smtpUrl) ? new URL(smtpUrl) : null;
    if (!url || !["smtp:", "smtps:"].includes(url.protocol)) {
      throw new Error("SMTP_URL debe usar smtp: o smtps:.");
    }
    this.transport = nodemailer.createTransport({
      host: url.hostname,
      port: Number(url.port || (url.protocol === "smtps:" ? 465 : 587)),
      secure: url.protocol === "smtps:",
      requireTLS: url.protocol === "smtp:" && !["localhost", "127.0.0.1"].includes(url.hostname),
      auth: url.username ? { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) } : undefined,
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }

  async sendPasswordReset({ email, token }: { email: string; token: string; expiresAt: Date }) {
    const url = new URL("/restablecer", this.webOrigin);
    url.searchParams.set("token", token);
    await this.transport.sendMail({
      from: this.from,
      to: email,
      subject: "Restablece tu contraseña de RoomLink",
      text: `Abre este enlace para elegir tu nueva contraseña. El enlace caduca en 30 minutos y solo se puede usar una vez.\n\n${url.href}`,
    });
  }

  async sendNotification(email: string, title: string) {
    await this.transport.sendMail({
      from: this.from,
      to: email,
      subject: "Nueva notificación de RoomLink",
      text: `${title}\n\nConsulta tus notificaciones: ${new URL("/notificaciones", this.webOrigin).href}`,
    });
  }
}

export function configureSmtp(env: NodeJS.ProcessEnv = process.env): SmtpMailer | undefined {
  if (!env.SMTP_URL) return undefined;
  if (!env.SMTP_FROM || !env.PUBLIC_WEB_ORIGIN) {
    throw new Error("SMTP requiere SMTP_FROM y PUBLIC_WEB_ORIGIN.");
  }
  const origin = new URL(env.PUBLIC_WEB_ORIGIN);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && (origin.hostname === "127.0.0.1" || origin.hostname === "localhost"))) {
    throw new Error("PUBLIC_WEB_ORIGIN requiere HTTPS, salvo en localhost.");
  }
  return new SmtpMailer(env.SMTP_URL, env.SMTP_FROM, origin);
}
