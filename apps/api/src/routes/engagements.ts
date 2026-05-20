import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const engagementsRouter = Router();
engagementsRouter.use(requireAuth);

const engagementSchema = z.object({
  organizationId: z.string().min(1),
  dealId: z.string().nullish(),
  title: z.string().min(1),
  description: z.string().nullish(),
  offerType: z.string().nullish(),
  spk: z.boolean().optional(),
  spkPulse: z.boolean().optional(),
  totalAmount: z.number().default(0),
  paidAmount: z.number().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  invoiceStatus: z.enum(['to_invoice', 'invoiced', 'partially_paid', 'paid']).optional(),
  startedAt: z.coerce.date().nullish(),
  endedAt: z.coerce.date().nullish(),
  invoicedAt: z.coerce.date().nullish(),
  invoicedAmount: z.number().nullish(),
  invoiceRef: z.string().nullish(),
  invoiceDate1: z.coerce.date().nullish(),
  invoiceAmount1: z.number().nullish(),
  invoiceDate2: z.coerce.date().nullish(),
  invoiceAmount2: z.number().nullish(),
  invoiceDate3: z.coerce.date().nullish(),
  invoiceAmount3: z.number().nullish(),
});

engagementsRouter.get('/', async (req, res) => {
  const { organizationId } = req.query as { organizationId?: string };
  const rows = organizationId
    ? await db.select().from(schema.engagements).where(eq(schema.engagements.organizationId, organizationId)).orderBy(desc(schema.engagements.updatedAt))
    : await db.select().from(schema.engagements).orderBy(desc(schema.engagements.updatedAt));
  res.json(rows);
});

engagementsRouter.get('/:id', async (req, res) => {
  const [engagement] = await db.select().from(schema.engagements).where(eq(schema.engagements.id, req.params.id));
  if (!engagement) return res.status(404).json({ error: 'not_found' });
  const milestones = await db.select().from(schema.milestones).where(eq(schema.milestones.engagementId, engagement.id));
  const milestoneIds = milestones.map(m => m.id);
  const payments = milestoneIds.length
    ? await db.select().from(schema.payments).where(inArray(schema.payments.milestoneId, milestoneIds))
    : [];
  res.json({ ...engagement, milestones, payments });
});

engagementsRouter.post('/', async (req, res) => {
  const parsed = engagementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  const [row] = await db.insert(schema.engagements).values(parsed.data as any).returning();
  res.status(201).json(row);
});

engagementsRouter.patch('/:id', async (req, res) => {
  const parsed = engagementSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const [row] = await db
    .update(schema.engagements)
    .set({ ...(parsed.data as any), updatedAt: new Date() })
    .where(eq(schema.engagements.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

engagementsRouter.delete('/:id', async (req, res) => {
  const result = await db.delete(schema.engagements).where(eq(schema.engagements.id, req.params.id));
  if ((result as any).rowsAffected === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});
