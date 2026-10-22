import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { Agent, CreateAgentInput, UpdateAgentInput, AgentStatus, Order } from '../models/types';

const router = Router();
const VALID_STATUSES: AgentStatus[] = ['available', 'busy', 'offline', 'on_break'];

function validateTimeFormat(timeStr?: string): boolean {
  if (!timeStr) return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
}

function validateAgentInput(input: any): { valid: boolean; error?: string } {
  if (!input.name || typeof input.name !== 'string' || input.name.trim() === '') {
    return { valid: false, error: 'name is required' };
  }
  if (input.latitude === undefined || input.latitude === null || isNaN(Number(input.latitude))) {
    return { valid: false, error: 'latitude must be a valid number' };
  }
  const lat = Number(input.latitude);
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'latitude must be between -90 and 90' };
  }

  if (input.longitude === undefined || input.longitude === null || isNaN(Number(input.longitude))) {
    return { valid: false, error: 'longitude must be a valid number' };
  }
  const lon = Number(input.longitude);
  if (lon < -180 || lon > 180) {
    return { valid: false, error: 'longitude must be between -180 and 180' };
  }

  if (input.max_capacity !== undefined) {
    const cap = Number(input.max_capacity);
    if (isNaN(cap) || cap <= 0) {
      return { valid: false, error: 'max_capacity must be a positive number greater than 0' };
    }
  }

  if (input.shift_start && !validateTimeFormat(input.shift_start)) {
    return { valid: false, error: 'shift_start must be in valid HH:MM format (24-hour)' };
  }
  if (input.shift_end && !validateTimeFormat(input.shift_end)) {
    return { valid: false, error: 'shift_end must be in valid HH:MM format (24-hour)' };
  }

  if (input.status && !VALID_STATUSES.includes(input.status)) {
    return { valid: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` };
  }

  return { valid: true };
}

// GET /api/agents
router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { status } = req.query;

    let query = 'SELECT * FROM agents';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY name ASC';

    const agents = db.prepare(query).all(...params) as Agent[];

    const agentStats = db.prepare(`
      SELECT assigned_agent_id,
             COUNT(*) as order_count,
             COALESCE(SUM(package_weight), 0) as total_weight
      FROM orders
      WHERE status IN ('assigned', 'in_progress') AND assigned_agent_id IS NOT NULL
      GROUP BY assigned_agent_id
    `).all() as { assigned_agent_id: string; order_count: number; total_weight: number }[];

    const statsMap = new Map<string, { order_count: number; total_weight: number }>();
    agentStats.forEach((s) => statsMap.set(s.assigned_agent_id, s));

    const enrichedAgents = agents.map((agent) => {
      const stats = statsMap.get(agent.id);
      const computedLoad = stats ? Math.round(stats.total_weight * 100) / 100 : agent.current_load;
      const assignedCount = stats ? stats.order_count : 0;

      return {
        ...agent,
        current_load: computedLoad,
        assigned_orders: assignedCount,
      };
    });

    res.json(enrichedAgents);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve agents', details: err.message });
  }
});

// GET /api/agents/:id
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as Agent | undefined;

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const assignedOrders = db
      .prepare("SELECT * FROM orders WHERE assigned_agent_id = ? AND status IN ('assigned', 'in_progress') ORDER BY created_at ASC")
      .all(agent.id) as Order[];

    const totalWeight = assignedOrders.reduce((sum, o) => sum + (o.package_weight || 0), 0);

    res.json({
      ...agent,
      current_load: Math.round(totalWeight * 100) / 100,
      assigned_orders: assignedOrders.length,
      orders: assignedOrders,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve agent', details: err.message });
  }
});

// POST /api/agents
router.post('/', (req: Request, res: Response): void => {
  try {
    const validation = validateAgentInput(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    const newAgent: Agent = {
      id,
      name: req.body.name.trim(),
      depot_address: req.body.depot_address ? req.body.depot_address.trim() : 'Depot Hub',
      latitude: Number(req.body.latitude),
      longitude: Number(req.body.longitude),
      vehicle_type: req.body.vehicle_type || 'van',
      max_capacity: req.body.max_capacity !== undefined ? Number(req.body.max_capacity) : 100.0,
      max_volume: req.body.max_volume !== undefined ? Number(req.body.max_volume) : null,
      shift_start: req.body.shift_start || '08:00',
      shift_end: req.body.shift_end || '18:00',
      status: req.body.status || 'available',
      current_load: 0,
      color: req.body.color || '#3B82F6',
      created_at: now,
      updated_at: now,
      is_demo_data: req.body.is_demo_data ? 1 : 0,
      assigned_orders: 0,
    };

    db.prepare(`
      INSERT INTO agents (
        id, name, depot_address, latitude, longitude,
        vehicle_type, max_capacity, max_volume, shift_start,
        shift_end, status, current_load, color, created_at, updated_at, is_demo_data
      ) VALUES (
        @id, @name, @depot_address, @latitude, @longitude,
        @vehicle_type, @max_capacity, @max_volume, @shift_start,
        @shift_end, @status, @current_load, @color, @created_at, @updated_at, @is_demo_data
      )
    `).run(newAgent);

    res.status(201).json(newAgent);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create agent', details: err.message });
  }
});

// PUT /api/agents/:id
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as Agent | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const validation = validateAgentInput(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const updated: Agent = {
      ...existing,
      name: req.body.name !== undefined ? req.body.name.trim() : existing.name,
      depot_address: req.body.depot_address !== undefined ? req.body.depot_address.trim() : existing.depot_address,
      latitude: req.body.latitude !== undefined ? Number(req.body.latitude) : existing.latitude,
      longitude: req.body.longitude !== undefined ? Number(req.body.longitude) : existing.longitude,
      vehicle_type: req.body.vehicle_type !== undefined ? req.body.vehicle_type : existing.vehicle_type,
      max_capacity: req.body.max_capacity !== undefined ? Number(req.body.max_capacity) : existing.max_capacity,
      max_volume: req.body.max_volume !== undefined ? Number(req.body.max_volume) : existing.max_volume,
      shift_start: req.body.shift_start !== undefined ? req.body.shift_start : existing.shift_start,
      shift_end: req.body.shift_end !== undefined ? req.body.shift_end : existing.shift_end,
      status: req.body.status !== undefined ? req.body.status : existing.status,
      color: req.body.color !== undefined ? req.body.color : existing.color,
      updated_at: new Date().toISOString(),
    };

    db.prepare(`
      UPDATE agents SET
        name = @name,
        depot_address = @depot_address,
        latitude = @latitude,
        longitude = @longitude,
        vehicle_type = @vehicle_type,
        max_capacity = @max_capacity,
        max_volume = @max_volume,
        shift_start = @shift_start,
        shift_end = @shift_end,
        status = @status,
        color = @color,
        updated_at = @updated_at
      WHERE id = @id
    `).run(updated);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update agent', details: err.message });
  }
});

// DELETE /api/agents/:id
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as Agent | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const assignedCount = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE assigned_agent_id = ? AND status IN ('assigned', 'in_progress')")
      .get(req.params.id) as { count: number };

    if (assignedCount.count > 0) {
      res.status(409).json({
        error: `Cannot delete agent with ${assignedCount.count} assigned or in-progress deliveries. Unassign or complete them first.`,
      });
      return;
    }

    db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
    res.json({ message: 'Agent deleted successfully', id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete agent', details: err.message });
  }
});

// PATCH /api/agents/:id/status
router.patch('/:id/status', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as Agent | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    let warning: string | undefined = undefined;

    const assignedCount = db
      .prepare("SELECT COUNT(*) as count FROM orders WHERE assigned_agent_id = ? AND status IN ('assigned', 'in_progress')")
      .get(req.params.id) as { count: number };

    if (status === 'offline' && assignedCount.count > 0) {
      warning = `Agent has ${assignedCount.count} active or in-progress deliveries that need re-assignment`;
    }

    db.prepare("UPDATE agents SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      status,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as Agent;

    res.json({
      ...updated,
      assigned_orders: assignedCount.count,
      warning,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update agent status', details: err.message });
  }
});

export default router;
