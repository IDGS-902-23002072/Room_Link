import type { Context } from "hono";
import type { ProfileService } from "./profile.service.js";
import { ProfileView } from "./profile.view.js";

export class ProfileController {
  constructor(private profileService: ProfileService) {}

  getProfile = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) {
        return c.json({ error: "userId es obligatorio" }, 400);
      }
      const profile = await this.profileService.getProfile(userId);
      return c.json(ProfileView.toPublicProfile(profile), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Perfil no encontrado" }, 404);
    }
  };

  createProfile = async (c: Context) => {
    try {
      const body = await c.req.json();
      if (!body.userId || !body.fullName || !body.birthDate) {
        return c.json(
          { error: "userId, fullName y birthDate son obligatorios" },
          400,
        );
      }

      const profile = await this.profileService.createProfile({
        userId: body.userId,
        fullName: body.fullName,
        birthDate: body.birthDate,
        occupation: body.occupation,
        bio: body.bio,
        phone: body.phone,
      });

      return c.json(ProfileView.toPublicProfile(profile), 201);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al crear perfil" }, 400);
    }
  };

  updateProfile = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) {
        return c.json({ error: "userId es obligatorio" }, 400);
      }
      const body = await c.req.json();

      const updated = await this.profileService.updateProfile(userId, body);
      return c.json(ProfileView.toPublicProfile(updated), 200);
    } catch (err: any) {
      return c.json({ error: err.message ?? "Error al actualizar perfil" }, 400);
    }
  };
}
