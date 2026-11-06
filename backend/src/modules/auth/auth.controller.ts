import type { Context } from "hono";
import type { AuthService } from "./auth.service.js";
import { AuthView } from "./auth.view.js";

export class AuthController {
  constructor(private authService: AuthService) {}

  register = async (c: Context) => {
    try {
      const body = await c.req.json();
      if (!body.email || !body.password) {
        return c.json({ error: "Email y contraseña son requeridos" }, 400);
      }

      const user = await this.authService.register({
        email: body.email,
        password: body.password,
        role: body.role,
      });

      return c.json(
        AuthView.toAuthResponse(user, undefined, "Usuario registrado exitosamente"),
        201,
      );
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error interno del servidor" }, 400);
    }
  };

  login = async (c: Context) => {
    try {
      const body = await c.req.json();
      if (!body.email || !body.password) {
        return c.json({ error: "Email y contraseña son requeridos" }, 400);
      }

      const { user, token } = await this.authService.login({
        email: body.email,
        password: body.password,
      });

      return c.json(AuthView.toAuthResponse(user, token, "Inicio de sesión exitoso"), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error de autenticación" }, 401);
    }
  };

  me = async (c: Context) => {
    try {
      const userId = c.req.query("userId");
      if (!userId) {
        return c.json({ error: "Parámetro userId requerido" }, 400);
      }

      const user = await this.authService.getById(userId);
      return c.json(AuthView.toPublicUser(user), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Usuario no encontrado" }, 404);
    }
  };
}
