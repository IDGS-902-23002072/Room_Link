import { Hono } from "hono";
import {
  createAuthMiddleware,
  type AuthService,
  type AuthVariables,
} from "../auth/index.js";
import type { AgreementsController } from "./agreements.controller.js";

export const createAgreementsRoutes = (
  controller: AgreementsController,
  authService: AuthService,
): Hono<{ Variables: AuthVariables }> => {
  const router = new Hono<{ Variables: AuthVariables }>();
  const authenticate = createAuthMiddleware(authService);

  // Acuerdos de convivencia: datos privados → toda la API requiere sesión.
  router.post("/", authenticate, controller.generarAcuerdo);
  router.get("/:agreementId", authenticate, controller.getAgreement);
  router.post("/:agreementId/accept", authenticate, controller.aceptarAcuerdo);
  router.post(
    "/:agreementId/versions",
    authenticate,
    controller.crearNuevaVersion,
  );

  router.get("/by-listing/:listingId", authenticate, controller.listForListing);
  router.get("/by-user/:userId", authenticate, controller.listForUser);

  return router;
};
