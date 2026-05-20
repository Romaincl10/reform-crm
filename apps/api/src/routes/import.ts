import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const importRouter = Router();
importRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const norm = (v: any) => (v == null ? '' : String(v).trim());
const yesNo = (v: any) => {
  const s = norm(v).toLowerCase();
  return ['oui', 'yes', 'true', '1', 'o', 'y'].includes(s);
};
const num = (v: any) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};
const dateOrNull = (v: any) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

type Row = Record<string, any>;

// Parse Excel/CSV file → array of rows keyed by lowercased header
async function parseFile(file: Express.Multer.File): Promise<Row[]> {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const rows: Row[] = [];
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell, col) => {
      headers[col] = norm(cell.value).toLowerCase().replace(/\s*\*\s*$/, '').trim();
    });
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const r: Row = {};
      row.eachCell((cell, col) => {
        const key = headers[col];
        if (!key) return;
        let v: any = cell.value;
        // Hyperlink object
        if (v && typeof v === 'object' && 'text' in v) v = (v as any).text;
        if (v && typeof v === 'object' && 'result' in v) v = (v as any).result;
        r[key] = v;
      });
      if (Object.values(r).some(v => v !== null && v !== undefined && v !== '')) rows.push(r);
    });
    return rows;
  }
  // CSV fallback
  const text = file.buffer.toString('utf-8');
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: h => h.toLowerCase().trim() });
  return parsed.data;
}

// Pick first non-empty value among synonyms
const pick = (row: Row, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
};

// === IMPORT ORGANIZATIONS (basic, used by /import page) ===
importRouter.post('/organizations', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  let rows: Row[];
  try { rows = await parseFile(req.file); } catch (e: any) { return res.status(400).json({ error: 'parse_error', message: e.message }); }

  let inserted = 0;
  const skipped: any[] = [];
  for (const row of rows) {
    const name = norm(pick(row, 'name', 'nom', 'organization', 'raison sociale'));
    if (!name) { skipped.push({ row, reason: 'missing_name' }); continue; }
    const statusRaw = norm(pick(row, 'status', 'statut')).toLowerCase();
    const status = statusRaw === 'client' || statusRaw === 'clients' ? 'client' : statusRaw === 'inactive' || statusRaw === 'inactif' ? 'inactive' : 'prospect';
    try {
      await db.insert(schema.organizations).values({
        name,
        status: status as any,
        siren: norm(pick(row, 'siren')) || null,
        industry: norm(pick(row, 'industry', 'secteur')) || null,
        size: norm(pick(row, 'size', 'taille')) || null,
        website: norm(pick(row, 'website', 'site')) || null,
        city: norm(pick(row, 'city', 'ville')) || null,
        zipcode: norm(pick(row, 'zipcode', 'cp', 'code postal')) || null,
        country: norm(pick(row, 'country', 'pays')) || 'France',
        notes: norm(pick(row, 'notes')) || null,
      } as any);
      inserted++;
    } catch (e: any) {
      skipped.push({ row, reason: e.message });
    }
  }
  res.json({ inserted, skipped: skipped.length, details: { skipped } });
});

