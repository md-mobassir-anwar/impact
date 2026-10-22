import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Agent, Order } from '../models/types';

export const DEMO_AGENTS: Omit<Agent, 'created_at' | 'updated_at' | 'current_load' | 'assigned_orders'>[] = [
  {
    id: 'agent-rajesh-001',
    name: 'Rajesh Sharma',
    depot_address: 'MG Road Hub, Central Bangalore',
    latitude: 12.9716,
    longitude: 77.5946,
    vehicle_type: 'van',
    max_capacity: 150.0,
    max_volume: 3.5,
    shift_start: '08:00',
    shift_end: '18:00',
    status: 'available',
    color: '#3B82F6',
    is_demo_data: 1,
  },
  {
    id: 'agent-priya-002',
    name: 'Priya Patel',
    depot_address: 'Koramangala 4th Block Hub, South Bangalore',
    latitude: 12.9352,
    longitude: 77.6245,
    vehicle_type: 'bike',
    max_capacity: 50.0,
    max_volume: 0.8,
    shift_start: '09:00',
    shift_end: '17:00',
    status: 'available',
    color: '#10B981',
    is_demo_data: 1,
  },
  {
    id: 'agent-kumar-003',
    name: 'Kumar Swamy',
    depot_address: 'ITPL Main Road Hub, Whitefield',
    latitude: 12.9698,
    longitude: 77.75,
    vehicle_type: 'truck',
    max_capacity: 300.0,
    max_volume: 8.0,
    shift_start: '07:00',
    shift_end: '19:00',
    status: 'available',
    color: '#F59E0B',
    is_demo_data: 1,
  },
];

