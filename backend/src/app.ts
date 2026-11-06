import { Hono } from "hono";
import { db, checkDatabase as defaultCheckDatabase } from "./db/client.js";
import { config } from "./config.js";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  type IUserRepository,
  type IProfileRepository,
  type IRoomListingRepository,
  type IApplicationRepository,
  type ICompatibilityRepository,
  type ISearchRepository,
  type IAgreementRepository,
} from "./domain/index.js";
import {
  DrizzleUserRepository,
  DrizzleProfileRepository,
  DrizzleRoomListingRepository,
  DrizzleApplicationRepository,
  DrizzleCompatibilityRepository,
  DrizzleAuthSessionRepository,
  DrizzleOAuthIdentityRepository,
  DrizzleOutboxEventPublisher,
  DrizzlePasswordResetRepository,
  DrizzleMessagingRepository,
  DrizzleModerationRepository,
  DrizzleSearchRepository,
  DrizzleAgreementRepository,
} from "./infrastructure/repositories/index.js";
import {
  AuthService,
  AuthController,
  createAuthRoutes,
  BcryptPasswordHasher,
  CryptoTokenGenerator,
  GoogleOAuthProfileProvider,
  ConsoleEmailNotifier,
  AsyncEventPublisher,
  type AuthServiceDependencies,
} from "./modules/auth/index.js";
import {
  InMemoryMessageEventPublisher,
  MessagingController,
  MessagingService,
  createMessagingRoutes,
  type MessageEventPublisher,
  type MessagingRepository,
} from "./modules/messaging/index.js";
import {
  ModerationController,
  ModerationService,
  createModerationRoutes,
  type ModerationRepository,
} from "./modules/moderation/index.js";
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
import {
  SearchService,
  SearchController,
  createSearchRoutes,
} from "./modules/search/index.js";
import {
  AgreementsService,
  AgreementsController,
  createAgreementsRoutes,
} from "./modules/agreements/index.js";
import { cors } from "hono/cors";

export interface AppDependencies {
  checkDatabase?: () => Promise<void>;
  userRepo?: IUserRepository;
  profileRepo?: IProfileRepository;
  roomRepo?: IRoomListingRepository;
  appRepo?: IApplicationRepository;
  compatibilityRepo?: ICompatibilityRepository;
  authDependencies?: AuthServiceDependencies;
  messagingRepo?: MessagingRepository;
  messageEvents?: MessageEventPublisher;
  moderationRepo?: ModerationRepository;
  searchRepo?: ISearchRepository;
  agreementsRepo?: IAgreementRepository;
}

export const createApp = (dependencies: AppDependencies = {}): Hono => {
  const app = new Hono();
  // Permitir consultar las fotografías almacenadas
app.use(
  "/uploads/*",
  serveStatic({ root: "./" })
);
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
  const authDependencies =
    dependencies.authDependencies ??
    ({
      passwordHasher: new BcryptPasswordHasher(12),
      tokenGenerator: new CryptoTokenGenerator(),
      sessionRepository: new DrizzleAuthSessionRepository(db),
      resetRepository: new DrizzlePasswordResetRepository(db),
      oauthIdentityRepository: new DrizzleOAuthIdentityRepository(db),
      oauthProvider: new GoogleOAuthProfileProvider(config.auth.googleClientId),
      emailNotifier: new ConsoleEmailNotifier(),
      eventPublisher: new AsyncEventPublisher(new DrizzleOutboxEventPublisher(db)),
    } satisfies AuthServiceDependencies);
  const authService = new AuthService(userRepo, authDependencies);
  const authController = new AuthController(authService, config.auth.secureCookies);
  app.route("/api/v1/auth", createAuthRoutes(authController, authService));

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

  // 6. Messaging Module
  const messageEvents = dependencies.messageEvents ?? new InMemoryMessageEventPublisher();
  const messagingService = new MessagingService(
    dependencies.messagingRepo ?? new DrizzleMessagingRepository(db),
    messageEvents,
  );
  const messagingController = new MessagingController(messagingService, messageEvents);
  app.route("/api/v1/messages", createMessagingRoutes(messagingController, authService));

  // 7. Listing Moderation Module
  const moderationService = new ModerationService(
    dependencies.moderationRepo ?? new DrizzleModerationRepository(db),
    authDependencies.eventPublisher,
  );
  const moderationController = new ModerationController(moderationService);
  app.route(
    "/api/v1/moderation",
    createModerationRoutes(moderationController, authService),
  );

  // 8. Search Module (HU-05)
  const searchRepo = dependencies.searchRepo ?? new DrizzleSearchRepository(db);
  const searchService = new SearchService(searchRepo);
  const searchController = new SearchController(searchService);
  app.route("/api/v1/search", createSearchRoutes(searchController));

  // 9. Agreements Module (HU-12)
  const agreementsRepo =
    dependencies.agreementsRepo ?? new DrizzleAgreementRepository(db);
  const agreementsService = new AgreementsService(agreementsRepo);
  const agreementsController = new AgreementsController(agreementsService);
  app.route("/api/v1/agreements", createAgreementsRoutes(agreementsController));

  // Endpoints del sistema / orquestación
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
