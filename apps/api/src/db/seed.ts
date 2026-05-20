import 'dotenv/config';
import { db, schema } from './client.js';
import { hashPassword } from '../lib/password.js';

async function seed() {
  console.log('Seeding database...');

  const existing = await db.select().from(schema.users);
  if (existing.length > 0) {
    console.log('⚠ Users already exist, skipping user seed.');
  } else {
    const adminPwd = await hashPassword('reform2026');
    const memberPwd = await hashPassword('reform2026');

    await db.insert(schema.users).values([
      { email: 'admin@joinreform.com', passwordHash: adminPwd, fullName: 'Admin REFORM', role: 'admin' },
      { email: 'commercial@joinreform.com', passwordHash: memberPwd, fullName: 'Commercial REFORM', role: 'member' },
      { email: 'consultant@joinreform.com', passwordHash: memberPwd, fullName: 'Consultant REFORM', role: 'member' },
    ] as any);
    console.log('✓ Users created (default password: reform2026 — CHANGE IT)');
  }

  const [owner] = await db.select().from(schema.users);
  const ownerId = owner.id;

  const orgCount = await db.select().from(schema.organizations);
  if (orgCount.length > 0) {
    console.log('⚠ Organizations already exist, skipping demo data.');
    return;
  }

  const [bnp] = await db.insert(schema.organizations).values({
    name: 'BNP Paribas',
    status: 'prospect',
    industry: 'Banque',
    size: '500+',
    city: 'Paris',
    notes: 'Intéressés par un parcours formation RSO direction.',
    ownerId,
  } as any).returning();

  const [decathlon] = await db.insert(schema.organizations).values({
    name: 'Decathlon',
    status: 'prospect',
    industry: 'Retail / Sport',
    size: '500+',
    city: 'Lille',
    notes: 'Premier RDV positif.',
    ownerId,
  } as any).returning();

  const [michelin] = await db.insert(schema.organizations).values({
    name: 'Michelin',
    status: 'client',
    industry: 'Industrie',
    size: '500+',
    city: 'Clermont-Ferrand',
    notes: 'Mission RSO en cours.',
    ownerId,
  } as any).returning();

  const [malakoff] = await db.insert(schema.organizations).values({
    name: 'Malakoff Humanis',
    status: 'client',
    industry: 'Assurance',
    size: '500+',
    city: 'Paris',
    ownerId,
  } as any).returning();

  await db.insert(schema.contacts).values([
    { organizationId: bnp.id, firstName: 'Claire', lastName: 'Martin', role: 'DRH', email: 'c.martin@bnpparibas.com', phone: '+33 1 40 14 45 46', isPrimary: true },
    { organizationId: decathlon.id, firstName: 'Julien', lastName: 'Petit', role: 'Directeur RSE', email: 'j.petit@decathlon.com', isPrimary: true },
    { organizationId: michelin.id, firstName: 'Sophie', lastName: 'Bernard', role: 'Directrice Transformation', email: 's.bernard@michelin.com', isPrimary: true },
    { organizationId: malakoff.id, firstName: 'Antoine', lastName: 'Durand', role: 'DG Adjoint', email: 'a.durand@malakoffhumanis.com', isPrimary: true },
  ] as any);

  await db.insert(schema.deals).values([
    { organizationId: bnp.id, title: 'Programme transformation RSO 2026', stage: 'proposal', amount: 85000, probability: 60, ownerId },
    { organizationId: decathlon.id, title: 'Parcours formation Comex', stage: 'meeting', amount: 45000, probability: 40, ownerId },
  ] as any);

  const [engMichelin] = await db.insert(schema.engagements).values({
    organizationId: michelin.id,
    title: 'Accompagnement transformation RSO — phase 1',
    description: 'Diagnostic + plan d\'action 6 mois',
    totalAmount: 120000,
    status: 'active',
    startedAt: new Date('2026-02-01'),
  } as any).returning();

  await db.insert(schema.milestones).values([
    { engagementId: engMichelin.id, label: 'Acompte signature', amount: 40000, status: 'paid', invoicedAt: new Date('2026-02-05'), invoiceRef: 'FA-2026-0042' },
    { engagementId: engMichelin.id, label: 'Phase diagnostic terminée', amount: 40000, status: 'invoiced', invoicedAt: new Date('2026-04-15'), invoiceRef: 'FA-2026-0089', dueDate: new Date('2026-05-15') },
    { engagementId: engMichelin.id, label: 'Livraison plan d\'action final', amount: 40000, status: 'to_invoice', dueDate: new Date('2026-07-31') },
  ] as any);

  const [engMalakoff] = await db.insert(schema.engagements).values({
    organizationId: malakoff.id,
    title: 'Formation cadres dirigeants',
    description: '3 sessions de 2 jours',
    totalAmount: 36000,
    status: 'active',
    startedAt: new Date('2026-03-15'),
  } as any).returning();

  await db.insert(schema.milestones).values([
    { engagementId: engMalakoff.id, label: 'Session 1', amount: 12000, status: 'paid', invoicedAt: new Date('2026-03-20'), invoiceRef: 'FA-2026-0067' },
    { engagementId: engMalakoff.id, label: 'Session 2', amount: 12000, status: 'invoiced', invoicedAt: new Date('2026-04-25'), invoiceRef: 'FA-2026-0095', dueDate: new Date('2026-05-25') },
    { engagementId: engMalakoff.id, label: 'Session 3', amount: 12000, status: 'to_invoice', dueDate: new Date('2026-06-30') },
  ] as any);

  await db.insert(schema.activities).values([
    { organizationId: bnp.id, type: 'meeting', subject: 'Premier RDV cadrage', body: 'Bonne écoute, propale demandée pour fin mois.', occurredAt: new Date('2026-05-02'), authorId: ownerId },
    { organizationId: decathlon.id, type: 'call', subject: 'Appel découverte', body: '30min, intérêt confirmé.', occurredAt: new Date('2026-05-10'), authorId: ownerId },
    { organizationId: michelin.id, type: 'note', subject: 'Point hebdo équipe projet', body: 'Phase diagnostic clôturée, présentation au Comex le 28/05.', occurredAt: new Date('2026-05-15'), authorId: ownerId },
  ] as any);

  console.log('✓ Demo data seeded:');
  console.log('  - 4 organizations (2 prospects, 2 clients)');
  console.log('  - 4 contacts, 2 deals, 2 engagements, 6 milestones, 3 activities');
  console.log('');
  console.log('Login: admin@joinreform.com / reform2026');
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
