import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  SimulationEvent,
  SimulationState,
  Order,
  Agent,
  RouteStop,
  Notification,
} from '../models/types';
import { runOptimization } from './optimization-engine';

/**
 * Creates and inserts a notification into the notifications table.
 */
export function createNotification(
  db: Database.Database,
  type: string,
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'error' | 'success' = 'info',
  relatedEntityType?: string,
  relatedEntityId?: string
): Notification {
  const notif: Notification = {
    id: uuidv4(),
    type,
    title,
    message,
    severity,
    is_read: 0,
    related_entity_type: relatedEntityType || null,
    related_entity_id: relatedEntityId || null,
    created_at: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO notifications (
      id, type, title, message, severity, is_read, related_entity_type, related_entity_id, created_at
    ) VALUES (
      @id, @type, @title, @message, @severity, @is_read, @related_entity_type, @related_entity_id, @created_at
    )
  `).run(notif);

  return notif;
}

/**
 * Gets the current simulation state from the database.
 */
export function getSimulationState(db: Database.Database): SimulationState {
  const row = db.prepare('SELECT * FROM simulation_state WHERE id = 1').get() as {
    id: number;
    is_running: number;
    current_time: string | null;
    speed_multiplier: number;
    events: string;
  } | undefined;

  if (!row) {
    db.prepare(`
      INSERT INTO simulation_state (id, is_running, current_time, speed_multiplier, events)
      VALUES (1, 0, datetime('now'), 1.0, '[]')
    `).run();
    return {
      id: 1,
      is_running: false,
      current_time: new Date().toISOString(),
      speed_multiplier: 1.0,
      events: [],
    };
  }

  let parsedEvents: SimulationEvent[] = [];
  try {
    parsedEvents = JSON.parse(row.events || '[]');
  } catch {
    parsedEvents = [];
  }

  return {
    id: row.id,
    is_running: row.is_running === 1,
    current_time: row.current_time,
    speed_multiplier: row.speed_multiplier,
    events: parsedEvents,
  };
}

/**
 * Starts the delivery simulation.
 */
export function startSimulation(
  db: Database.Database,
  speedMultiplier: number = 1.0
): SimulationState {
  const currentState = getSimulationState(db);
  const now = currentState.current_time || new Date().toISOString();

  const startEvent: SimulationEvent = {
    id: uuidv4(),
    type: 'status_change',
    timestamp: now,
    message: `Simulation started at ${speedMultiplier}x speed multiplier`,
  };

  const existingEvents = (currentState.events as SimulationEvent[]) || [];
  const updatedEvents = [startEvent, ...existingEvents.slice(0, 49)];

  db.prepare(`
    UPDATE simulation_state
    SET is_running = 1, speed_multiplier = ?, events = ?
    WHERE id = 1
  `).run(speedMultiplier, JSON.stringify(updatedEvents));

  createNotification(
    db,
    'simulation_start',
    'Simulation Started',
    `Simulation running at ${speedMultiplier}x speed`,
    'info'
  );

  return getSimulationState(db);
}

/**
 * Stops the delivery simulation.
 */
export function stopSimulation(db: Database.Database): SimulationState {
  const currentState = getSimulationState(db);
  const now = currentState.current_time || new Date().toISOString();

  const stopEvent: SimulationEvent = {
    id: uuidv4(),
    type: 'status_change',
    timestamp: now,
    message: 'Simulation paused',
  };

  const existingEvents = (currentState.events as SimulationEvent[]) || [];
  const updatedEvents = [stopEvent, ...existingEvents.slice(0, 49)];

  db.prepare(`
    UPDATE simulation_state
    SET is_running = 0, events = ?
    WHERE id = 1
  `).run(JSON.stringify(updatedEvents));

  createNotification(
    db,
    'simulation_stop',
    'Simulation Paused',
    'Simulation has been stopped',
    'info'
  );

  return getSimulationState(db);
}

/**
 * Resets the simulation state.
 */
export function resetSimulation(db: Database.Database): SimulationState {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE simulation_state
    SET is_running = 0, current_time = ?, speed_multiplier = 1.0, events = '[]'
    WHERE id = 1
  `).run(now);

  createNotification(
    db,
    'simulation_reset',
    'Simulation Reset',
    'Simulation clock and event log reset to defaults',
    'info'
  );

  return getSimulationState(db);
}

