import { GeolocationService } from "./modules/geolocation/geolocation.service.js";
import { createGeolocationRoutes } from "./modules/geolocation/geolocation.routes.js";
import { configureSmtp } from "./modules/auth/smtp-mailer.js";
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
  type IConnectionRepository,
  type IActivityLogRepository,
  type IAgreementRepository,
  type IAnalyticsRepository,
  type IAnalyticsSource,
  type INotificationRepository,
  type ISanctionRepository,
  type ISearchRepository,
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
  DrizzleConnectionRepository,
  DrizzleNotificationRepository,
  DrizzleSanctionRepository,
  DrizzleActivityLogRepository,
  DrizzleAgreementRepository,
  DrizzleAnalyticsRepository,
  DrizzleAnalyticsSource,
  DrizzleSearchRepository,
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
  ConnectionsService,
  ConnectionsController,
  createConnectionsRoutes,
} from "./modules/connections/index.js";
import {
  NotificationsService,
  NotificationsController,
  NotificationsEventConsumer,
  InProcessEventBus,
  createNotificationsRoutes,
} from "./modules/notifications/index.js";
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
import {
  AnalyticsService,
  AnalyticsController,
  createAnalyticsRoutes,
} from "./modules/analytics/index.js";
import {
  SanctionsService,
  SanctionsController,
  createSanctionsRoutes,
} from "./modules/sanctions/index.js";
import {
  ActivityLogService,
  ActivityLogController,
  ActivityLogConsumer,
  createActivityLogRoutes,
} from "./modules/activity-log/index.js";
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
  connectionRepo?: IConnectionRepository;
  notificationRepo?: INotificationRepository;
  sanctionRepo?: ISanctionRepository;
  activityLogRepo?: IActivityLogRepository;
  agreementRepo?: IAgreementRepository;
  analyticsRepo?: IAnalyticsRepository;
  analyticsSource?: IAnalyticsSource;
  searchRepo?: ISearchRepository;
}

