export interface Order {
  id: string;
  customer_name: string;
  delivery_address: string;
  latitude: number;
  longitude: number;
  package_weight: number;
  package_length?: number;
  package_width?: number;
  package_height?: number;
  service_duration: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  time_window_start?: string;
  time_window_end?: string;
  deadline?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  assigned_agent_id?: string;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
  is_demo_data: number;
}

export interface Agent {
  id: string;
  name: string;
  depot_address: string;
  latitude: number;
  longitude: number;
  vehicle_type: string;
  max_capacity: number;
  max_volume?: number;
  shift_start: string;
  shift_end: string;
  status: 'available' | 'busy' | 'offline' | 'on_break';
  current_load: number;
  color: string;
  created_at: string;
  updated_at: string;
  is_demo_data: number;
  assigned_orders?: number;
}

export interface RouteStop {
  orderId: string;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
  arrivalTime: string;
  departureTime: string;
  load: number;
  distanceFromPrev: number;
  durationFromPrev: number;
  sequenceIndex: number;
  status?: string;
}

export interface RoutePlan {
  id: string;
  optimization_run_id: string;
  agent_id: string;
  agent_name?: string;
  agent_color?: string;
  stop_sequence: RouteStop[];
  total_distance: number;
  total_duration: number;
  total_load: number;
  departure_time: string;
  estimated_completion: string;
  status: string;
}

export interface OptimizationResult {
  id: string;
  status: string;
  algorithm: string;
  routes: RoutePlan[];
  unassigned: { orderId: string; customerName?: string; reason: string }[];
  metrics: {
    total_orders: number;
    assigned_orders: number;
    unassigned_orders: number;
    total_distance: number;
    total_duration: number;
    total_travel_time: number;
    objective_value: number;
    computation_time_ms: number;
    solution_quality: string;
    baseline_distance?: number;
    baseline_duration?: number;
    improvement_pct?: number;
  };
  created_at: string;
  is_reoptimization: number;
  trigger_event?: string;
}

export interface DashboardStats {
  total_orders: number;
  pending_orders: number;
  assigned_orders: number;
  in_progress_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  unassigned_orders: number;
  total_agents: number;
  available_agents: number;
  busy_agents: number;
  late_deliveries: number;
  total_planned_distance: number;
  avg_utilization: number;
  workload_balance: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  is_read: number;
  related_entity_type?: string;
  related_entity_id?: string;
  created_at: string;
}

export interface SimulationState {
  is_running: boolean;
  current_time: string;
  speed_multiplier: number;
  events: SimulationEvent[];
}

export interface SimulationEvent {
  type: string;
  description: string;
  timestamp: string;
  data?: any;
}
