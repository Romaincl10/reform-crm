// Migration PostgreSQL idempotente — exécutée au start Railway (npm run start)
import 'dotenv/config';
import { sql } from './client.js';

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prospect',
  siren TEXT,
  spk BOOLEAN NOT NULL DEFAULT FALSE,
  spk_pulse BOOLEAN NOT NULL DEFAULT FALSE,
  industry TEXT,
  size TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  zipcode TEXT,
  country TEXT DEFAULT 'France',
  notes TEXT,
  owner_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'to_qualify',
  offer_type TEXT,
  amount REAL,
  probability INTEGER DEFAULT 0,
  expected_close_at TIMESTAMPTZ,
  service_start_at TIMESTAMPTZ,
  service_end_at TIMESTAMPTZ,
  invoice_date_1 TIMESTAMPTZ,
  invoice_amount_1 REAL,
  invoice_date_2 TIMESTAMPTZ,
  invoice_amount_2 REAL,
  invoice_date_3 TIMESTAMPTZ,
  invoice_amount_3 REAL,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  owner_id TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id TEXT REFERENCES deals(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done BOOLEAN NOT NULL DEFAULT TRUE,
  author_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id TEXT REFERENCES deals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  offer_type TEXT,
  spk BOOLEAN NOT NULL DEFAULT FALSE,
  spk_pulse BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  invoice_status TEXT NOT NULL DEFAULT 'to_invoice',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  invoiced_amount REAL,
  invoice_ref TEXT,
  invoice_date_1 TIMESTAMPTZ,
  invoice_amount_1 REAL,
  invoice_date_2 TIMESTAMPTZ,
  invoice_amount_2 REAL,
  invoice_date_3 TIMESTAMPTZ,
  invoice_amount_3 REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  engagement_id TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  invoice_ref TEXT,
  status TEXT NOT NULL DEFAULT 'to_invoice',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orgs_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_orgs_siren ON organizations(siren);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_engagements_org ON engagements(organization_id);
CREATE INDEX IF NOT EXISTS idx_milestones_eng ON milestones(engagement_id);
CREATE INDEX IF NOT EXISTS idx_payments_milestone ON payments(milestone_id);
`;

console.log('→ Application du schéma PostgreSQL…');
await sql.unsafe(DDL);
console.log('✓ Schéma appliqué.');

await sql.end();
process.exit(0);
