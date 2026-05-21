// Reporting hebdo REFORM — croise les données CRM (Supabase) avec les charges SIG
// Produit un HTML standalone charté REFORM avec 3 onglets : CA, Pipeline, SIG
import fs from 'node:fs';
import path from 'node:path';
import { db, schema, sql } from './client.js';

// ─── Charges annuelles depuis SIG REFORM Base.xlsx (Recrutement 1 EXCLU) ──
const CHARGES = {
  // Charges externes (total fournitures + services extérieurs)
  fournituresConsommables: 1320,
  servicesExterieurs: 100757,
  // = total charges externes : 102 077
  // Impôts et taxes
  impotsEtTaxes: 1797,
  // Salaires bruts salariés (sans Recrutement 1 = 16 252)
  salairesSalaries: 62652 - 16252, // 46 400
  // Charges sociales salariés (sans Recrutement 1 = 7 315)
  chargesSocialesSalaries: 22433 - 7315, // 15 118
  // Salaires bruts dirigeants
  salairesDirigeants: 63156,
  // Charges sociales dirigeants
  chargesSocialesDirigeants: 26526,
};

const TOTAL_CHARGES_EXTERNES = CHARGES.fournituresConsommables + CHARGES.servicesExterieurs;
const TOTAL_CHARGES_PERSONNEL = CHARGES.salairesSalaries + CHARGES.chargesSocialesSalaries + CHARGES.salairesDirigeants + CHARGES.chargesSocialesDirigeants;
const TOTAL_CHARGES_FIXES = TOTAL_CHARGES_EXTERNES + CHARGES.impotsEtTaxes + TOTAL_CHARGES_PERSONNEL;

const OBJECTIF_CA = 380000;
const DATE_BORNE_S1 = new Date('2026-04-30T23:59:59');
const TODAY = new Date();

// Override : tant que le CRM n'a pas la vraie date de facturation par deal,
// on force le CA facturé au 30/04/2026 à 50 k€ (estimation Romain)
const CA_FACTURE_FORCE_S1 = 50000;

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: Date) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
const pct = (n: number, dec = 1) => `${(n * 100).toFixed(dec)}%`;

