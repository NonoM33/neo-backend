import { eq, ilike, or, count, and, desc, SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { clients, projects, users } from '../../db/schema';
import { NotFoundError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type {
  CreateClientInput,
  UpdateClientInput,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectFilter,
} from './projects.schema';

// ============ Clients ============

export async function getClients(params: PaginationParams, search?: string) {
  const where = search
    ? or(
        ilike(clients.firstName, `%${search}%`),
        ilike(clients.lastName, `%${search}%`),
        ilike(clients.email, `%${search}%`)
      )
    : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(clients.createdAt)),
    db.select({ total: count() }).from(clients).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getClientById(id: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) {
    throw new NotFoundError('Client');
  }

  return client;
}

export async function createClient(input: CreateClientInput) {
  const [client] = await db.insert(clients).values(input).returning();
  return client;
}

export async function updateClient(id: string, input: UpdateClientInput) {
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Client');
  }

  const [client] = await db
    .update(clients)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();

  return client;
}

export async function deleteClient(id: string) {
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Client');
  }

  await db.delete(clients).where(eq(clients.id, id));
}

// ============ Projects ============

export async function getProjects(
  params: PaginationParams,
  filters: ProjectFilter,
  userId: string,
  userRole: string
) {
  const conditions: SQL[] = [];

  // Non-admin users can only see their own projects
  if (userRole !== 'admin') {
    conditions.push(eq(projects.userId, userId));
  }

  if (filters.status) {
    conditions.push(eq(projects.status, filters.status));
  }

  if (filters.clientId) {
    conditions.push(eq(projects.clientId, filters.clientId));
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(projects.name, `%${filters.search}%`),
        ilike(projects.description, `%${filters.search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        address: projects.address,
        city: projects.city,
        postalCode: projects.postalCode,
        surface: projects.surface,
        roomCount: projects.roomCount,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        client: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
        },
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .innerJoin(users, eq(projects.userId, users.id))
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(projects.createdAt)),
    db.select({ total: count() }).from(projects).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getProjectById(id: string, userId: string, userRole: string) {
  const conditions: SQL[] = [eq(projects.id, id)];

  // Non-admin users can only see their own projects
  if (userRole !== 'admin') {
    conditions.push(eq(projects.userId, userId));
  }

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      address: projects.address,
      city: projects.city,
      postalCode: projects.postalCode,
      surface: projects.surface,
      roomCount: projects.roomCount,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      client: clients,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      },
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .innerJoin(users, eq(projects.userId, users.id))
    .where(and(...conditions))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Projet');
  }

  return project;
}

export async function createProject(input: CreateProjectInput, userId: string) {
  // Verify client exists
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!client) {
    throw new NotFoundError('Client');
  }

  const [project] = await db
    .insert(projects)
    .values({
      ...input,
      userId,
      surface: input.surface?.toString(),
    })
    .returning();

  return project;
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  userId: string,
  userRole: string
) {
  const conditions: SQL[] = [eq(projects.id, id)];

  if (userRole !== 'admin') {
    conditions.push(eq(projects.userId, userId));
  }

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Projet');
  }

  if (input.clientId) {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, input.clientId))
      .limit(1);

    if (!client) {
      throw new NotFoundError('Client');
    }
  }

  const [project] = await db
    .update(projects)
    .set({
      ...input,
      surface: input.surface?.toString(),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  return project;
}

export async function deleteProject(id: string, userId: string, userRole: string) {
  const conditions: SQL[] = [eq(projects.id, id)];

  if (userRole !== 'admin') {
    conditions.push(eq(projects.userId, userId));
  }

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(...conditions))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Projet');
  }

  await db.delete(projects).where(eq(projects.id, id));
}