export function getDemoOrders(): Omit<Order, 'created_at' | 'updated_at'>[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  return [
    {
      id: 'order-blr-001',
      customer_name: 'Anita Desai',
      delivery_address: '14 Indiranagar 100ft Road, HAL 2nd Stage',
      latitude: 12.9784,
      longitude: 77.6408,
      package_weight: 12.5,
      package_length: 30,
      package_width: 20,
      package_height: 15,
      service_duration: 10,
      priority: 'high',
      time_window_start: `${todayStr}T09:30:00Z`,
      time_window_end: `${todayStr}T13:00:00Z`,
      deadline: `${todayStr}T14:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Ring bell twice, apartment 302',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-002',
      customer_name: 'Suresh Menon',
      delivery_address: '88 Jayanagar 4th Block, near Cool Joint',
      latitude: 12.9299,
      longitude: 77.5824,
      package_weight: 5.0,
      package_length: 25,
      package_width: 15,
      package_height: 10,
      service_duration: 10,
      priority: 'normal',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T17:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Leave at security gate if not answering',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-003',
      customer_name: 'Vikram Mehta',
      delivery_address: '22 HSR Layout Sector 1, 27th Main',
      latitude: 12.9116,
      longitude: 77.6534,
      package_weight: 8.0,
      package_length: 40,
      package_width: 25,
      package_height: 20,
      service_duration: 15,
      priority: 'urgent',
      time_window_start: `${todayStr}T09:00:00Z`,
      time_window_end: `${todayStr}T11:30:00Z`,
      deadline: `${todayStr}T12:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Urgent medical supplies - signature required',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-004',
      customer_name: 'Deepa Rao',
      delivery_address: '7 Malleshwaram 8th Cross, Temple Road',
      latitude: 13.0031,
      longitude: 77.5703,
      package_weight: 4.5,
      package_length: 20,
      package_width: 20,
      package_height: 10,
      service_duration: 10,
      priority: 'normal',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T16:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: null,
      is_demo_data: 1,
    },
    {
      id: 'order-blr-005',
      customer_name: 'Heavy Industries Corp',
      delivery_address: 'Industrial Plot 42, Electronic City Phase 1',
      latitude: 12.8452,
      longitude: 77.6602,
      package_weight: 250.0, // Heavy order: only truck (300kg) can handle!
      package_length: 120,
      package_width: 80,
      package_height: 60,
      service_duration: 30,
      priority: 'normal',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T18:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Requires hydraulic liftgate / two handlers',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-006',
      customer_name: 'Expired Consignment Co',
      delivery_address: '10 Richmond Road, Shanthala Nagar',
      latitude: 12.9663,
      longitude: 77.5999,
      package_weight: 15.0,
      package_length: 30,
      package_width: 30,
      package_height: 20,
      service_duration: 10,
      priority: 'urgent',
      time_window_start: null,
      time_window_end: null,
      deadline: '2020-01-01T08:00:00Z', // Infeasible: deadline has already passed
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Strict past SLA deadline verification',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-007',
      customer_name: 'Kavita Sundaram',
      delivery_address: '45 Marathahalli Bridge, Outer Ring Road',
      latitude: 12.9554,
      longitude: 77.7011,
      package_weight: 18.0,
      package_length: 35,
      package_width: 30,
      package_height: 25,
      service_duration: 15,
      priority: 'high',
      time_window_start: `${todayStr}T11:00:00Z`,
      time_window_end: `${todayStr}T15:00:00Z`,
      deadline: `${todayStr}T16:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Near Kalamandir showroom',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-008',
      customer_name: 'Rohan Gupta',
      delivery_address: '19 Bellandur EcoSpace, Outer Ring Road',
      latitude: 12.926,
      longitude: 77.6762,
      package_weight: 6.2,
      package_length: 22,
      package_width: 18,
      package_height: 12,
      service_duration: 10,
      priority: 'normal',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T17:30:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Tower 2 Reception desk',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-009',
      customer_name: 'Pooja Hegde',
      delivery_address: '32 Banashankari 2nd Stage, 100ft Ring Road',
      latitude: 12.9255,
      longitude: 77.5658,
      package_weight: 3.8,
      package_length: 20,
      package_width: 15,
      package_height: 10,
      service_duration: 10,
      priority: 'low',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T19:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: null,
      is_demo_data: 1,
    },
    {
      id: 'order-blr-010',
      customer_name: 'Arjun Nambiar',
      delivery_address: '105 BTM Layout 2nd Stage, Bannerghatta Road',
      latitude: 12.9166,
      longitude: 77.6101,
      package_weight: 9.5,
      package_length: 28,
      package_width: 22,
      package_height: 16,
      service_duration: 10,
      priority: 'normal',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T17:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Call customer 10 mins before arrival',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-011',
      customer_name: 'Meera Iyer',
      delivery_address: '16 Domlur Layout, near Embassy Golf Links',
      latitude: 12.9609,
      longitude: 77.6387,
      package_weight: 2.1,
      package_length: 15,
      package_width: 10,
      package_height: 8,
      service_duration: 5,
      priority: 'low',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T18:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Small envelope delivery',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-012',
      customer_name: 'Sunil Chhetri',
      delivery_address: '77 Ulsoor Lake Road, Sivanchetti Gardens',
      latitude: 12.9818,
      longitude: 77.6198,
      package_weight: 24.0,
      package_length: 45,
      package_width: 35,
      package_height: 25,
      service_duration: 15,
      priority: 'high',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T15:30:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Sports equipment gear box',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-013',
      customer_name: 'Lakshmi Narayana',
      delivery_address: '50 Rajajinagar 1st Block, Dr. Rajkumar Road',
      latitude: 12.9982,
      longitude: 77.553,
      package_weight: 14.2,
      package_length: 32,
      package_width: 24,
      package_height: 18,
      service_duration: 10,
      priority: 'normal',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T17:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: null,
      is_demo_data: 1,
    },
    {
      id: 'order-blr-014',
      customer_name: 'Gaurav Kulkarni',
      delivery_address: '12 Hebbal Kempapura, near Esteem Mall',
      latitude: 13.0456,
      longitude: 77.5912,
      package_weight: 7.4,
      package_length: 25,
      package_width: 20,
      package_height: 15,
      service_duration: 10,
      priority: 'normal',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T18:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'North Bangalore perimeter',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-015',
      customer_name: 'Divya Krishnan',
      delivery_address: '29 Frazer Town, Coles Road',
      latitude: 12.9975,
      longitude: 77.6145,
      package_weight: 3.2,
      package_length: 18,
      package_width: 14,
      package_height: 10,
      service_duration: 10,
      priority: 'low',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T18:30:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: null,
      is_demo_data: 1,
    },
    {
      id: 'order-blr-016',
      customer_name: 'Farhan Akhtar',
      delivery_address: '63 Cunningham Road, Vasanth Nagar',
      latitude: 12.9868,
      longitude: 77.5982,
      package_weight: 11.0,
      package_length: 30,
      package_width: 25,
      package_height: 15,
      service_duration: 10,
      priority: 'high',
      time_window_start: `${todayStr}T10:00:00Z`,
      time_window_end: `${todayStr}T14:00:00Z`,
      deadline: `${todayStr}T15:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Leave at front office',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-017',
      customer_name: 'Bhavna Sharma',
      delivery_address: '84 Basavanagudi, Gandhi Bazaar Main Road',
      latitude: 12.9421,
      longitude: 77.5739,
      package_weight: 5.8,
      package_length: 22,
      package_width: 18,
      package_height: 14,
      service_duration: 10,
      priority: 'low',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T18:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: null,
      is_demo_data: 1,
    },
    {
      id: 'order-blr-018',
      customer_name: 'Karthik Raja',
      delivery_address: '91 Brookefield, Kundalahalli Gate',
      latitude: 12.9664,
      longitude: 77.7174,
      package_weight: 16.5,
      package_length: 35,
      package_width: 28,
      package_height: 20,
      service_duration: 15,
      priority: 'high',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T16:30:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Close to AECS layout gate',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-019',
      customer_name: 'Shilpa Reddy',
      delivery_address: '37 Sarjapur Road, Kaikondrahalli',
      latitude: 12.9122,
      longitude: 77.6841,
      package_weight: 80.0, // Substantial weight package
      package_length: 70,
      package_width: 50,
      package_height: 40,
      service_duration: 20,
      priority: 'normal',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T17:30:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Large household appliance - handle with care',
      is_demo_data: 1,
    },
    {
      id: 'order-blr-020',
      customer_name: 'Naveen Jindal',
      delivery_address: '15 Yelahanka New Town, Sector A',
      latitude: 13.0998,
      longitude: 77.5855,
      package_weight: 8.2,
      package_length: 26,
      package_width: 20,
      package_height: 15,
      service_duration: 15,
      priority: 'low',
      time_window_start: null,
      time_window_end: null,
      deadline: `${todayStr}T19:00:00Z`,
      status: 'pending',
      assigned_agent_id: null,
      special_instructions: 'Far north perimeter delivery',
      is_demo_data: 1,
    },
  ];
}

