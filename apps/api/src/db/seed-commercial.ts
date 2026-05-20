// Import du fichier CRM_Commercial_2026.xlsx → Supabase
// Lit le fichier, mappe sur le modèle CRM, crée orgas + deals + engagements (pour les won)
// Idempotent sur les orgas (match par nom), pas sur les deals (chaque run ajoute).
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { db, schema, sql } from './client.js';

const EXCEL_PATH = 'C:/Users/RomainCLOUET/Documents/CRM_Commercial_2026.xlsx';

type Stage = 'to_qualify' | 'contacted' | 'meeting' | 'proposal' | 'won' | 'lost';

const STAGE_MAP: Record<string, Stage> = {
  '1 - Lead identifié': 'to_qualify',
  '2 - Premier contact': 'contacted',
  '3 - Proposition envoyée': 'proposal',
  '5 - Validé verbalement': 'proposal',
  '6 - Gagné (contrat signé)': 'won',
  '7 - Perdu': 'lost',
};

const PROBA_MAP: Record<Stage, number> = {
  to_qualify: 10,
  contacted: 25,
  meeting: 40,
  proposal: 50,
  won: 100,
  lost: 0,
};

// Si "Validé verbalement", on garde stage=proposal mais on monte la proba à 80
const STAGE_OVERRIDE_PROBA: Record<string, number> = {
  '5 - Validé verbalement': 80,
};

const OFFER_MAP: Record<string, string> = {
  Accompagnement: 'Appui conseil',
  ACRSE: 'Appui conseil',
  'Conseil ponctuel': 'Appui conseil',
  Aide: 'Appui conseil',
  FDD: 'Appui conseil',
  Formation: 'Formation',
  Évenement: 'Activation',
  Event: 'Activation',
  Outils: 'Activation',
  Séminaire: 'Activation',
  Semainaire: 'Activation',
  Seminaire: 'Activation',
  Contenu: 'Activation',
  'Bilan carbone': 'Bilan carbone',
  "Mesure d'impact": 'Diagnostic',
  Diagnostic: 'Diagnostic',
};

const TRIMESTER_DATES: Record<string, { start: Date; end: Date }> = {
  T1: { start: new Date('2026-01-01'), end: new Date('2026-03-31') },
  T2: { start: new Date('2026-04-01'), end: new Date('2026-06-30') },
  T3: { start: new Date('2026-07-01'), end: new Date('2026-09-30') },
  T4: { start: new Date('2026-10-01'), end: new Date('2026-12-31') },
};

const cellStr = (v: any): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v) return String((v as any).text).trim();
  if (typeof v === 'object' && 'result' in v) return String((v as any).result).trim();
  return String(v).trim();
};

const cellNum = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as any).result;
    return typeof r === 'number' ? r : 0;
  }
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const cellDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && 'result' in v && (v as any).result instanceof Date) return (v as any).result;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

