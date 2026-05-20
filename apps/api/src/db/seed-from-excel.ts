import 'dotenv/config';
import { db, schema } from './client.js';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';

interface Dossier {
  label: string;
  amount: number;
  trimestre: 'T1' | 'T2' | 'T3' | 'T4' | null;
}

// Extracted from CRM Reform.xlsx — colonne gauche (liste exhaustive 2026)
const DOSSIERS: Dossier[] = [
  { label: 'ACRSE Hand', amount: 22800, trimestre: 'T1' },
  { label: 'CDOS COLLECTIF - ACRSE', amount: 17100, trimestre: 'T1' },
  { label: 'LIGUE + COMITE TENNIS - ACRSE', amount: 15878.57, trimestre: 'T1' },
  { label: 'thedraft Amos', amount: 4000, trimestre: 'T2' },
  { label: 'TRIATHLON - ACRSE', amount: 4800, trimestre: 'T1' },
  { label: "Mesure Impact L'om", amount: 12000, trimestre: 'T2' },
  { label: 'CDOS - Formation DEI', amount: 6000, trimestre: 'T3' },
  { label: 'ASBH - ACRSE', amount: 6000, trimestre: 'T3' },
  { label: 'FFF', amount: 13000, trimestre: 'T4' },
  { label: 'Bruleurs de loups - Charte', amount: 6000, trimestre: 'T4' },
  { label: 'Sapiac Rugby - ACRSE', amount: 6000, trimestre: 'T4' },
  { label: 'HTV Basket - Formation', amount: 6144, trimestre: 'T4' },
  { label: 'HTV Basket - Accompagnement FDD', amount: 6000, trimestre: 'T4' },
  { label: 'thedraft amu', amount: 4000, trimestre: 'T2' },
  { label: 'BLUE STAR', amount: 4800, trimestre: 'T2' },
  { label: 'MHP', amount: 4800, trimestre: 'T2' },
  { label: 'Fédération HAND', amount: 30000, trimestre: 'T2' },
  { label: 'TEAM CHAMBE', amount: 6000, trimestre: 'T2' },
  { label: 'PB86', amount: 5000, trimestre: 'T3' },
  { label: 'CNM - FORMATION', amount: 7000, trimestre: 'T2' },
  { label: 'Sapiac Rugby - Formation', amount: 5734.4, trimestre: 'T2' },
  { label: 'Session formation ISO30415', amount: 11600, trimestre: 'T4' },
  { label: 'JDA Dijon - ACRSE', amount: 6000, trimestre: 'T2' },
  { label: 'JDA Dijon - Formation', amount: 6144, trimestre: 'T2' },
  { label: 'Brest Handball - ACRSE', amount: 6000, trimestre: 'T4' },
  { label: 'Brest Handball - Formation', amount: 6144, trimestre: 'T4' },
  { label: 'Stade Rennais - Formation', amount: 6000, trimestre: 'T4' },
  { label: 'Stade Rennais - ACRSE', amount: 6000, trimestre: 'T4' },
  { label: 'Corsaires Nantes - Formation', amount: 10000, trimestre: 'T4' },
  { label: 'GF38 - ACRSE', amount: 6000, trimestre: 'T2' },
  { label: 'GF38 - Formation', amount: 7000, trimestre: 'T2' },
  { label: 'FF HOCKEY', amount: 9216, trimestre: 'T2' },
  { label: 'thedraft Amos T3', amount: 4000, trimestre: 'T3' },
  { label: 'Frontignan handball Formation', amount: 5000, trimestre: 'T3' },
  { label: 'Formation ligue de Hand Sponso', amount: 5000, trimestre: 'T4' },
  { label: 'Intersport', amount: 30000, trimestre: 'T2' },
  { label: 'thedraft amu sept', amount: 15000, trimestre: 'T4' },
  { label: 'PFG', amount: 19000, trimestre: 'T2' },
  { label: 'ETIC - ISO 20121', amount: 10000, trimestre: 'T1' },
  { label: 'Formation charte 15 engagements CDOS', amount: 8000, trimestre: 'T1' },
  { label: 'FIN ACRSE District', amount: 3250, trimestre: 'T1' },
  { label: 'SPK', amount: 15000, trimestre: 'T2' },
  { label: 'FIN ACRSE District 2', amount: 3250, trimestre: 'T2' },
  { label: 'Formation BFC - Salariés', amount: 5000, trimestre: 'T3' },
  { label: 'Formation Tennis', amount: 15000, trimestre: 'T3' },
  { label: 'LMF 26-27', amount: 10000, trimestre: 'T4' },
  { label: 'Formation Tri', amount: 6000, trimestre: 'T3' },
];