// === IMPORT PROSPECTS (orgs + contact + deal en 1 ligne) ===
importRouter.post('/prospects', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  let rows: Row[];
  try { rows = await parseFile(req.file); } catch (e: any) { return res.status(400).json({ error: 'parse_error', message: e.message }); }

  let orgsCreated = 0, contactsCreated = 0, dealsCreated = 0;
  const skipped: any[] = [];

  for (const row of rows) {
    const name = norm(pick(row, 'nom', 'name', 'organisation', 'raison sociale'));
    if (!name) { skipped.push({ row, reason: 'missing_name' }); continue; }

    try {
      const [org] = await db.insert(schema.organizations).values({
        name,
        status: 'prospect',
        siren: norm(pick(row, 'siren')) || null,
        spk: yesNo(pick(row, 'spk')),
          spkPulse: yesNo(pick(row, 'spk pulse', 'spk_pulse', 'pulse')),
        industry: norm(pick(row, 'secteur', 'industry')) || null,
        size: norm(pick(row, 'taille', 'size')) || null,
        city: norm(pick(row, 'ville', 'city')) || null,
        zipcode: norm(pick(row, 'code postal', 'cp', 'zipcode')) || null,
        country: norm(pick(row, 'pays', 'country')) || 'France',
        website: norm(pick(row, 'site web', 'website', 'site')) || null,
        notes: norm(pick(row, 'notes')) || null,
        ownerId: req.user!.userId,
      } as any).returning();
      orgsCreated++;

      const firstName = norm(pick(row, 'contact prénom', 'contact prenom', 'prénom contact', 'prenom contact', 'prénom', 'prenom', 'firstname'));
      const lastName = norm(pick(row, 'contact nom', 'nom contact', 'lastname'));
      if (firstName || lastName) {
        await db.insert(schema.contacts).values({
          organizationId: org.id,
          firstName: firstName || '—',
          lastName: lastName || '—',
          role: norm(pick(row, 'contact fonction', 'fonction', 'role')) || null,
          email: norm(pick(row, 'contact email', 'email')) || null,
          phone: norm(pick(row, 'contact téléphone', 'contact telephone', 'téléphone', 'telephone', 'phone')) || null,
          isPrimary: true,
        } as any);
        contactsCreated++;
      }

      const dealTitle = norm(pick(row, 'titre opportunité', 'titre opportunite', 'opportunité', 'opportunite', 'deal', 'mission'));
      if (dealTitle) {
        const stageRaw = norm(pick(row, 'étape', 'etape', 'stage')).toLowerCase().replace(/\s+/g, '_');
        const validStages = ['to_qualify', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost'];
        const stage = validStages.includes(stageRaw) ? stageRaw : 'to_qualify';
        await db.insert(schema.deals).values({
          organizationId: org.id,
          title: dealTitle,
          stage: stage as any,
          offerType: norm(pick(row, "type d'offre", 'type d offre', 'type offre', 'offre', 'offer type')) || null,
          amount: num(pick(row, 'enveloppe / devis', 'enveloppe', 'devis', 'montant', 'amount')),
          probability: num(pick(row, 'probabilité', 'probabilite', 'probability')),
          serviceStartAt: dateOrNull(pick(row, 'début prestation', 'debut prestation', 'service start', 'date début prestation', 'date debut prestation')),
          serviceEndAt: dateOrNull(pick(row, 'fin prestation prévue', 'fin prestation prevue', 'fin prestation', 'service end', 'date fin prestation')),
          invoiceDate1: dateOrNull(pick(row, 'facture 1 — date', 'facture 1 date', 'facture 1', 'invoice 1 date', 'date facture 1')),
          invoiceAmount1: num(pick(row, 'facture 1 — montant', 'facture 1 montant', 'invoice 1 amount')),
          invoiceDate2: dateOrNull(pick(row, 'facture 2 — date', 'facture 2 date', 'facture 2', 'invoice 2 date', 'date facture 2')),
          invoiceAmount2: num(pick(row, 'facture 2 — montant', 'facture 2 montant', 'invoice 2 amount')),
          invoiceDate3: dateOrNull(pick(row, 'facture 3 — date', 'facture 3 date', 'facture 3', 'invoice 3 date', 'date facture 3')),
          invoiceAmount3: num(pick(row, 'facture 3 — montant', 'facture 3 montant', 'invoice 3 amount')),
          ownerId: req.user!.userId,
        } as any);
        dealsCreated++;
      }
    } catch (e: any) {
      skipped.push({ row, reason: e.message });
    }
  }

  res.json({ orgsCreated, contactsCreated, dealsCreated, skipped: skipped.length, details: { skipped } });
});

// === IMPORT CLIENTS (orgs + contact + engagement + milestone en 1 ligne) ===
// Plusieurs lignes même client → on consolide sur le nom
importRouter.post('/clients', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  let rows: Row[];
  try { rows = await parseFile(req.file); } catch (e: any) { return res.status(400).json({ error: 'parse_error', message: e.message }); }

  let orgsCreated = 0, contactsCreated = 0, engCreated = 0;
  const skipped: any[] = [];
  const orgCache = new Map<string, string>();

  for (const row of rows) {
    const name = norm(pick(row, 'nom', 'name', 'client', 'raison sociale'));
    if (!name) { skipped.push({ row, reason: 'missing_name' }); continue; }

    try {
      let orgId = orgCache.get(name.toLowerCase());
      if (!orgId) {
        const [org] = await db.insert(schema.organizations).values({
          name,
          status: 'client',
          siren: norm(pick(row, 'siren')) || null,
          spk: yesNo(pick(row, 'spk')),
          spkPulse: yesNo(pick(row, 'spk pulse', 'spk_pulse', 'pulse')),
          industry: norm(pick(row, 'secteur', 'industry')) || null,
          size: norm(pick(row, 'taille', 'size')) || null,
          city: norm(pick(row, 'ville', 'city')) || null,
          website: norm(pick(row, 'site web', 'website', 'site')) || null,
          notes: norm(pick(row, 'notes')) || null,
          ownerId: req.user!.userId,
        } as any).returning();
        orgId = org.id;
        orgCache.set(name.toLowerCase(), orgId);
        orgsCreated++;

        const firstName = norm(pick(row, 'contact prénom', 'contact prenom', 'prénom', 'prenom', 'firstname'));
        const lastName = norm(pick(row, 'contact nom', 'lastname'));
        if (firstName || lastName) {
          await db.insert(schema.contacts).values({
            organizationId: orgId,
            firstName: firstName || '—',
            lastName: lastName || '—',
            role: norm(pick(row, 'contact fonction', 'fonction')) || null,
            email: norm(pick(row, 'contact email', 'email')) || null,
            phone: norm(pick(row, 'contact téléphone', 'contact telephone', 'téléphone', 'phone')) || null,
            isPrimary: true,
          } as any);
          contactsCreated++;
        }
      }

      const engTitle = norm(pick(row, 'prestation (titre)', 'prestation', 'engagement', 'titre prestation'));
      if (engTitle) {
        const engAmount = num(pick(row, 'montant total', 'montant total (€)', 'engagement amount', 'montant prestation')) ?? 0;
        const statusRaw = norm(pick(row, 'statut facturation', 'invoice status', 'statut')).toLowerCase().replace(/\s+/g, '_');
        const invoiceStatus = ['to_invoice', 'invoiced', 'partially_paid', 'paid'].includes(statusRaw) ? statusRaw : 'to_invoice';
        await db.insert(schema.engagements).values({
          organizationId: orgId,
          title: engTitle,
          description: norm(pick(row, 'description prestation', 'description')) || null,
          offerType: norm(pick(row, "type d'offre", 'type d offre', 'type offre', 'offre', 'offer type')) || null,
          spk: yesNo(pick(row, 'spk')),
          spkPulse: yesNo(pick(row, 'spk pulse', 'spk_pulse', 'pulse')),
          totalAmount: engAmount,
          paidAmount: num(pick(row, 'encaissé', 'encaisse', 'paid', 'paid amount')) ?? 0,
          status: 'active',
          invoiceStatus: invoiceStatus as any,
          startedAt: dateOrNull(pick(row, 'date début', 'date debut', 'démarrage', 'demarrage', 'start')),
          endedAt: dateOrNull(pick(row, 'date fin prévue', 'date fin prevue', 'date fin', 'fin', 'end')),
        } as any);
        engCreated++;
      }
    } catch (e: any) {
      skipped.push({ row, reason: e.message });
    }
  }

  res.json({ orgsCreated, contactsCreated, engCreated, skipped: skipped.length, details: { skipped } });
});

