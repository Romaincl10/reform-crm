/**
 * Update du mot de passe Germain BUTROT pour alignement SPK Hub.
 * Usage : tsx src/db/update-germain-password.ts
 * Ou via Railway : railway run --service=reform-crm-api npm run update-germain-password
 *
 * Mot de passe cible : variable d'env GERMAIN_PWD ou défaut hub.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, schema } from './client.js';
import { hashPassword } from '../lib/password.js';

const EMAIL = 'germain.butrot';
const NEW_PASSWORD = process.env.GERMAIN_PWD || 'zmpibMWuXhLTmnuP8p';

const existing = await db.select().from(schema.users).where(eq(schema.users.email, EMAIL));
if (existing.length === 0) {
  console.error(`User ${EMAIL} introuvable`);
  process.exit(1);
}

const passwordHash = await hashPassword(NEW_PASSWORD);
await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.email, EMAIL));

console.log(`✓ Mot de passe de ${EMAIL} mis à jour.`);
process.exit(0);
