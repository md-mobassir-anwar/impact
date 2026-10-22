import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { Order, Agent, RoutePlan, RouteStop, OptimizationResult } from '../models/types';
import { runOptimization } from '../services/optimization-engine';
import { triggerReoptimization, createNotification } from '../services/simulation-service';

const router = Router();

// POST /api/optimize/run
router.post('/run', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const config = req.body || {};

    const orders = db.prepare('SELECT * FROM orders').all() as Order[];
    const agents = db.prepare('SELECT * FROM agents').all() as Agent[];

    const result = runOptimization(orders, agents, config);

    // Save optimization run
    const insertRun = db.prepare(`
      INSERT INTO optimization_runs (
        id, status, algorithm, total_orders, assigned_orders, unassigned_orders,
        total_distance, total_duration, total_travel_time, objective_value,
        computation_time_ms, solution_quality, baseline_distance, baseline_duration,
        improvement_pct, config, created_at, is_reoptimization, trigger_event
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0, NULL
      )
    `);

    insertRun.run(
      result.id,
      result.status,
      result.algorithm,
      orders.length,
      result.metrics.assigned_orders,
      result.metrics.unassigned_orders,
      result.metrics.total_distance,
      result.metrics.total_duration,
      result.metrics.total_travel_time,
      result.metrics.objective_value,
      result.metrics.computation_time_ms,
      result.metrics.solution_quality,
      result.metrics.baseline_distance,
      result.metrics.baseline_duration,
      result.metrics.improvement_pct,
      JSON.stringify(config)
    );

    // Save route plans
    const insertPlan = db.prepare(`
      INSERT INTO route_plans (
        id, optimization_run_id, agent_id, stop_sequence, total_distance,
        total_duration, total_load, departure_time, estimated_completion, status, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', datetime('now')
      )
    `);

    const updateOrder = db.prepare(`
      UPDATE orders
      SET assigned_agent_id = ?, status = 'assigned', updated_at = datetime('now')
      WHERE id = ? AND status != 'completed'
    `);

    const tx = db.transaction(() => {
      for (const route of result.routes) {
        insertPlan.run(
          route.id,
          result.id,
          route.agent_id,
          JSON.stringify(route.stops || route.stop_sequence),
          route.total_distance,
          route.total_duration,
          route.total_load,
          route.departure_time,
          route.estimated_completion
        );

        const stops = (route.stops || route.stop_sequence) as RouteStop[];
        for (const stop of stops) {
          updateOrder.run(route.agent_id, stop.orderId);
        }

        db.prepare("UPDATE agents SET current_load = ?, status = 'busy', updated_at = datetime('now') WHERE id = ?").run(
          route.total_load,
          route.agent_id
        );
      }
    });

    tx();

    createNotification(
      db,
      'optimization_success',
      'Optimization Completed',
      `Optimized ${result.metrics.assigned_orders} deliveries across ${result.routes.length} agents in ${result.metrics.computation_time_ms}ms with ${result.metrics.improvement_pct}% improvement.`,
      'success',
      'optimization_runs',
      result.id
    );

    if (result.unassigned.length > 0) {
      createNotification(
        db,
        'unassigned_orders',
        'Unassigned Orders Alert',
        `${result.unassigned.length} orders could not be feasibly assigned due to capacity or deadline constraints.`,
        'warning',
        'optimization_runs',
        result.id
      );
    }

    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Optimization failed', details: err.message });
  }
});

// GET /api/optimize/history
router.get('/history', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { page = '1', page_size = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(page_size as string, 10) || 20));
    const offset = (pageNum - 1) * limit;

    const totalRow = db
      .prepare('SELECT COUNT(*) as total FROM optimization_runs')
      .get() as { total: number };

    const runs = db
      .prepare('SELECT * FROM optimization_runs ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset);

    res.json({
      runs,
      total: totalRow.total,
      page: pageNum,
      pageSize: limit,
      totalPages: Math.ceil(totalRow.total / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve optimization history', details: err.message });
  }
});

// GET /api/optimize/current
router.get('/current', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const latestRun = db
      .prepare('SELECT * FROM optimization_runs WHERE status = ? ORDER BY created_at DESC LIMIT 1')
      .get('completed') as any;

    if (!latestRun) {
      res.status(404).json({ error: 'No completed optimization run found' });
      return;
    }

    const plans = db
      .prepare('SELECT * FROM route_plans WHERE optimization_run_id = ?')
      .all(latestRun.id) as any[];

    const enrichedPlans: RoutePlan[] = plans.map((p) => {
      let stops: RouteStop[] = [];
      try {
        stops = JSON.parse(p.stop_sequence);
      } catch {
        stops = [];
      }

      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(p.agent_id) as Agent | undefined;

      return {
        ...p,
        stop_sequence: stops,
        stops,
        agent,
      };
    });

    const result: OptimizationResult = {
      id: latestRun.id,
      status: latestRun.status,
      algorithm: latestRun.algorithm,
      routes: enrichedPlans,
      unassigned: [],
      metrics: {
        total_distance: latestRun.total_distance,
        total_duration: latestRun.total_duration,
        total_travel_time: latestRun.total_travel_time,
        assigned_orders: latestRun.assigned_orders,
        unassigned_orders: latestRun.unassigned_orders,
        objective_value: latestRun.objective_value,
        computation_time_ms: latestRun.computation_time_ms,
        solution_quality: latestRun.solution_quality,
        baseline_distance: latestRun.baseline_distance || 0,
        baseline_duration: latestRun.baseline_duration || 0,
        improvement_pct: latestRun.improvement_pct || 0,
      },
      created_at: latestRun.created_at,
    };

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve current optimization', details: err.message });
  }
});

// GET /api/optimize/history/:id
router.get('/history/:id', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const run = db
      .prepare('SELECT * FROM optimization_runs WHERE id = ?')
      .get(req.params.id) as any;

    if (!run) {
      res.status(404).json({ error: 'Optimization run not found' });
      return;
    }

    const plans = db
      .prepare('SELECT * FROM route_plans WHERE optimization_run_id = ?')
      .all(run.id) as any[];

    const enrichedPlans = plans.map((p) => {
      let stops: RouteStop[] = [];
      try {
        stops = JSON.parse(p.stop_sequence);
      } catch {
        stops = [];
      }
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(p.agent_id) as Agent | undefined;
      return {
        ...p,
        stop_sequence: stops,
        stops,
        agent,
      };
    });

    res.json({
      ...run,
      routes: enrichedPlans,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve optimization run', details: err.message });
  }
});

// POST /api/optimize/reoptimize
router.post('/reoptimize', (req: Request, res: Response): void => {
  try {
    const db = getDb();
    const { trigger_event = 'manual_reoptimization', affected_order_id, affected_agent_id } = req.body;

    const result = triggerReoptimization(db, trigger_event, affected_order_id, affected_agent_id);

    if (!result) {
      res.status(400).json({ error: 'No eligible orders or agents available to reoptimize' });
      return;
    }

    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Re-optimization failed', details: err.message });
  }
});

export default router;
