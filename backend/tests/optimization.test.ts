import { describe, it, expect } from 'vitest';
import { runOptimization } from '../src/services/optimization-engine';
import { haversineDistance, roadDistance } from '../src/services/routing-service';
import { Order, Agent } from '../src/models/types';

describe('Routing Service & Haversine Distance', () => {
  it('calculates 0 distance for identical coordinates', () => {
    const dist = haversineDistance(12.9716, 77.5946, 12.9716, 77.5946);
    expect(dist).toBe(0);
  });

  it('calculates accurate distance between known coordinates (equator 1 degree lon)', () => {
    // 1 degree longitude at equator is approx 111.195 km
    const dist = haversineDistance(0, 0, 0, 1);
    expect(dist).toBeGreaterThan(111.0);
    expect(dist).toBeLessThan(111.4);
  });

  it('calculates Bangalore MG Road to Koramangala (approx 5.1-5.3 km)', () => {
    const dist = haversineDistance(12.9716, 77.5946, 12.9352, 77.6245);
    expect(dist).toBeGreaterThan(5.0);
    expect(dist).toBeLessThan(5.5);
  });

  it('applies road factor and speed to compute road distance and duration', () => {
    const { distance, duration } = roadDistance(12.9716, 77.5946, 12.9352, 77.6245, 40, 1.3);
    const straight = haversineDistance(12.9716, 77.5946, 12.9352, 77.6245);
    expect(distance).toBeCloseTo(straight * 1.3, 1);
    expect(duration).toBeGreaterThan(0);
  });
});

