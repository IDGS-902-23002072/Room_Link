import { describe, expect, it } from "vitest";
import {
  User,
  Profile,
  RoomListing,
  Application,
  CompatibilityProfile,
} from "../../src/domain/index.js";

describe("Domain Entities & Business Rules", () => {
  describe("User Entity", () => {
    it("creates an active user with valid email", () => {
      const user = new User({
        id: "u-1",
        email: "estudiante@ejemplo.com",
        status: "active",
        termsAcceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(user.isActive()).toBe(true);
      expect(user.email).toBe("estudiante@ejemplo.com");
      expect(user.hasRole("seeker")).toBe(true);
    });

    it("throws error with invalid email", () => {
      expect(
        () =>
          new User({
            id: "u-2",
            email: "correo_sin_arroba",
            status: "active",
            termsAcceptedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      ).toThrow(/Email de usuario inválido/);
    });
  });

  describe("Profile Entity (Adult Age Business Rule)", () => {
    it("accepts a profile for an adult (18+)", () => {
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 20);

      const profile = new Profile({
        userId: "u-1",
        fullName: "Juan Pérez",
        birthDate: eighteenYearsAgo,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(profile.getAge()).toBeGreaterThanOrEqual(18);
      expect(profile.fullName).toBe("Juan Pérez");
    });

    it("rejects a profile for a minor under 18 years old", () => {
      const sixteenYearsAgo = new Date();
      sixteenYearsAgo.setFullYear(sixteenYearsAgo.getFullYear() - 16);

      expect(
        () =>
          new Profile({
            userId: "u-2",
            fullName: "Menor de Edad",
            birthDate: sixteenYearsAgo,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      ).toThrow(/al menos 18 años/);
    });
  });

  describe("RoomListing Entity (3 Photos to Publish Rule)", () => {
    it("creates a draft room listing with positive rent", () => {
      const room = new RoomListing({
        id: "r-1",
        hostId: "u-1",
        title: "Habitación luminosa cerca de la universidad",
        monthlyRent: 3500,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(room.status).toBe("draft");
      expect(room.monthlyRent).toBe(3500);
    });

    it("rejects rent less than or equal to 0", () => {
      expect(
        () =>
          new RoomListing({
            id: "r-2",
            hostId: "u-1",
            title: "Habitación inválida",
            monthlyRent: 0,
            status: "draft",
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      ).toThrow(/renta mensual debe ser un valor positivo/);
    });

    it("rejects publishing when listing has less than 3 photos", () => {
      const room = new RoomListing({
        id: "r-3",
        hostId: "u-1",
        title: "Habitación con pocas fotos",
        monthlyRent: 2500,
        status: "draft",
        photoCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(room.canPublish()).toBe(false);
      expect(() => room.publish()).toThrow(/al menos 3 fotografías/);
    });

    it("allows publishing when listing has 3 or more photos", () => {
      const room = new RoomListing({
        id: "r-4",
        hostId: "u-1",
        title: "Habitación completa",
        monthlyRent: 2500,
        status: "draft",
        photoCount: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(room.canPublish()).toBe(true);
      room.publish();
      expect(room.status).toBe("published");
    });
  });

  describe("Application Entity (Status transitions)", () => {
    it("accepts a pending application", () => {
      const app = new Application({
        id: "app-1",
        listingId: "r-1",
        applicantId: "u-2",
        status: "pending",
        createdAt: new Date(),
      });

      app.accept();
      expect(app.status).toBe("accepted");
    });

    it("cannot accept an already accepted application", () => {
      const app = new Application({
        id: "app-1",
        listingId: "r-1",
        applicantId: "u-2",
        status: "accepted",
        createdAt: new Date(),
      });

      expect(() => app.accept()).toThrow(/No se puede aceptar/);
    });
  });

  describe("CompatibilityProfile Entity (Affinity calculation)", () => {
    it("calculates 100% compatibility for identical habits", () => {
      const profile1 = new CompatibilityProfile({
        userId: "u-1",
        schedule: 3,
        cleanliness: 4,
        noise: 2,
        pets: 1,
        smoking: 1,
        visits: 2,
        genderPref: 3,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      const profile2 = new CompatibilityProfile({
        userId: "u-2",
        schedule: 3,
        cleanliness: 4,
        noise: 2,
        pets: 1,
        smoking: 1,
        visits: 2,
        genderPref: 3,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      expect(profile1.calculateAffinityWith(profile2)).toBe(100);
    });

    it("calculates lower compatibility for divergent habits", () => {
      const morningPerson = new CompatibilityProfile({
        userId: "u-1",
        schedule: 1,
        cleanliness: 5,
        noise: 1,
        pets: 1,
        smoking: 1,
        visits: 1,
        genderPref: 1,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      const nightOwlParty = new CompatibilityProfile({
        userId: "u-2",
        schedule: 5,
        cleanliness: 1,
        noise: 5,
        pets: 5,
        smoking: 5,
        visits: 5,
        genderPref: 5,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      const score = morningPerson.calculateAffinityWith(nightOwlParty);
      expect(score).toBe(0);
    });
  });
});
