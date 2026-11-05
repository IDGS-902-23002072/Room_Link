import { randomUUID } from "node:crypto";
import { User, type IUserRepository, type UserRole } from "../../domain/index.js";
import { AppError } from "../../shared/AppError.js";
import type {
  AuthPrincipal,
  AuthResult,
  AuthServiceDependencies,
} from "./auth.ports.js";

export interface RegisterUserInput {
  email: string;
  password: string;
  termsAccepted: boolean;
  role?: UserRole;
}

export interface LoginUserInput {
  email: string;
  password: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface OAuthLoginInput {
  idToken: string;
  termsAccepted: boolean;
  userAgent?: string | null;
  ipAddress?: string | null;
}

const systemClock = { now: (): Date => new Date() };

export class AuthService {
  private readonly clock;

  constructor(
    private readonly userRepo: IUserRepository,
    private readonly dependencies: AuthServiceDependencies,
  ) {
    this.clock = dependencies.clock ?? systemClock;
  }

  async register(input: RegisterUserInput): Promise<User> {
    const email = this.normalizeEmail(input.email);
    this.assertPassword(input.password);
    if (input.termsAccepted !== true) {
      throw new AppError(
        "Debes aceptar explícitamente los términos y condiciones.",
        400,
        "TERMS_REQUIRED",
      );
    }
    if (await this.userRepo.findByEmail(email)) {
      throw new AppError(
        "Ya existe una cuenta registrada con este correo electrónico.",
        409,
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const now = this.clock.now();
    const user = new User({
      id: randomUUID(),
      email,
      passwordHash: await this.dependencies.passwordHasher.hash(input.password),
      status: "active",
      roles: input.role ? [input.role] : ["seeker"],
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.userRepo.create(user);
    await this.dependencies.eventPublisher.publish({
      type: "UserRegisteredEvent",
      aggregateId: created.id,
      payload: { userId: created.id, email: created.email, provider: "local" },
    });
    return created;
  }

  async login(input: LoginUserInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(this.normalizeEmail(input.email));
    if (!user || !user.passwordHash) {
      throw new AppError("Credenciales inválidas.", 401, "INVALID_CREDENTIALS");
    }
    const now = this.clock.now();
    if (user.isLocked(now)) {
      throw new AppError(
        "La cuenta está bloqueada temporalmente. Intenta de nuevo más tarde.",
        423,
        "ACCOUNT_LOCKED",
      );
    }
    if (!user.isActive()) {
      throw new AppError("La cuenta se encuentra inactiva o suspendida.", 403, "ACCOUNT_INACTIVE");
    }

    if (!(await this.dependencies.passwordHasher.verify(input.password, user.passwordHash))) {
      user.recordFailedLogin(now);
      await this.userRepo.update(user);
      throw new AppError("Credenciales inválidas.", 401, "INVALID_CREDENTIALS");
    }

    user.recordSuccessfulLogin(now);
    await this.userRepo.update(user);
    return this.issueSession(user, input.userAgent, input.ipAddress);
  }

  async loginWithGoogle(input: OAuthLoginInput): Promise<AuthResult> {
    const profile = await this.dependencies.oauthProvider.verify(input.idToken);
    let user: User | null = null;
    const linkedUserId = await this.dependencies.oauthIdentityRepository.findUserId(
      profile.provider,
      profile.providerUserId,
    );
    if (linkedUserId) user = await this.userRepo.findById(linkedUserId);

    if (!user) {
      user = await this.userRepo.findByEmail(this.normalizeEmail(profile.email));
      if (!user) {
        if (input.termsAccepted !== true) {
          throw new AppError(
            "Debes aceptar explícitamente los términos y condiciones.",
            400,
            "TERMS_REQUIRED",
          );
        }
        const now = this.clock.now();
        user = await this.userRepo.create(
          new User({
            id: randomUUID(),
            email: this.normalizeEmail(profile.email),
            passwordHash: null,
            status: "active",
            roles: ["seeker"],
            emailVerifiedAt: profile.emailVerified ? now : null,
            termsAcceptedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        );
        await this.dependencies.eventPublisher.publish({
          type: "UserRegisteredEvent",
          aggregateId: user.id,
          payload: { userId: user.id, email: user.email, provider: "google" },
        });
      }
      await this.dependencies.oauthIdentityRepository.create({
        id: randomUUID(),
        userId: user.id,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      });
    }

    if (!user.isActive()) {
      throw new AppError("La cuenta se encuentra inactiva o suspendida.", 403, "ACCOUNT_INACTIVE");
    }
    user.recordSuccessfulLogin(this.clock.now());
    await this.userRepo.update(user);
    return this.issueSession(user, input.userAgent, input.ipAddress);
  }

  async requestPasswordReset(emailInput: string): Promise<void> {
    const user = await this.userRepo.findByEmail(this.normalizeEmail(emailInput));
    if (!user || !user.passwordHash) return;

    const now = this.clock.now();
    const token = this.dependencies.tokenGenerator.generate();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    await this.dependencies.resetRepository.invalidateForUser(user.id, now);
    await this.dependencies.resetRepository.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.dependencies.tokenGenerator.hash(token),
      expiresAt,
      createdAt: now,
    });
    await this.dependencies.emailNotifier.sendPasswordReset({ email: user.email, token, expiresAt });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    this.assertPassword(password);
    const record = await this.dependencies.resetRepository.findByTokenHash(
      this.dependencies.tokenGenerator.hash(token),
    );
    const now = this.clock.now();
    if (!record || record.usedAt || record.expiresAt <= now) {
      throw new AppError(
        "El token de recuperación es inválido o expiró.",
        400,
        "INVALID_RESET_TOKEN",
      );
    }
    const user = await this.userRepo.findById(record.userId);
    if (!user) throw new AppError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
    user.changePassword(await this.dependencies.passwordHasher.hash(password), now);
    await this.userRepo.update(user);
    await this.dependencies.resetRepository.markUsed(record.id, now);
    await this.dependencies.sessionRepository.revokeAllForUser(user.id, now);
  }

  async authenticate(token: string): Promise<AuthPrincipal> {
    const session = await this.dependencies.sessionRepository.findActiveByTokenHash(
      this.dependencies.tokenGenerator.hash(token),
      this.clock.now(),
    );
    if (!session) throw new AppError("Sesión inválida o expirada.", 401, "INVALID_SESSION");
    const user = await this.userRepo.findById(session.userId);
    if (!user || !user.isActive()) {
      throw new AppError("Sesión no autorizada.", 401, "INVALID_SESSION");
    }
    return { userId: user.id, roles: user.roles, sessionId: session.id };
  }

  async logout(principal: AuthPrincipal): Promise<void> {
    await this.dependencies.sessionRepository.revoke(principal.sessionId, this.clock.now());
  }

  async getById(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new AppError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
    return user;
  }

  private async issueSession(
    user: User,
    userAgent?: string | null,
    ipAddress?: string | null,
  ): Promise<AuthResult> {
    const now = this.clock.now();
    const token = this.dependencies.tokenGenerator.generate();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.dependencies.sessionRepository.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.dependencies.tokenGenerator.hash(token),
      userAgent,
      ipAddress,
      createdAt: now,
      expiresAt,
    });
    return { user, token, expiresAt };
  }

  private assertPassword(password: string): void {
    if (!password || password.length < 8) {
      throw new AppError(
        "La contraseña debe tener al menos 8 caracteres.",
        400,
        "WEAK_PASSWORD",
      );
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
