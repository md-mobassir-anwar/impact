import { v4 as uuidv4 } from 'uuid';
import {
  Order,
  Agent,
  RoutePlan,
  RouteStop,
  OptimizationResult,
  OptimizationConfig,
  UnassignedReason,
  OptimizationMetrics,
} from '../models/types';
import { roadDistance, haversineDistance } from './routing-service';

interface StopNode {
  order: Order;
  distanceFromPrev: number;
  durationFromPrev: number;
  arrivalTimeMinutes: number;
  departureTimeMinutes: number;
  arrivalTimeIso: string;
  departureTimeIso: string;
  cumulativeLoad: number;
}

interface EvaluatedRoute {
  agent: Agent;
  stops: StopNode[];
  totalDistance: number;
  totalDuration: number;
  totalTravelTime: number;
  totalLoad: number;
  departureTimeMinutes: number;
  completionTimeMinutes: number;
  latenessMinutes: number;
}

/**
 * Parses time string (either HH:MM or ISO timestamp) into minutes from midnight of reference date.
 */
function parseTimeToMinutes(
  timeStr: string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!timeStr) return null;

  // Check if it's HH:MM format
  const hhMmMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (hhMmMatch) {
    const hours = parseInt(hhMmMatch[1], 10);
    const minutes = parseInt(hhMmMatch[2], 10);
    return hours * 60 + minutes;
  }

  // Otherwise try parsing as full ISO date
  const parsedDate = new Date(timeStr);
  if (!isNaN(parsedDate.getTime())) {
    // Check if on same day or calculate relative minutes from start of referenceDate's day
    const refDayStart = new Date(referenceDate);
    refDayStart.setHours(0, 0, 0, 0);

    const diffMinutes = Math.round(
      (parsedDate.getTime() - refDayStart.getTime()) / 60000
    );
    return diffMinutes;
  }

  return null;
}

/**
 * Formats minutes from midnight into ISO date string for reference date.
 */
function minutesToIso(minutesFromMidnight: number, referenceDate: Date = new Date()): string {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(Math.round(minutesFromMidnight));
  return date.toISOString();
}

/**
 * Calculates standard deviation.
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculates objective function value:
 * Minimize: total_distance * 1.0 + total_lateness * 10.0 + workload_imbalance * 5.0
 * Where workload_imbalance = std_dev(orders_per_agent) / mean(orders_per_agent) if mean > 0
 */
function calculateObjective(routes: EvaluatedRoute[]): number {
  const totalDistance = routes.reduce((sum, r) => sum + r.totalDistance, 0);
  const totalLateness = routes.reduce((sum, r) => sum + r.latenessMinutes, 0);

  const orderCounts = routes.map((r) => r.stops.length);
  const meanOrders =
    orderCounts.length > 0
      ? orderCounts.reduce((sum, c) => sum + c, 0) / orderCounts.length
      : 0;
  const stdDevOrders = calculateStdDev(orderCounts);
  const workloadImbalance = meanOrders > 0 ? stdDevOrders / meanOrders : 0;

  return (
    Math.round((totalDistance * 1.0 + totalLateness * 10.0 + workloadImbalance * 5.0) * 100) /
    100
  );
}

/**
 * Evaluates route feasibility and timing for a given sequence of orders for an agent.
 */
