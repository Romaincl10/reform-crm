import { Router } from 'express';
import { db, schema } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, async (_req, res) => {
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, fullName: schema.users.fullName, role: schema.users.role })
    .from(schema.users);
  res.json(rows);
});
