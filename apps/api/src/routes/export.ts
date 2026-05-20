import { Router } from 'express';
import ExcelJS from 'exceljs';
import { eq, desc, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const exportRouter = Router();
exportRouter.use(requireAuth);

const REFORM_VIOLET = 'FF5F30E2';
const REFORM_MAUVE = 'FFF8F7FC';

const STAGE_LABELS: Record<string, string> = {
  to_qualify: 'À qualifier',
  contacted: 'Contacté',
  meeting: 'RDV',
  proposal: 'Propale envoyée',
  negotiation: 'Négociation',
  won: 'Gagné',
  lost: 'Perdu',
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REFORM_VIOLET } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  row.height = 22;
}

function autosize(ws: ExcelJS.Worksheet) {
  ws.columns.forEach(col => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const v = String(cell.value ?? '');
      if (v.length > max) max = v.length;
    });
    col.width = Math.min(max + 2, 50);
  });
}

async function sendWorkbook(res: any, wb: ExcelJS.Workbook, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// === EXPORT PROSPECTS ===
exportRouter.get('/prospects', async (_req, res) => {
  const orgs = await db.select().from(schema.organizations).where(eq(schema.organizations.status, 'prospect')).orderBy(desc(schema.organizations.updatedAt));
  const orgIds = orgs.map(o => o.id);
  const allDeals = orgIds.length ? await db.select().from(schema.deals).where(inArray(schema.deals.organizationId, orgIds)) : [];
  const allContacts = orgIds.length ? await db.select().from(schema.contacts).where(inArray(schema.contacts.organizationId, orgIds)) : [];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'REFORM CRM';
  wb.created = new Date();

  const orgsSheet = wb.addWorksheet('Prospects');
  orgsSheet.columns = [
    { header: 'Nom', key: 'name', width: 30 },
    { header: 'SIREN', key: 'siren', width: 12 },
    { header: 'SPK', key: 'spk', width: 8 },
    { header: 'SPK PULSE', key: 'spkPulse', width: 12 },
    { header: 'Secteur', key: 'industry', width: 20 },
    { header: 'Taille', key: 'size', width: 12 },
    { header: 'Ville', key: 'city', width: 18 },
    { header: 'Site web', key: 'website', width: 25 },
    { header: 'Code postal', key: 'zipcode', width: 12 },
    { header: 'Pays', key: 'country', width: 12 },
    { header: 'Notes', key: 'notes', width: 40 },
    { header: 'Contact principal', key: 'primaryContact', width: 25 },
    { header: 'Email contact', key: 'contactEmail', width: 28 },
    { header: 'Téléphone', key: 'contactPhone', width: 18 },
    { header: 'Deals actifs', key: 'dealsCount', width: 12 },
    { header: 'Potentiel total (€)', key: 'totalAmount', width: 18 },
    { header: 'Étape la plus avancée', key: 'topStage', width: 22 },
    { header: 'Créé le', key: 'createdAt', width: 14 },
  ];
  styleHeader(orgsSheet.getRow(1));

  for (const o of orgs) {
    const orgDeals = allDeals.filter(d => d.organizationId === o.id && !['won', 'lost'].includes(d.stage));
    const total = orgDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
    const primary = allContacts.find(c => c.organizationId === o.id && c.isPrimary) ?? allContacts.find(c => c.organizationId === o.id);
    const stageOrder = ['to_qualify', 'contacted', 'meeting', 'proposal', 'negotiation'];
    const topStage = orgDeals.length
      ? STAGE_LABELS[[...orgDeals].sort((a, b) => stageOrder.indexOf(b.stage) - stageOrder.indexOf(a.stage))[0].stage]
      : '';

    orgsSheet.addRow({
      name: o.name,
      siren: o.siren ?? '',
      spk: o.spk ? 'Oui' : 'Non',
      spkPulse: o.spkPulse ? 'Oui' : 'Non',
      industry: o.industry ?? '',
      size: o.size ?? '',
      city: o.city ?? '',
      website: o.website ?? '',
      zipcode: o.zipcode ?? '',
      country: o.country ?? '',
      notes: o.notes ?? '',
      primaryContact: primary ? `${primary.firstName} ${primary.lastName}${primary.role ? ' — ' + primary.role : ''}` : '',
      contactEmail: primary?.email ?? '',
      contactPhone: primary?.phone ?? '',
      dealsCount: orgDeals.length,
      totalAmount: total,
      topStage,
      createdAt: o.createdAt,
    });
  }

  // Deal-level sheet
  const dealsSheet = wb.addWorksheet('Opportunités');
  dealsSheet.columns = [
    { header: 'Organisation', key: 'org', width: 30 },
    { header: 'SIREN', key: 'siren', width: 12 },
    { header: 'SPK', key: 'spk', width: 8 },
    { header: 'SPK PULSE', key: 'spkPulse', width: 12 },
    { header: 'Titre opportunité', key: 'title', width: 40 },
    { header: 'Type d\'offre', key: 'offerType', width: 18 },
    { header: 'Étape', key: 'stage', width: 18 },
    { header: 'Enveloppe / devis (€)', key: 'amount', width: 18 },
    { header: 'Probabilité (%)', key: 'probability', width: 14 },
    { header: 'Pondéré (€)', key: 'weighted', width: 14 },
    { header: 'Début prestation', key: 'serviceStartAt', width: 16 },
    { header: 'Fin prestation prévue', key: 'serviceEndAt', width: 18 },
    { header: 'Facture 1 (acompte) — date', key: 'invoice1Date', width: 22 },
    { header: 'Facture 1 — montant (€)', key: 'invoice1Amount', width: 20 },
    { header: 'Facture 2 (intermédiaire) — date', key: 'invoice2Date', width: 26 },
    { header: 'Facture 2 — montant (€)', key: 'invoice2Amount', width: 20 },
    { header: 'Facture 3 (solde) — date', key: 'invoice3Date', width: 22 },
    { header: 'Facture 3 — montant (€)', key: 'invoice3Amount', width: 20 },
    { header: 'Clôture prévue', key: 'expectedCloseAt', width: 16 },
    { header: 'Notes', key: 'notes', width: 40 },
  ];
  styleHeader(dealsSheet.getRow(1));

  for (const d of allDeals.filter(d => !['won', 'lost'].includes(d.stage))) {
    const org = orgs.find(o => o.id === d.organizationId);
    dealsSheet.addRow({
      org: org?.name ?? '',
      siren: org?.siren ?? '',
      spk: org?.spk ? 'Oui' : 'Non',
      spkPulse: org?.spkPulse ? 'Oui' : 'Non',
      title: d.title,
      offerType: d.offerType ?? '',
      stage: STAGE_LABELS[d.stage] ?? d.stage,
      amount: d.amount ?? null,
      probability: d.probability ?? null,
      weighted: d.amount && d.probability ? (d.amount * d.probability) / 100 : null,
      serviceStartAt: d.serviceStartAt ?? '',
      serviceEndAt: d.serviceEndAt ?? '',
      invoice1Date: d.invoiceDate1 ?? '',
      invoice1Amount: d.invoiceAmount1 ?? null,
      invoice2Date: d.invoiceDate2 ?? '',
      invoice2Amount: d.invoiceAmount2 ?? null,
      invoice3Date: d.invoiceDate3 ?? '',
      invoice3Amount: d.invoiceAmount3 ?? null,
      expectedCloseAt: d.expectedCloseAt ?? '',
      notes: d.notes ?? '',
    });
  }

  for (const sheet of [orgsSheet, dealsSheet]) {
    sheet.getRow(1).eachCell(cell => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REFORM_VIOLET } });
    autosize(sheet);
  }

  const date = new Date().toISOString().slice(0, 10);
  await sendWorkbook(res, wb, `REFORM_Prospects_${date}.xlsx`);
});

