import { Router } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const dealsRouter = Router();
dealsRouter.use(requireAuth);

const STAGES = ['to_qualify', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost'] as const;

const dealSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1),
  stage: z.enum(STAGES).optional(),
  offerType: z.string().nullish(),
  amount: z.number().nullish(),
  probability: z.number().int().min(0).max(100).nullish(),
  expectedCloseAt: z.coerce.date().nullish(),
  serviceStartAt: z.coerce.date().nullish(),
  serviceEndAt: z.coerce.date().nullish(),
  invoiceDate1: z.coerce.date().nullish(),
  invoiceAmount1: z.number().nullish(),
  invoiceDate2: z.coerce.date().nullish(),
  invoiceAmount2: z.number().nullish(),
  invoiceDate3: z.coerce.date().nullish(),
  invoiceAmount3: z.number().nullish(),
  closedAt: z.coerce.date().nullish(),
  lostReason: z.string().nullish(),
  ownerId: z.string().nullish(),
  notes: z.string().nullish(),
});

dealsRouter.get('/', async (_req, res) => {
  const rows = await db.select().from(schema.deals).orderBy(desc(schema.deals.updatedAt));
  res.json(rows);
});

dealsRouter.post('/', async (req, res) => {
  const parsed = dealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  const [row] = await db.insert(schema.deals).values(parsed.data as any).returning();
  res.status(201).json(row);
});

dealsRouter.patch('/:id', async (req, res) => {
  const parsed = dealSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  const data: any = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.stage === 'won' || parsed.data.stage === 'lost') {
    data.closedAt = data.closedAt ?? new Date();
  }
  const [row] = await db.update(schema.deals).set(data).where(eq(schema.deals.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: 'not_found' });

  // Transformation automatique en client si stage = won
  if (row.stage === 'won') {
    // 1. Bascule orga → client
    await db.update(schema.organizations)
      .set({ status: 'client', updatedAt: new Date() })
      .where(eq(schema.organizations.id, row.organizationId));

    // 2. Crée engagement si pas déjà fait pour ce deal
    const existing = await db.select().from(schema.engagements).where(eq(schema.engagements.dealId, row.id));
    if (existing.length === 0) {
      const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, row.organizationId));
      await db.insert(schema.engagements).values({
        organizationId: row.organizationId,
        dealId: row.id,
        title: row.title,
        totalAmount: row.amount ?? 0,
        offerType: row.offerType ?? null,
        spk: org?.spk ?? false,
        spkPulse: org?.spkPulse ?? false,
        status: 'active',
        invoiceStatus: 'to_invoice',
        startedAt: row.serviceStartAt ?? null,
        endedAt: row.serviceEndAt ?? null,
        invoiceDate1: row.invoiceDate1 ?? null,
        invoiceAmount1: row.invoiceAmount1 ?? null,
        invoiceDate2: row.invoiceDate2 ?? null,
        invoiceAmount2: row.invoiceAmount2 ?? null,
        invoiceDate3: row.invoiceDate3 ?? null,
        invoiceAmount3: row.invoiceAmount3 ?? null,
      } as any);
    }
  }

  res.json(row);
});

dealsRouter.delete('/:id', async (req, res) => {
  const result = await db.delete(schema.deals).where(eq(schema.deals.id, req.params.id));
  if ((result as any).rowsAffected === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});
