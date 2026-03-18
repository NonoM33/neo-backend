import { eq, ilike, or, count, and, desc, SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { cloudInstances, clients } from '../../db/schema';
import { NotFoundError, AppError } from '../../lib/errors';
import { paginate, getOffset, type PaginationParams } from '../../lib/pagination';
import type {
  CreateCloudInstanceInput,
  UpdateCloudInstanceInput,
  HeartbeatInput,
  InstanceFilter,
} from './cloud-instances.schema';
import { env } from '../../config/env';

// ============ Docker Management ============

function generateTenantId(clientName: string): string {
  const slug = clientName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}

function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(64);
  crypto.getRandomValues(randomValues);
  for (const val of randomValues) {
    result += chars[val % chars.length];
  }
  return result;
}

async function findAvailablePort(): Promise<number> {
  // Find the highest port currently in use, start from 18123
  const [result] = await db
    .select({ maxPort: count() })
    .from(cloudInstances);

  const instanceCount = result?.maxPort ?? 0;
  return 18123 + instanceCount;
}

async function dockerCreateContainer(
  tenantId: string,
  domain: string,
  port: number,
  memoryLimitMb: number,
  cpuLimit: string,
  haVersion: string,
): Promise<{ containerId: string; containerName: string }> {
  const containerName = `neo-ha-${tenantId}`;
  const dataDir = `/data/neo-cloud/tenants/${tenantId}/config`;

  // Use Docker CLI via shell (works without Dockerode dependency)
  const proc = Bun.spawn([
    'docker', 'create',
    '--name', containerName,
    '--hostname', containerName,
    '--restart', 'unless-stopped',
    '--network', 'neo-cloud',
    // Resource limits
    '--memory', `${memoryLimitMb}m`,
    '--cpus', cpuLimit,
    // Security
    '--security-opt', 'no-new-privileges:true',
    '--cap-drop', 'ALL',
    '--cap-add', 'NET_RAW',
    // Volumes
    '-v', `${dataDir}:/config`,
    // Environment
    '-e', `TZ=Europe/Paris`,
    // Traefik labels for auto-routing
    '-l', 'traefik.enable=true',
    '-l', `traefik.http.routers.${tenantId}.rule=Host(\`${domain}\`)`,
    '-l', `traefik.http.routers.${tenantId}.entrypoints=websecure`,
    '-l', `traefik.http.routers.${tenantId}.tls.certresolver=letsencrypt`,
    '-l', `traefik.http.services.${tenantId}.loadbalancer.server.port=8123`,
    // Port mapping (fallback direct access)
    '-p', `${port}:8123`,
    // Image
    `ghcr.io/home-assistant/home-assistant:${haVersion}`,
  ], { stdout: 'pipe', stderr: 'pipe' });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new AppError(500, `Erreur création container: ${stderr.trim()}`);
  }

  const containerId = stdout.trim().substring(0, 12);
  return { containerId, containerName };
}

async function dockerStartContainer(containerName: string): Promise<void> {
  const proc = Bun.spawn(['docker', 'start', containerName], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new AppError(500, `Erreur démarrage container: ${stderr.trim()}`);
  }
}