export const createApp = (dependencies: AppDependencies = {}): Hono => {
  const app = new Hono();
  // Cabeceras de seguridad transversales (RNF-05.1)
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });

  // Permitir consultar las fotografías almacenadas
  app.use("/uploads/*", serveStatic({ root: "./" }));

  const allowedOrigins = new Set([
    process.env.FRONTEND_ORIGIN ?? "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  app.use(
    "/api/*",
    cors({
      origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
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
  // Event bus compartido: outbox persistente + suscriptores in-process.
  // Si el cliente pasó su propio publisher en authDependencies, lo usamos
  // para TODOS los módulos (sanctions incluida) — así los listeners se
  // suscriben al mismo bus que los publishers.
  const defaultBus = new InProcessEventBus(
    new AsyncEventPublisher(new DrizzleOutboxEventPublisher(db)),
  );
  const resolvedBus = dependencies.authDependencies?.eventPublisher ?? defaultBus;

  // Sanctions service construido primero para poder exponerlo como SessionGuard a auth.
  const sanctionsService = new SanctionsService(
    dependencies.sanctionRepo ?? new DrizzleSanctionRepository(db),
    resolvedBus,
  );

  // 1. Auth Module
  const smtp = dependencies.authDependencies ? undefined : configureSmtp();
  const authDependencies =
    dependencies.authDependencies ??
    ({
      passwordHasher: new BcryptPasswordHasher(12),
      tokenGenerator: new CryptoTokenGenerator(),
      sessionRepository: new DrizzleAuthSessionRepository(db),
      resetRepository: new DrizzlePasswordResetRepository(db),
      oauthIdentityRepository: new DrizzleOAuthIdentityRepository(db),
      oauthProvider: new GoogleOAuthProfileProvider(config.auth.googleClientId),
      emailNotifier: smtp ?? new ConsoleEmailNotifier(),
      eventPublisher: resolvedBus,
      sessionGuard: {
        isBlocked: async (userId: string) =>
          (await sanctionsService.findBlockingSession(userId)) !== null,
      },
      // Registro exhaustivo de arrendador: auth consulta la verificación de
      // identidad (que vive en el módulo de perfil) sin acoplarse a él.
      identityProvider: {
        getIdentityStatus: async (userId: string) => {
          const perfil = await profileRepo.findByUserId(userId);
          return perfil ? perfil.identityStatus : null;
        },
      },
    } satisfies AuthServiceDependencies);
  const authService = new AuthService(userRepo, authDependencies);
  const authController = new AuthController(authService, config.auth.secureCookies);
  app.route("/api/v1/auth", createAuthRoutes(authController, authService));

  // Repositorio de conexiones compartido (perfil HU-02 + módulo de conexiones).
  const connectionRepo =
    dependencies.connectionRepo ?? new DrizzleConnectionRepository(db);

  // 2. Profile Module
  const profileService = new ProfileService(profileRepo);
  const profileController = new ProfileController(profileService, {
    // HU-02 — hay conexión si existe una aceptada entre ambos.
    areConnected: async (viewerId: string, ownerId: string) => {
      const conns = await connectionRepo.listForUser(viewerId, "all");
      return conns.some(
        (conn) =>
          conn.status === "accepted" &&
          (conn.requesterId === ownerId || conn.addresseeId === ownerId),
      );
    },
  });
  app.route("/api/v1/profiles", createProfileRoutes(profileController, authService));

  // 3. Rooms Module
  const roomsService = new RoomsService(roomRepo);
  const roomsController = new RoomsController(roomsService);
  app.route("/api/v1/rooms", createRoomsRoutes(roomsController, authService));
  app.route("/api/v1/geolocation", createGeolocationRoutes(new GeolocationService(), roomsService, authService));

  // 4. Applications Module (resuelve el host del listing para autorizar decide/getByListing)
  const applicationsService = new ApplicationsService(appRepo, authDependencies.eventPublisher);
  const applicationsController = new ApplicationsController(applicationsService, {
    resolveListingHostId: async (listingId: string) => {
      const room = await roomRepo.findById(listingId);
      return room ? room.hostId : null;
    },
    // HU-07 — afinidad calculada en el servidor (postulante como viewer, host como candidato).
    resolveCompatibilityScore: async (applicantId: string, hostId: string) => {
      try {
        const candidate = await compatibilityRepo.findCandidate(applicantId, hostId);
        return candidate?.compatibilityScore ?? null;
      } catch {
        return null;
      }
    },
  });
  app.route(
    "/api/v1/applications",
    createApplicationsRoutes(applicationsController, authService),
  );

  // 5. Compatibility and affinity modules
  const compatibilityService = new CompatibilityService(compatibilityRepo, authDependencies.eventPublisher);
  const compatibilityController = new CompatibilityController(compatibilityService);
  app.route(
    "/api/v1/compatibility",
    createCompatibilityRoutes(compatibilityController, authService),
  );

  // 6. Messaging Module
  const messageEvents = dependencies.messageEvents ?? new InMemoryMessageEventPublisher();
  const messagingService = new MessagingService(
    dependencies.messagingRepo ?? new DrizzleMessagingRepository(db),
    messageEvents,
    undefined,
    authDependencies.eventPublisher,
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

  // 8. Connections Module (accept/reject/cancel)
  const connectionsService = new ConnectionsService(
    connectionRepo,
    authDependencies.eventPublisher,
  );
  const connectionsController = new ConnectionsController(connectionsService);
  app.route(
    "/api/v1/connections",
    createConnectionsRoutes(connectionsController, authService),
  );

  // 9. Notifications Module (consumidor de eventos + API)
  const notificationsService = new NotificationsService(
    dependencies.notificationRepo ?? new DrizzleNotificationRepository(db),
  );
  const notificationsController = new NotificationsController(notificationsService);
  const notificationsConsumer = new NotificationsEventConsumer(
    notificationsService,
    async (listingId) => {
      const room = await roomRepo.findById(listingId);
      return room ? room.hostId : null;
    },
    smtp ? async (userId, title) => {
      const user = await userRepo.findById(userId);
      if (user?.emailVerifiedAt && user.isActive()) await smtp.sendNotification(user.email, title);
    } : undefined,
  );
  // Suscribe el consumer al bus compartido (solo si el publisher soporta subscribe).
  const subscribable = resolvedBus as unknown as InProcessEventBus;
  if (typeof subscribable.subscribe === "function") {
    notificationsConsumer.register(subscribable);
  }
  app.route(
    "/api/v1/notifications",
    createNotificationsRoutes(notificationsController, authService),
  );

  // 10. Sanctions Module (admin)
  const sanctionsController = new SanctionsController(sanctionsService);
  app.route(
    "/api/v1/sanctions",
    createSanctionsRoutes(sanctionsController, authService),
  );

  // 11. Agreements (acuerdos de convivencia) — módulo de Roberto
  const agreementsService = new AgreementsService(
    dependencies.agreementRepo ?? new DrizzleAgreementRepository(db),
  );
  const agreementsController = new AgreementsController(agreementsService);
  app.route(
    "/api/v1/agreements",
    createAgreementsRoutes(agreementsController, authService),
  );

  // 14. Search Module (HU-05) — módulo de Roberto
  const searchRepo = dependencies.searchRepo ?? new DrizzleSearchRepository(db);
  const searchService = new SearchService(searchRepo);
  const searchController = new SearchController(searchService);
  app.route("/api/v1/search", createSearchRoutes(searchController, authService));

  // 12. Analytics (admin)
  const analyticsService = new AnalyticsService(
    dependencies.analyticsRepo ?? new DrizzleAnalyticsRepository(db),
    dependencies.analyticsSource ?? new DrizzleAnalyticsSource(db),
  );
  const analyticsController = new AnalyticsController(analyticsService);
  app.route(
    "/api/v1/admin/analytics",
    createAnalyticsRoutes(analyticsController, authService),
  );

  // 13. Activity log (admin): suscribe al bus para persistir cada evento.
  const activityLogService = new ActivityLogService(
    dependencies.activityLogRepo ?? new DrizzleActivityLogRepository(db),
  );
  const activityLogConsumer = new ActivityLogConsumer(activityLogService);
  if (typeof subscribable.subscribe === "function") {
    activityLogConsumer.register(subscribable);
  }
  const activityLogController = new ActivityLogController(activityLogService);
  app.route(
    "/api/v1/admin/activity-log",
    createActivityLogRoutes(activityLogController, authService),
  );

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

  // Sirve el build estático del sitio web (web/, Vite) desde ./public.
  // public/descargas enlaza a la carpeta persistente con el APK.
  app.use("/*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    return serveStatic({ root: "./public" })(c, next);
  });
  // Fallback SPA: las rutas de BrowserRouter resuelven a index.html.
  app.get("/*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    return serveStatic({ path: "./public/index.html" })(c, next);
  });

  return app;
};
