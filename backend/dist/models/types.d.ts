export type OrderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type OrderStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
export type AgentStatus = 'available' | 'busy' | 'offline' | 'on_break';
export type OptimizationStatus = 'running' | 'completed' | 'failed';
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';
export interface Order {
    id: string;
    customer_name: string;
    delivery_address: string;
    latitude: number;
    longitude: number;
    package_weight: number;
    package_length?: number | null;
    package_width?: number | null;
    package_height?: number | null;
    service_duration: number;
    priority: OrderPriority;
    time_window_start?: string | null;
    time_window_end?: string | null;
    deadline?: string | null;
    status: OrderStatus;
    assigned_agent_id?: string | null;
    special_instructions?: string | null;
    created_at: string;
    updated_at: string;
    is_demo_data: number;
}
export interface CreateOrderInput {
    customer_name: string;
    delivery_address: string;
    latitude: number;
    longitude: number;
    package_weight?: number;
    package_length?: number | null;
    package_width?: number | null;
    package_height?: number | null;
    service_duration?: number;
    priority?: OrderPriority;
    time_window_start?: string | null;
    time_window_end?: string | null;
    deadline?: string | null;
    special_instructions?: string | null;
    is_demo_data?: number;
}
export interface UpdateOrderInput {
    customer_name?: string;
    delivery_address?: string;
    latitude?: number;
    longitude?: number;
    package_weight?: number;
    package_length?: number | null;
    package_width?: number | null;
    package_height?: number | null;
    service_duration?: number;
    priority?: OrderPriority;
    time_window_start?: string | null;
    time_window_end?: string | null;
    deadline?: string | null;
    status?: OrderStatus;
    assigned_agent_id?: string | null;
    special_instructions?: string | null;
}
export interface Agent {
    id: string;
    name: string;
    depot_address: string;
    latitude: number;
    longitude: number;
    vehicle_type: string;
    max_capacity: number;
    max_volume?: number | null;
    shift_start: string;
    shift_end: string;
    status: AgentStatus;
    current_load: number;
    color: string;
    created_at: string;
    updated_at: string;
    is_demo_data: number;
    assigned_orders?: number;
}
export interface CreateAgentInput {
    name: string;
    depot_address?: string;
    latitude: number;
    longitude: number;
    vehicle_type?: string;
    max_capacity?: number;
    max_volume?: number | null;
    shift_start?: string;
    shift_end?: string;
    status?: AgentStatus;
    color?: string;
    is_demo_data?: number;
}
export interface UpdateAgentInput {
    name?: string;
    depot_address?: string;
    latitude?: number;
    longitude?: number;
    vehicle_type?: string;
    max_capacity?: number;
    max_volume?: number | null;
    shift_start?: string;
    shift_end?: string;
    status?: AgentStatus;
    current_load?: number;
    color?: string;
}
export interface RouteStop {
    orderId: string;
    latitude: number;
    longitude: number;
    customerName: string;
    deliveryAddress?: string;
    arrivalTime: string;
    departureTime: string;
    load: number;
    distanceFromPrev: number;
    durationFromPrev: number;
    sequenceIndex: number;
    status?: OrderStatus;
}
export interface RoutePlan {
    id: string;
    optimization_run_id: string;
    agent_id: string;
    stop_sequence: string | RouteStop[];
    stops?: RouteStop[];
    total_distance: number;
    total_duration: number;
    total_load: number;
    departure_time?: string | null;
    estimated_completion?: string | null;
    status: string;
    created_at: string;
    agent?: Agent;
}
export interface OptimizationRun {
    id: string;
    status: OptimizationStatus;
    algorithm: string;
    total_orders: number;
    assigned_orders: number;
    unassigned_orders: number;
    total_distance: number;
    total_duration: number;
    total_travel_time: number;
    objective_value: number;
    computation_time_ms: number;
    solution_quality: string;
    baseline_distance?: number | null;
    baseline_duration?: number | null;
    improvement_pct?: number | null;
    config?: string | null;
    created_at: string;
    is_reoptimization: number;
    trigger_event?: string | null;
}
export interface UnassignedReason {
    orderId: string;
    customerName?: string;
    reason: string;
}
export interface OptimizationMetrics {
    total_distance: number;
    total_duration: number;
    total_travel_time: number;
    assigned_orders: number;
    unassigned_orders: number;
    objective_value: number;
    computation_time_ms: number;
    solution_quality: string;
    baseline_distance: number;
    baseline_duration: number;
    improvement_pct: number;
}
export interface OptimizationResult {
    id: string;
    status: OptimizationStatus;
    algorithm: string;
    routes: RoutePlan[];
    unassigned: UnassignedReason[];
    metrics: OptimizationMetrics;
    created_at: string;
}
export interface OptimizationConfig {
    algorithm?: string;
    maxTime?: number;
    includeOrderIds?: string[];
    excludeAgentIds?: string[];
    reoptimize?: boolean;
    roadFactor?: number;
    defaultSpeedKmh?: number;
}
export interface SimulationEvent {
    id: string;
    type: 'new_order' | 'cancel_order' | 'agent_unavailable' | 'delay' | 'complete_delivery' | 'status_change' | 'step';
    timestamp: string;
    message: string;
    data?: any;
}
export interface SimulationState {
    id: number;
    is_running: number | boolean;
    current_time?: string | null;
    speed_multiplier: number;
    events: string | SimulationEvent[];
}
export interface Setting {
    key: string;
    value: string;
    updated_at: string;
}
export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    severity: NotificationSeverity;
    is_read: number;
    related_entity_type?: string | null;
    related_entity_id?: string | null;
    created_at: string;
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
export interface AnalyticsData {
    stats: DashboardStats;
    comparison?: {
        baseline_distance: number;
        optimized_distance: number;
        distance_saved_km: number;
        distance_saved_pct: number;
        baseline_duration: number;
        optimized_duration: number;
        duration_saved_mins: number;
        duration_saved_pct: number;
    } | null;
    agentUtilization?: {
        agent_id: string;
        agent_name: string;
        vehicle_type: string;
        max_capacity: number;
        current_load: number;
        utilization_pct: number;
        assigned_orders: number;
        status: AgentStatus;
        color: string;
    }[];
    timeline?: {
        time: string;
        completed: number;
        cumulative_completed: number;
        target: number;
    }[];
}
//# sourceMappingURL=types.d.ts.map