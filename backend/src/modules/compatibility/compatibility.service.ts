import {
  CompatibilityProfile,
  compatibilityDimensions,
  type CompatibilityAnswers,
} from "../../domain/entities/CompatibilityProfile.js";
import type {
  CompatibilityFeedCandidate,
  ConnectionRequest,
  ICompatibilityRepository,
} from "../../domain/repositories/ICompatibilityRepository.js";

export class CompatibilityError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404,
  ) {
    super(message);
    this.name = "CompatibilityError";
  }
}

export interface CompatibilityTestResult {
  completed: boolean;
  answers: CompatibilityAnswers | null;
  summary: ReturnType<CompatibilityProfile["calculateSummary"]>;
  updatedAt: string | null;
}

export interface AffinityFeedResult {
  hasTest: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
  profiles: CompatibilityFeedCandidate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class CompatibilityService {
  constructor(private readonly repository: ICompatibilityRepository) {}

  async getTest(userId: string): Promise<CompatibilityTestResult> {
    await this.requireActiveUser(userId);
    const profile = await this.repository.findByUserId(userId);
    return profile
      ? {
          completed: true,
          answers: profile.answers,
          summary: profile.calculateSummary(),
          updatedAt: profile.updatedAt.toISOString(),
        }
      : { completed: false, answers: null, summary: [], updatedAt: null };
  }

  async saveTest(
    userId: string,
    answers: CompatibilityAnswers,
  ): Promise<CompatibilityTestResult> {
    await this.requireActiveUser(userId);
    const now = new Date();
    const profile = new CompatibilityProfile({
      userId,
      ...answers,
      completedAt: now,
      updatedAt: now,
    });
    await this.repository.save(profile);
    return {
      completed: true,
      answers: profile.answers,
      summary: profile.calculateSummary(),
      updatedAt: now.toISOString(),
    };
  }

  async getFeed(userId: string, page: number): Promise<AffinityFeedResult> {
    await this.requireActiveUser(userId);
    const pageSize = 12;
    const profiles = await this.repository.findFeed(
      userId,
      pageSize,
      (page - 1) * pageSize,
    );
    return {
      hasTest: (await this.repository.findByUserId(userId)) !== null,
      page,
      pageSize,
      hasMore: profiles.length === pageSize,
      profiles,
    };
  }

  async getCandidate(
    viewerId: string,
    candidateId: string,
  ): Promise<CompatibilityFeedCandidate> {
    await this.requireActiveUser(viewerId);
    const candidate = await this.repository.findCandidate(viewerId, candidateId);
    if (!candidate) {
      throw new CompatibilityError("No se encontró el perfil solicitado.", 404);
    }
    return candidate;
  }

  async sendConnectionRequest(
    requesterId: string,
    addresseeId: string,
    introMessage: string | null,
  ): Promise<ConnectionRequest> {
    if (requesterId === addresseeId) {
      throw new CompatibilityError("No puedes enviarte una solicitud a ti mismo.", 400);
    }
    await this.requireActiveUser(requesterId);
    await this.requireActiveUser(addresseeId);
    const message = introMessage?.trim() ?? "";
    if (message.length > 500) {
      throw new CompatibilityError("El mensaje no puede superar 500 caracteres.", 400);
    }
    return this.repository.createConnection(
      requesterId,
      addresseeId,
      message.length > 0 ? message : null,
    );
  }

  static isValidAnswers(input: unknown): input is CompatibilityAnswers {
    if (!isRecord(input)) return false;
    return (
      compatibilityDimensions.every(
        (dimension) =>
          Number.isInteger(input[dimension]) &&
          Number(input[dimension]) >= 1 &&
          Number(input[dimension]) <= 5,
      ) &&
      Object.keys(input).length === compatibilityDimensions.length
    );
  }

  private async requireActiveUser(userId: string): Promise<void> {
    if (!(await this.repository.isActiveUser(userId))) {
      throw new CompatibilityError("El usuario no existe o no está activo.", 404);
    }
  }
}