/**
 * Advances the simulation by one step.
 */
export function stepSimulation(db: Database.Database): {
  success: boolean;
  currentTime: string;
  events: SimulationEvent[];
  completedCount: number;
} {
  const state = getSimulationState(db);
  const baseDate = state.current_time ? new Date(state.current_time) : new Date();

  // Advance simulation clock by (10 * speed_multiplier) minutes
  const advanceMinutes = Math.max(5, 10 * (state.speed_multiplier || 1.0));
  baseDate.setMinutes(baseDate.getMinutes() + advanceMinutes);
  const newSimTime = baseDate.toISOString();

  // Find latest optimization run
  const latestRun = db
    .prepare('SELECT id FROM optimization_runs WHERE status = ? ORDER BY created_at DESC LIMIT 1')
    .get('completed') as { id: string } | undefined;

  const newEvents: SimulationEvent[] = [];
  let completedCount = 0;

  if (latestRun) {
    const plans = db
      .prepare('SELECT * FROM route_plans WHERE optimization_run_id = ?')
      .all(latestRun.id) as {
      id: string;
      agent_id: string;
      stop_sequence: string;
      total_load: number;
    }[];

    for (const plan of plans) {
      let stops: RouteStop[] = [];
      try {
        stops = JSON.parse(plan.stop_sequence);
      } catch {
        continue;
      }

      if (stops.length === 0) continue;

      const agent = db
        .prepare('SELECT * FROM agents WHERE id = ?')
        .get(plan.agent_id) as Agent | undefined;
      if (!agent || agent.status === 'offline') continue;

      // Find first stop that is not completed or cancelled
      let targetStop: RouteStop | null = null;
      for (const stop of stops) {
        const order = db
          .prepare('SELECT status, deadline, customer_name, package_weight FROM orders WHERE id = ?')
          .get(stop.orderId) as Order | undefined;

        if (order && (order.status === 'assigned' || order.status === 'in_progress')) {
          targetStop = stop;
          break;
        }
      }

      if (targetStop) {
        const order = db
          .prepare('SELECT * FROM orders WHERE id = ?')
          .get(targetStop.orderId) as Order;

        if (order.status === 'assigned') {
          // Transition to in_progress
          db.prepare(`
            UPDATE orders
            SET status = 'in_progress', updated_at = datetime('now')
            WHERE id = ?
          `).run(order.id);

          db.prepare(`
            UPDATE agents
            SET status = 'busy', updated_at = datetime('now')
            WHERE id = ?
          `).run(agent.id);

          const event: SimulationEvent = {
            id: uuidv4(),
            type: 'step',
            timestamp: newSimTime,
            message: `Agent ${agent.name} is en route to deliver Order #${order.id.slice(0, 8)} to ${order.customer_name}`,
            data: { orderId: order.id, agentId: agent.id, status: 'in_progress' },
          };
          newEvents.push(event);
        } else if (order.status === 'in_progress') {
          // Transition to completed
          db.prepare(`
            UPDATE orders
            SET status = 'completed', updated_at = datetime('now')
            WHERE id = ?
          `).run(order.id);

          // Update agent load
          const newLoad = Math.max(0, agent.current_load - order.package_weight);
          db.prepare(`
            UPDATE agents
            SET current_load = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newLoad, agent.id);

          completedCount++;

          // Check deadline violation
          const isLate = order.deadline && new Date(newSimTime) > new Date(order.deadline);

          if (isLate) {
            createNotification(
              db,
              'sla_violation',
              'Delivery SLA Violated',
              `Order #${order.id.slice(0, 8)} for ${order.customer_name} completed past deadline ${order.deadline}`,
              'warning',
              'orders',
              order.id
            );
          } else {
            createNotification(
              db,
              'delivery_completed',
              'Delivery Completed',
              `Order #${order.id.slice(0, 8)} for ${order.customer_name} delivered successfully by ${agent.name}`,
              'success',
              'orders',
              order.id
            );
          }

          const event: SimulationEvent = {
            id: uuidv4(),
            type: 'complete_delivery',
            timestamp: newSimTime,
            message: `Agent ${agent.name} delivered Order #${order.id.slice(0, 8)} to ${order.customer_name}${isLate ? ' (Delayed)' : ''}`,
            data: { orderId: order.id, agentId: agent.id, status: 'completed', isLate },
          };
          newEvents.push(event);

          // Check if agent has finished all remaining stops
          const remainingAssigned = db
            .prepare("SELECT COUNT(*) as count FROM orders WHERE assigned_agent_id = ? AND status IN ('assigned','in_progress')")
            .get(agent.id) as { count: number };

          if (remainingAssigned.count === 0) {
            db.prepare("UPDATE agents SET status = 'available', current_load = 0 WHERE id = ?").run(agent.id);
            createNotification(
              db,
              'route_completed',
              'Route Completed',
              `Agent ${agent.name} completed all scheduled deliveries and returned to depot`,
              'info',
              'agents',
              agent.id
            );
          }
        }
      }
    }
  }

  // Update simulation state with new time and merged events
  const existingEvents = (state.events as SimulationEvent[]) || [];
  const mergedEvents = [...newEvents, ...existingEvents].slice(0, 50);

  db.prepare(`
    UPDATE simulation_state
    SET current_time = ?, events = ?
    WHERE id = 1
  `).run(newSimTime, JSON.stringify(mergedEvents));

  return {
    success: true,
    currentTime: newSimTime,
    events: newEvents,
    completedCount,
  };
}

