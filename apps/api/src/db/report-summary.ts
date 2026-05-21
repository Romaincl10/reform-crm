import { db, schema, sql } from './client.js';

const deals = await db.select().from(schema.deals);
const wonAll = deals.filter(d => d.stage === 'won');
const wonBefore = wonAll.filter(d => d.closedAt && new Date(d.closedAt) <= new Date('2026-04-30T23:59:59'));
const openDeals = deals.filter(d => !['won', 'lost'].includes(d.stage));

const caSignTot = wonAll.reduce((s, d) => s + (d.amount ?? 0), 0);
const caSignApr = wonBefore.reduce((s, d) => s + (d.amount ?? 0), 0);
const pipeBrut = openDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
const pipePond = openDeals.reduce((s, d) => s + ((d.amount ?? 0) * (d.probability ?? 0)) / 100, 0);

// Charges (Recrutement 1 exclu)
const CHE = 1320 + 100757;
const CIT = 1797;
const CP = (62652 - 16252) + (22433 - 7315) + 63156 + 26526;
const TOT = CHE + CIT + CP;

console.log('═══════════════════════════════════════════════');
console.log('  STATS CRM ACTUELLES');
console.log('═══════════════════════════════════════════════');
console.log(`  CA signé total       : ${caSignTot.toLocaleString('fr-FR')} € (${wonAll.length} prestas)`);
console.log(`  CA signé avant 30/04 : ${caSignApr.toLocaleString('fr-FR')} € (${wonBefore.length} prestas)`);
console.log(`  Pipeline brut        : ${pipeBrut.toLocaleString('fr-FR')} € (${openDeals.length} devis)`);
console.log(`  Pipeline pondéré     : ${pipePond.toLocaleString('fr-FR')} €`);
console.log('');
console.log('  CHARGES FIXES ANNUELLES (Recrutement 1 exclu)');
console.log(`    Charges externes     : ${CHE.toLocaleString('fr-FR')} €`);
console.log(`    Impôts et taxes      : ${CIT.toLocaleString('fr-FR')} €`);
console.log(`    Charges de personnel : ${CP.toLocaleString('fr-FR')} €`);
console.log(`    TOTAL                : ${TOT.toLocaleString('fr-FR')} €`);
console.log('');

const calc = (ca: number, period: number, label: string) => {
  const che = CHE * period;
  const cit = CIT * period;
  const cp = CP * period;
  const va = ca - che;
  const ebe = va - cit - cp;
  const objPct = (ca / 380000) * 100;
  console.log(`  ${label}`);
  console.log(`    CA              : ${ca.toLocaleString('fr-FR').padStart(12)} €   ${objPct.toFixed(1)}% obj. 380k`);
  console.log(`    Charges ext     : ${che.toLocaleString('fr-FR', { maximumFractionDigits: 0 }).padStart(12)} €`);
  console.log(`    Valeur ajoutée  : ${va.toLocaleString('fr-FR', { maximumFractionDigits: 0 }).padStart(12)} €`);
  console.log(`    Impôts & taxes  : ${cit.toLocaleString('fr-FR', { maximumFractionDigits: 0 }).padStart(12)} €`);
  console.log(`    Personnel       : ${cp.toLocaleString('fr-FR', { maximumFractionDigits: 0 }).padStart(12)} €`);
  console.log(`    EBE             : ${ebe.toLocaleString('fr-FR', { maximumFractionDigits: 0 }).padStart(12)} €   ${((ebe/Math.max(ca,1))*100).toFixed(1)}% du CA`);
  console.log('');
};

console.log('═══════════════════════════════════════════════');
console.log('  SCÉNARIO 1 — CA au 30/04/2026 + 4 mois de charges');
console.log('═══════════════════════════════════════════════');
calc(caSignApr, 4 / 12, '');

console.log('═══════════════════════════════════════════════');
console.log('  SCÉNARIO 2 — Tout le CA signé + charges annuelles');
console.log('═══════════════════════════════════════════════');
calc(caSignTot, 1, '');

console.log('═══════════════════════════════════════════════');
console.log('  SCÉNARIO 3 — CA signé + pipeline pondéré + charges annuelles');
console.log('═══════════════════════════════════════════════');
calc(caSignTot + pipePond, 1, '');

await sql.end();
process.exit(0);
