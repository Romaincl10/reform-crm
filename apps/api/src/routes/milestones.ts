import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const milestonesRouter = Router();
milestonesRouter.use(requireAuth);

const milestoneSchema = z.object({
  engagementId: z.string().min(1),
  label: z.string().min(1),
  amount: z.number(),
  dueDate: z.coerce.date().nullish(),
  invoicedAt: z.coerce.date().nullish(),
  invoiceRef: z.string().nullish(),
  status: z.enum(['to_invoice', 'invoiced', 'paid', 'overdue']).optional(),
  notes: z.string().nullish(),
});

milestonesRouter.post('/', async (req, res) => {
  const parsed = milestoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  const [row] = await db.insert(schema.milestones).values(parsed.data as any).returning();
  res.status(201).json(row);
});

milestonesRouter.patch('/:id', async (req, res) => {
  const parsed = milestoneSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const data: any = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.status === 'invoiced' && !parsed.data.invoicedAt) {
    data.invoicedAt = new Date();
  }
  const [row] = await db.update(schema.milestones).set(data).where(eq(schema.milestones.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

milestonesRouter.delete('/:id', async (req, res) => {
  const result = await db.delete(schema.milestones).where(eq(schema.milestones.id, req.params.id));
  if ((result as any).rowsAffected === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});