/**
 * Injects a dynamic real-time event and handles re-optimization if necessary.
 */
export function injectSimulationEvent(
  db: Database.Database,
  eventInput: {
    type: 'new_order' | 'cancel_order' | 'agent_unavailable' | 'delay' | 'complete_delivery';
    data: any;
  }
): { success: boolean; event: SimulationEvent; reoptimizationResult?: any } {
  const state = getSimulationState(db);
  const now = state.current_time || new Date().toISOString();
  let reoptResult: any = undefined;

  let eventMessage = '';

  switch (eventInput.type) {
    case 'new_order': {
      const orderData = eventInput.data;
      const orderId = orderData.id || uuidv4();
      db.prepare(`
        INSERT INTO orders (
          id, customer_name, delivery_address, latitude, longitude,
          package_weight, service_duration, priority, deadline, status,
          time_window_start, time_window_end, special_instructions, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, datetime('now'), datetime('now')
        )
      `).run(
        orderId,
        orderData.customer_name || 'Dynamic Customer',
        orderData.delivery_address || 'MG Road, Bangalore',
        orderData.latitude || 12.975,
        orderData.longitude || 77.605,
        orderData.package_weight || 5.0,
        orderData.service_duration || 10,
        orderData.priority || 'high',
        orderData.deadline || null,
        orderData.time_window_start || null,
        orderData.time_window_end || null,
        orderData.special_instructions || 'Dynamic order injected via simulation'
      );

      eventMessage = `New incoming delivery request received for ${orderData.customer_name || 'Customer'}`;
      createNotification(
        db,
        'new_order',
        'New On-Demand Order',
        eventMessage,
        'info',
        'orders',
        orderId
      );

      // Trigger automatic re-optimization
      reoptResult = triggerReoptimization(db, 'new_order', orderId);
      break;
    }

    case 'cancel_order': {
      const orderId = eventInput.data.order_id || eventInput.data.id;
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Order | undefined;
      if (order) {
        db.prepare("UPDATE orders SET status = 'cancelled', assigned_agent_id = NULL, updated_at = datetime('now') WHERE id = ?").run(orderId);
        eventMessage = `Delivery for ${order.customer_name} cancelled by customer`;
        createNotification(
          db,
          'order_cancelled',
          'Delivery Cancelled',
          eventMessage,
          'warning',
          'orders',
          orderId
        );
        reoptResult = triggerReoptimization(db, 'cancel_order', orderId);
      }
      break;
    }

    case 'agent_unavailable': {
      const agentId = eventInput.data.agent_id || eventInput.data.id;
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as Agent | undefined;
      if (agent) {
        db.prepare("UPDATE agents SET status = 'offline', updated_at = datetime('now') WHERE id = ?").run(agentId);
        // Unassign uncompleted orders assigned to this agent
        db.prepare("UPDATE orders SET status = 'pending', assigned_agent_id = NULL WHERE assigned_agent_id = ? AND status = 'assigned'").run(agentId);

        eventMessage = `Agent ${agent.name} broke down / went offline`;
        createNotification(
          db,
          'agent_offline',
          'Agent Unavailable',
          eventMessage,
          'error',
          'agents',
          agentId
        );
        reoptResult = triggerReoptimization(db, 'agent_unavailable', undefined, agentId);
      }
      break;
    }

    case 'delay': {
      const agentId = eventInput.data.agent_id;
      const delayMinutes = eventInput.data.delay_minutes || 20;
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as Agent | undefined;
      eventMessage = `Traffic congestion alert: ${agent ? agent.name : 'Agent'} delayed by ${delayMinutes} minutes`;
      createNotification(
        db,
        'traffic_delay',
        'Route Delay Reported',
        eventMessage,
        'warning',
        'agents',
        agentId
      );
      break;
    }

    case 'complete_delivery': {
      const orderId = eventInput.data.order_id || eventInput.data.id;
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Order | undefined;
      if (order) {
        db.prepare("UPDATE orders SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(orderId);
        eventMessage = `Delivery to ${order.customer_name} marked completed`;
        createNotification(
          db,
          'delivery_completed',
          'Delivery Completed',
          eventMessage,
          'success',
          'orders',
          orderId
        );
      }
      break;
    }
  }

  const simEvent: SimulationEvent = {
    id: uuidv4(),
    type: eventInput.type,
    timestamp: now,
    message: eventMessage,
    data: eventInput.data,
  };

  const existingEvents = (state.events as SimulationEvent[]) || [];
  const updatedEvents = [simEvent, ...existingEvents.slice(0, 49)];

  db.prepare('UPDATE simulation_state SET events = ? WHERE id = 1').run(
    JSON.stringify(updatedEvents)
  );

  return {
    success: true,
    event: simEvent,
    reoptimizationResult: reoptResult,
  };
}

/**
 * Re-runs optimization while preserving completed deliveries.
 */
export function triggerReoptimization(
  db: Database.Database,
  triggerEvent: string,
  affectedOrderId?: string,
  affectedAgentId?: string
) {
  // Fetch pending and assigned orders
  const candidateOrders = db
    .prepare("SELECT * FROM orders WHERE status IN ('pending', 'assigned')")
    .all() as Order[];

  // Fetch available and busy agents
  const eligibleAgents = db
    .prepare("SELECT * FROM agents WHERE status IN ('available', 'busy')")
    .all() as Agent[];

  if (candidateOrders.length === 0 || eligibleAgents.length === 0) {
    return null;
  }

  const result = runOptimization(candidateOrders, eligibleAgents, {
    reoptimize: true,
  });

  // Save optimization run
  const insertRun = db.prepare(`
    INSERT INTO optimization_runs (
      id, status, algorithm, total_orders, assigned_orders, unassigned_orders,
      total_distance, total_duration, total_travel_time, objective_value,
      computation_time_ms, solution_quality, baseline_distance, baseline_duration,
      improvement_pct, config, created_at, is_reoptimization, trigger_event
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, ?
    )
  `);

  insertRun.run(
    result.id,
    result.status,
    result.algorithm,
    candidateOrders.length,
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
    JSON.stringify({ reoptimize: true }),
    triggerEvent
  );

  // Save route plans and update order assignments
  const insertPlan = db.prepare(`
    INSERT INTO route_plans (
      id, optimization_run_id, agent_id, stop_sequence, total_distance,
      total_duration, total_load, departure_time, estimated_completion, status, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', datetime('now')
    )
  `);

  const updateOrderAssignment = db.prepare(`
    UPDATE orders
    SET assigned_agent_id = ?, status = 'assigned', updated_at = datetime('now')
    WHERE id = ? AND status != 'completed' AND status != 'in_progress'
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
        updateOrderAssignment.run(route.agent_id, stop.orderId);
      }

      // Update agent current load
      db.prepare("UPDATE agents SET current_load = ?, status = 'busy', updated_at = datetime('now') WHERE id = ?").run(
        route.total_load,
        route.agent_id
      );
    }
  });

  tx();

  createNotification(
    db,
    'reoptimization_complete',
    'Dynamic Re-optimization Completed',
    `Routes dynamically updated due to: ${triggerEvent}. ${result.metrics.assigned_orders} orders reassigned across ${result.routes.length} agents.`,
    'info',
    'optimization_runs',
    result.id
  );

  return result;
}