// Split "ClientName - PrestationType" → { client, presta }
function parseLabel(label: string): { client: string; presta: string | null } {
  // Cas spéciaux
  const specialCases: Record<string, { client: string; presta: string }> = {
    'ACRSE Hand': { client: 'Fédération Française de Handball', presta: 'ACRSE Hand' },
    'CDOS COLLECTIF - ACRSE': { client: 'CDOS', presta: 'ACRSE Collectif' },
    'LIGUE + COMITE TENNIS - ACRSE': { client: 'Ligue + Comité Tennis', presta: 'ACRSE' },
    'thedraft Amos': { client: 'TheDraft Amos', presta: 'Mission' },
    'thedraft amu': { client: 'TheDraft AMU', presta: 'Mission' },
    'thedraft amu sept': { client: 'TheDraft AMU', presta: 'Mission septembre' },
    'thedraft Amos T3': { client: 'TheDraft Amos', presta: 'Mission T3' },
    'TRIATHLON - ACRSE': { client: 'Fédération Française de Triathlon', presta: 'ACRSE' },
    "Mesure Impact L'om": { client: "L'Olympique de Marseille", presta: 'Mesure Impact' },
    'CDOS - Formation DEI': { client: 'CDOS', presta: 'Formation DEI' },
    'ASBH - ACRSE': { client: 'AS Béziers Hérault', presta: 'ACRSE' },
    FFF: { client: 'Fédération Française de Football', presta: 'Mission' },
    'Bruleurs de loups - Charte': { client: 'Brûleurs de Loups Grenoble', presta: 'Charte' },
    'Sapiac Rugby - ACRSE': { client: 'Sapiac Rugby', presta: 'ACRSE' },
    'Sapiac Rugby - Formation': { client: 'Sapiac Rugby', presta: 'Formation' },
    'HTV Basket - Formation': { client: 'Hyères-Toulon Var Basket', presta: 'Formation' },
    'HTV Basket - Accompagnement FDD': { client: 'Hyères-Toulon Var Basket', presta: 'Accompagnement FDD' },
    'BLUE STAR': { client: 'Blue Star', presta: 'Mission' },
    MHP: { client: 'MHP Naval', presta: 'Mission' },
    'Fédération HAND': { client: 'Fédération Française de Handball', presta: 'Accompagnement' },
    'TEAM CHAMBE': { client: 'Team Chambé', presta: 'Mission' },
    PB86: { client: 'Poitiers Basket 86', presta: 'Mission' },
    'CNM - FORMATION': { client: 'CNM', presta: 'Formation' },
    'Session formation ISO30415': { client: 'Session inter-entreprise', presta: 'Formation ISO 30415' },
    'JDA Dijon - ACRSE': { client: 'JDA Dijon Basket', presta: 'ACRSE' },
    'JDA Dijon - Formation': { client: 'JDA Dijon Basket', presta: 'Formation' },
    'Brest Handball - ACRSE': { client: 'Brest Bretagne Handball', presta: 'ACRSE' },
    'Brest Handball - Formation': { client: 'Brest Bretagne Handball', presta: 'Formation' },
    'Stade Rennais - Formation': { client: 'Stade Rennais FC', presta: 'Formation' },
    'Stade Rennais - ACRSE': { client: 'Stade Rennais FC', presta: 'ACRSE' },
    'Corsaires Nantes - Formation': { client: 'Corsaires de Nantes', presta: 'Formation' },
    'GF38 - ACRSE': { client: 'Grenoble Foot 38', presta: 'ACRSE' },
    'GF38 - Formation': { client: 'Grenoble Foot 38', presta: 'Formation' },
    'FF HOCKEY': { client: 'Fédération Française de Hockey', presta: 'Mission' },
    'Frontignan handball Formation': { client: 'Frontignan Handball', presta: 'Formation' },
    'Formation ligue de Hand Sponso': { client: 'Ligue de Handball (sponso)', presta: 'Formation' },
    Intersport: { client: 'Intersport', presta: 'Mission' },
    PFG: { client: 'PFG', presta: 'Mission' },
    'ETIC - ISO 20121': { client: 'ETIC', presta: 'Certification ISO 20121' },
    'Formation charte 15 engagements CDOS': { client: 'CDOS', presta: 'Formation charte 15 engagements' },
    'FIN ACRSE District': { client: 'District (Foot)', presta: 'FIN ACRSE' },
    'FIN ACRSE District 2': { client: 'District (Foot) 2', presta: 'FIN ACRSE' },
    SPK: { client: 'SPK Group', presta: 'Accompagnement RSO' },
    'Formation BFC - Salariés': { client: 'BFC', presta: 'Formation salariés' },
    'Formation Tennis': { client: 'Fédération Française de Tennis', presta: 'Formation' },
    'LMF 26-27': { client: 'LMF', presta: 'Mission 2026-2027' },
    'Formation Tri': { client: 'Fédération Française de Triathlon', presta: 'Formation' },
  };

  if (specialCases[label]) return specialCases[label];
  const parts = label.split(' - ');
  if (parts.length >= 2) return { client: parts[0].trim(), presta: parts.slice(1).join(' - ').trim() };
  return { client: label.trim(), presta: null };
}

