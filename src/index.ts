import app from './app';
import { env } from './config/env';
import { db } from './config/database';
import { users } from './db/schema';
import { hashPassword } from './modules/auth/auth.service';
import { eq } from 'drizzle-orm';

async function seedAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    return;
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, env.ADMIN_EMAIL))
    .limit(1);

  if (existing) {
    console.log(`Admin user ${env.ADMIN_EMAIL} already exists`);
    return;
  }

  const hashedPassword = await hashPassword(env.ADMIN_PASSWORD);

  await db.insert(users).values({
    email: env.ADMIN_EMAIL,
    password: hashedPassword,
    firstName: 'Admin',
    lastName: 'Neo',
    role: 'admin',
  });

  console.log(`Admin user ${env.ADMIN_EMAIL} created`);
}

async function main() {
  console.log('Starting Neo Domotique Backend...');

  // Seed admin user
  try {
    await seedAdmin();
  } catch (error) {
    console.error('Error seeding admin:', error);
  }

  console.log(`Server running on http://localhost:${env.PORT}`);
  console.log(`Admin panel: http://localhost:${env.PORT}/admin`);
  console.log(`Backoffice: http://localhost:${env.PORT}/backoffice`);
}

main();

export default {
  port: env.PORT,
  fetch: app.fetch,
};
