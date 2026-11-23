import { describe, expect, it } from "vitest";
import { Profile } from "../../src/domain/entities/Profile.js";
import { ContactPrivacy } from "../../src/domain/entities/ContactPrivacy.js";
import { ProfileView } from "../../src/modules/profile/profile.view.js";

// HU-02 — El serializador oculta teléfono y redes salvo al dueño o a conexiones
// aceptadas que el dueño autorizó. Verifica que no haya fuga de datos de contacto.
describe("ProfileView.toPublicProfile — visibilidad de contacto (HU-02)", () => {
  const profile = new Profile({
    userId: "owner-1",
    fullName: "Ana García",
    birthDate: new Date("2000-06-15"),
    phone: "+52 477 111 2222",
    instagram: "ana.g",
    facebook: "ana.garcia",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const allowAll = new ContactPrivacy({
    userId: "owner-1",
    showPhoneToConnections: true,
    showEmailToConnections: true,
    showSocialsToConnections: true,
  });

  const denyAll = new ContactPrivacy({
    userId: "owner-1",
    showPhoneToConnections: false,
    showEmailToConnections: false,
    showSocialsToConnections: false,
  });

  it("sin visibility (vista propia) muestra todo", () => {
    const dto = ProfileView.toPublicProfile(profile);
    expect(dto.phone).toBe("+52 477 111 2222");
    expect(dto.instagram).toBe("ana.g");
    expect(dto.facebook).toBe("ana.garcia");
  });

  it("dueño: muestra todo aunque la privacidad niegue", () => {
    const dto = ProfileView.toPublicProfile(profile, {
      isOwner: true,
      isConnected: false,
      privacy: denyAll,
    });
    expect(dto.phone).toBe("+52 477 111 2222");
    expect(dto.instagram).toBe("ana.g");
  });

  it("espectador NO conectado: oculta teléfono y redes", () => {
    const dto = ProfileView.toPublicProfile(profile, {
      isOwner: false,
      isConnected: false,
      privacy: allowAll,
    });
    expect(dto.phone).toBeNull();
    expect(dto.instagram).toBeNull();
    expect(dto.facebook).toBeNull();
    // Los datos públicos siguen visibles.
    expect(dto.fullName).toBe("Ana García");
  });

  it("conexión aceptada con permiso: muestra los datos autorizados", () => {
    const dto = ProfileView.toPublicProfile(profile, {
      isOwner: false,
      isConnected: true,
      privacy: allowAll,
    });
    expect(dto.phone).toBe("+52 477 111 2222");
    expect(dto.instagram).toBe("ana.g");
  });

  it("conexión aceptada pero el dueño niega: sigue oculto", () => {
    const dto = ProfileView.toPublicProfile(profile, {
      isOwner: false,
      isConnected: true,
      privacy: denyAll,
    });
    expect(dto.phone).toBeNull();
    expect(dto.instagram).toBeNull();
  });

  it("conexión aceptada sin registro de privacidad: oculto por defecto", () => {
    const dto = ProfileView.toPublicProfile(profile, {
      isOwner: false,
      isConnected: true,
      privacy: null,
    });
    expect(dto.phone).toBeNull();
    expect(dto.instagram).toBeNull();
  });
});