async function dockerStopContainer(containerName: string): Promise<void> {
  const proc = Bun.spawn(['docker', 'stop', '-t', '30', containerName], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await proc.exited;
}

async function dockerRemoveContainer(containerName: string): Promise<void> {
  // Stop first
  await dockerStopContainer(containerName).catch(() => {});

  const proc = Bun.spawn(['docker', 'rm', '-f', containerName], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await proc.exited;
}

async function dockerRestartContainer(containerName: string): Promise<void> {
  const proc = Bun.spawn(['docker', 'restart', containerName], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new AppError(500, `Erreur redémarrage container: ${stderr.trim()}`);
  }
}

async function dockerGetContainerStatus(containerName: string): Promise<string> {
  const proc = Bun.spawn(
    ['docker', 'inspect', '--format', '{{.State.Status}}', containerName],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) return 'not_found';
  return stdout.trim();
}

async function dockerGetContainerLogs(containerName: string, lines: number = 100): Promise<string> {
  const proc = Bun.spawn(
    ['docker', 'logs', '--tail', String(lines), '--timestamps', containerName],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return stdout + stderr;
}

async function provisionTenantConfig(
  tenantId: string,
  domain: string,
  adminToken: string,
): Promise<void> {
  const neoCloudDir = `${process.cwd()}/../neo-cloud`;
  const proc = Bun.spawn(
    [
      'bash',
      `${neoCloudDir}/provision.sh`,
      tenantId,
      'neo-admin-temp', // Temporary password, will be set via onboarding API
      domain,
      env.PUBLIC_URL,
      adminToken,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new AppError(500, `Erreur provisioning config: ${stderr.trim()}`);
  }
}

// ============ Onboarding API ============

async function onboardInstance(
  port: number,
  adminPassword: string,
): Promise<{ authToken: string }> {
  // Wait for HA to start (max 60s)
  const baseUrl = `http://localhost:${port}`;
  let ready = false;

  for (let i = 0; i < 30; i++) {
    try {
      const resp = await fetch(`${baseUrl}/api/`, { signal: AbortSignal.timeout(2000) });
      if (resp.ok || resp.status === 401) {
        ready = true;
        break;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!ready) {
    throw new AppError(500, 'Home Assistant ne démarre pas (timeout 60s)');
  }

  // Check if onboarding is needed
  try {
    const onboardResp = await fetch(`${baseUrl}/api/onboarding`);
    const onboardData = await onboardResp.json() as Array<{ step: string; done: boolean }>;

    // If user step is not done, create user via onboarding API
    const userStep = onboardData.find((s: { step: string }) => s.step === 'user');
    if (userStep && !userStep.done) {
      const createUserResp = await fetch(`${baseUrl}/api/onboarding/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Neo Admin',
          username: 'neo-admin',
          password: adminPassword,
          client_id: `${baseUrl}/`,
          language: 'fr',
        }),
      });

      if (!createUserResp.ok) {
        throw new AppError(500, 'Erreur création utilisateur HA');
      }

      const userData = await createUserResp.json() as { auth_code: string };

      // Exchange auth_code for token
      const tokenResp = await fetch(`${baseUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: userData.auth_code,
          client_id: `${baseUrl}/`,
        }),
      });

      if (!tokenResp.ok) {
        throw new AppError(500, 'Erreur échange token HA');
      }

      const tokenData = await tokenResp.json() as { access_token: string };

      // Complete remaining onboarding steps
      await fetch(`${baseUrl}/api/onboarding/core_config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
        body: JSON.stringify({}),
      });

      await fetch(`${baseUrl}/api/onboarding/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
        body: JSON.stringify({}),
      });

      await fetch(`${baseUrl}/api/onboarding/integration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
        body: JSON.stringify({}),
      });

      return { authToken: tokenData.access_token };
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Onboarding already done (pre-seeded .storage files)
  }

  // If onboarding was pre-seeded, authenticate normally
  const tokenResp = await fetch(`${baseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      username: 'neo-admin',
      password: adminPassword,
      client_id: `${baseUrl}/`,
    }),
  });

  if (tokenResp.ok) {
    const tokenData = await tokenResp.json() as { access_token: string };
    return { authToken: tokenData.access_token };
  }

  return { authToken: '' };
}

// ============ CRUD Operations ============

export async function getInstances(params: PaginationParams, filters: InstanceFilter) {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(cloudInstances.status, filters.status));
  }

  if (filters.clientId) {
    conditions.push(eq(cloudInstances.clientId, filters.clientId));
  }

  if (filters.isOnline === 'true') {
    conditions.push(eq(cloudInstances.isOnline, true));
  } else if (filters.isOnline === 'false') {
    conditions.push(eq(cloudInstances.isOnline, false));
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(cloudInstances.tenantId, `%${filters.search}%`),
        ilike(cloudInstances.domain, `%${filters.search}%`),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: cloudInstances.id,
        clientId: cloudInstances.clientId,
        tenantId: cloudInstances.tenantId,
        domain: cloudInstances.domain,
        status: cloudInstances.status,
        haVersion: cloudInstances.haVersion,
        port: cloudInstances.port,
        lastHeartbeat: cloudInstances.lastHeartbeat,
        entityCount: cloudInstances.entityCount,
        automationCount: cloudInstances.automationCount,
        isOnline: cloudInstances.isOnline,
        memoryLimitMb: cloudInstances.memoryLimitMb,
        cpuLimit: cloudInstances.cpuLimit,
        errorMessage: cloudInstances.errorMessage,
        provisionedAt: cloudInstances.provisionedAt,
        createdAt: cloudInstances.createdAt,
        client: {
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
        },
      })
      .from(cloudInstances)
      .innerJoin(clients, eq(cloudInstances.clientId, clients.id))
      .where(where)
      .limit(params.limit)
      .offset(getOffset(params))
      .orderBy(desc(cloudInstances.createdAt)),
    db.select({ total: count() }).from(cloudInstances).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;
  return paginate(data, total, params);
}

