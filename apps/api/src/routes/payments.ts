import { Router } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const paymentSchema = z.object({
  milestoneId: z.string().min(1),
  amount: z.number(),
  receivedAt: z.coerce.date().optional(),
  method: z.string().nullish(),
  reference: z.string().nullish(),
  notes: z.string().nullish(),
});

paymentsRouter.post('/', async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });

  const [milestone] = await db.select().from(schema.milestones).where(eq(schema.milestones.id, parsed.data.milestoneId));
  if (!milestone) return res.status(404).json({ error: 'milestone_not_found' });

  const [row] = await db.insert(schema.payments).values(parsed.data as any).returning();

  const totalPaidRows = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.payments.amount}), 0)` })
    .from(schema.payments)
    .where(eq(schema.payments.milestoneId, milestone.id));
  const totalPaid = totalPaidRows[0]?.total ?? 0;

  if (totalPaid >= milestone.amount) {
    await db.update(schema.milestones)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(schema.milestones.id, milestone.id));
  }

  res.status(201).json(row);
});

paymentsRouter.delete('/:id', async (req, res) => {
  const result = await db.delete(schema.payments).where(eq(schema.payments.id, req.params.id));
  if ((result as any).rowsAffected === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});
