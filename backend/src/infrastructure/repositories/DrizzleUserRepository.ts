import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { User, type IUserRepository } from "../../domain/index.js";
import { authUsers, authUserRoles } from "../../db/schema/auth.js";

export class DrizzleUserRepository implements IUserRepository {
  constructor(private db: MySql2Database<any>) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);

    const userRow = rows[0];
    if (!userRow) return null;

    const rolesRows = await this.db
      .select()
      .from(authUserRoles)
      .where(eq(authUserRoles.userId, id));

    return new User({
      id: userRow.id,
      email: userRow.email,
      passwordHash: userRow.passwordHash,
      status: userRow.status,
      roles: rolesRows.map((r) => r.role),
      emailVerifiedAt: userRow.emailVerifiedAt ? new Date(userRow.emailVerifiedAt) : null,
      termsAcceptedAt: new Date(userRow.termsAcceptedAt),
      failedLoginAttempts: userRow.failedLoginAttempts,
      lockedUntil: userRow.lockedUntil ? new Date(userRow.lockedUntil) : null,
      lastLoginAt: userRow.lastLoginAt ? new Date(userRow.lastLoginAt) : null,
      createdAt: new Date(userRow.createdAt),
      updatedAt: new Date(userRow.updatedAt),
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .limit(1);

    const userRow = rows[0];
    if (!userRow) return null;

    const rolesRows = await this.db
      .select()
      .from(authUserRoles)
      .where(eq(authUserRoles.userId, userRow.id));

    return new User({
      id: userRow.id,
      email: userRow.email,
      passwordHash: userRow.passwordHash,
      status: userRow.status,
      roles: rolesRows.map((r) => r.role),
      emailVerifiedAt: userRow.emailVerifiedAt ? new Date(userRow.emailVerifiedAt) : null,
      termsAcceptedAt: new Date(userRow.termsAcceptedAt),
      failedLoginAttempts: userRow.failedLoginAttempts,
      lockedUntil: userRow.lockedUntil ? new Date(userRow.lockedUntil) : null,
      lastLoginAt: userRow.lastLoginAt ? new Date(userRow.lastLoginAt) : null,
      createdAt: new Date(userRow.createdAt),
      updatedAt: new Date(userRow.updatedAt),
    });
  }

  async create(user: User): Promise<User> {
    await this.db.insert(authUsers).values({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash ?? null,
      status: user.status,
      termsAcceptedAt: user.termsAcceptedAt,
    });

    for (const role of user.roles) {
      await this.db.insert(authUserRoles).values({
        userId: user.id,
        role,
      });
    }

    return user;
  }

  async update(user: User): Promise<void> {
    await this.db
      .update(authUsers)
      .set({
        email: user.email,
        passwordHash: user.passwordHash ?? null,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt ?? null,
      })
      .where(eq(authUsers.id, user.id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(authUsers).where(eq(authUsers.id, id));
  }
}