async function main() {
  console.log('→ Lecture Excel :', EXCEL_PATH);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const ws = wb.worksheets.find(w => w.name.includes('Propositions'));
  if (!ws) throw new Error('Onglet Propositions introuvable');

  // Trouve la ligne de headers (cell B contient "ID")
  let headerRow = 0;
  for (let r = 1; r <= 15; r++) {
    if (cellStr(ws.getRow(r).getCell(2).value) === 'ID') {
      headerRow = r;
      break;
    }
  }
  if (!headerRow) throw new Error('Ligne header introuvable');
  console.log('→ Header row :', headerRow);

  // Indexe les colonnes par nom
  const colByName: Record<string, number> = {};
  ws.getRow(headerRow).eachCell((cell, col) => {
    colByName[cellStr(cell.value)] = col;
  });
  const C = (name: string) => colByName[name];

  // Charge les orgas existantes pour matching
  const existingOrgs = await db.select().from(schema.organizations);
  const orgByName = new Map<string, (typeof existingOrgs)[number]>();
  for (const o of existingOrgs) orgByName.set(o.name.toLowerCase(), o);
  console.log(`→ Orgas existantes : ${existingOrgs.length}`);

  let orgsCreated = 0,
    orgsPromoted = 0,
    dealsCreated = 0,
    engsCreated = 0;
  const skipped: string[] = [];
  const summary: Array<{ orga: string; stage: Stage; offer: string; amount: number }> = [];

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const clientName = cellStr(row.getCell(C('Client / Prospect')).value);
    if (!clientName) continue;
    if (/^total/i.test(clientName)) continue; // ignore les lignes TOTAUX / TOTAL

    const title = cellStr(row.getCell(C('Intitulé du dossier')).value) || 'Mission';
    const typePrestation = cellStr(row.getCell(C('Type de prestation')).value);
    const stageFr = cellStr(row.getCell(C('Étape')).value);
    const trim = cellStr(row.getCell(C('Trimestre cible')).value);
    const amount = cellNum(row.getCell(C('Montant HT (€)')).value);
    const closeExp = cellDate(row.getCell(C('Date clôture prévue')).value);
    const closeReal = cellDate(row.getCell(C('Date clôture réelle')).value);
    const financement = cellStr(row.getCell(C('Financement')).value);
    const source = cellStr(row.getCell(C('Source')).value);
    const comment = cellStr(row.getCell(C('Commentaires')).value);
    const nextAction = cellStr(row.getCell(C('Prochaine action')).value);

    const stage: Stage = STAGE_MAP[stageFr] || 'to_qualify';
    const probability = STAGE_OVERRIDE_PROBA[stageFr] ?? PROBA_MAP[stage];
    const offerType = OFFER_MAP[typePrestation] || 'Appui conseil';
    const trimDates = TRIMESTER_DATES[trim];

    // Find or create org
    const key = clientName.toLowerCase();
    let org = orgByName.get(key);
    if (!org) {
      const orgStatus: 'prospect' | 'client' = stage === 'won' ? 'client' : 'prospect';
      const [created] = await db.insert(schema.organizations).values({
        name: clientName,
        status: orgStatus,
        notes: source ? `Source : ${source}` : null,
      } as any).returning();
      org = created;
      orgByName.set(key, created);
      orgsCreated++;
    } else if (stage === 'won' && org.status === 'prospect') {
      await db.update(schema.organizations)
        .set({ status: 'client' as any, updatedAt: new Date() })
        .where(eq(schema.organizations.id, org.id));
      org = { ...org, status: 'client' };
      orgsPromoted++;
    }

    // Build notes
    const noteParts: string[] = [];
    if (financement) noteParts.push(`Financement : ${financement}`);
    if (source) noteParts.push(`Source : ${source}`);
    if (nextAction) noteParts.push(`Prochaine action : ${nextAction}`);
    if (comment) noteParts.push(comment);
    const notes = noteParts.length ? noteParts.join('\n') : null;

    // Create deal
    const dealRow = {
      organizationId: org.id,
      title,
      stage,
      offerType,
      amount: amount || null,
      probability,
      expectedCloseAt: closeExp,
      closedAt: closeReal || (stage === 'won' ? new Date() : null),
      serviceStartAt: trimDates?.start ?? null,
      serviceEndAt: trimDates?.end ?? null,
      notes,
    };
    const [deal] = await db.insert(schema.deals).values(dealRow as any).returning();
    dealsCreated++;
    summary.push({ orga: org.name, stage, offer: offerType, amount });

    // If won, create engagement
    if (stage === 'won' && amount > 0) {
      await db.insert(schema.engagements).values({
        organizationId: org.id,
        dealId: deal.id,
        title,
        offerType,
        totalAmount: amount,
        status: 'active' as any,
        invoiceStatus: 'to_invoice' as any,
        startedAt: trimDates?.start ?? null,
        endedAt: trimDates?.end ?? null,
      } as any);
      engsCreated++;
    }
  }

  // Rapport
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('✓ Import CRM_Commercial_2026.xlsx terminé');
  console.log('═══════════════════════════════════════════');
  console.log(`  Organisations créées : ${orgsCreated}`);
  console.log(`  Orgas promues prospect → client : ${orgsPromoted}`);
  console.log(`  Deals créés : ${dealsCreated}`);
  console.log(`  Prestations créées (gagnés) : ${engsCreated}`);
  if (skipped.length) console.log(`  ⚠ ${skipped.length} lignes ignorées`);
  console.log('');

  // Stats par stage
  const byStage: Record<string, { count: number; total: number }> = {};
  for (const s of summary) {
    if (!byStage[s.stage]) byStage[s.stage] = { count: 0, total: 0 };
    byStage[s.stage].count++;
    byStage[s.stage].total += s.amount;
  }
  console.log('Répartition par étape :');
  for (const [stg, st] of Object.entries(byStage)) {
    console.log(`  ${stg.padEnd(12)} : ${st.count} deals · ${st.total.toLocaleString('fr-FR')} €`);
  }

  await sql.end();
  process.exit(0);
}

main().catch(e => {
  console.error('✗', e);
  process.exit(1);
});
