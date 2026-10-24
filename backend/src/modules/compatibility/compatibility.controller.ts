import type { Context } from "hono";
import { CompatibilityService, CompatibilityError } from "./compatibility.service.js";
import { CompatibilityView } from "./compatibility.view.js";

export class CompatibilityController {
  constructor(private readonly service: CompatibilityService) {}

  getTest = async (context: Context) => {
    try {
      return context.json(
        CompatibilityView.toTest(
          await this.service.getTest(context.req.param("userId") ?? ""),
        ),
      );
    } catch (error) {
      return this.respondWithError(context, error);
    }
  };

  saveTest = async (context: Context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "El cuerpo debe ser JSON válido." }, 400);
    }

    if (!CompatibilityService.isValidAnswers(body)) {
      return context.json(
        {
          error:
            "Se requieren las siete respuestas como enteros entre 1 y 5: schedule, cleanliness, noise, pets, smoking, visits y genderPref.",
        },
        400,
      );
    }

    try {
      const result = await this.service.saveTest(
        context.req.param("userId") ?? "",
        body,
      );
      return context.json(CompatibilityView.toTest(result), 200);
    } catch (error) {
      return this.respondWithError(context, error);
    }
  };

  getFeed = async (context: Context) => {
    const rawPage = context.req.query("page") ?? "1";
    const page = Number(rawPage);
    if (!Number.isSafeInteger(page) || page < 1) {
      return context.json({ error: "La página debe ser un entero mayor a cero." }, 400);
    }

    try {
      const result = await this.service.getFeed(
        context.req.param("userId") ?? "",
        page,
      );
      return context.json(CompatibilityView.toFeed(result), 200);
    } catch (error) {
      return this.respondWithError(context, error);
    }
  };

  getCandidate = async (context: Context) => {
    try {
      const candidate = await this.service.getCandidate(
        context.req.param("userId") ?? "",
        context.req.param("candidateId") ?? "",
      );
      return context.json(CompatibilityView.toCandidate(candidate), 200);
    } catch (error) {
      return this.respondWithError(context, error);
    }
  };

  sendConnectionRequest = async (context: Context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "El cuerpo debe ser JSON válido." }, 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("introMessage" in body) ||
      !("candidateId" in body) ||
      typeof body.candidateId !== "string" ||
      (body.introMessage !== null && typeof body.introMessage !== "string")
    ) {
      return context.json(
        { error: "candidateId e introMessage (texto o null) son obligatorios." },
        400,
      );
    }

    try {
      const request = await this.service.sendConnectionRequest(
        context.req.param("userId") ?? "",
        body.candidateId,
        body.introMessage,
      );
      return context.json(CompatibilityView.toConnection(request), 201);
    } catch (error) {
      return this.respondWithError(context, error);
    }
  };

  private respondWithError(context: Context, error: unknown) {
    if (error instanceof CompatibilityError) {
      return context.json({ error: error.message }, error.statusCode);
    }
    console.error("Error en el módulo de compatibilidad:", error);
    return context.json({ error: "No se pudo completar la operación." }, 500);
  }
}
