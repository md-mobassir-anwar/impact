import {
  Order,
  Agent,
  OptimizationResult,
  DashboardStats,
  Notification,
  SimulationState,
  SimulationEvent
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Dashboard
  getDashboardStats: () => fetchJson<DashboardStats>('/analytics/dashboard'),
  
  // Orders
  getOrders: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<{ orders: Order[]; total: number }>(`/orders${query}`);
  },
  getOrder: (id: string) => fetchJson<Order>(`/orders/${id}`),
  createOrder: (data: Partial<Order>) => fetchJson<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: Partial<Order>) => fetchJson<Order>(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrder: (id: string) => fetchJson<void>(`/orders/${id}`, { method: 'DELETE' }),
  cancelOrder: (id: string) => fetchJson<Order>(`/orders/${id}/cancel`, { method: 'PATCH' }),
  bulkCreateOrders: (orders: Partial<Order>[]) => fetchJson<{ created: number; errors: any[] }>('/orders/bulk', { method: 'POST', body: JSON.stringify(orders) }),
  exportOrdersCsv: () => fetch(`${API_BASE}/orders/export/csv`).then(r => r.blob()),
  
  // Agents
  getAgents: (params?: Record<string, string>) => fetchJson<Agent[]>(`/agents${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  getAgent: (id: string) => fetchJson<Agent>(`/agents/${id}`),
  createAgent: (data: Partial<Agent>) => fetchJson<Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: Partial<Agent>) => fetchJson<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAgent: (id: string) => fetchJson<void>(`/agents/${id}`, { method: 'DELETE' }),
  updateAgentStatus: (id: string, status: string) => fetchJson<Agent>(`/agents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  
  // Optimization
  runOptimization: (config?: any) => fetchJson<OptimizationResult>('/optimize/run', { method: 'POST', body: JSON.stringify(config || {}) }),
  getOptimizationHistory: () => fetchJson<OptimizationResult[]>('/optimize/history'),
  getOptimizationRun: (id: string) => fetchJson<OptimizationResult>(`/optimize/history/${id}`),
  getCurrentOptimization: () => fetchJson<OptimizationResult>('/optimize/current'),
  reoptimize: (data: any) => fetchJson<OptimizationResult>('/optimize/reoptimize', { method: 'POST', body: JSON.stringify(data) }),
  
  // Simulation
  getSimulationState: () => fetchJson<SimulationState>('/simulation/state'),
  startSimulation: (speed?: number) => fetchJson<any>('/simulation/start', { method: 'POST', body: JSON.stringify({ speed_multiplier: speed || 1 }) }),
  stopSimulation: () => fetchJson<any>('/simulation/stop', { method: 'POST' }),
  stepSimulation: () => fetchJson<any>('/simulation/step', { method: 'POST' }),
  resetSimulation: () => fetchJson<any>('/simulation/reset', { method: 'POST' }),
  injectEvent: (event: any) => fetchJson<any>('/simulation/event', { method: 'POST', body: JSON.stringify(event) }),
  getSimulationEvents: () => fetchJson<SimulationEvent[]>('/simulation/events'),
  
  // Analytics
  getComparison: () => fetchJson<any>('/analytics/comparison'),
  getAgentUtilization: () => fetchJson<any>('/analytics/agent-utilization'),
  getTimeline: () => fetchJson<any>('/analytics/timeline'),
  
  // Settings
  getSettings: () => fetchJson<Record<string, string>>('/settings'),
  updateSettings: (settings: Record<string, string>) => fetchJson<any>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  loadDemoData: () => fetchJson<any>('/settings/demo/load', { method: 'POST' }),
  resetDemoData: () => fetchJson<any>('/settings/demo/reset', { method: 'POST', body: JSON.stringify({ confirm: true }) }),
  
  // Notifications
  getNotifications: (unreadOnly?: boolean) => fetchJson<Notification[]>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
  markNotificationRead: (id: string) => fetchJson<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => fetchJson<any>('/notifications/read-all', { method: 'PATCH' }),
};
