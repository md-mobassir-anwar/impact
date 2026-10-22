"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const simulation_service_1 = require("../services/simulation-service");
const router = (0, express_1.Router)();
// GET /api/simulation/state
router.get('/state', (_req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const state = (0, simulation_service_1.getSimulationState)(db);
        res.json(state);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve simulation state', details: err.message });
    }
});
// POST /api/simulation/start
router.post('/start', (req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const speedMultiplier = req.body.speed_multiplier ? Number(req.body.speed_multiplier) : 1.0;
        const state = (0, simulation_service_1.startSimulation)(db, speedMultiplier);
        res.json(state);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to start simulation', details: err.message });
    }
});
// POST /api/simulation/stop
router.post('/stop', (_req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const state = (0, simulation_service_1.stopSimulation)(db);
        res.json(state);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to stop simulation', details: err.message });
    }
});
// POST /api/simulation/step
router.post('/step', (_req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const result = (0, simulation_service_1.stepSimulation)(db);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to advance simulation step', details: err.message });
    }
});
// POST /api/simulation/reset
router.post('/reset', (_req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const state = (0, simulation_service_1.resetSimulation)(db);
        res.json(state);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to reset simulation', details: err.message });
    }
});
// POST /api/simulation/event
router.post('/event', (req, res) => {
    try {
        const { type, data } = req.body;
        const allowedTypes = ['new_order', 'cancel_order', 'agent_unavailable', 'delay', 'complete_delivery'];
        if (!type || !allowedTypes.includes(type)) {
            res.status(400).json({
                error: `Event type must be one of: ${allowedTypes.join(', ')}`,
            });
            return;
        }
        const db = (0, database_1.getDb)();
        const result = (0, simulation_service_1.injectSimulationEvent)(db, { type, data: data || {} });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to inject simulation event', details: err.message });
    }
});
// GET /api/simulation/events
router.get('/events', (_req, res) => {
    try {
        const db = (0, database_1.getDb)();
        const state = (0, simulation_service_1.getSimulationState)(db);
        res.json(state.events || []);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to get simulation events', details: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=simulation.js.map