async function main() {
  // ─── Récupération des données CRM ─────────────────────────────────────
  const orgs = await db.select().from(schema.organizations);
  const deals = await db.select().from(schema.deals);
  const engagements = await db.select().from(schema.engagements);

  const orgById = new Map(orgs.map(o => [o.id, o]));

  // Won deals
  const wonAll = deals.filter(d => d.stage === 'won');
  const wonBefore0430 = wonAll.filter(d => d.closedAt && new Date(d.closedAt) <= DATE_BORNE_S1);
  const caSignedTotal = wonAll.reduce((s, d) => s + (d.amount ?? 0), 0);
  const caSignedToApr = wonBefore0430.reduce((s, d) => s + (d.amount ?? 0), 0);

  // Open deals
  const openDeals = deals.filter(d => !['won', 'lost'].includes(d.stage));
  const pipelineBrut = openDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
  const pipelinePondere = openDeals.reduce((s, d) => s + ((d.amount ?? 0) * (d.probability ?? 0)) / 100, 0);

  // Top 10 clients par CA signé
  const caByOrg = new Map<string, number>();
  for (const d of wonAll) {
    const k = d.organizationId;
    caByOrg.set(k, (caByOrg.get(k) ?? 0) + (d.amount ?? 0));
  }
  const top10Clients = [...caByOrg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, ca]) => ({ name: orgById.get(id)?.name ?? '—', ca }));

  // Répartition CA signé par offre
  const caByOffer = new Map<string, { count: number; ca: number }>();
  for (const d of wonAll) {
    const k = d.offerType ?? 'Non catégorisé';
    const cur = caByOffer.get(k) ?? { count: 0, ca: 0 };
    cur.count++;
    cur.ca += d.amount ?? 0;
    caByOffer.set(k, cur);
  }
  const offerRepartition = [...caByOffer.entries()]
    .sort((a, b) => b[1].ca - a[1].ca)
    .map(([offer, v]) => ({ offer, ...v, pct: v.ca / caSignedTotal }));

  // Pipeline par client (top 10 potentiels)
  const pipelineByOrg = new Map<string, { brut: number; pondere: number; count: number }>();
  for (const d of openDeals) {
    const k = d.organizationId;
    const cur = pipelineByOrg.get(k) ?? { brut: 0, pondere: 0, count: 0 };
    cur.brut += d.amount ?? 0;
    cur.pondere += ((d.amount ?? 0) * (d.probability ?? 0)) / 100;
    cur.count++;
    pipelineByOrg.set(k, cur);
  }
  const top10Pipeline = [...pipelineByOrg.entries()]
    .sort((a, b) => b[1].brut - a[1].brut)
    .slice(0, 10)
    .map(([id, v]) => ({ name: orgById.get(id)?.name ?? '—', ...v }));

  // Détail devis en cours (par stage)
  const dealsByStage = {
    to_qualify: openDeals.filter(d => d.stage === 'to_qualify'),
    contacted: openDeals.filter(d => d.stage === 'contacted'),
    meeting: openDeals.filter(d => d.stage === 'meeting'),
    proposal: openDeals.filter(d => d.stage === 'proposal'),
  };

  const sumStage = (arr: typeof openDeals) => ({
    brut: arr.reduce((s, x) => s + (x.amount ?? 0), 0),
    pondere: arr.reduce((s, x) => s + ((x.amount ?? 0) * (x.probability ?? 0)) / 100, 0),
  });
  const byStageTotals = {
    to_qualify: sumStage(dealsByStage.to_qualify),
    contacted: sumStage(dealsByStage.contacted),
    meeting: sumStage(dealsByStage.meeting),
    proposal: sumStage(dealsByStage.proposal),
  };

  // ─── Calculs SIG des 3 scénarios ──────────────────────────────────────
  type SIG = {
    ca: number;
    chargesExternes: number;
    impotsEtTaxes: number;
    chargesPersonnel: number;
    totalCharges: number;
    valeurAjoutee: number;
    ebe: number;
    ebePctCa: number;
    objectifCA: number;
    objectifPct: number;
    periodLabel: string;
  };

  function calcSIG(ca: number, periodFraction: number, periodLabel: string): SIG {
    const chargesExternes = TOTAL_CHARGES_EXTERNES * periodFraction;
    const impotsEtTaxes = CHARGES.impotsEtTaxes * periodFraction;
    const chargesPersonnel = TOTAL_CHARGES_PERSONNEL * periodFraction;
    const totalCharges = chargesExternes + impotsEtTaxes + chargesPersonnel;
    const valeurAjoutee = ca - chargesExternes;
    const ebe = valeurAjoutee - impotsEtTaxes - chargesPersonnel;
    const objectifCA = OBJECTIF_CA * periodFraction;
    return {
      ca,
      chargesExternes,
      impotsEtTaxes,
      chargesPersonnel,
      totalCharges,
      valeurAjoutee,
      ebe,
      ebePctCa: ca > 0 ? ebe / ca : 0,
      objectifCA,
      objectifPct: ca / objectifCA,
      periodLabel,
    };
  }

  const sig1 = calcSIG(CA_FACTURE_FORCE_S1, 4 / 12, 'Charges sur 4 mois (janv. → avril 2026)');
  const sig2 = calcSIG(caSignedTotal, 1, 'Charges annuelles complètes');
  const sig3 = calcSIG(caSignedTotal + pipelinePondere, 1, 'Charges annuelles complètes');

  // ─── HTML ──────────────────────────────────────────────────────────────
  const html = buildHTML({
    today: TODAY,
    caSignedTotal,
    caSignedToApr,
    wonAllCount: wonAll.length,
    wonBefore0430Count: wonBefore0430.length,
    pipelineBrut,
    pipelinePondere,
    pipelineCount: openDeals.length,
    top10Clients,
    offerRepartition,
    top10Pipeline,
    dealsByStage,
    byStageTotals,
    orgById,
    sig1, sig2, sig3,
  });

  const outPath = path.resolve(process.cwd(), `Reporting_REFORM_${TODAY.toISOString().slice(0, 10)}.html`);
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`✓ Rapport généré : ${outPath}`);

  await sql.end();
  process.exit(0);
}

