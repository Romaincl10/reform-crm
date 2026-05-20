import { Router } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const orgsRouter = Router();
orgsRouter.use(requireAuth);

const orgSchema = z.object({
  name: z.string().min(1),
  status: z.enum(['prospect', 'client', 'inactive']).optional(),
  siren: z.string().nullish(),
  spk: z.boolean().optional(),
  spkPulse: z.boolean().optional(),
  industry: z.string().nullish(),
  size: z.string().nullish(),
  website: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  zipcode: z.string().nullish(),
  country: z.string().nullish(),
  notes: z.string().nullish(),
  ownerId: z.string().nullish(),
});

orgsRouter.get('/', async (req, res) => {
  const { status } = req.query as { status?: string };
  const rows = status
    ? await db.select().from(schema.organizations).where(eq(schema.organizations.status, status as any)).orderBy(desc(schema.organizations.updatedAt))
    : await db.select().from(schema.organizations).orderBy(desc(schema.organizations.updatedAt));
  res.json(rows);
});

orgsRouter.get('/:id', async (req, res) => {
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, req.params.id));
  if (!org) return res.status(404).json({ error: 'not_found' });

  const [contacts, deals, activities, engagements] = await Promise.all([
    db.select().from(schema.contacts).where(eq(schema.contacts.organizationId, org.id)),
    db.select().from(schema.deals).where(eq(schema.deals.organizationId, org.id)).orderBy(desc(schema.deals.updatedAt)),
    db.select().from(schema.activities).where(eq(schema.activities.organizationId, org.id)).orderBy(desc(schema.activities.occurredAt)),
    db.select().from(schema.engagements).where(eq(schema.engagements.organizationId, org.id)),
  ]);

  res.json({ ...org, contacts, deals, activities, engagements });
});

orgsRouter.post('/', async (req, res) => {
  const parsed = orgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  const [row] = await db.insert(schema.organizations).values(parsed.data as any).returning();
  res.status(201).json(row);
});

orgsRouter.patch('/:id', async (req, res) => {
  const parsed = orgSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  const [row] = await db
    .update(schema.organizations)
    .set({ ...(parsed.data as any), updatedAt: new Date() })
    .where(eq(schema.organizations.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

orgsRouter.delete('/:id', async (req, res) => {
  const result = await db.delete(schema.organizations).where(eq(schema.organizations.id, req.params.id));
  if ((result as any).rowsAffected === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});