function evaluateRouteSequence(
  agent: Agent,
  orderedOrders: Order[],
  speedKmh: number,
  roadFactor: number,
  referenceDate: Date
): EvaluatedRoute | null {
  const shiftStartMin = parseTimeToMinutes(agent.shift_start, referenceDate) ?? 8 * 60; // 08:00
  const shiftEndMin = parseTimeToMinutes(agent.shift_end, referenceDate) ?? 18 * 60; // 18:00

  let currentLat = agent.latitude;
  let currentLon = agent.longitude;
  let currentTime = shiftStartMin;
  let currentLoad = 0;
  let totalDistance = 0;
  let totalTravelTime = 0;
  let totalLateness = 0;

  const stops: StopNode[] = [];

  for (let i = 0; i < orderedOrders.length; i++) {
    const order = orderedOrders[i];

    // Capacity check
    if (currentLoad + order.package_weight > agent.max_capacity) {
      return null;
    }

    const { distance, duration } = roadDistance(
      currentLat,
      currentLon,
      order.latitude,
      order.longitude,
      speedKmh,
      roadFactor
    );

    let arrivalTime = currentTime + duration;
    totalDistance += distance;
    totalTravelTime += duration;

    // Time window check
    const twStartMin = parseTimeToMinutes(order.time_window_start, referenceDate);
    const twEndMin = parseTimeToMinutes(order.time_window_end, referenceDate);

    if (twStartMin !== null && arrivalTime < twStartMin) {
      // Agent arrives early, waits until window opens
      arrivalTime = twStartMin;
    }

    if (twEndMin !== null && arrivalTime > twEndMin) {
      // Arrived after time window closed -> infeasible
      return null;
    }

    // Deadline check
    const deadlineMin = parseTimeToMinutes(order.deadline, referenceDate);
    if (deadlineMin !== null) {
      if (arrivalTime > deadlineMin) {
        // Late delivery
        const lateness = arrivalTime - deadlineMin;
        totalLateness += lateness;
        // Strictly treat deadline as hard constraint unless lateness is small (< 0)
        // If deadline is hard constraint:
        return null;
      }
    }

    const serviceDuration = order.service_duration || 10;
    const departureTime = arrivalTime + serviceDuration;

    // Shift end check: agent must finish service before shift ends
    if (departureTime > shiftEndMin) {
      return null;
    }

    currentLoad += order.package_weight;
    currentTime = departureTime;
    currentLat = order.latitude;
    currentLon = order.longitude;

    stops.push({
      order,
      distanceFromPrev: distance,
      durationFromPrev: duration,
      arrivalTimeMinutes: arrivalTime,
      departureTimeMinutes: departureTime,
      arrivalTimeIso: minutesToIso(arrivalTime, referenceDate),
      departureTimeIso: minutesToIso(departureTime, referenceDate),
      cumulativeLoad: currentLoad,
    });
  }

  const totalDuration = currentTime - shiftStartMin;

  return {
    agent,
    stops,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalDuration: Math.round(totalDuration * 10) / 10,
    totalTravelTime: Math.round(totalTravelTime * 10) / 10,
    totalLoad: Math.round(currentLoad * 100) / 100,
    departureTimeMinutes: shiftStartMin,
    completionTimeMinutes: currentTime,
    latenessMinutes: totalLateness,
  };
}

/**
 * Diagnoses why an order cannot be assigned to an agent or any agent.
 */
function diagnoseInfeasibility(
  order: Order,
  agents: Agent[],
  speedKmh: number,
  roadFactor: number,
  referenceDate: Date
): string {
  if (agents.length === 0) {
    return 'No available agents';
  }

  const maxAgentCapacity = Math.max(...agents.map((a) => a.max_capacity));
  if (order.package_weight > maxAgentCapacity) {
    return `Exceeds capacity of all available agents (${order.package_weight}kg > max ${maxAgentCapacity}kg)`;
  }

  // Check deadline relative to shift start / current time
  const deadlineMin = parseTimeToMinutes(order.deadline, referenceDate);
  const earliestShiftStart = Math.min(
    ...agents.map((a) => parseTimeToMinutes(a.shift_start, referenceDate) ?? 8 * 60)
  );

  if (deadlineMin !== null && deadlineMin < earliestShiftStart) {
    return `Cannot meet deadline (${order.deadline}) with any agent: deadline is before earliest shift start`;
  }

  // Check direct travel from depot
  let canAnyAgentReachDirectly = false;
  for (const agent of agents) {
    if (agent.max_capacity < order.package_weight) continue;
    const shiftStart = parseTimeToMinutes(agent.shift_start, referenceDate) ?? 8 * 60;
    const shiftEnd = parseTimeToMinutes(agent.shift_end, referenceDate) ?? 18 * 60;
    const { duration } = roadDistance(
      agent.latitude,
      agent.longitude,
      order.latitude,
      order.longitude,
      speedKmh,
      roadFactor
    );

    const arrival = shiftStart + duration;
    const departure = arrival + (order.service_duration || 10);

    const twStart = parseTimeToMinutes(order.time_window_start, referenceDate);
    const twEnd = parseTimeToMinutes(order.time_window_end, referenceDate);
    const effectiveArrival = twStart !== null ? Math.max(arrival, twStart) : arrival;

    if (twEnd !== null && effectiveArrival > twEnd) continue;
    if (deadlineMin !== null && effectiveArrival > deadlineMin) continue;
    if (departure > shiftEnd) continue;

    canAnyAgentReachDirectly = true;
    break;
  }

  if (!canAnyAgentReachDirectly) {
    if (deadlineMin !== null) {
      return `Cannot meet deadline with any agent`;
    }
    return `Outside all agents' shift hours or time window constraints`;
  }

  return `Cannot be scheduled feasibly without violating capacity, time window, or shift constraints`;
}

