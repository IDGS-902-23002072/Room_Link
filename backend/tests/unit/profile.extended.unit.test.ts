import { describe, expect, it, beforeEach } from "vitest";
import { ProfileService } from "../../src/modules/profile/profile.service.js";
import { NotificationPreference } from "../../src/domain/entities/NotificationPreference.js";
import { InMemoryExtendedProfileRepository } from "../helpers/in-memory-profile-repo.js";

/**
 * HU-02 — Perfil personal y privacidad de contacto.
 * Cubre EL-02.2, EL-02.4, EL-02.5, EL-02.6 y la extensión de redes/verificación/notif.
 */
describe("ProfileService (Roberto, HU-02)", () => {
  let repo: InMemoryExtendedProfileRepository;
  let service: ProfileService;
  const uid = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    repo = new InMemoryExtendedProfileRepository();
    service = new ProfileService(repo);
    await service.createProfile({
      userId: uid,
      fullName: "Roberto Vargas",
      birthDate: "2000-06-15",
      occupation: "Estudiante",
      bio: "Me gusta el café.",
      phone: "+52 477 123 4567",
    });
  });

  describe("createProfile — EL-02.4 (validación de datos del perfil)", () => {
    it("rechaza nombres de menos de 2 caracteres", async () => {
      await expect(
        service.createProfile({
          userId: "u2",
          fullName: "x",
          birthDate: "1990-01-01",
        }),
      ).rejects.toThrow(/al menos 2 caracteres/);
    });

    it("rechaza biografías de más de 300 caracteres", async () => {
      await expect(
        service.createProfile({
          userId: "u3",
          fullName: "Usuario",
          birthDate: "1990-01-01",
          bio: "x".repeat(301),
        }),
      ).rejects.toThrow(/300 caracteres/);
    });

    it("rechaza teléfonos con formato inválido", async () => {
      await expect(
        service.createProfile({
          userId: "u4",
          fullName: "Usuario",
          birthDate: "1990-01-01",
          phone: "abc",
        }),
      ).rejects.toThrow(/teléfono/i);
    });

    it("rechaza perfiles de menores de 18", async () => {
      await expect(
        service.createProfile({
          userId: "u5",
          fullName: "Menor",
          birthDate: "2020-01-01",
        }),
      ).rejects.toThrow(/18 años/);
    });
  });

  describe("updateProfile — EL-02.6 (guardarPerfil)", () => {
    it("actualiza bio y ocupación y persiste", async () => {
      const updated = await service.updateProfile(uid, {
        bio: "Nueva bio",
        occupation: "Developer",
      });
      expect(updated.bio).toBe("Nueva bio");
      expect(updated.occupation).toBe("Developer");
      const fromRepo = await repo.findByUserId(uid);
      expect(fromRepo?.bio).toBe("Nueva bio");
    });

    it("lanza si el perfil no existe", async () => {
      await expect(
        service.updateProfile("no-existe", { bio: "x" }),
      ).rejects.toThrow(/Perfil no encontrado/);
    });
  });

  describe("updateSocials (Instagram / Facebook)", () => {
    it("guarda los enlaces y marca updatedAt", async () => {
      const before = await repo.findByUserId(uid);
      const beforeTs = before!.updatedAt.getTime();
      await new Promise((r) => setTimeout(r, 5));
      const updated = await service.updateSocials(uid, {
        instagram: "https://instagram.com/robertov",
        facebook: "https://facebook.com/robertov",
      });
      expect(updated.instagram).toContain("instagram.com");
      expect(updated.facebook).toContain("facebook.com");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(beforeTs);
    });
  });

  describe("Galería — EL-02.2 / EL-02.5", () => {
    it("agrega hasta 6 fotos y rechaza la séptima", async () => {
      for (let i = 1; i <= 6; i++) {
        await service.addPhoto(uid, {
          url: `https://cdn.example.com/${i}.jpg`,
        });
      }
      const photos = await service.listPhotos(uid);
      expect(photos).toHaveLength(6);
      await expect(
        service.addPhoto(uid, { url: "https://cdn.example.com/7.jpg" }),
      ).rejects.toThrow(/hasta 6 fotos/);
    });

    it("rechaza una URL inválida", async () => {
      await expect(
        service.addPhoto(uid, { url: "no-es-url" }),
      ).rejects.toThrow(/http/);
    });

    it("rechaza posiciones fuera de rango 1..6", async () => {
      await expect(
        service.addPhoto(uid, {
          url: "https://cdn.example.com/x.jpg",
          position: 9,
        }),
      ).rejects.toThrow(/entre 1 y 6/);
    });

    it("elimina una foto existente", async () => {
      const added = await service.addPhoto(uid, {
        url: "https://cdn.example.com/a.jpg",
      });
      await service.removePhoto(uid, added.id);
      const after = await service.listPhotos(uid);
      expect(after.find((p) => p.id === added.id)).toBeUndefined();
    });

    it("reordena fotos manteniendo unicidad de posición", async () => {
      const a = await service.addPhoto(uid, {
        url: "https://cdn.example.com/a.jpg",
      });
      const b = await service.addPhoto(uid, {
        url: "https://cdn.example.com/b.jpg",
      });
      const reordered = await service.reorderPhotos(uid, [
        { photoId: a.id, position: 2 },
        { photoId: b.id, position: 1 },
      ]);
      expect(reordered.find((p) => p.id === a.id)!.position).toBe(2);
      expect(reordered.find((p) => p.id === b.id)!.position).toBe(1);
    });

    it("rechaza una reordenación con posiciones duplicadas", async () => {
      const a = await service.addPhoto(uid, {
        url: "https://cdn.example.com/a.jpg",
      });
      const b = await service.addPhoto(uid, {
        url: "https://cdn.example.com/b.jpg",
      });
      await expect(
        service.reorderPhotos(uid, [
          { photoId: a.id, position: 1 },
          { photoId: b.id, position: 1 },
        ]),
      ).rejects.toThrow(/duplicadas/);
    });
  });

  describe("Privacidad de contacto", () => {
    it("devuelve valores por defecto si no hay registro", async () => {
      const privacy = await service.getContactPrivacy(uid);
      expect(privacy.showPhoneToConnections).toBe(true);
      expect(privacy.showEmailToConnections).toBe(true);
      expect(privacy.showSocialsToConnections).toBe(true);
    });

    it("actualiza sólo los campos provistos", async () => {
      const updated = await service.updateContactPrivacy(uid, {
        showPhoneToConnections: false,
      });
      expect(updated.showPhoneToConnections).toBe(false);
      expect(updated.showEmailToConnections).toBe(true);
    });
  });

  describe("Verificación de identidad", () => {
    it("pasa de unverified a pending cuando se solicita", async () => {
      const updated = await service.requestIdentityVerification(uid);
      expect(updated.identityStatus).toBe("pending");
    });

    it("no permite volver a solicitar si ya está verified", async () => {
      const profile = await service.getProfile(uid);
      profile.markIdentityVerified(new Date());
      await repo.updateIdentityStatus(profile);
      await expect(
        service.requestIdentityVerification(uid),
      ).rejects.toThrow(/ya está verificada/);
    });
  });

  describe("Preferencias de notificación", () => {
    it("crea una preferencia la primera vez y la actualiza después", async () => {
      const first = await service.updateNotificationPreference(uid, {
        type: "new_message",
        inApp: true,
        email: false,
      });
      expect(first.email).toBe(false);

      const second = await service.updateNotificationPreference(uid, {
        type: "new_message",
        email: true,
      });
      expect(second.email).toBe(true);
      expect(second.inApp).toBe(true);
    });

    it("la entidad NotificationPreference rechaza tipos inexistentes", () => {
      expect(
        () =>
          new NotificationPreference({
            userId: uid,
            type: "no-existe" as any,
            inApp: true,
            email: true,
          }),
      ).toThrow(/inválido/);
    });
  });
});