// Type d'offre depuis le libellé presta
function typeFromPresta(presta: string | null, label: string): string {
  const s = (presta || label).toLowerCase();
  if (s.includes('acrse')) return 'ACRSE';
  if (s.includes('formation')) return 'Formation';
  if (s.includes('bilan carbone')) return 'Bilan carbone';
  if (s.includes('iso 20121')) return 'Certification ISO 20121';
  if (s.includes('iso 30415') || s.includes('iso30415')) return 'Formation ISO 30415';
  if (s.includes('charte')) return 'Activation / Charte';
  if (s.includes('mesure impact') || s.includes('diagnostic')) return 'Diagnostic';
  if (s.includes('accompagnement')) return 'Appui conseil';
  return 'Mission';
}

const TRI_DATES: Record<'T1' | 'T2' | 'T3' | 'T4', { start: Date; due: Date }> = {
  T1: { start: new Date('2026-01-15'), due: new Date('2026-03-31') },
  T2: { start: new Date('2026-04-15'), due: new Date('2026-06-30') },
  T3: { start: new Date('2026-07-15'), due: new Date('2026-09-30') },
  T4: { start: new Date('2026-10-15'), due: new Date('2026-12-31') },
};

async function seed() {
  console.log('Wipe + seed avec les données REFORM 2026...');

  // Wipe ordre cascade
  await db.execute(sql`DELETE FROM payments`);
  await db.execute(sql`DELETE FROM milestones`);
  await db.execute(sql`DELETE FROM engagements`);
  await db.execute(sql`DELETE FROM activities`);
  await db.execute(sql`DELETE FROM deals`);
  await db.execute(sql`DELETE FROM contacts`);
  await db.execute(sql`DELETE FROM organizations WHERE name != ''`);

  // Users si absents
  const existing = await db.select().from(schema.users);
  if (existing.length === 0) {
    const pwd = await hashPassword('reform2026');
    await db.insert(schema.users).values([
      { email: 'admin@joinreform.com', passwordHash: pwd, fullName: 'Admin REFORM', role: 'admin' },
      { email: 'commercial@joinreform.com', passwordHash: pwd, fullName: 'Commercial REFORM', role: 'member' },
      { email: 'consultant@joinreform.com', passwordHash: pwd, fullName: 'Consultant REFORM', role: 'member' },
    ] as any);
  }
  const [owner] = await db.select().from(schema.users);
  const ownerId = owner.id;

  // Regroupe par client
  const clientMap = new Map<string, { presta: string | null; amount: number; trimestre: Dossier['trimestre']; rawLabel: string }[]>();
  for (const d of DOSSIERS) {
    const { client, presta } = parseLabel(d.label);
    if (!clientMap.has(client)) clientMap.set(client, []);
    clientMap.get(client)!.push({ presta, amount: d.amount, trimestre: d.trimestre, rawLabel: d.label });
  }

  let orgCount = 0;
  let engagementCount = 0;
  let milestoneCount = 0;
  let totalAmount = 0;

  for (const [clientName, prestations] of clientMap) {
    const [org] = await db.insert(schema.organizations).values({
      name: clientName,
      status: 'client',
      notes: prestations.length > 1 ? `${prestations.length} dossiers 2026` : null,
      ownerId,
    } as any).returning();
    orgCount++;

    for (const p of prestations) {
      const dates = p.trimestre ? TRI_DATES[p.trimestre] : null;
      const offerType = typeFromPresta(p.presta, p.rawLabel);
      const [eng] = await db.insert(schema.engagements).values({
        organizationId: org.id,
        title: p.presta ? `${offerType} — ${p.presta}` : offerType,
        description: `Dossier 2026 · ${p.trimestre ?? 'date à confirmer'} · type : ${offerType}`,
        totalAmount: p.amount,
        status: 'active',
        startedAt: dates?.start ?? new Date('2026-01-01'),
      } as any).returning();
      engagementCount++;
      totalAmount += p.amount;

      await db.insert(schema.milestones).values({
        engagementId: eng.id,
        label: `Facturation ${p.trimestre ?? 'unique'}`,
        amount: p.amount,
        status: 'to_invoice',
        dueDate: dates?.due ?? null,
      } as any);
      milestoneCount++;
    }
  }

  console.log(`\n✓ Seed depuis Excel terminé :`);
  console.log(`  - ${orgCount} clients`);
  console.log(`  - ${engagementCount} prestations`);
  console.log(`  - ${milestoneCount} jalons de facturation`);
  console.log(`  - Total CA 2026 : ${totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`);
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