/**
 * Runs 2-opt intra-route improvement on a route.
 */
function optimizeIntraRoute2Opt(
  evaluatedRoute: EvaluatedRoute,
  speedKmh: number,
  roadFactor: number,
  referenceDate: Date,
  maxIterations: number = 50
): EvaluatedRoute {
  let bestRoute = evaluatedRoute;
  let currentOrders = evaluatedRoute.stops.map((s) => s.order);

  if (currentOrders.length <= 2) {
    return evaluatedRoute;
  }

  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (let i = 0; i < currentOrders.length - 1; i++) {
      for (let j = i + 1; j < currentOrders.length; j++) {
        // Reverse subsegment from i to j
        const newOrderSequence = [
          ...currentOrders.slice(0, i),
          ...currentOrders.slice(i, j + 1).reverse(),
          ...currentOrders.slice(j + 1),
        ];

        const testEvaluation = evaluateRouteSequence(
          evaluatedRoute.agent,
          newOrderSequence,
          speedKmh,
          roadFactor,
          referenceDate
        );

        if (testEvaluation && testEvaluation.totalDistance < bestRoute.totalDistance - 0.001) {
          bestRoute = testEvaluation;
          currentOrders = newOrderSequence;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return bestRoute;
}

/**
 * Runs inter-route moves (relocating orders between agents) to improve the overall objective.
 */
function optimizeInterRouteMoves(
  routes: EvaluatedRoute[],
  speedKmh: number,
  roadFactor: number,
  referenceDate: Date,
  maxRounds: number = 20
): EvaluatedRoute[] {
  let currentRoutes = [...routes];
  let bestObjective = calculateObjective(currentRoutes);

  let improved = true;
  let round = 0;

  while (improved && round < maxRounds) {
    improved = false;
    round++;

    for (let fromIdx = 0; fromIdx < currentRoutes.length; fromIdx++) {
      const fromRoute = currentRoutes[fromIdx];
      if (fromRoute.stops.length === 0) continue;

      for (let stopIdx = 0; stopIdx < fromRoute.stops.length; stopIdx++) {
        const orderToMove = fromRoute.stops[stopIdx].order;

        for (let toIdx = 0; toIdx < currentRoutes.length; toIdx++) {
          if (fromIdx === toIdx) continue;
          const toRoute = currentRoutes[toIdx];

          // Check if orderToMove exceeds toRoute agent capacity
          if (toRoute.totalLoad + orderToMove.package_weight > toRoute.agent.max_capacity) {
            continue;
          }

          // Try inserting orderToMove at all possible positions in toRoute
          const toOrders = toRoute.stops.map((s) => s.order);
          for (let insertPos = 0; insertPos <= toOrders.length; insertPos++) {
            const newToOrders = [
              ...toOrders.slice(0, insertPos),
              orderToMove,
              ...toOrders.slice(insertPos),
            ];

            const evalTo = evaluateRouteSequence(
              toRoute.agent,
              newToOrders,
              speedKmh,
              roadFactor,
              referenceDate
            );

            if (!evalTo) continue;

            const newFromOrders = fromRoute.stops
              .map((s) => s.order)
              .filter((_, idx) => idx !== stopIdx);

            const evalFrom = evaluateRouteSequence(
              fromRoute.agent,
              newFromOrders,
              speedKmh,
              roadFactor,
              referenceDate
            );

            if (!evalFrom) continue;

            const candidateRoutes = [...currentRoutes];
            candidateRoutes[fromIdx] = evalFrom;
            candidateRoutes[toIdx] = evalTo;

            const candidateObjective = calculateObjective(candidateRoutes);

            if (candidateObjective < bestObjective - 0.01) {
              currentRoutes = candidateRoutes;
              bestObjective = candidateObjective;
              improved = true;
              break;
            }
          }

          if (improved) break;
        }

        if (improved) break;
      }

      if (improved) break;
    }
  }

  return currentRoutes;
}

/**
 * Main optimization entry point.
 */
export function runOptimization(
  orders: Order[],
  agents: Agent[],
  config: OptimizationConfig = {}
): OptimizationResult {
  const startTime = performance.now();
  const runId = uuidv4();
  const speedKmh = config.defaultSpeedKmh || 40;
  const roadFactor = config.roadFactor || 1.3;
  const referenceDate = new Date();

  // Filter eligible agents (available or busy if reoptimizing)
  const availableAgents = agents.filter((a) => {
    if (config.excludeAgentIds && config.excludeAgentIds.includes(a.id)) {
      return false;
    }
    return a.status === 'available' || (config.reoptimize && a.status === 'busy');
  });

  // Filter eligible orders
  let candidateOrders = orders.filter((o) => {
    if (config.includeOrderIds && config.includeOrderIds.length > 0) {
      return config.includeOrderIds.includes(o.id);
    }
    return o.status === 'pending' || (config.reoptimize && o.status === 'assigned');
  });

  // Sort orders by priority and urgency
  const priorityWeight: Record<string, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  candidateOrders.sort((a, b) => {
    const pwA = priorityWeight[a.priority] || 2;
    const pwB = priorityWeight[b.priority] || 2;
    if (pwB !== pwA) return pwB - pwA;

    // Next by deadline if available
    const dlA = parseTimeToMinutes(a.deadline, referenceDate) ?? 99999;
    const dlB = parseTimeToMinutes(b.deadline, referenceDate) ?? 99999;
    return dlA - dlB;
  });

  const unassigned: UnassignedReason[] = [];
  const agentOrderMap: Map<string, Order[]> = new Map();
  for (const agent of availableAgents) {
    agentOrderMap.set(agent.id, []);
  }

  if (availableAgents.length === 0) {
    for (const order of candidateOrders) {
      unassigned.push({
        orderId: order.id,
        customerName: order.customer_name,
        reason: 'No available agents',
      });
    }

    const compTime = Math.round((performance.now() - startTime) * 10) / 10;
    return {
      id: runId,
      status: 'completed',
      algorithm: config.algorithm || 'nearest_neighbor_2opt',
      routes: [],
      unassigned,
      metrics: {
        total_distance: 0,
        total_duration: 0,
        total_travel_time: 0,
        assigned_orders: 0,
        unassigned_orders: unassigned.length,
        objective_value: 0,
        computation_time_ms: compTime,
        solution_quality: 'heuristic',
        baseline_distance: 0,
        baseline_duration: 0,
        improvement_pct: 0,
      },
      created_at: new Date().toISOString(),
    };
  }

  // ==========================================
  // PHASE 1: NEAREST NEIGHBOR GREEDY ASSIGNMENT
  // ==========================================
  // For each agent, greedily assign the nearest unassigned feasible order
  let unassignedCandidates = [...candidateOrders];
  const assignedOrderIds = new Set<string>();

  let progress = true;
  while (progress && unassignedCandidates.length > 0) {
    progress = false;

    for (const agent of availableAgents) {
      if (unassignedCandidates.length === 0) break;

      const currentAssigned = agentOrderMap.get(agent.id) || [];
      const lastStopLat =
        currentAssigned.length > 0
          ? currentAssigned[currentAssigned.length - 1].latitude
          : agent.latitude;
      const lastStopLon =
        currentAssigned.length > 0
          ? currentAssigned[currentAssigned.length - 1].longitude
          : agent.longitude;

      let bestOrderIdx = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unassignedCandidates.length; i++) {
        const order = unassignedCandidates[i];

        // Feasibility check: try appending order
        const candidateSeq = [...currentAssigned, order];
        const evaluation = evaluateRouteSequence(
          agent,
          candidateSeq,
          speedKmh,
          roadFactor,
          referenceDate
        );

        if (evaluation) {
          const dist = roadDistance(
            lastStopLat,
            lastStopLon,
            order.latitude,
            order.longitude,
            speedKmh,
            roadFactor
          ).distance;

          if (dist < minDistance) {
            minDistance = dist;
            bestOrderIdx = i;
          }
        }
      }

      if (bestOrderIdx !== -1) {
        const [chosenOrder] = unassignedCandidates.splice(bestOrderIdx, 1);
        currentAssigned.push(chosenOrder);
        agentOrderMap.set(agent.id, currentAssigned);
        assignedOrderIds.add(chosenOrder.id);
        progress = true;
      }
    }
  }

  // Any remaining unassigned candidates
  for (const order of unassignedCandidates) {
    unassigned.push({
      orderId: order.id,
      customerName: order.customer_name,
      reason: diagnoseInfeasibility(
        order,
        availableAgents,
        speedKmh,
        roadFactor,
        referenceDate
      ),
    });
  }

  // Baseline evaluation
  const baselineRoutes: EvaluatedRoute[] = [];
  for (const agent of availableAgents) {
    const list = agentOrderMap.get(agent.id) || [];
    const evaluation = evaluateRouteSequence(
      agent,
      list,
      speedKmh,
      roadFactor,
      referenceDate
    );
    if (evaluation) {
      baselineRoutes.push(evaluation);
    } else {
      baselineRoutes.push({
        agent,
        stops: [],
        totalDistance: 0,
        totalDuration: 0,
        totalTravelTime: 0,
        totalLoad: 0,
        departureTimeMinutes: parseTimeToMinutes(agent.shift_start, referenceDate) ?? 480,
        completionTimeMinutes: parseTimeToMinutes(agent.shift_start, referenceDate) ?? 480,
        latenessMinutes: 0,
      });
    }
  }

  const baselineDistance = Math.round(
    baselineRoutes.reduce((sum, r) => sum + r.totalDistance, 0) * 100
  ) / 100;
  const baselineDuration = Math.round(
    baselineRoutes.reduce((sum, r) => sum + r.totalDuration, 0) * 10
  ) / 10;

  // ==========================================
  // PHASE 2: 2-OPT & INTER-ROUTE OPTIMIZATION
  // ==========================================
  // 1. Intra-route 2-opt
  let optimizedRoutes = baselineRoutes.map((route) =>
    optimizeIntraRoute2Opt(route, speedKmh, roadFactor, referenceDate)
  );

  // 2. Inter-route moves
  optimizedRoutes = optimizeInterRouteMoves(
    optimizedRoutes,
    speedKmh,
    roadFactor,
    referenceDate
  );

  // 3. Final intra-route 2-opt pass on updated routes
  optimizedRoutes = optimizedRoutes.map((route) =>
    optimizeIntraRoute2Opt(route, speedKmh, roadFactor, referenceDate)
  );

  // Calculate final metrics
  const totalDistance = Math.round(
    optimizedRoutes.reduce((sum, r) => sum + r.totalDistance, 0) * 100
  ) / 100;
  const totalDuration = Math.round(
    optimizedRoutes.reduce((sum, r) => sum + r.totalDuration, 0) * 10
  ) / 10;
  const totalTravelTime = Math.round(
    optimizedRoutes.reduce((sum, r) => sum + r.totalTravelTime, 0) * 10
  ) / 10;
  const assignedCount = assignedOrderIds.size;
  const unassignedCount = unassigned.length;
  const objectiveValue = calculateObjective(optimizedRoutes);

  let improvementPct = 0;
  if (baselineDistance > 0 && totalDistance <= baselineDistance) {
    improvementPct = Math.round(
      ((baselineDistance - totalDistance) / baselineDistance) * 1000
    ) / 10;
  }

  const computationTimeMs = Math.round((performance.now() - startTime) * 10) / 10;

  // Format RoutePlan objects
  const routePlans: RoutePlan[] = optimizedRoutes.map((r) => {
    const stops: RouteStop[] = r.stops.map((s, idx) => ({
      orderId: s.order.id,
      latitude: s.order.latitude,
      longitude: s.order.longitude,
      customerName: s.order.customer_name,
      deliveryAddress: s.order.delivery_address,
      arrivalTime: s.arrivalTimeIso,
      departureTime: s.departureTimeIso,
      load: s.cumulativeLoad,
      distanceFromPrev: s.distanceFromPrev,
      durationFromPrev: s.durationFromPrev,
      sequenceIndex: idx,
      status: s.order.status,
    }));

    return {
      id: uuidv4(),
      optimization_run_id: runId,
      agent_id: r.agent.id,
      stop_sequence: stops,
      stops,
      total_distance: r.totalDistance,
      total_duration: r.totalDuration,
      total_load: r.totalLoad,
      departure_time: minutesToIso(r.departureTimeMinutes, referenceDate),
      estimated_completion: minutesToIso(r.completionTimeMinutes, referenceDate),
      status: 'planned',
      created_at: new Date().toISOString(),
      agent: r.agent,
    };
  });

  const metrics: OptimizationMetrics = {
    total_distance: totalDistance,
    total_duration: totalDuration,
    total_travel_time: totalTravelTime,
    assigned_orders: assignedCount,
    unassigned_orders: unassignedCount,
    objective_value: objectiveValue,
    computation_time_ms: computationTimeMs,
    solution_quality: 'heuristic',
    baseline_distance: baselineDistance,
    baseline_duration: baselineDuration,
    improvement_pct: improvementPct,
  };

  return {
    id: runId,
    status: 'completed',
    algorithm: config.algorithm || 'nearest_neighbor_2opt',
    routes: routePlans,
    unassigned,
    metrics,
    created_at: new Date().toISOString(),
  };
}
