import express from 'express';
import { Client } from 'pg';

export const healthRouter = express.Router();

healthRouter.get('/', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'SalonPilot API'
  });
});

healthRouter.get('/supabase', async (_req, res) => {
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(500).json({ ok: false, error: 'DATABASE_URL missing' });
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  } finally {
    await client.end().catch(() => {});
  }
});