// === IMPORT PRESTATIONS (match orga existante par nom, sinon création) ===
importRouter.post('/prestations', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  let rows: Row[];
  try { rows = await parseFile(req.file); } catch (e: any) { return res.status(400).json({ error: 'parse_error', message: e.message }); }

  let engCreated = 0, orgsCreated = 0;
  const skipped: any[] = [];
  const orgCache = new Map<string, string>();

  // Pré-charge les orgas existantes pour matching
  const existingOrgs = await db.select().from(schema.organizations);
  for (const o of existingOrgs) orgCache.set(o.name.toLowerCase(), o.id);

  for (const row of rows) {
    const clientName = norm(pick(row, 'client', 'nom', 'name', 'organisation'));
    const engTitle = norm(pick(row, 'prestation (titre)', 'prestation', 'titre', 'title'));
    if (!clientName) { skipped.push({ row, reason: 'missing_client' }); continue; }
    if (!engTitle) { skipped.push({ row, reason: 'missing_title' }); continue; }

    try {
      let orgId = orgCache.get(clientName.toLowerCase());
      if (!orgId) {
        const [org] = await db.insert(schema.organizations).values({
          name: clientName,
          status: 'client',
          siren: norm(pick(row, 'siren')) || null,
          spk: yesNo(pick(row, 'spk')),
          spkPulse: yesNo(pick(row, 'spk pulse', 'spk_pulse', 'pulse')),
          ownerId: req.user!.userId,
        } as any).returning();
        orgId = org.id;
        orgCache.set(clientName.toLowerCase(), orgId);
        orgsCreated++;
      } else {
        // Si SIREN fourni et orga existante sans SIREN, on complète
        const siren = norm(pick(row, 'siren'));
        if (siren) {
          await db.update(schema.organizations)
            .set({ siren, updatedAt: new Date() })
            .where(eq(schema.organizations.id, orgId));
        }
      }

      const statusRaw = norm(pick(row, 'statut facturation', 'invoice status', 'statut')).toLowerCase().replace(/\s+/g, '_');
      const invoiceStatus = ['to_invoice', 'invoiced', 'partially_paid', 'paid'].includes(statusRaw) ? statusRaw : 'to_invoice';

      await db.insert(schema.engagements).values({
        organizationId: orgId,
        title: engTitle,
        offerType: norm(pick(row, "type d'offre", 'type d offre', 'offre', 'offer type')) || null,
        spk: yesNo(pick(row, 'spk')),
          spkPulse: yesNo(pick(row, 'spk pulse', 'spk_pulse', 'pulse')),
        description: norm(pick(row, 'description')) || null,
        totalAmount: num(pick(row, 'montant total', 'montant total (€)', 'montant')) ?? 0,
        paidAmount: num(pick(row, 'encaissé', 'encaisse', 'paid')) ?? 0,
        status: 'active',
        invoiceStatus: invoiceStatus as any,
        startedAt: dateOrNull(pick(row, 'date début', 'date debut', 'début', 'start')),
        endedAt: dateOrNull(pick(row, 'date fin prévue', 'date fin prevue', 'date fin', 'fin', 'end')),
      } as any);
      engCreated++;
    } catch (e: any) {
      skipped.push({ row, reason: e.message });
    }
  }

  res.json({ orgsCreated, engCreated, skipped: skipped.length, details: { skipped } });
});
