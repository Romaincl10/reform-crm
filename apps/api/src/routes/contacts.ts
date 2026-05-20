import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

const contactSchema = z.object({
  organizationId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal('').transform(() => null)),
  phone: z.string().nullish(),
  isPrimary: z.boolean().optional(),
  notes: z.string().nullish(),
});

contactsRouter.post('/', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  const [row] = await db.insert(schema.contacts).values(parsed.data as any).returning();
  res.status(201).json(row);
});

contactsRouter.patch('/:id', async (req, res) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const [row] = await db
    .update(schema.contacts)
    .set({ ...(parsed.data as any), updatedAt: new Date() })
    .where(eq(schema.contacts.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

contactsRouter.delete('/:id', async (req, res) => {
  const result = await db.delete(schema.contacts).where(eq(schema.contacts.id, req.params.id));
  if ((result as any).rowsAffected === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});