describe('Optimization Engine', () => {
  const baseAgents: Agent[] = [
    {
      id: 'agent-1',
      name: 'Agent 1',
      depot_address: 'Depot Central',
      latitude: 12.97,
      longitude: 77.59,
      vehicle_type: 'van',
      max_capacity: 100,
      shift_start: '08:00',
      shift_end: '18:00',
      status: 'available',
      current_load: 0,
      color: '#3B82F6',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_demo_data: 0,
    },
    {
      id: 'agent-2',
      name: 'Agent 2',
      depot_address: 'Depot South',
      latitude: 12.93,
      longitude: 77.62,
      vehicle_type: 'bike',
      max_capacity: 50,
      shift_start: '08:00',
      shift_end: '18:00',
      status: 'available',
      current_load: 0,
      color: '#10B981',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_demo_data: 0,
    },
    {
      id: 'agent-3',
      name: 'Agent 3',
      depot_address: 'Depot East',
      latitude: 12.96,
      longitude: 77.75,
      vehicle_type: 'truck',
      max_capacity: 300,
      shift_start: '07:00',
      shift_end: '19:00',
      status: 'available',
      current_load: 0,
      color: '#F59E0B',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_demo_data: 0,
    },
  ];

  it('handles empty orders gracefully', () => {
    const result = runOptimization([], baseAgents);
    expect(result.status).toBe('completed');
    expect(result.metrics.assigned_orders).toBe(0);
    expect(result.metrics.unassigned_orders).toBe(0);
    expect(result.routes.every((r) => !r.stops || r.stops.length === 0)).toBe(true);
  });

  it('assigns a single order to a single agent', () => {
    const order: Order = {
      id: 'order-1',
      customer_name: 'Single Customer',
      delivery_address: 'Address 1',
      latitude: 12.975,
      longitude: 77.6,
      package_weight: 5,
      service_duration: 10,
      priority: 'normal',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_demo_data: 0,
    };

    const result = runOptimization([order], [baseAgents[0]]);
    expect(result.metrics.assigned_orders).toBe(1);
    expect(result.unassigned.length).toBe(0);
    expect(result.routes[0].stops?.length).toBe(1);
    expect(result.routes[0].stops?.[0].orderId).toBe('order-1');
  });

  it('performs basic assignment for 3 agents and 5 feasible orders', () => {
    const orders: Order[] = [
      {
        id: 'ord-1',
        customer_name: 'Customer 1',
        delivery_address: 'Addr 1',
        latitude: 12.972,
        longitude: 77.595,
        package_weight: 10,
        service_duration: 10,
        priority: 'normal',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_demo_data: 0,
      },
      {
        id: 'ord-2',
        customer_name: 'Customer 2',
        delivery_address: 'Addr 2',
        latitude: 12.935,
        longitude: 77.625,
        package_weight: 8,
        service_duration: 10,
        priority: 'high',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_demo_data: 0,
      },
      {
        id: 'ord-3',
        customer_name: 'Customer 3',
        delivery_address: 'Addr 3',
        latitude: 12.968,
        longitude: 77.749,
        package_weight: 15,
        service_duration: 10,
        priority: 'normal',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_demo_data: 0,
      },
      {
        id: 'ord-4',
        customer_name: 'Customer 4',
        delivery_address: 'Addr 4',
        latitude: 12.978,
        longitude: 77.64,
        package_weight: 5,
        service_duration: 10,
        priority: 'urgent',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_demo_data: 0,
      },
      {
        id: 'ord-5',
        customer_name: 'Customer 5',
        delivery_address: 'Addr 5',
        latitude: 12.92,
        longitude: 77.58,
        package_weight: 12,
        service_duration: 10,
        priority: 'low',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_demo_data: 0,
      },
    ];

    const result = runOptimization(orders, baseAgents);
    expect(result.metrics.assigned_orders).toBe(5);
    expect(result.unassigned.length).toBe(0);
    expect(result.metrics.total_distance).toBeGreaterThan(0);
  });

  it('respects capacity constraint when order is too heavy for some agents', () => {
    // Only Agent 3 (truck, max 300kg) can take an 80kg package if other agents are full,
    // or an order with 200kg can ONLY be handled by Agent 3
    const heavyOrder: Order = {
      id: 'ord-heavy',
      customer_name: 'Heavy Industrial Order',
      delivery_address: 'Industrial Area',
      latitude: 12.965,
      longitude: 77.74,
      package_weight: 220, // Agent 1 has 100kg max, Agent 2 has 50kg max, Agent 3 has 300kg max
      service_duration: 20,
      priority: 'high',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_demo_data: 0,
    };

    const result = runOptimization([heavyOrder], baseAgents);
    expect(result.metrics.assigned_orders).toBe(1);

    // Verify it was assigned to Agent 3 (truck)
    const truckRoute = result.routes.find((r) => r.agent_id === 'agent-3');
    expect(truckRoute).toBeDefined();
    expect(truckRoute?.stops?.some((s) => s.orderId === 'ord-heavy')).toBe(true);
  });

  it('marks orders with expired past deadlines as infeasible/unassigned', () => {
    const expiredOrder: Order = {
      id: 'ord-expired',
      customer_name: 'Expired SLA Order',
      delivery_address: 'Central Square',
      latitude: 12.97,
      longitude: 77.59,
      package_weight: 5,
      service_duration: 10,
      priority: 'urgent',
      deadline: '2020-01-01T08:00:00Z', // In the past!
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_demo_data: 0,
    };

    const result = runOptimization([expiredOrder], baseAgents);
    expect(result.unassigned.length).toBe(1);
    expect(result.unassigned[0].orderId).toBe('ord-expired');
    expect(result.unassigned[0].reason).toContain('deadline');
  });

  it('verifies 2-opt improves or equals baseline distance', () => {
    // 6 orders in a zig-zag that can be untangled by 2-opt
    const zigzagOrders: Order[] = [
      { id: 'z1', customer_name: 'Z1', delivery_address: 'A', latitude: 12.95, longitude: 77.55, package_weight: 2, service_duration: 5, priority: 'normal', status: 'pending', created_at: '', updated_at: '', is_demo_data: 0 },
      { id: 'z2', customer_name: 'Z2', delivery_address: 'B', latitude: 12.99, longitude: 77.65, package_weight: 2, service_duration: 5, priority: 'normal', status: 'pending', created_at: '', updated_at: '', is_demo_data: 0 },
      { id: 'z3', customer_name: 'Z3', delivery_address: 'C', latitude: 12.95, longitude: 77.65, package_weight: 2, service_duration: 5, priority: 'normal', status: 'pending', created_at: '', updated_at: '', is_demo_data: 0 },
      { id: 'z4', customer_name: 'Z4', delivery_address: 'D', latitude: 12.99, longitude: 77.55, package_weight: 2, service_duration: 5, priority: 'normal', status: 'pending', created_at: '', updated_at: '', is_demo_data: 0 },
    ];

    const result = runOptimization(zigzagOrders, [baseAgents[0]]);
    expect(result.metrics.assigned_orders).toBe(4);
    expect(result.metrics.total_distance).toBeLessThanOrEqual(result.metrics.baseline_distance);
  });

  it('balances workload across available agents', () => {
    const orders: Order[] = Array.from({ length: 6 }, (_, i) => ({
      id: `bal-${i}`,
      customer_name: `Balanced Customer ${i}`,
      delivery_address: `Street ${i}`,
      latitude: 12.95 + i * 0.01,
      longitude: 77.60 + i * 0.01,
      package_weight: 5,
      service_duration: 10,
      priority: 'normal',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_demo_data: 0,
    }));

    const result = runOptimization(orders, baseAgents);
    expect(result.metrics.assigned_orders).toBe(6);

    // Ensure more than one agent received deliveries
    const activeRoutes = result.routes.filter((r) => r.stops && r.stops.length > 0);
    expect(activeRoutes.length).toBeGreaterThan(1);
  });
});
