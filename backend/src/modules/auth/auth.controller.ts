import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthVariables } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";
import { AuthView } from "./auth.view.js";

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly secureCookies: boolean,
  ) {}

  register = async (context: Context) => {
    try {
      const body = await context.req.json();
      const user = await this.authService.register({
        email: body.email ?? "",
        password: body.password ?? "",
        termsAccepted: body.termsAccepted === true,
        role: body.role,
      });
      return context.json(
        AuthView.toAuthResponse(user, undefined, undefined, "Usuario registrado exitosamente"),
        201,
      );
    } catch (error) {
      return this.failure(context, error);
    }
  };

  login = async (context: Context) => {
    try {
      const body = await context.req.json();
      const result = await this.authService.login({
        email: body.email ?? "",
        password: body.password ?? "",
        userAgent: context.req.header("User-Agent") ?? null,
        ipAddress: context.req.header("X-Forwarded-For") ?? null,
      });
      this.setSessionCookie(context, result.token, result.expiresAt);
      return context.json(
        AuthView.toAuthResponse(
          result.user,
          result.token,
          result.expiresAt,
          "Inicio de sesión exitoso",
        ),
      );
    } catch (error) {
      return this.failure(context, error);
    }
  };

  google = async (context: Context) => {
    try {
      const body = await context.req.json();
      const result = await this.authService.loginWithGoogle({
        idToken: body.idToken ?? "",
        termsAccepted: body.termsAccepted === true,
        userAgent: context.req.header("User-Agent") ?? null,
        ipAddress: context.req.header("X-Forwarded-For") ?? null,
      });
      this.setSessionCookie(context, result.token, result.expiresAt);
      return context.json(AuthView.toAuthResponse(result.user, result.token, result.expiresAt));
    } catch (error) {
      return this.failure(context, error);
    }
  };

  forgotPassword = async (context: Context) => {
    try {
      const body = await context.req.json();
      await this.authService.requestPasswordReset(body.email ?? "");
      return context.json(
        { message: "Si la cuenta existe, recibirás instrucciones para restablecerla." },
        202,
      );
    } catch (error) {
      return this.failure(context, error);
    }
  };

  resetPassword = async (context: Context) => {
    try {
      const body = await context.req.json();
      await this.authService.resetPassword(body.token ?? "", body.password ?? "");
      return context.json({ message: "Contraseña restablecida correctamente." });
    } catch (error) {
      return this.failure(context, error);
    }
  };

  me = async (context: Context<{ Variables: AuthVariables }>) => {
    try {
      const user = await this.authService.getById(context.get("auth").userId);
      return context.json(AuthView.toPublicUser(user));
    } catch (error) {
      return this.failure(context, error);
    }
  };

  logout = async (context: Context<{ Variables: AuthVariables }>) => {
    try {
      await this.authService.logout(context.get("auth"));
      deleteCookie(context, "roomlink_session", { path: "/", secure: this.secureCookies });
      return context.json({ message: "Sesión cerrada." });
    } catch (error) {
      return this.failure(context, error);
    }
  };

  private setSessionCookie(context: Context, token: string, expiresAt: Date): void {
    setCookie(context, "roomlink_session", token, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: "Strict",
      path: "/",
      expires: expiresAt,
    });
  }

  private failure(context: Context, error: unknown): Response {
    const response = errorResponse(error);
    return context.json(
      { error: response.error, code: response.code },
      response.status as 400,
    );
  }
}
