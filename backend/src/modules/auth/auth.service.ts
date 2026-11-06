import { randomUUID } from "node:crypto";
import { User, type IUserRepository, type UserRole } from "../../domain/index.js";

export interface RegisterUserInput {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginUserInput {
  email: string;
  password: string;
}

export class AuthService {
  constructor(private userRepo: IUserRepository) {}

  async register(input: RegisterUserInput): Promise<User> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new Error("Ya existe una cuenta registrada con este correo electrónico.");
    }

    if (!input.password || input.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }

    // Nota: En producción usar bcrypt/argon2. Para el monolito base usamos hash representativo.
    const passwordHash = `mock_hash_${input.password}`;

    const user = new User({
      id: randomUUID(),
      email: input.email,
      passwordHash,
      status: "active",
      roles: input.role ? [input.role] : ["seeker"],
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await this.userRepo.create(user);
  }

  async login(input: LoginUserInput): Promise<{ user: User; token: string }> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new Error("Credenciales inválidas: correo no registrado.");
    }

    if (!user.isActive()) {
      throw new Error("La cuenta se encuentra inactiva o suspendida.");
    }

    const expectedHash = `mock_hash_${input.password}`;
    if (user.passwordHash !== expectedHash) {
      throw new Error("Credenciales inválidas: contraseña incorrecta.");
    }

    // Simulación de token JWT para el monolito educativo
    const token = `token_${user.id}_${Date.now()}`;
    return { user, token };
  }

  async getById(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error("Usuario no encontrado.");
    }
    return user;
  }
}
