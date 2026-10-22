import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { loadDemoData, resetDemoData, isDemoDataLoaded } from '../services/demo-data';
import { Notification } from '../models/types';

const router = Router();

// GET /api/settings
router.get('/', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value, updated_at FROM settings').all() as {
      key: string;
      value: string;
      updated_at: string;
    }[];

    const settingsObj: Record<string, string> = {};
    rows.forEach((r) => {
      settingsObj[r.key] = r.value;
    });

    res.json(settingsObj);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve settings', details: err.message });
  }
});

// PUT /api/settings
router.put('/', (req: Request, res: Response): void => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({ error: 'Expected key-value object of settings' });
      return;
    }

    const db = getDb();
    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `);

    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        upsertStmt.run(key, String(value));
      }
    });

    tx();

    // Return updated settings
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    rows.forEach((r) => {
      result[r.key] = r.value;
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings', details: err.message });
  }
});

// POST /api/settings/demo/load
router.post('/demo/load', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const result = loadDemoData(db);
    res.json({
      success: true,
      message: `Demo dataset loaded: ${result.agentsLoaded} agents, ${result.ordersLoaded} orders`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load demo data', details: err.message });
  }
});

// POST /api/settings/demo/reset
router.post('/demo/reset', (req: Request, res: Response): void => {
  try {
    const { confirm } = req.body;
    if (confirm !== true && confirm !== 'true') {
      res.status(400).json({
        error: 'Confirmation required. Pass { confirm: true } to reset all database records.',
      });
      return;
    }

    const db = getDb();
    const result = resetDemoData(db);

    res.json({
      success: true,
      message: `Database successfully reset to demo state: ${result.agentsLoaded} agents, ${result.ordersLoaded} orders`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset demo data', details: err.message });
  }
});

// GET /api/notifications
router.get('/notifications', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { unread_only } = req.query;

    let query = 'SELECT * FROM notifications';
    const params: any[] = [];

    if (unread_only === 'true' || unread_only === '1') {
      query += ' WHERE is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const notifs = db.prepare(query).all(...params) as Notification[];
    res.json(notifs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve notifications', details: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);

    if (!notif) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark notification as read', details: err.message });
  }
});

// PATCH /api/notifications/read-all
router.patch('/notifications/read-all', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const info = db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
    res.json({ message: 'All notifications marked as read', modified: info.changes });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark all notifications as read', details: err.message });
  }
});

export default router;
