import { Hono } from "hono";
import type { AgreementsController } from "./agreements.controller.js";

export const createAgreementsRoutes = (
  controller: AgreementsController,
): Hono => {
  const router = new Hono();

  router.post("/", controller.generarAcuerdo);
  router.get("/:agreementId", controller.getAgreement);
  router.post("/:agreementId/accept", controller.aceptarAcuerdo);
  router.post("/:agreementId/versions", controller.crearNuevaVersion);

  router.get("/by-listing/:listingId", controller.listForListing);
  router.get("/by-user/:userId", controller.listForUser);

  return router;
};
