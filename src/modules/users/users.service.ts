import { eq, ilike, or, count, and, SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { users } from '../../db/schema';
import { hashPassword } from '../auth/auth.service';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type { CreateUserInput, UpdateUserInput, UserFilter } from './users.schema';

export async function getUsers(params: PaginationParams, filters: UserFilter) {
  const conditions: SQL[] = [];

  if (filters.role) {
    conditions.push(eq(users.role, filters.role));
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(users.email, `%${filters.search}%`),
        ilike(users.firstName, `%${filters.search}%`),
        ilike(users.lastName, `%${filters.search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(users.createdAt),
    db.select({ total: count() }).from(users).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getUserById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw new NotFoundError('Utilisateur');
  }

  return user;
}

export async function createUser(input: CreateUserInput) {
  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('Un utilisateur avec cet email existe déjà');
  }

  const hashedPassword = await hashPassword(input.password);

  const [user] = await db
    .insert(users)
    .values({
      ...input,
      password: hashedPassword,
    })
    .returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
    });

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  // Check if user exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Utilisateur');
  }

  // Check email uniqueness if updating email
  if (input.email) {
    const emailExists = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, input.email), eq(users.id, id)))
      .limit(1);

    // If we find a user with this email that's not the current user
    const otherUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (otherUser.length > 0 && otherUser[0]?.id !== id) {
      throw new ConflictError('Un utilisateur avec cet email existe déjà');
    }
  }

  const updateData: Record<string, any> = { ...input, updatedAt: new Date() };

  if (input.password) {
    updateData.password = await hashPassword(input.password);
  }

  const [user] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  return user;
}

export async function deleteUser(id: string) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Utilisateur');
  }

  await db.delete(users).where(eq(users.id, id));
}