export async function getInstanceById(id: string) {
  const [instance] = await db
    .select({
      id: cloudInstances.id,
      clientId: cloudInstances.clientId,
      tenantId: cloudInstances.tenantId,
      containerId: cloudInstances.containerId,
      containerName: cloudInstances.containerName,
      domain: cloudInstances.domain,
      status: cloudInstances.status,
      haVersion: cloudInstances.haVersion,
      adminToken: cloudInstances.adminToken,
      clientToken: cloudInstances.clientToken,
      port: cloudInstances.port,
      lastHeartbeat: cloudInstances.lastHeartbeat,
      entityCount: cloudInstances.entityCount,
      automationCount: cloudInstances.automationCount,
      isOnline: cloudInstances.isOnline,
      memoryLimitMb: cloudInstances.memoryLimitMb,
      cpuLimit: cloudInstances.cpuLimit,
      config: cloudInstances.config,
      errorMessage: cloudInstances.errorMessage,
      provisionedAt: cloudInstances.provisionedAt,
      createdAt: cloudInstances.createdAt,
      updatedAt: cloudInstances.updatedAt,
      client: {
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        address: clients.address,
        city: clients.city,
      },
    })
    .from(cloudInstances)
    .innerJoin(clients, eq(cloudInstances.clientId, clients.id))
    .where(eq(cloudInstances.id, id))
    .limit(1);

  if (!instance) {
    throw new NotFoundError('Instance cloud');
  }

  return instance;
}

export async function provisionInstance(input: CreateCloudInstanceInput) {
  // 1. Verify client exists
  const [client] = await db
    .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!client) {
    throw new NotFoundError('Client');
  }

  // 2. Check client doesn't already have an instance
  const [existing] = await db
    .select({ id: cloudInstances.id })
    .from(cloudInstances)
    .where(eq(cloudInstances.clientId, input.clientId))
    .limit(1);

  if (existing) {
    throw new AppError(409, 'Ce client a déjà une instance cloud');
  }

  // 3. Generate tenant ID and tokens
  const clientName = `${client.firstName}-${client.lastName}`;
  const tenantId = generateTenantId(clientName);
  const adminToken = generateSecureToken();
  const cloudDomain = input.domain || `${tenantId}.cloud.neo-domotique.fr`;
  const port = await findAvailablePort();

  // 4. Create DB record
  const [instance] = await db
    .insert(cloudInstances)
    .values({
      clientId: input.clientId,
      tenantId,
      domain: cloudDomain,
      status: 'provisioning',
      haVersion: input.haVersion || 'stable',
      adminToken,
      port,
      memoryLimitMb: input.memoryLimitMb,
      cpuLimit: input.cpuLimit,
    })
    .returning();

  // 5. Provision in background (don't block the response)
  (async () => {
    try {
      // Generate config files
      await provisionTenantConfig(tenantId, cloudDomain, adminToken);

      // Create and start Docker container
      const { containerId, containerName } = await dockerCreateContainer(
        tenantId,
        cloudDomain,
        port,
        input.memoryLimitMb,
        input.cpuLimit,
        input.haVersion || 'stable',
      );

      await dockerStartContainer(containerName);

      // Complete onboarding
      const adminPassword = generateSecureToken().substring(0, 24);
      let authToken = '';
      try {
        const onboardResult = await onboardInstance(port, adminPassword);
        authToken = onboardResult.authToken;
      } catch (err) {
        console.warn(`[Neo Cloud] Onboarding warning for ${tenantId}:`, err);
      }

      // Update DB record
      await db
        .update(cloudInstances)
        .set({
          containerId,
          containerName,
          status: 'running',
          adminToken: authToken || adminToken,
          provisionedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cloudInstances.id, instance.id));

      console.log(`[Neo Cloud] Instance ${tenantId} provisioned successfully`);
    } catch (err) {
      console.error(`[Neo Cloud] Provisioning failed for ${tenantId}:`, err);
      await db
        .update(cloudInstances)
        .set({
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(cloudInstances.id, instance.id));
    }
  })();

  return instance;
}

