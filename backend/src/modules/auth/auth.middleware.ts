import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import { errorResponse } from "../../shared/AppError.js";
import type { AuthPrincipal } from "./auth.ports.js";
import type { AuthService } from "./auth.service.js";

export interface AuthVariables {
  auth: AuthPrincipal;
}

export const extractAuthToken = (authorization?: string, cookieToken?: string): string | null => {
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  return cookieToken ?? null;
};

export const createAuthMiddleware = (
  authService: AuthService,
): MiddlewareHandler<{ Variables: AuthVariables }> => async (context, next) => {
  try {
    const token = extractAuthToken(
      context.req.header("Authorization"),
      getCookie(context, "roomlink_session"),
    );
    if (!token) {
      return context.json({ error: "Autenticación requerida", code: "AUTH_REQUIRED" }, 401);
    }
    context.set("auth", await authService.authenticate(token));
    await next();
  } catch (error) {
    const response = errorResponse(error);
    return context.json({ error: response.error, code: response.code }, response.status as 401);
  }
};

export const requireAdmin: MiddlewareHandler<{ Variables: AuthVariables }> = async (
  context,
  next,
) => {
  if (!context.get("auth").roles.includes("admin")) {
    return context.json({ error: "Rol administrador requerido", code: "ADMIN_REQUIRED" }, 403);
  }
  await next();
};
