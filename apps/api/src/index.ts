import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { orgsRouter } from './routes/organizations.js';
import { contactsRouter } from './routes/contacts.js';
import { dealsRouter } from './routes/deals.js';
import { activitiesRouter } from './routes/activities.js';
import { engagementsRouter } from './routes/engagements.js';
import { milestonesRouter } from './routes/milestones.js';
import { paymentsRouter } from './routes/payments.js';
import { importRouter } from './routes/import.js';
import { exportRouter } from './routes/export.js';
import { applySchema } from './db/migrate-all.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/organizations', orgsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/engagements', engagementsRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);

// En prod, sert aussi le build du front (apps/web/dist) — single process Railway
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA fallback : tout ce qui n'est pas /api/* renvoie index.html
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
  console.log('→ Front statique servi depuis', webDist);
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error', message: err.message });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✓ REFORM CRM API listening on port ${port}`);
  // Le serveur écoute déjà → /health répond immédiatement et le healthcheck Railway passe,
  // sans attendre le cold-start Supabase. La migration (idempotente) tourne ensuite, en tâche de fond.
  applySchema()
    .then(() => console.log('✓ Migration DB terminée'))
    .catch((err) => console.error('✗ Migration DB abandonnée (le serveur reste up) :', err.message));
});
