import type { Context } from "hono";
import type { ProfileService } from "./profile.service.js";
import { ProfileView } from "./profile.view.js";
import { notificationTypeValues } from "../../domain/index.js";

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Perfil no encontrado";
      return c.json({ error: msg }, 404);
    }
  };

  createProfile = async (c: Context) => {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      if (!body["userId"] || !body["fullName"] || !body["birthDate"]) {
        return c.json(
          { error: "userId, fullName y birthDate son obligatorios" },
          400,
        );
      }
      const profile = await this.profileService.createProfile({
        userId: String(body["userId"]),
        fullName: String(body["fullName"]),
        birthDate: String(body["birthDate"]),
        occupation: (body["occupation"] as string | null | undefined) ?? null,
        bio: (body["bio"] as string | null | undefined) ?? null,
        phone: (body["phone"] as string | null | undefined) ?? null,
        instagram: (body["instagram"] as string | null | undefined) ?? null,
        facebook: (body["facebook"] as string | null | undefined) ?? null,
      });
      return c.json(ProfileView.toPublicProfile(profile), 201);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear perfil";
      return c.json({ error: msg }, 400);
    }
  };

  updateProfile = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
      const body = (await c.req.json()) as Record<string, unknown>;
      const updated = await this.profileService.updateProfile(userId, body);
      return c.json(ProfileView.toPublicProfile(updated), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al actualizar perfil";
      return c.json({ error: msg }, 400);
    }
  };

  updateSocials = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
      const body = (await c.req.json()) as Record<string, unknown>;
      const updated = await this.profileService.updateSocials(userId, {
        instagram: (body["instagram"] as string | null | undefined) ?? undefined,
        facebook: (body["facebook"] as string | null | undefined) ?? undefined,
      });
      return c.json(ProfileView.toPublicProfile(updated), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al actualizar redes";
      return c.json({ error: msg }, 400);
    }
  };

  listPhotos = async (c: Context) => {
    const userId = c.req.param("userId");
    if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
    const photos = await this.profileService.listPhotos(userId);
    return c.json({ items: photos.map(ProfileView.toPhotoDto) }, 200);
  };

  addPhoto = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
      const body = (await c.req.json()) as Record<string, unknown>;
      if (!body["url"]) return c.json({ error: "url es obligatoria" }, 400);
      const photoInput: { url: string; position?: number } = {
        url: String(body["url"]),
      };
      if (body["position"] !== undefined) {
        photoInput.position = Number(body["position"]);
      }
      const photo = await this.profileService.addPhoto(userId, photoInput);
      return c.json(ProfileView.toPhotoDto(photo), 201);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al agregar foto";
      return c.json({ error: msg }, 400);
    }
  };

  removePhoto = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      const photoId = c.req.param("photoId");
      if (!userId || !photoId) {
        return c.json({ error: "userId y photoId son obligatorios" }, 400);
      }
      await this.profileService.removePhoto(userId, photoId);
      return c.body(null, 204);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al eliminar foto";
      return c.json({ error: msg }, 400);
    }
  };

  reorderPhotos = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
      const body = (await c.req.json()) as Record<string, unknown>;
      const orderRaw = body["order"];
      if (!Array.isArray(orderRaw)) {
        return c.json({ error: "order debe ser un arreglo" }, 400);
      }
      const order = (orderRaw as unknown[]).map((entry) => {
        const record = entry as Record<string, unknown>;
        return {
          photoId: String(record["photoId"]),
          position: Number(record["position"]),
        };
      });
      const updated = await this.profileService.reorderPhotos(userId, order);
      return c.json({ items: updated.map(ProfileView.toPhotoDto) }, 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al reordenar fotos";
      return c.json({ error: msg }, 400);
    }
  };

  getPrivacy = async (c: Context) => {
    const userId = c.req.param("userId");
    if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
    const privacy = await this.profileService.getContactPrivacy(userId);
    return c.json(ProfileView.toPrivacyDto(privacy), 200);
  };

  updatePrivacy = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
      const body = (await c.req.json()) as Record<string, unknown>;
      const payload: {
        showPhoneToConnections?: boolean;
        showEmailToConnections?: boolean;
        showSocialsToConnections?: boolean;
      } = {};
      if (body["showPhoneToConnections"] !== undefined) {
        payload.showPhoneToConnections = Boolean(body["showPhoneToConnections"]);
      }
      if (body["showEmailToConnections"] !== undefined) {
        payload.showEmailToConnections = Boolean(body["showEmailToConnections"]);
      }
      if (body["showSocialsToConnections"] !== undefined) {
        payload.showSocialsToConnections = Boolean(
          body["showSocialsToConnections"],
        );
      }
      const privacy = await this.profileService.updateContactPrivacy(
        userId,
        payload,
      );
      return c.json(ProfileView.toPrivacyDto(privacy), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al actualizar privacidad";
      return c.json({ error: msg }, 400);
    }
  };

  requestVerification = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
      const profile = await this.profileService.requestIdentityVerification(
        userId,
      );
      return c.json(ProfileView.toPublicProfile(profile), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al solicitar verificación de identidad";
      return c.json({ error: msg }, 400);
    }
  };

  listNotificationPrefs = async (c: Context) => {
    const userId = c.req.param("userId");
    if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
    const prefs = await this.profileService.getNotificationPreferences(userId);
    return c.json({ items: prefs.map(ProfileView.toNotifPrefDto) }, 200);
  };

  updateNotificationPref = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) return c.json({ error: "userId es obligatorio" }, 400);
      const body = (await c.req.json()) as Record<string, unknown>;
      const typeRaw = String(body["type"] ?? "");
      if (!notificationTypeValues.includes(typeRaw as any)) {
        return c.json({ error: `Tipo de notificación inválido: ${typeRaw}` }, 400);
      }
      const prefInput: {
        type: (typeof notificationTypeValues)[number];
        inApp?: boolean;
        email?: boolean;
      } = { type: typeRaw as (typeof notificationTypeValues)[number] };
      if (body["inApp"] !== undefined) prefInput.inApp = Boolean(body["inApp"]);
      if (body["email"] !== undefined) prefInput.email = Boolean(body["email"]);
      const pref = await this.profileService.updateNotificationPreference(
        userId,
        prefInput,
      );
      return c.json(ProfileView.toNotifPrefDto(pref), 200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al actualizar preferencia";
      return c.json({ error: msg }, 400);
    }
  };
}