/**
 * Checks whether demo data is already loaded in the database.
 */
export function isDemoDataLoaded(db: Database.Database): boolean {
  try {
    const agentCount = db
      .prepare('SELECT COUNT(*) as count FROM agents WHERE is_demo_data = 1')
      .get() as { count: number };
    const orderCount = db
      .prepare('SELECT COUNT(*) as count FROM orders WHERE is_demo_data = 1')
      .get() as { count: number };
    return agentCount.count > 0 && orderCount.count > 0;
  } catch {
    return false;
  }
}

/**
 * Loads demo agents and orders into the database.
 */
export function loadDemoData(db: Database.Database): {
  agentsLoaded: number;
  ordersLoaded: number;
} {
  const insertAgent = db.prepare(`
    INSERT OR REPLACE INTO agents (
      id, name, depot_address, latitude, longitude,
      vehicle_type, max_capacity, max_volume, shift_start,
      shift_end, status, current_load, color, created_at, updated_at, is_demo_data
    ) VALUES (
      @id, @name, @depot_address, @latitude, @longitude,
      @vehicle_type, @max_capacity, @max_volume, @shift_start,
      @shift_end, @status, 0, @color, datetime('now'), datetime('now'), @is_demo_data
    )
  `);

  const insertOrder = db.prepare(`
    INSERT OR REPLACE INTO orders (
      id, customer_name, delivery_address, latitude, longitude,
      package_weight, package_length, package_width, package_height,
      service_duration, priority, time_window_start, time_window_end,
      deadline, status, assigned_agent_id, special_instructions,
      created_at, updated_at, is_demo_data
    ) VALUES (
      @id, @customer_name, @delivery_address, @latitude, @longitude,
      @package_weight, @package_length, @package_width, @package_height,
      @service_duration, @priority, @time_window_start, @time_window_end,
      @deadline, @status, @assigned_agent_id, @special_instructions,
      datetime('now'), datetime('now'), @is_demo_data
    )
  `);

  const demoOrders = getDemoOrders();

  const tx = db.transaction(() => {
    for (const agent of DEMO_AGENTS) {
      insertAgent.run(agent);
    }
    for (const order of demoOrders) {
      insertOrder.run(order);
    }
  });

  tx();

  return {
    agentsLoaded: DEMO_AGENTS.length,
    ordersLoaded: demoOrders.length,
  };
}

/**
 * Deletes all data from tables and reloads the fresh demo data.
 */
export function resetDemoData(db: Database.Database): {
  agentsLoaded: number;
  ordersLoaded: number;
} {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM route_plans').run();
    db.prepare('DELETE FROM optimization_runs').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM agents').run();
    db.prepare('DELETE FROM notifications').run();
    db.prepare("UPDATE simulation_state SET is_running = 0, current_time = datetime('now'), events = '[]' WHERE id = 1").run();
  });
  tx();

  return loadDemoData(db);
}
