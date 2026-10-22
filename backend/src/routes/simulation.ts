import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import {
  getSimulationState,
  startSimulation,
  stopSimulation,
  resetSimulation,
  stepSimulation,
  injectSimulationEvent,
} from '../services/simulation-service';
import { SimulationEvent } from '../models/types';

const router = Router();

// GET /api/simulation/state
router.get('/state', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const state = getSimulationState(db);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve simulation state', details: err.message });
  }
});

// POST /api/simulation/start
router.post('/start', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const speedMultiplier = req.body.speed_multiplier ? Number(req.body.speed_multiplier) : 1.0;
    const state = startSimulation(db, speedMultiplier);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to start simulation', details: err.message });
  }
});

// POST /api/simulation/stop
router.post('/stop', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const state = stopSimulation(db);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to stop simulation', details: err.message });
  }
});

// POST /api/simulation/step
router.post('/step', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const result = stepSimulation(db);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to advance simulation step', details: err.message });
  }
});

// POST /api/simulation/reset
router.post('/reset', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const state = resetSimulation(db);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset simulation', details: err.message });
  }
});

// POST /api/simulation/event
router.post('/event', (req: Request, res: Response): void => {
  try {
    const { type, data } = req.body;
    const allowedTypes = ['new_order', 'cancel_order', 'agent_unavailable', 'delay', 'complete_delivery'];

    if (!type || !allowedTypes.includes(type)) {
      res.status(400).json({
        error: `Event type must be one of: ${allowedTypes.join(', ')}`,
      });
      return;
    }

    const db = getDb();
    const result = injectSimulationEvent(db, { type, data: data || {} });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to inject simulation event', details: err.message });
  }
});

// GET /api/simulation/events
router.get('/events', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const state = getSimulationState(db);
    res.json((state.events as SimulationEvent[]) || []);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get simulation events', details: err.message });
  }
});

export default router;
