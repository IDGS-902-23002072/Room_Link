import { Hono } from "hono";
import { db, checkDatabase as defaultCheckDatabase } from "./db/client.js";
import {
  type IUserRepository,
  type IProfileRepository,
  type IRoomListingRepository,
  type IApplicationRepository,
  type ICompatibilityRepository,
} from "./domain/index.js";
import {
  DrizzleUserRepository,
  DrizzleProfileRepository,
  DrizzleRoomListingRepository,
  DrizzleApplicationRepository,
  DrizzleCompatibilityRepository,
} from "./infrastructure/repositories/index.js";
import {
  AuthService,
  AuthController,
  createAuthRoutes,
} from "./modules/auth/index.js";
import {
  ProfileService,
  ProfileController,
  createProfileRoutes,
} from "./modules/profile/index.js";
import {
  RoomsService,
  RoomsController,
  createRoomsRoutes,
} from "./modules/rooms/index.js";
import {
  ApplicationsService,
  ApplicationsController,
  createApplicationsRoutes,
} from "./modules/applications/index.js";
import {
  CompatibilityService,
  CompatibilityController,
  createCompatibilityRoutes,
} from "./modules/compatibility/index.js";
import { cors } from "hono/cors";

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
  userRepo?: IUserRepository;
  profileRepo?: IProfileRepository;
  roomRepo?: IRoomListingRepository;
  appRepo?: IApplicationRepository;
  compatibilityRepo?: ICompatibilityRepository;
}

export const createApp = (dependencies: AppDependencies = {}): Hono => {
  const app = new Hono();
  const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:8081";
  app.use(
    "/api/*",
    cors({
      origin: (origin) =>
        origin === allowedOrigin || origin === "http://127.0.0.1:8081"
          ? origin
          : null,
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
      maxAge: 600,
    }),
  );

  // Dependencias e Infraestructura (Inyección de dependencias)
  const checkDb = dependencies.checkDatabase ?? defaultCheckDatabase;
  const userRepo = dependencies.userRepo ?? new DrizzleUserRepository(db);
  const profileRepo = dependencies.profileRepo ?? new DrizzleProfileRepository(db);
  const roomRepo = dependencies.roomRepo ?? new DrizzleRoomListingRepository(db);
  const appRepo = dependencies.appRepo ?? new DrizzleApplicationRepository(db);
  const compatibilityRepo =
    dependencies.compatibilityRepo ?? new DrizzleCompatibilityRepository(db);

  // Módulos (Monolito Modular con MVC)
  // 1. Auth Module
  const authService = new AuthService(userRepo);
  const authController = new AuthController(authService);
  app.route("/api/v1/auth", createAuthRoutes(authController));

  // 2. Profile Module
  const profileService = new ProfileService(profileRepo);
  const profileController = new ProfileController(profileService);
  app.route("/api/v1/profiles", createProfileRoutes(profileController));

  // 3. Rooms Module
  const roomsService = new RoomsService(roomRepo);
  const roomsController = new RoomsController(roomsService);
  app.route("/api/v1/rooms", createRoomsRoutes(roomsController));

  // 4. Applications Module
  const applicationsService = new ApplicationsService(appRepo);
  const applicationsController = new ApplicationsController(applicationsService);
  app.route("/api/v1/applications", createApplicationsRoutes(applicationsController));

  // 5. Compatibility and affinity modules
  const compatibilityService = new CompatibilityService(compatibilityRepo);
  const compatibilityController = new CompatibilityController(compatibilityService);
  app.route(
    "/api/v1/compatibility",
    createCompatibilityRoutes(compatibilityController),
  );

  // System endpoints
  app.get("/health", (context) =>
    context.json({ status: "ok", service: "room-link-backend" }),
  );

  app.get("/ready", async (context) => {
    try {
      await checkDb();
      return context.json({ status: "ready", database: "connected" });
    } catch {
      return context.json(
        { status: "unavailable", database: "disconnected" },
        503,
      );
    }
  });

  return app;
};
