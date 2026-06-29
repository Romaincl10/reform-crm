import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { comparePassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

// Accepte un email complet OU un username court (ex. "germain.butrot")
const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

// Message clair quand la base est injoignable (ex: projet Supabase en pause)
const DB_UNAVAILABLE = 'Service temporairement indisponible (base de données). Réessayez dans une minute.';

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });

  const { email, password } = parsed.data;
  try {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase()));
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (err: any) {
    console.error('login DB error:', err.code || err.message);
    res.status(503).json({ error: DB_UNAVAILABLE });
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user!.userId));
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
  } catch (err: any) {
    console.error('me DB error:', err.code || err.message);
    res.status(503).json({ error: DB_UNAVAILABLE });
  }
});
