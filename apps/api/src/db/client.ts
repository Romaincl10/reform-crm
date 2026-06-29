import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

// Charge le .env de apps/api quelle que soit la cwd
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../.env') });
loadEnv(); // fallback : .env dans le cwd si présent

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
  connect_timeout: 10, // échec rapide si la base est injoignable (ex: projet Supabase en pause) → évite les requêtes pendantes → 502
  onnotice: () => {}, // silence les NOTICE PostgreSQL (déclarations "already exists" idempotentes)
});

export const db = drizzle(sql, { schema });
export { schema };