function buildHTML(d: any): string {
  const top10ClientsHTML = d.top10Clients.map((c: any, i: number) => `
    <tr>
      <td class="rank">${i + 1}</td>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td class="num">${fmt(c.ca)}</td>
      <td class="num pct">${pct(c.ca / d.caSignedTotal)}</td>
    </tr>`).join('');

  const offerHTML = d.offerRepartition.map((o: any) => `
    <tr>
      <td><span class="badge">${escapeHtml(o.offer)}</span></td>
      <td class="num">${o.count}</td>
      <td class="num">${fmt(o.ca)}</td>
      <td class="num pct">${pct(o.pct)}</td>
      <td><div class="bar"><div class="bar-fill" style="width:${(o.pct * 100).toFixed(1)}%"></div></div></td>
    </tr>`).join('');

  const top10PipelineHTML = d.top10Pipeline.map((c: any, i: number) => `
    <tr>
      <td class="rank">${i + 1}</td>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td class="num">${c.count}</td>
      <td class="num">${fmt(c.brut)}</td>
      <td class="num pondere">${fmt(c.pondere)}</td>
    </tr>`).join('');

  const dealsStageHTML = (label: string, deals: any[]) => `
    <div class="stage-block">
      <h4>${label} <span class="count">${deals.length}</span> · <span class="total">${fmt(deals.reduce((s, x) => s + (x.amount ?? 0), 0))}</span></h4>
      ${deals.length === 0 ? '<p class="empty">Aucun</p>' : `
      <table class="compact">
        <thead><tr><th>Client</th><th>Intitulé</th><th>Offre</th><th class="num">Montant</th><th class="num">Proba</th></tr></thead>
        <tbody>
          ${deals.map(dl => {
            const org = d.orgById.get(dl.organizationId);
            return `<tr>
              <td><strong>${escapeHtml(org?.name ?? '—')}</strong></td>
              <td>${escapeHtml(dl.title)}</td>
              <td><span class="badge sm">${escapeHtml(dl.offerType ?? '—')}</span></td>
              <td class="num">${fmt(dl.amount ?? 0)}</td>
              <td class="num">${dl.probability ?? 0}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`}
    </div>`;

  const renderSIG = (sig: any, scenarioNum: number, title: string, subtitle: string) => {
    const gaugePct = Math.min(100, sig.objectifPct * 100);
    const gaugeColor = gaugePct >= 100 ? '#10b981' : gaugePct >= 70 ? '#5F30E2' : gaugePct >= 40 ? '#f59e0b' : '#ef4444';
    return `
    <div class="sig-card">
      <div class="sig-header">
        <div>
          <div class="sig-num">Scénario ${scenarioNum}</div>
          <h3>${title}</h3>
          <p class="sig-sub">${subtitle} · ${sig.periodLabel}</p>
        </div>
      </div>

      <div class="gauge-block">
        <div class="gauge-label">
          <span>Objectif <strong>${fmt(sig.objectifCA)}</strong></span>
          <strong style="color:${gaugeColor}">${fmt(sig.ca)} · ${pct(sig.objectifPct, 1)}</strong>
        </div>
        <div class="gauge">
          <div class="gauge-fill" style="width:${gaugePct}%; background:${gaugeColor};"></div>
        </div>
      </div>

      <table class="sig-table">
        <tr class="pos"><td>Chiffre d'affaires</td><td class="num">${fmt(sig.ca)}</td><td></td></tr>
        <tr class="neg"><td>− Charges externes</td><td class="num">${fmt(sig.chargesExternes)}</td><td class="pct">${pct(sig.chargesExternes / Math.max(sig.ca, 1))}</td></tr>
        <tr class="sub"><td><strong>= Valeur ajoutée</strong></td><td class="num"><strong>${fmt(sig.valeurAjoutee)}</strong></td><td class="pct">${pct(sig.valeurAjoutee / Math.max(sig.ca, 1))}</td></tr>
        <tr class="neg"><td>− Impôts et taxes</td><td class="num">${fmt(sig.impotsEtTaxes)}</td><td class="pct">${pct(sig.impotsEtTaxes / Math.max(sig.ca, 1))}</td></tr>
        <tr class="neg"><td>− Charges de personnel</td><td class="num">${fmt(sig.chargesPersonnel)}</td><td class="pct">${pct(sig.chargesPersonnel / Math.max(sig.ca, 1))}</td></tr>
        <tr class="ebe"><td><strong>= EBE</strong></td><td class="num"><strong>${fmt(sig.ebe)}</strong></td><td class="pct"><strong>${pct(sig.ebePctCa)}</strong></td></tr>
      </table>
    </div>`;
  };

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Reporting REFORM — ${fmtDate(d.today)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --violet: #5F30E2;
    --violet-dark: #4a25b8;
    --violet-light: #f0eafd;
    --ink: #3C3C3B;
    --ink-soft: #212529;
    --gray: #8a8a8a;
    --gray-soft: #a6a5a6;
    --beige: #F6F2EF;
    --mauve: #F8F7FC;
    --border: #ececec;
    --green: #10b981;
    --red: #ef4444;
    --amber: #f59e0b;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Poppins', system-ui, sans-serif; color: var(--ink); background: #fff; line-height: 1.5; }
  h1, h2, h3, h4 { font-family: 'Anton', sans-serif; letter-spacing: 0.01em; font-weight: 400; color: var(--ink); margin: 0; }
  header.top {
    position: relative;
    padding: 48px 48px 56px;
    background:
      radial-gradient(ellipse 70% 60% at 15% 25%, rgba(167, 139, 250, 0.55), transparent 60%),
      radial-gradient(ellipse 65% 80% at 85% 75%, rgba(244, 182, 234, 0.45), transparent 60%),
      radial-gradient(ellipse 80% 50% at 55% 10%, rgba(252, 211, 161, 0.35), transparent 60%),
      radial-gradient(ellipse 60% 70% at 70% 90%, rgba(196, 181, 253, 0.4), transparent 60%),
      #fafaff;
    overflow: hidden;
  }
  header.top::before {
    content: '';
    position: absolute;
    inset: 0;
    backdrop-filter: blur(50px);
    pointer-events: none;
  }
  header.top h1 { position: relative; color: var(--ink); font-size: 64px; line-height: 1; font-weight: 400; }
  header.top .accent { position: relative; color: var(--violet); display: block; font-size: 32px; margin-top: 8px; font-family: 'Anton', sans-serif; }
  header.top .sub { position: relative; color: var(--ink); opacity: 0.6; margin-top: 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 500; }
  nav.tabs { background: white; border-bottom: 1px solid var(--border); padding: 0 48px; display: flex; gap: 4px; position: sticky; top: 0; z-index: 10; }
  nav.tabs button { background: none; border: 0; padding: 18px 24px; font: inherit; font-weight: 500; color: var(--gray); cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s; }
  nav.tabs button:hover { color: var(--ink); }
  nav.tabs button.active { color: var(--violet); border-bottom-color: var(--violet); }
  main { padding: 32px 48px; max-width: 1400px; margin: 0 auto; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .kpi { background: var(--mauve); border-radius: 16px; padding: 24px; }
  .kpi .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gray); font-weight: 500; }
  .kpi .value { font-family: 'Anton', sans-serif; font-size: 36px; line-height: 1.1; margin-top: 8px; }
  .kpi.violet { background: var(--violet-light); }
  .kpi.violet .value { color: var(--violet); }
  .kpi.green { background: #ecfdf5; }
  .kpi.green .value { color: var(--green); }
  .kpi.amber { background: #fef3c7; }
  .kpi.amber .value { color: var(--amber); }
  section.card { background: white; border: 1px solid var(--border); border-radius: 16px; padding: 28px; margin-bottom: 24px; }
  section.card h2 { font-size: 24px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gray); font-weight: 500; background: var(--mauve); }
  thead th.num { text-align: right; }
  tbody td { padding: 14px 16px; border-top: 1px solid var(--border); font-size: 14px; }
  tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody td.pct { color: var(--gray); }
  tbody tr:hover { background: var(--mauve); }
  td.rank { color: var(--gray); font-weight: 600; width: 32px; }
  td.pondere { color: var(--violet); font-weight: 500; }
  .badge { display: inline-block; padding: 4px 10px; background: var(--mauve); color: var(--ink); border-radius: 999px; font-size: 12px; font-weight: 500; }
  .badge.sm { font-size: 11px; padding: 2px 8px; background: var(--violet-light); color: var(--violet); }
  .bar { width: 100%; height: 6px; background: var(--mauve); border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--violet); border-radius: 999px; }
  .stage-block { margin-bottom: 24px; }
  .stage-block h4 { font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; color: var(--violet); }
  .stage-block .count { background: var(--violet); color: white; padding: 2px 10px; border-radius: 999px; font-size: 12px; margin-left: 8px; }
  .stage-block .total { color: var(--gray); font-size: 14px; font-weight: 400; }
  table.compact thead th { padding: 8px 12px; font-size: 10px; }
  table.compact tbody td { padding: 10px 12px; font-size: 13px; }
  .empty { color: var(--gray); font-style: italic; font-size: 13px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  @media (max-width: 1100px) { .sig-grid { grid-template-columns: 1fr; } }
  .sig-card { background: white; border: 2px solid var(--border); border-radius: 20px; padding: 24px; display: flex; flex-direction: column; }
  .sig-header { margin-bottom: 18px; min-height: 88px; }
  .sig-num { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--violet); font-weight: 600; }
  .sig-header h3 { font-size: 22px; margin: 6px 0; line-height: 1.15; }
  .sig-sub { color: var(--gray); font-size: 12px; margin: 0; line-height: 1.4; }
  .gauge-block { background: var(--mauve); border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
  .gauge-label { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--gray); margin-bottom: 8px; }
  .gauge-label strong { color: var(--ink); }
  .gauge { width: 100%; height: 14px; background: white; border-radius: 999px; overflow: hidden; border: 1px solid var(--border); }
  .gauge-fill { height: 100%; border-radius: 999px; transition: width 0.6s; }
  table.sig-table { margin-top: 8px; }
  table.sig-table td { padding: 10px 12px; font-size: 13px; border-top: 1px solid var(--border); }
  table.sig-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.sig-table td.pct { text-align: right; color: var(--gray); width: 64px; font-size: 11px; }
  table.sig-table tr.pos { background: #ecfdf5; }
  table.sig-table tr.neg td:first-child { color: var(--gray); }
  table.sig-table tr.sub { background: var(--mauve); font-weight: 500; }
  table.sig-table tr.ebe { background: var(--violet-light); }
  table.sig-table tr.ebe td { font-size: 14px; color: var(--violet); }
  footer { text-align: center; padding: 32px; color: var(--gray); font-size: 12px; }
  @media print { nav.tabs { display: none; } .tab-content { display: block !important; page-break-after: always; } }
</style>
</head>
<body>
  <header class="top">
    <h1>Reporting</h1>
    <span class="accent">REFORM · ${fmtDate(d.today)}</span>
    <div class="sub">Récap commercial, pipeline & soldes intermédiaires de gestion</div>
  </header>

  <nav class="tabs">
    <button data-tab="ca" class="active">Chiffre d'affaires</button>
    <button data-tab="pipeline">Pipeline</button>
    <button data-tab="sig">Soldes intermédiaires de gestion</button>
  </nav>

  <main>
    <!-- ─── ONGLET CA ─────────────────────────────────────── -->
    <div class="tab-content active" id="tab-ca">
      <div class="kpi-row">
        <div class="kpi green">
          <div class="label">CA signé</div>
          <div class="value">${fmt(d.caSignedTotal)}</div>
        </div>
        <div class="kpi violet">
          <div class="label">Prestations signées</div>
          <div class="value">${d.wonAllCount}</div>
        </div>
        <div class="kpi">
          <div class="label">Panier moyen</div>
          <div class="value">${fmt(d.caSignedTotal / Math.max(d.wonAllCount, 1))}</div>
        </div>
      </div>

      <section class="card">
        <h2>Top 10 clients</h2>
        <table>
          <thead><tr><th></th><th>Client</th><th class="num">CA signé</th><th class="num">% total</th></tr></thead>
          <tbody>${top10ClientsHTML}</tbody>
        </table>
      </section>

      <section class="card">
        <h2>Répartition du CA par offre</h2>
        <table>
          <thead><tr><th>Offre</th><th class="num">Nb</th><th class="num">CA</th><th class="num">%</th><th></th></tr></thead>
          <tbody>${offerHTML}</tbody>
        </table>
      </section>
    </div>

    <!-- ─── ONGLET PIPELINE ──────────────────────────────── -->
    <div class="tab-content" id="tab-pipeline">
      <div class="kpi-row">
        <div class="kpi violet">
          <div class="label">Pipeline brut · total</div>
          <div class="value">${fmt(d.pipelineBrut)}</div>
        </div>
        <div class="kpi violet">
          <div class="label">Pipeline pondéré · total</div>
          <div class="value">${fmt(d.pipelinePondere)}</div>
        </div>
        <div class="kpi">
          <div class="label">Devis en cours</div>
          <div class="value">${d.pipelineCount}</div>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi">
          <div class="label">Propale envoyée · brut</div>
          <div class="value">${fmt(d.byStageTotals.proposal.brut)}</div>
        </div>
        <div class="kpi">
          <div class="label">Propale envoyée · pondéré</div>
          <div class="value">${fmt(d.byStageTotals.proposal.pondere)}</div>
        </div>
        <div class="kpi">
          <div class="label">Premier contact · brut</div>
          <div class="value">${fmt(d.byStageTotals.contacted.brut)}</div>
        </div>
        <div class="kpi">
          <div class="label">Premier contact · pondéré</div>
          <div class="value">${fmt(d.byStageTotals.contacted.pondere)}</div>
        </div>
      </div>

      <section class="card">
        <h2>État des devis en cours</h2>
        ${dealsStageHTML('Propale envoyée', d.dealsByStage.proposal)}
        ${dealsStageHTML('Premier contact', d.dealsByStage.contacted)}
        ${dealsStageHTML('Meeting', d.dealsByStage.meeting)}
        ${dealsStageHTML('À qualifier', d.dealsByStage.to_qualify)}
      </section>

      <section class="card">
        <h2>Top 10 clients potentiels</h2>
        <table>
          <thead><tr><th></th><th>Client potentiel</th><th class="num">Nb devis</th><th class="num">Pipeline brut</th><th class="num">Pipeline pondéré</th></tr></thead>
          <tbody>${top10PipelineHTML}</tbody>
        </table>
      </section>
    </div>

    <!-- ─── ONGLET SIG ───────────────────────────────────── -->
    <div class="tab-content" id="tab-sig">
      <section class="card" style="background: var(--mauve); border: 0;">
        <h2 style="font-size: 20px; margin-bottom: 8px;">Hypothèses de calcul</h2>
        <p style="margin: 0; font-size: 13px; color: var(--gray);">
          <strong style="color: var(--ink)">Charges fixes annuelles (Recrutement 1 exclu)</strong> · Charges externes : <strong>${fmt(TOTAL_CHARGES_EXTERNES)}</strong> ·
          Impôts et taxes : <strong>${fmt(CHARGES.impotsEtTaxes)}</strong> · Personnel : <strong>${fmt(TOTAL_CHARGES_PERSONNEL)}</strong> ·
          <strong style="color: var(--violet)">Total : ${fmt(TOTAL_CHARGES_FIXES)}</strong>
        </p>
      </section>

      <div class="sig-grid">
        ${renderSIG(d.sig1, 1, 'Situation au 30/04/2026', 'CA facturé à fin avril (estimation manuelle)')}
        ${renderSIG(d.sig2, 2, 'Atterrissage au 31/12/2026 signé', `${d.wonAllCount} prestations signées projetées sur l'année`)}
        ${renderSIG(d.sig3, 3, 'Atterrissage au 31/12/2026 signé + pipe pondéré', `${d.wonAllCount} signées + pipeline pondéré`)}
      </div>
    </div>
  </main>

  <footer>
    REFORM — Reporting généré le ${fmtDate(d.today)} · Source : CRM REFORM (Supabase) + SIG REFORM Base
  </footer>

  <script>
    document.querySelectorAll('nav.tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

main().catch(e => { console.error(e); process.exit(1); });
