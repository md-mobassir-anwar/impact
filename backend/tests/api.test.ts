import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../src/index';
import { initializeDatabase, getDb } from '../src/database';
import { loadDemoData } from '../src/services/demo-data';

describe('RouteWise API Endpoints', () => {
  const testDbPath = path.resolve(__dirname, 'test_routewise.db');

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore unlink error
      }
    }
    const db = initializeDatabase(testDbPath);
    loadDemoData(db);
  });

  afterAll(() => {
    try {
      const db = getDb();
      db.close();
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it('GET /api/orders returns orders list with pagination', async () => {
    const res = await request(app).get('/api/orders?page=1&page_size=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeLessThanOrEqual(10);
    expect(res.body.total).toBeGreaterThanOrEqual(20);
  });

  it('POST /api/orders creates a valid order and returns 201', async () => {
    const newOrderPayload = {
      customer_name: 'Test Customer A',
      delivery_address: '100 Test St, Bangalore',
      latitude: 12.9716,
      longitude: 77.5946,
      package_weight: 4.5,
      priority: 'high',
      service_duration: 15,
      special_instructions: 'Handle with care',
    };

    const res = await request(app).post('/api/orders').send(newOrderPayload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.customer_name).toBe('Test Customer A');
    expect(res.body.status).toBe('pending');
    expect(res.body.package_weight).toBe(4.5);
  });

  it('POST /api/orders rejects invalid coordinates (lat > 90)', async () => {
    const invalidPayload = {
      customer_name: 'Invalid Lat Customer',
      delivery_address: 'Somewhere',
      latitude: 95.0, // Invalid: > 90
      longitude: 77.5946,
      package_weight: 2.0,
    };

    const res = await request(app).post('/api/orders').send(invalidPayload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('latitude');
  });

  it('POST /api/orders rejects negative or zero package weight', async () => {
    const invalidPayload = {
      customer_name: 'Negative Weight Customer',
      delivery_address: 'Somewhere',
      latitude: 12.97,
      longitude: 77.59,
      package_weight: -5.0, // Invalid
    };

    const res = await request(app).post('/api/orders').send(invalidPayload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('package_weight');
  });

  it('DELETE /api/orders/:id only allows deleting pending orders and rejects non-pending', async () => {
    // 1. Create a pending order
    const createRes = await request(app).post('/api/orders').send({
      customer_name: 'To Delete Customer',
      delivery_address: 'Temp Address',
      latitude: 12.95,
      longitude: 77.6,
      package_weight: 3.0,
    });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    // 2. Delete it while pending -> should succeed
    const delRes = await request(app).delete(`/api/orders/${orderId}`);
    expect(delRes.status).toBe(200);

    // 3. Mark an order as completed directly in DB and try to delete -> should return 409
    const db = getDb();
    const completedOrderId = 'order-test-completed-1';
    db.prepare(`
      INSERT INTO orders (id, customer_name, delivery_address, latitude, longitude, package_weight, status, created_at, updated_at)
      VALUES (?, 'Completed Cust', 'Completed Addr', 12.95, 77.6, 5.0, 'completed', datetime('now'), datetime('now'))
    `).run(completedOrderId);

    const failDelRes = await request(app).delete(`/api/orders/${completedOrderId}`);
    expect(failDelRes.status).toBe(409);
    expect(failDelRes.body).toHaveProperty('error');
  });

  it('POST /api/agents creates a new agent and returns 201', async () => {
    const agentPayload = {
      name: 'Agent Sanjay',
      depot_address: 'Koramangala Depot',
      latitude: 12.935,
      longitude: 77.62,
      vehicle_type: 'electric_van',
      max_capacity: 120,
      shift_start: '08:30',
      shift_end: '17:30',
      color: '#8B5CF6',
    };

    const res = await request(app).post('/api/agents').send(agentPayload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Agent Sanjay');
    expect(res.body.max_capacity).toBe(120);
    expect(res.body.status).toBe('available');
  });

  it('GET /api/analytics/dashboard returns complete dashboard stats', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_orders');
    expect(res.body).toHaveProperty('pending_orders');
    expect(res.body).toHaveProperty('assigned_orders');
    expect(res.body).toHaveProperty('in_progress_orders');
    expect(res.body).toHaveProperty('completed_orders');
    expect(res.body).toHaveProperty('cancelled_orders');
    expect(res.body).toHaveProperty('unassigned_orders');
    expect(res.body).toHaveProperty('total_agents');
    expect(res.body).toHaveProperty('available_agents');
    expect(res.body).toHaveProperty('busy_agents');
    expect(res.body).toHaveProperty('late_deliveries');
    expect(res.body).toHaveProperty('total_planned_distance');
    expect(res.body).toHaveProperty('avg_utilization');
    expect(res.body).toHaveProperty('workload_balance');

    expect(typeof res.body.total_orders).toBe('number');
    expect(typeof res.body.total_agents).toBe('number');
    expect(res.body.total_agents).toBeGreaterThan(0);
  });
});
