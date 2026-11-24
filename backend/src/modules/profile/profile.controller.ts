import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Context } from "hono";
import type { ProfileService } from "./profile.service.js";
import { ProfileView } from "./profile.view.js";
import { notificationTypeValues } from "../../domain/index.js";

const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export interface ProfileControllerDependencies {
  /**
   * HU-02 — Indica si existe una conexión aceptada entre espectador y dueño.
   * Inyectado desde `app.ts` para no acoplar el perfil al módulo de conexiones.
   */
  areConnected: (viewerId: string, ownerId: string) => Promise<boolean>;
  getEmail?: (userId: string) => Promise<string | null>;
}

export class ProfileController {
  constructor(
    private profileService: ProfileService,
    private readonly deps?: ProfileControllerDependencies,
  ) {}

  getProfile = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) {
        return c.json({ error: "userId es obligatorio" }, 400);
      }
      const profile = await this.profileService.getProfile(userId);

      // HU-02 — Oculta contacto/redes salvo al dueño o a conexiones autorizadas.
      const viewerId = (c.get("auth") as { userId?: string } | undefined)?.userId;
      const isOwner = viewerId === userId;
      let visibility;
      if (isOwner) {
        visibility = { isOwner: true, isConnected: false, privacy: null };
      } else {
        const privacy = await this.profileService
          .getContactPrivacy(userId)
          .catch(() => null);
        const isConnected =
          viewerId && this.deps
            ? await this.deps.areConnected(viewerId, userId)
            : false;
        visibility = { isOwner: false, isConnected, privacy };
      }
      c.header("Cache-Control", "private, no-store");
      const dto = ProfileView.toPublicProfile(profile, visibility);
      if (visibility.isConnected && visibility.privacy?.showEmailToConnections && this.deps?.getEmail) {
        return c.json({ ...dto, email: await this.deps.getEmail(userId) }, 200);
      }
      return c.json(dto, 200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Perfil no encontrado";
      return c.json({ error: msg }, 404);
    }
  };

  createProfile = async (c: Context) => {
    try {
      // El userId se toma de la sesión autenticada, no del body (RNF-01.2).
      const userId = c.get("auth").userId as string;
      const body = (await c.req.json()) as Record<string, unknown>;
      if (!body["fullName"] || !body["birthDate"]) {
        return c.json(
          { error: "fullName y birthDate son obligatorios" },
          400,
        );
      }
      const profile = await this.profileService.createProfile({
        userId,
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
    const dtos = photos.map(ProfileView.toPhotoDto);
    return c.json({ items: dtos, photos: dtos }, 200);
  };

  addPhoto = async (c: Context) => {
    try {
      const userId = c.req.param("userId");
      if (!userId) return c.json({ error: "userId es obligatorio" }, 400);

      const contentType = c.req.header("content-type") ?? "";
      if (contentType.includes("multipart/form-data")) {
        const parsed = (await c.req.parseBody({ all: true })) as Record<
          string,
          unknown
        >;
        const rawFiles = [parsed["photos"], parsed["photo"]].flatMap((v) =>
          Array.isArray(v) ? v : v === undefined || v === null ? [] : [v],
        );
        const files = rawFiles.filter((v): v is File => v instanceof File);
        if (files.length === 0) {
          return c.json(
            { error: "Adjunta al menos una foto en el campo 'photos'." },
            400,
          );
        }
        const uploadDir = path.resolve(process.cwd(), "uploads", "photos");
        await mkdir(uploadDir, { recursive: true });
        for (const file of files) {
          const mime = file.type?.trim().toLowerCase() ?? "";
          const ext = PHOTO_EXTENSIONS[mime];
          if (!ext) {
            return c.json(
              { error: "La foto debe ser JPG, PNG o WEBP." },
              400,
            );
          }
          if (file.size <= 0 || file.size > MAX_PHOTO_SIZE_BYTES) {
            return c.json(
              { error: "Cada foto debe pesar como máximo 5 MB." },
              400,
            );
          }
          const filename = `${randomUUID()}.${ext}`;
          const bytes = Buffer.from(await file.arrayBuffer());
          await writeFile(path.join(uploadDir, filename), bytes);
          await this.profileService.addPhoto(userId, {
            url: `/uploads/photos/${filename}`,
          });
        }
        const allPhotos = await this.profileService.listPhotos(userId);
        const dtos = allPhotos.map(ProfileView.toPhotoDto);
        return c.json({ items: dtos, photos: dtos }, 201);
      }

      const body = (await c.req.json()) as Record<string, unknown>;
      if (!body["url"]) return c.json({ error: "url es obligatoria" }, 400);
      const photoInput: { url: string; position?: number } = {
        url: String(body["url"]),
      };
      if (body["position"] !== undefined) {
        photoInput.position = Number(body["position"]);
      }
      const photo = await this.profileService.addPhoto(userId, photoInput);
      const allPhotos = await this.profileService.listPhotos(userId);
      const dtos = allPhotos.map(ProfileView.toPhotoDto);
      return c.json(
        { ...ProfileView.toPhotoDto(photo), items: dtos, photos: dtos },
        201,
      );
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
      const photoIdsRaw = body["photoIds"];
      let order: { photoId: string; position: number }[];
      if (Array.isArray(orderRaw)) {
        order = (orderRaw as unknown[]).map((entry) => {
          const record = entry as Record<string, unknown>;
          return {
            photoId: String(record["photoId"]),
            position: Number(record["position"]),
          };
        });
      } else if (
        Array.isArray(photoIdsRaw) &&
        photoIdsRaw.every((id) => typeof id === "string")
      ) {
        order = (photoIdsRaw as string[]).map((photoId, idx) => ({
          photoId,
          position: idx + 1,
        }));
      } else {
        return c.json({ error: "order debe ser un arreglo" }, 400);
      }
      const updated = await this.profileService.reorderPhotos(userId, order);
      const dtos = updated.map(ProfileView.toPhotoDto);
      return c.json({ items: dtos, photos: dtos }, 200);
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
      for (const key of ["showPhoneToConnections", "showEmailToConnections", "showSocialsToConnections"] as const) {
        const value = body[key];
        if (value === undefined) continue;
        if (typeof value !== "boolean") return c.json({ error: `${key} debe ser booleano.` }, 400);
        payload[key] = value;
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

  listPendingVerifications = async (c: Context) => {
    const rawPage = Number(c.req.query("page") ?? 1);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage < 1_000_000 ? rawPage : 1;
    return c.json(await this.profileService.listPendingVerifications(page));
  };

  resolveVerification = async (c: Context) => {
    const userId = c.req.param("userId");
    const body = await c.req.json<{ decision?: string }>().catch(() => null);
    if (!userId || (body?.decision !== "verified" && body?.decision !== "rejected")) {
      return c.json({ error: "Indica una decisión válida." }, 400);
    }
    const updated = await this.profileService.resolveIdentityVerification(userId, body.decision);
    if (!updated) return c.json({ error: "La solicitud ya no está pendiente." }, 409);
    return c.json({ status: body.decision }, 200);
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
