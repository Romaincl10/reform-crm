import { db, schema, sql } from './client.js';

const orgs = await db.select().from(schema.organizations);
const deals = await db.select().from(schema.deals);
const engs = await db.select().from(schema.engagements);
const users = await db.select().from(schema.users);

const prospects = orgs.filter(o => o.status === 'prospect').length;
const clients = orgs.filter(o => o.status === 'client').length;

console.log('═══════════════════════════════════════════');
console.log('  ÉTAT DE LA BASE — REFORM CRM PROD');
console.log('═══════════════════════════════════════════');
console.log(`  Utilisateurs   : ${users.length}`);
console.log(`  Organisations  : ${orgs.length} (${prospects} prospects · ${clients} clients)`);
console.log(`  Deals          : ${deals.length}`);
console.log(`  Prestations    : ${engs.length}`);
console.log('');

const byStage: Record<string, { count: number; total: number }> = {};
for (const d of deals) {
  const k = d.stage;
  if (!byStage[k]) byStage[k] = { count: 0, total: 0 };
  byStage[k].count++;
  byStage[k].total += d.amount ?? 0;
}
console.log('Deals par étape :');
for (const [stg, st] of Object.entries(byStage).sort()) {
  console.log(`  ${stg.padEnd(12)} : ${String(st.count).padStart(3)} · ${st.total.toLocaleString('fr-FR').padStart(12)} €`);
}

const totalAmount = deals.reduce((s, d) => s + (d.amount ?? 0), 0);
const pipelineOpen = deals.filter(d => !['won', 'lost'].includes(d.stage)).reduce((s, d) => s + (d.amount ?? 0), 0);
const pipelineWeighted = deals
  .filter(d => !['won', 'lost'].includes(d.stage))
  .reduce((s, d) => s + ((d.amount ?? 0) * (d.probability ?? 0)) / 100, 0);
const wonAmount = deals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.amount ?? 0), 0);

console.log('');
console.log('Montants :');
console.log(`  Pipeline brut (open)    : ${pipelineOpen.toLocaleString('fr-FR')} €`);
console.log(`  Pipeline pondéré        : ${pipelineWeighted.toLocaleString('fr-FR')} €`);
console.log(`  CA gagné (won)          : ${wonAmount.toLocaleString('fr-FR')} €`);
console.log(`  Total deals             : ${totalAmount.toLocaleString('fr-FR')} €`);

await sql.end();
process.exit(0);
