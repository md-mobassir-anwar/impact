"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const demo_data_1 = require("../services/demo-data");
const router = (0, express_1.Router)();
// GET /api/settings
router.get('/', (_req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const rows = db.prepare('SELECT key, value, updated_at FROM settings').all();
        const settingsObj = {};
        rows.forEach((r) => {
            settingsObj[r.key] = r.value;
        });
        res.json(settingsObj);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve settings', details: err.message });
    }
});
// PUT /api/settings
router.put('/', (req, res) => {
    try {
        const updates = req.body;
        if (!updates || typeof updates !== 'object') {
            res.status(400).json({ error: 'Expected key-value object of settings' });
            return;
        }
        const db = (0, database_1.getDb)();
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
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const result = {};
        rows.forEach((r) => {
            result[r.key] = r.value;
        });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update settings', details: err.message });
    }
});
// POST /api/settings/demo/load
router.post('/demo/load', (_req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const result = (0, demo_data_1.loadDemoData)(db);
        res.json({
            success: true,
            message: `Demo dataset loaded: ${result.agentsLoaded} agents, ${result.ordersLoaded} orders`,
            ...result,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to load demo data', details: err.message });
    }
});
// POST /api/settings/demo/reset
router.post('/demo/reset', (req, res) => {
    try {
        const { confirm } = req.body;
        if (confirm !== true && confirm !== 'true') {
            res.status(400).json({
                error: 'Confirmation required. Pass { confirm: true } to reset all database records.',
            });
            return;
        }
        const db = (0, database_1.getDb)();
        const result = (0, demo_data_1.resetDemoData)(db);
        res.json({
            success: true,
            message: `Database successfully reset to demo state: ${result.agentsLoaded} agents, ${result.ordersLoaded} orders`,
            ...result,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to reset demo data', details: err.message });
    }
});
// GET /api/notifications
router.get('/notifications', (req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const { unread_only } = req.query;
        let query = 'SELECT * FROM notifications';
        const params = [];
        if (unread_only === 'true' || unread_only === '1') {
            query += ' WHERE is_read = 0';
        }
        query += ' ORDER BY created_at DESC LIMIT 100';
        const notifs = db.prepare(query).all(...params);
        res.json(notifs);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve notifications', details: err.message });
    }
});
// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', (req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
        if (!notif) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
        const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to mark notification as read', details: err.message });
    }
});
// PATCH /api/notifications/read-all
router.patch('/notifications/read-all', (_req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const info = db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
        res.json({ message: 'All notifications marked as read', modified: info.changes });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to mark all notifications as read', details: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map