// === EXPORT CLIENTS ===
const INVOICE_LABELS: Record<string, string> = {
  to_invoice: 'À facturer',
  invoiced: 'Facturé',
  partially_paid: 'Paiement partiel',
  paid: 'Payé',
};

exportRouter.get('/clients', async (_req, res) => {
  const orgs = await db.select().from(schema.organizations).where(eq(schema.organizations.status, 'client')).orderBy(desc(schema.organizations.updatedAt));
  const orgIds = orgs.map(o => o.id);
  const engs = orgIds.length ? await db.select().from(schema.engagements).where(inArray(schema.engagements.organizationId, orgIds)) : [];
  const allContacts = orgIds.length ? await db.select().from(schema.contacts).where(inArray(schema.contacts.organizationId, orgIds)) : [];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'REFORM CRM';
  wb.created = new Date();

  // 1. Vue agrégée clients
  const summary = wb.addWorksheet('Clients');
  summary.columns = [
    { header: 'Client', key: 'name', width: 32 },
    { header: 'SIREN', key: 'siren', width: 12 },
    { header: 'SPK', key: 'spk', width: 8 },
    { header: 'SPK PULSE', key: 'spkPulse', width: 12 },
    { header: 'Secteur', key: 'industry', width: 18 },
    { header: 'Ville', key: 'city', width: 18 },
    { header: 'Contact principal', key: 'primary', width: 25 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Téléphone', key: 'phone', width: 18 },
    { header: 'Nb prestations', key: 'nb', width: 14 },
    { header: 'CA contractualisé (€)', key: 'ca', width: 20 },
    { header: 'À facturer (€)', key: 'toInvoice', width: 16 },
    { header: 'Facturé non payé (€)', key: 'invoiced', width: 20 },
    { header: 'Encaissé (€)', key: 'paid', width: 16 },
  ];
  styleHeader(summary.getRow(1));

  for (const o of orgs) {
    const orgEngs = engs.filter(e => e.organizationId === o.id);
    const ca = orgEngs.reduce((s, e) => s + e.totalAmount, 0);
    const toInvoice = orgEngs.filter(e => e.invoiceStatus === 'to_invoice').reduce((s, e) => s + e.totalAmount, 0);
    const invoiced = orgEngs.filter(e => e.invoiceStatus === 'invoiced' || e.invoiceStatus === 'partially_paid').reduce((s, e) => s + (e.totalAmount - e.paidAmount), 0);
    const paid = orgEngs.reduce((s, e) => s + e.paidAmount, 0);
    const primary = allContacts.find(c => c.organizationId === o.id && c.isPrimary) ?? allContacts.find(c => c.organizationId === o.id);

    summary.addRow({
      name: o.name,
      siren: o.siren ?? '',
      spk: o.spk ? 'Oui' : 'Non',
      spkPulse: o.spkPulse ? 'Oui' : 'Non',
      industry: o.industry ?? '',
      city: o.city ?? '',
      primary: primary ? `${primary.firstName} ${primary.lastName}${primary.role ? ' — ' + primary.role : ''}` : '',
      email: primary?.email ?? '',
      phone: primary?.phone ?? '',
      nb: orgEngs.length,
      ca,
      toInvoice,
      invoiced,
      paid,
    });
  }

  // Total row
  const totalRow = summary.addRow({
    name: 'TOTAL',
    nb: engs.length,
    ca: { formula: `SUM(K2:K${summary.rowCount})` },
    toInvoice: { formula: `SUM(L2:L${summary.rowCount})` },
    invoiced: { formula: `SUM(M2:M${summary.rowCount})` },
    paid: { formula: `SUM(N2:N${summary.rowCount})` },
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REFORM_MAUVE } };

  // 2. Vue détaillée prestations
  const detail = wb.addWorksheet('Prestations');
  detail.columns = [
    { header: 'Client', key: 'client', width: 30 },
    { header: 'SIREN', key: 'siren', width: 12 },
    { header: 'Prestation', key: 'title', width: 40 },
    { header: 'Type d\'offre', key: 'offerType', width: 18 },
    { header: 'SPK', key: 'spk', width: 8 },
    { header: 'SPK PULSE', key: 'spkPulse', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Date début', key: 'startedAt', width: 14 },
    { header: 'Date fin prévue', key: 'endedAt', width: 16 },
    { header: 'Statut facturation', key: 'invoiceStatus', width: 18 },
    { header: 'Date facturation', key: 'invoicedAt', width: 16 },
    { header: 'Montant facturé (€)', key: 'invoicedAmount', width: 18 },
    { header: 'Réf. facture', key: 'invoiceRef', width: 16 },
    { header: 'Montant total (€)', key: 'total', width: 18 },
    { header: 'Encaissé (€)', key: 'paid', width: 14 },
    { header: 'Reste dû (€)', key: 'remaining', width: 14 },
  ];
  styleHeader(detail.getRow(1));

  for (const e of engs) {
    const org = orgs.find(o => o.id === e.organizationId);
    detail.addRow({
      client: org?.name ?? '',
      siren: org?.siren ?? '',
      title: e.title,
      offerType: e.offerType ?? '',
      spk: e.spk ? 'Oui' : 'Non',
      spkPulse: e.spkPulse ? 'Oui' : 'Non',
      description: e.description ?? '',
      startedAt: e.startedAt ?? '',
      endedAt: e.endedAt ?? '',
      invoiceStatus: INVOICE_LABELS[e.invoiceStatus] ?? e.invoiceStatus,
      invoicedAt: e.invoicedAt ?? '',
      invoicedAmount: e.invoicedAmount ?? null,
      invoiceRef: e.invoiceRef ?? '',
      total: e.totalAmount,
      paid: e.paidAmount,
      remaining: e.totalAmount - e.paidAmount,
    });
  }

  for (const sheet of [summary, detail]) autosize(sheet);

  const date = new Date().toISOString().slice(0, 10);
  await sendWorkbook(res, wb, `REFORM_Clients_${date}.xlsx`);
});

// === EXPORT PRESTATIONS (toutes, tous statuts confondus) ===
exportRouter.get('/prestations', async (_req, res) => {
  const allOrgs = await db.select().from(schema.organizations);
  const engs = await db.select().from(schema.engagements).orderBy(desc(schema.engagements.updatedAt));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'REFORM CRM';
  wb.created = new Date();

  const ws = wb.addWorksheet('Prestations');
  ws.columns = [
    { header: 'Client', key: 'client', width: 30 },
    { header: 'SIREN', key: 'siren', width: 12 },
    { header: 'Statut client', key: 'orgStatus', width: 14 },
    { header: 'Prestation', key: 'title', width: 40 },
    { header: 'Type d\'offre', key: 'offerType', width: 18 },
    { header: 'SPK', key: 'spk', width: 8 },
    { header: 'SPK PULSE', key: 'spkPulse', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Date début', key: 'startedAt', width: 14 },
    { header: 'Date fin prévue', key: 'endedAt', width: 16 },
    { header: 'Statut facturation', key: 'invoiceStatus', width: 18 },
    { header: 'Date facturation', key: 'invoicedAt', width: 16 },
    { header: 'Montant facturé (€)', key: 'invoicedAmount', width: 18 },
    { header: 'Réf. facture', key: 'invoiceRef', width: 16 },
    { header: 'Montant total (€)', key: 'total', width: 18 },
    { header: 'Encaissé (€)', key: 'paid', width: 14 },
    { header: 'Reste dû (€)', key: 'remaining', width: 14 },
  ];
  styleHeader(ws.getRow(1));

  for (const e of engs) {
    const org = allOrgs.find(o => o.id === e.organizationId);
    ws.addRow({
      client: org?.name ?? '',
      siren: org?.siren ?? '',
      orgStatus: org?.status ?? '',
      title: e.title,
      offerType: e.offerType ?? '',
      spk: e.spk ? 'Oui' : 'Non',
      spkPulse: e.spkPulse ? 'Oui' : 'Non',
      description: e.description ?? '',
      startedAt: e.startedAt ?? '',
      endedAt: e.endedAt ?? '',
      invoiceStatus: INVOICE_LABELS[e.invoiceStatus] ?? e.invoiceStatus,
      invoicedAt: e.invoicedAt ?? '',
      invoicedAmount: e.invoicedAmount ?? null,
      invoiceRef: e.invoiceRef ?? '',
      total: e.totalAmount,
      paid: e.paidAmount,
      remaining: e.totalAmount - e.paidAmount,
    });
  }

  // Ligne TOTAL
  const totalRow = ws.addRow({
    client: 'TOTAL',
    total: { formula: `SUM(O2:O${ws.rowCount})` },
    paid: { formula: `SUM(P2:P${ws.rowCount})` },
    remaining: { formula: `SUM(Q2:Q${ws.rowCount})` },
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REFORM_MAUVE } };

  autosize(ws);
  const date = new Date().toISOString().slice(0, 10);
  await sendWorkbook(res, wb, `REFORM_Prestations_${date}.xlsx`);
});

// === TEMPLATES ===
exportRouter.get('/template/prospects', async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Prospects');
  ws.columns = [
    { header: 'Nom *', key: 'name', width: 30 },
    { header: 'SIREN', key: 'siren', width: 12 },
    { header: 'SPK (Oui / Non)', key: 'spk', width: 12 },
    { header: 'SPK PULSE (Oui / Non)', key: 'spkPulse', width: 16 },
    { header: 'Secteur', key: 'industry', width: 20 },
    { header: 'Taille', key: 'size', width: 12 },
    { header: 'Ville', key: 'city', width: 18 },
    { header: 'Code postal', key: 'zipcode', width: 12 },
    { header: 'Pays', key: 'country', width: 12 },
    { header: 'Site web', key: 'website', width: 25 },
    { header: 'Notes', key: 'notes', width: 40 },
    { header: 'Contact prénom', key: 'firstName', width: 16 },
    { header: 'Contact nom', key: 'lastName', width: 16 },
    { header: 'Contact fonction', key: 'role', width: 22 },
    { header: 'Contact email', key: 'email', width: 28 },
    { header: 'Contact téléphone', key: 'phone', width: 18 },
    { header: 'Titre opportunité *', key: 'dealTitle', width: 35 },
    { header: 'Type d\'offre (Appui conseil / Formation / Bilan carbone / Activation / Certification / Diagnostic)', key: 'offerType', width: 35 },
    { header: 'Étape (to_qualify / contacted / meeting / proposal / negotiation)', key: 'dealStage', width: 30 },
    { header: 'Enveloppe / devis (€) *', key: 'dealAmount', width: 18 },
    { header: 'Probabilité (%) *', key: 'dealProbability', width: 16 },
    { header: 'Début prestation (YYYY-MM-DD)', key: 'serviceStart', width: 22 },
    { header: 'Fin prestation prévue (YYYY-MM-DD)', key: 'serviceEnd', width: 25 },
    { header: 'Facture 1 — date (YYYY-MM-DD)', key: 'invoice1Date', width: 25 },
    { header: 'Facture 1 — montant (€)', key: 'invoice1Amount', width: 20 },
    { header: 'Facture 2 — date (YYYY-MM-DD)', key: 'invoice2Date', width: 25 },
    { header: 'Facture 2 — montant (€)', key: 'invoice2Amount', width: 20 },
    { header: 'Facture 3 — date (YYYY-MM-DD)', key: 'invoice3Date', width: 25 },
    { header: 'Facture 3 — montant (€)', key: 'invoice3Amount', width: 20 },
  ];
  styleHeader(ws.getRow(1));
  ws.addRow({
    name: 'Exemple SAS', siren: '123456789', spk: 'Non', spkPulse: 'Non', industry: 'Tech', city: 'Paris',
    firstName: 'Pierre', lastName: 'Durand', role: 'DG', email: 'p.durand@exemple.com',
    dealTitle: 'Accompagnement RSO 2026', offerType: 'Appui conseil', dealStage: 'meeting', dealAmount: 50000, dealProbability: 40,
    serviceStart: '2026-09-01', serviceEnd: '2027-02-28',
    invoice1Date: '2026-09-15', invoice1Amount: 20000,
    invoice2Date: '2026-12-15', invoice2Amount: 15000,
    invoice3Date: '2027-02-28', invoice3Amount: 15000,
  });
  await sendWorkbook(res, wb, 'REFORM_template_prospects.xlsx');
});

exportRouter.get('/template/prestations', async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Prestations');
  ws.columns = [
    { header: 'Client *', key: 'client', width: 30 },
    { header: 'SIREN', key: 'siren', width: 12 },
    { header: 'Prestation (titre) *', key: 'title', width: 35 },
    { header: 'Type d\'offre (Appui conseil / Formation / Bilan carbone / Activation / Certification / Diagnostic)', key: 'offerType', width: 35 },
    { header: 'SPK (Oui / Non)', key: 'spk', width: 12 },
    { header: 'SPK PULSE (Oui / Non)', key: 'spkPulse', width: 16 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'Montant total (€) *', key: 'total', width: 18 },
    { header: 'Encaissé (€)', key: 'paid', width: 14 },
    { header: 'Date début (YYYY-MM-DD)', key: 'startedAt', width: 22 },
    { header: 'Date fin prévue (YYYY-MM-DD)', key: 'endedAt', width: 25 },
    { header: 'Statut facturation (to_invoice / invoiced / partially_paid / paid)', key: 'invoiceStatus', width: 35 },
  ];
  styleHeader(ws.getRow(1));
  ws.addRow({
    client: 'Exemple Sport SAS', siren: '987654321', title: 'ACRSE 2026', offerType: 'Appui conseil', spk: 'Non', spkPulse: 'Oui',
    total: 30000, paid: 10000, startedAt: '2026-02-01', endedAt: '2026-07-31', invoiceStatus: 'invoiced',
  });
  await sendWorkbook(res, wb, 'REFORM_template_prestations.xlsx');
});

exportRouter.get('/template/clients', async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Clients');
  ws.columns = [
    { header: 'Nom *', key: 'name', width: 30 },
    { header: 'SIREN', key: 'siren', width: 12 },
    { header: 'SPK (Oui / Non)', key: 'spk', width: 12 },
    { header: 'SPK PULSE (Oui / Non)', key: 'spkPulse', width: 16 },
    { header: 'Secteur', key: 'industry', width: 20 },
    { header: 'Taille', key: 'size', width: 12 },
    { header: 'Ville', key: 'city', width: 18 },
    { header: 'Site web', key: 'website', width: 25 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Contact prénom', key: 'firstName', width: 16 },
    { header: 'Contact nom', key: 'lastName', width: 16 },
    { header: 'Contact fonction', key: 'role', width: 22 },
    { header: 'Contact email', key: 'email', width: 28 },
    { header: 'Contact téléphone', key: 'phone', width: 18 },
    { header: 'Prestation (titre) *', key: 'engagementTitle', width: 35 },
    { header: 'Type d\'offre (Appui conseil / Formation / Bilan carbone / Activation / Certification / Diagnostic)', key: 'offerType', width: 35 },
    { header: 'Description prestation', key: 'engagementDescription', width: 30 },
    { header: 'Montant total (€) *', key: 'engagementAmount', width: 16 },
    { header: 'Date début (YYYY-MM-DD)', key: 'engagementStart', width: 22 },
    { header: 'Date fin prévue (YYYY-MM-DD)', key: 'engagementEnd', width: 25 },
    { header: 'Statut facturation (to_invoice / invoiced / partially_paid / paid)', key: 'invoiceStatus', width: 35 },
    { header: 'Encaissé (€)', key: 'paidAmount', width: 14 },
  ];
  styleHeader(ws.getRow(1));
  ws.addRow({
    name: 'Exemple Sport SAS', siren: '987654321', spk: 'Oui', spkPulse: 'Oui', industry: 'Sport', city: 'Lyon',
    firstName: 'Marie', lastName: 'Dupont', role: 'DG', email: 'm.dupont@exemple.com',
    engagementTitle: 'ACRSE 2026', offerType: 'Appui conseil', engagementAmount: 30000,
    engagementStart: '2026-02-01', engagementEnd: '2026-07-31',
    invoiceStatus: 'invoiced', paidAmount: 10000,
  });
  await sendWorkbook(res, wb, 'REFORM_template_clients.xlsx');
});
