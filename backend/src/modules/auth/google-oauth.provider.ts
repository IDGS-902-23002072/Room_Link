import { AppError } from "../../shared/AppError.js";
import type { OAuthProfile, OAuthProfileProvider } from "./auth.ports.js";

interface GoogleTokenInfo {
  sub?: string;
  email?: string;
  email_verified?: string;
  aud?: string;
}

export class GoogleOAuthProfileProvider implements OAuthProfileProvider {
  constructor(private readonly clientId?: string) {}

  async verify(idToken: string): Promise<OAuthProfile> {
    if (!this.clientId) {
      throw new AppError("Google OAuth no está configurado.", 503, "OAUTH_NOT_CONFIGURED");
    }
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!response.ok) {
      throw new AppError("Token de Google inválido.", 401, "INVALID_OAUTH_TOKEN");
    }
    const profile = (await response.json()) as GoogleTokenInfo;
    if (
      profile.aud !== this.clientId ||
      !profile.sub ||
      !profile.email ||
      profile.email_verified !== "true"
    ) {
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