export async function updateInstance(id: string, input: UpdateCloudInstanceInput) {
  const [existing] = await db
    .select({ id: cloudInstances.id, containerName: cloudInstances.containerName })
    .from(cloudInstances)
    .where(eq(cloudInstances.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Instance cloud');
  }

  const [instance] = await db
    .update(cloudInstances)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(cloudInstances.id, id))
    .returning();

  return instance;
}

export async function startInstance(id: string) {
  const instance = await getInstanceById(id);

  if (!instance.containerName) {
    throw new AppError(400, 'Container non provisionné');
  }

  await dockerStartContainer(instance.containerName);

  await db
    .update(cloudInstances)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(cloudInstances.id, id));

  return { message: 'Instance démarrée' };
}

export async function stopInstance(id: string) {
  const instance = await getInstanceById(id);

  if (!instance.containerName) {
    throw new AppError(400, 'Container non provisionné');
  }

  await dockerStopContainer(instance.containerName);

  await db
    .update(cloudInstances)
    .set({ status: 'stopped', isOnline: false, updatedAt: new Date() })
    .where(eq(cloudInstances.id, id));

  return { message: 'Instance arrêtée' };
}

export async function restartInstance(id: string) {
  const instance = await getInstanceById(id);

  if (!instance.containerName) {
    throw new AppError(400, 'Container non provisionné');
  }

  await dockerRestartContainer(instance.containerName);

  await db
    .update(cloudInstances)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(cloudInstances.id, id));

  return { message: 'Instance redémarrée' };
}

export async function destroyInstance(id: string) {
  const instance = await getInstanceById(id);

  await db
    .update(cloudInstances)
    .set({ status: 'destroying', updatedAt: new Date() })
    .where(eq(cloudInstances.id, id));

  // Remove container
  if (instance.containerName) {
    await dockerRemoveContainer(instance.containerName);
  }

  // Delete DB record
  await db.delete(cloudInstances).where(eq(cloudInstances.id, id));

  return { message: 'Instance détruite' };
}

export async function getInstanceStatus(id: string) {
  const instance = await getInstanceById(id);

  let dockerStatus = 'unknown';
  if (instance.containerName) {
    dockerStatus = await dockerGetContainerStatus(instance.containerName);
  }

  return {
    ...instance,
    dockerStatus,
  };
}

export async function getInstanceLogs(id: string, lines: number = 100) {
  const instance = await getInstanceById(id);

  if (!instance.containerName) {
    throw new AppError(400, 'Container non provisionné');
  }

  const logs = await dockerGetContainerLogs(instance.containerName, lines);
  return { logs };
}

export async function handleHeartbeat(input: HeartbeatInput) {
  const [instance] = await db
    .select({ id: cloudInstances.id })
    .from(cloudInstances)
    .where(eq(cloudInstances.tenantId, input.tenant_id))
    .limit(1);

  if (!instance) {
    return { status: 'unknown_tenant' };
  }

  await db
    .update(cloudInstances)
    .set({
      lastHeartbeat: new Date(),
      isOnline: true,
      entityCount: input.entity_count,
      automationCount: input.automation_count,
      haVersion: input.version || undefined,
      status: 'running',
      updatedAt: new Date(),
    })
    .where(eq(cloudInstances.id, instance.id));

  return { status: 'ok' };
}

export async function getCloudStats() {
  const [stats] = await db
    .select({
      total: count(),
    })
    .from(cloudInstances);

  const [running] = await db
    .select({ count: count() })
    .from(cloudInstances)
    .where(eq(cloudInstances.status, 'running'));

  const [online] = await db
    .select({ count: count() })
    .from(cloudInstances)
    .where(eq(cloudInstances.isOnline, true));

  const [errors] = await db
    .select({ count: count() })
    .from(cloudInstances)
    .where(eq(cloudInstances.status, 'error'));

  return {
    total: stats?.total ?? 0,
    running: running?.count ?? 0,
    online: online?.count ?? 0,
    errors: errors?.count ?? 0,
  };
}
