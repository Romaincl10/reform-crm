import { Router } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const activitiesRouter = Router();
activitiesRouter.use(requireAuth);

const activitySchema = z.object({
  organizationId: z.string().min(1),
  dealId: z.string().nullish(),
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  subject: z.string().min(1),
  body: z.string().nullish(),
  occurredAt: z.coerce.date().optional(),
  done: z.boolean().optional(),
});

activitiesRouter.get('/', async (req, res) => {
  const { organizationId } = req.query as { organizationId?: string };
  const rows = organizationId
    ? await db.select().from(schema.activities).where(eq(schema.activities.organizationId, organizationId)).orderBy(desc(schema.activities.occurredAt))
    : await db.select().from(schema.activities).orderBy(desc(schema.activities.occurredAt));
  res.json(rows);
});

activitiesRouter.post('/', async (req, res) => {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  const [row] = await db
    .insert(schema.activities)
    .values({ ...(parsed.data as any), authorId: req.user!.userId })
    .returning();
  res.status(201).json(row);
});

activitiesRouter.patch('/:id', async (req, res) => {
  const parsed = activitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const [row] = await db.update(schema.activities).set(parsed.data as any).where(eq(schema.activities.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

activitiesRouter.delete('/:id', async (req, res) => {
  const result = await db.delete(schema.activities).where(eq(schema.activities.id, req.params.id));
  if ((result as any).rowsAffected === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});
