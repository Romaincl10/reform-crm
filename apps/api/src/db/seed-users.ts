import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, schema } from './client.js';
import { hashPassword } from '../lib/password.js';

interface SeedUser {
  email: string;
  fullName: string;
  role: 'admin' | 'member';
  password: string;
}

const USERS: SeedUser[] = [
  // REFORM — admins
  { email: 'mathieu.lafont@joinreform.com', fullName: 'Mathieu LAFONT', role: 'admin', password: 'UqcKgarMBj4AjE@93' },
  { email: 'maelle.beltas@joinreform.com',  fullName: 'Maëlle BELTAS',  role: 'admin', password: 'VXiMLChX7yNqNP%26' },
  // SPK — consultation
  { email: 'germain.butrot@spk-group.com',  fullName: 'Germain BUTROT', role: 'member', password: 'jHKanuEJFQEzHF$39' },
  { email: 'kevin.geoffroy@spk-group.com',  fullName: 'Kévin GEOFFROY', role: 'member', password: 'bmymWGnVwPfKfd#55' },
  { email: 'paul.debelair@spk-group.com',   fullName: 'Paul DE BEL AIR', role: 'member', password: 'ttc8sAEUsdsr3j@48' },
];

let created = 0;
let updated = 0;

for (const u of USERS) {
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, u.email));
  const passwordHash = await hashPassword(u.password);
  if (existing.length === 0) {
    await db.insert(schema.users).values({
      email: u.email,
      passwordHash,
      fullName: u.fullName,
      role: u.role,
    } as any);
    created++;
    console.log(`✓ Créé : ${u.fullName} (${u.email}) — rôle ${u.role}`);
  } else {
    await db.update(schema.users)
      .set({ passwordHash, fullName: u.fullName, role: u.role })
      .where(eq(schema.users.email, u.email));
    updated++;
    console.log(`↻ Mis à jour : ${u.fullName} (${u.email})`);
  }
}

console.log('');
console.log(`✓ ${created} compte(s) créé(s), ${updated} mis à jour`);
console.log('');
console.log('--- Identifiants ---');
for (const u of USERS) {
  const tag = u.role === 'admin' ? 'admin   ' : 'consult.';
  console.log(`  [${tag}] ${u.email.padEnd(34)} → ${u.password}`);
}
console.log('');
console.log('⚠ Demande à chaque utilisateur de changer son mot de passe au premier login.');

process.exit(0);
