import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from '../config/database';

console.log('🔄 Running migrations...');
await migrate(db, { migrationsFolder: './src/db/migrations' });
console.log('✅ Migrations complete');
process.exit(0);
