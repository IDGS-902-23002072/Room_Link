import type { User } from "../../domain/index.js";

export interface UserPublicDto {
  id: string;
  email: string;
  status: string;
  roles: string[];
  isEmailVerified: boolean;
  createdAt: string;
}

export interface AuthSuccessDto {
  user: UserPublicDto;
  token?: string | undefined;
  message?: string | undefined;
}

/**
 * Vista / Serializador para el módulo de Autenticación.
 */
export class AuthView {
  public static toPublicUser(user: User): UserPublicDto {
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      roles: user.roles,
      isEmailVerified: user.isEmailVerified(),
      createdAt: user.createdAt.toISOString(),
    };
  }

  public static toAuthResponse(user: User, token?: string, message?: string): AuthSuccessDto {
    const res: AuthSuccessDto = {
      user: this.toPublicUser(user),
    };
    if (token !== undefined) res.token = token;
    if (message !== undefined) res.message = message;
    return res;
  }
}
