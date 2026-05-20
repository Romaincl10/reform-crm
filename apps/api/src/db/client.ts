import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL manquant. Renseigne ta connection string Supabase dans .env');
  process.exit(1);
}

console.log('→ DB :', url.replace(/:[^:@]+@/, ':***@'));

// Connection adaptée à Supabase :
// - prepare: false pour rester compatible avec le pooler Supavisor
// - ssl: 'require' (Supabase exige SSL)
export const sql = postgres(url, {
  prepare: false,
  ssl: 'require',
  max: 10,
});

export const db = drizzle(sql, { schema });
export { schema };
