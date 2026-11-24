import { OAuth2Client } from "google-auth-library";
import { AppError } from "../../shared/AppError.js";
import type { OAuthProfile, OAuthProfileProvider } from "./auth.ports.js";

export class GoogleOAuthProfileProvider implements OAuthProfileProvider {
  private readonly client = new OAuth2Client();
  private readonly audiences: string[];

  constructor(clientIds?: string) {
    this.audiences = clientIds?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  }

  async verify(idToken: string): Promise<OAuthProfile> {
    if (!this.audiences.length) {
      throw new AppError("Google OAuth no está configurado.", 503, "OAUTH_NOT_CONFIGURED");
    }
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.audiences,
    }).catch(() => {
      throw new AppError("Token de Google inválido.", 401, "INVALID_OAUTH_TOKEN");
    });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      throw new AppError("Identidad de Google no verificable.", 401, "INVALID_OAUTH_IDENTITY");
    }
    return {
      provider: "google",
      providerUserId: profile.sub,
      email: profile.email.toLowerCase(),
      emailVerified: true,
    };
  }
}
