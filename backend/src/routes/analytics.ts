import { Router, Request, Response } from 'express';
import { getDb } from '../database';
import { DashboardStats, Agent } from '../models/types';

const router = Router();

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

// GET /api/analytics/dashboard
router.get('/dashboard', (_req: Request, res: Response): void => {
  try {
    const db = getDb();

    // Order statistics
    const orderStats = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned_orders,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(CASE WHEN status = 'pending' AND (assigned_agent_id IS NULL OR assigned_agent_id = '') THEN 1 ELSE 0 END) as unassigned_orders,
        SUM(CASE WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as late_deliveries
      FROM orders
    `).get() as any;

    // Agent statistics
    const agentStats = db.prepare(`
      SELECT
        COUNT(*) as total_agents,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_agents,
        SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) as busy_agents
      FROM agents
    `).get() as any;

    // Latest route plans total planned distance
    const latestRun = db.prepare(`
      SELECT id FROM optimization_runs WHERE status = 'completed' ORDER BY created_at DESC LIMIT 1
    `).get() as { id: string } | undefined;

    let totalPlannedDistance = 0;
    if (latestRun) {
      const distRow = db.prepare(`
        SELECT COALESCE(SUM(total_distance), 0) as total_distance
        FROM route_plans
        WHERE optimization_run_id = ?
      `).get(latestRun.id) as { total_distance: number };
      totalPlannedDistance = Math.round(distRow.total_distance * 100) / 100;
    }

    // Agent utilization: current_load / max_capacity
    const agents = db.prepare('SELECT id, current_load, max_capacity, status FROM agents').all() as Agent[];
    const busyAgents = agents.filter((a) => a.status === 'busy');
    const targetAgents = busyAgents.length > 0 ? busyAgents : agents;

    let avgUtilization = 0;
    if (targetAgents.length > 0) {
      const sumUtil = targetAgents.reduce((sum, a) => {
        const util = a.max_capacity > 0 ? a.current_load / a.max_capacity : 0;
        return sum + Math.min(1.0, util);
      }, 0);
      avgUtilization = Math.round((sumUtil / targetAgents.length) * 1000) / 10; // as percentage
    }

    // Workload balance: standard deviation of assigned orders per agent
    const ordersPerAgentRows = db.prepare(`
      SELECT a.id, COUNT(o.id) as assigned_count
      FROM agents a
      LEFT JOIN orders o ON o.assigned_agent_id = a.id AND o.status IN ('assigned', 'in_progress')
      GROUP BY a.id
    `).all() as { id: string; assigned_count: number }[];

    const orderCounts = ordersPerAgentRows.map((r) => r.assigned_count);
    const workloadBalance = calculateStdDev(orderCounts);

    const stats: DashboardStats = {
      total_orders: orderStats.total_orders || 0,
      pending_orders: orderStats.pending_orders || 0,
      assigned_orders: orderStats.assigned_orders || 0,
      in_progress_orders: orderStats.in_progress_orders || 0,
      completed_orders: orderStats.completed_orders || 0,
      cancelled_orders: orderStats.cancelled_orders || 0,
      unassigned_orders: orderStats.unassigned_orders || 0,
      total_agents: agentStats.total_agents || 0,
      available_agents: agentStats.available_agents || 0,
      busy_agents: agentStats.busy_agents || 0,
      late_deliveries: orderStats.late_deliveries || 0,
      total_planned_distance: totalPlannedDistance,
      avg_utilization: avgUtilization,
      workload_balance: workloadBalance,
    };

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve dashboard analytics', details: err.message });
  }
});

// GET /api/analytics/comparison
router.get('/comparison', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const latestRun = db.prepare(`
      SELECT * FROM optimization_runs WHERE status = 'completed' ORDER BY created_at DESC LIMIT 1
    `).get() as any;

    if (!latestRun) {
      res.json({
        has_run: false,
        baseline_distance: 0,
        optimized_distance: 0,
        distance_saved_km: 0,
        distance_saved_pct: 0,
        baseline_duration: 0,
        optimized_duration: 0,
        duration_saved_mins: 0,
        duration_saved_pct: 0,
      });
      return;
    }

    const baselineDist = latestRun.baseline_distance || latestRun.total_distance;
    const optimizedDist = latestRun.total_distance;
    const distSaved = Math.max(0, Math.round((baselineDist - optimizedDist) * 100) / 100);
    const distPct = baselineDist > 0 ? Math.round((distSaved / baselineDist) * 1000) / 10 : 0;

    const baselineDur = latestRun.baseline_duration || latestRun.total_duration;
    const optimizedDur = latestRun.total_duration;
    const durSaved = Math.max(0, Math.round((baselineDur - optimizedDur) * 10) / 10);
    const durPct = baselineDur > 0 ? Math.round((durSaved / baselineDur) * 1000) / 10 : 0;

    res.json({
      has_run: true,
      optimization_run_id: latestRun.id,
      algorithm: latestRun.algorithm,
      baseline_distance: baselineDist,
      optimized_distance: optimizedDist,
      distance_saved_km: distSaved,
      distance_saved_pct: distPct,
      baseline_duration: baselineDur,
      optimized_duration: optimizedDur,
      duration_saved_mins: durSaved,
      duration_saved_pct: durPct,
      computation_time_ms: latestRun.computation_time_ms,
      assigned_orders: latestRun.assigned_orders,
      unassigned_orders: latestRun.unassigned_orders,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve comparison analytics', details: err.message });
  }
});

// GET /api/analytics/agent-utilization
router.get('/agent-utilization', (_req: Request, res: Response): void => {
  try {
    const db = getDb();
    const agents = db.prepare('SELECT * FROM agents ORDER BY name ASC').all() as Agent[];

    const agentOrders = db.prepare(`
      SELECT assigned_agent_id,
             COUNT(*) as order_count,
             COALESCE(SUM(package_weight), 0) as total_weight
      FROM orders
      WHERE status IN ('assigned', 'in_progress') AND assigned_agent_id IS NOT NULL
      GROUP BY assigned_agent_id
    `).all() as { assigned_agent_id: string; order_count: number; total_weight: number }[];

    const orderMap = new Map<string, { order_count: number; total_weight: number }>();
    agentOrders.forEach((o) => orderMap.set(o.assigned_agent_id, o));

    const utilization = agents.map((agent) => {
      const stats = orderMap.get(agent.id);
      const currentLoad = stats ? Math.round(stats.total_weight * 100) / 100 : agent.current_load;
      const assignedCount = stats ? stats.order_count : 0;
      const pct = agent.max_capacity > 0 ? Math.round((currentLoad / agent.max_capacity) * 1000) / 10 : 0;

      return {
        agent_id: agent.id,
        agent_name: agent.name,
        vehicle_type: agent.vehicle_type,
        max_capacity: agent.max_capacity,
        current_load: currentLoad,
        utilization_pct: Math.min(100, pct),
        assigned_orders: assignedCount,
        status: agent.status,
        color: agent.color,
      };
    });

    res.json(utilization);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve agent utilization', details: err.message });
  }
});

// GET /api/analytics/timeline
router.get('/timeline', (_req: Request, res: Response): void => {
  try {
    const db = getDb();

    // Timeline based on hourly completion or time intervals
    const orders = db.prepare(`
      SELECT status, updated_at, deadline, priority
      FROM orders
    `).all() as { status: string; updated_at: string; deadline: string | null; priority: string }[];

    // Group completed into time buckets (or create sample distribution)
    const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
    const completedTotal = orders.filter((o) => o.status === 'completed').length;
    const totalCount = orders.length;

    let runningCompleted = 0;
    const timelineData = hours.map((hour, idx) => {
      const target = Math.round((totalCount / hours.length) * (idx + 1));
      const stepCompleted = Math.round(completedTotal / hours.length);
      runningCompleted += stepCompleted;
      if (idx === hours.length - 1) {
        runningCompleted = completedTotal;
      }

      return {
        time: hour,
        completed: stepCompleted,
        cumulative_completed: Math.min(completedTotal, runningCompleted),
        target: Math.min(totalCount, target),
      };
    });

    res.json(timelineData);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve timeline data', details: err.message });
  }
});

export default router;
