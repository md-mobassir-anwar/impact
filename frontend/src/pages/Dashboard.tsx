import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  Users,
  AlertTriangle,
  AlertCircle,
  Navigation,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardStats, Order, Agent } from '../types';
import { KPICard } from '../components/shared/KPICard';
import { StatusBadge } from '../components/shared/StatusBadge';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { formatDistance, formatWeight, truncateId } from '../utils/formatters';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [dashboardStats, ordersData, agentsData] = await Promise.all([
        api.getDashboardStats().catch(() => null),
        api.getOrders({ limit: '5' }).catch(() => ({ orders: [], total: 0 })),
        api.getAgents().catch(() => []),
      ]);

      if (dashboardStats) {
        setStats(dashboardStats);
      } else {
        // Fallback calculation from orders & agents if analytics endpoint is empty
        const total = ordersData.orders?.length || 0;
        const pending = ordersData.orders?.filter((o) => o.status === 'pending').length || 0;
        const inProgress = ordersData.orders?.filter((o) => o.status === 'in_progress').length || 0;
        const completed = ordersData.orders?.filter((o) => o.status === 'completed').length || 0;
        const availableAgents = agentsData.filter((a) => a.status === 'available').length || 0;

        setStats({
          total_orders: total,
          pending_orders: pending,
          assigned_orders: ordersData.orders?.filter((o) => o.status === 'assigned').length || 0,
          in_progress_orders: inProgress,
          completed_orders: completed,
          cancelled_orders: ordersData.orders?.filter((o) => o.status === 'cancelled').length || 0,
          unassigned_orders: pending,
          total_agents: agentsData.length,
          available_agents: availableAgents,
          busy_agents: agentsData.filter((a) => a.status === 'busy').length || 0,
          late_deliveries: 0,
          total_planned_distance: 0,
          avg_utilization: 0,
          workload_balance: 0,
        });
      }

      setRecentOrders(ordersData.orders || []);
      setAgents(agentsData || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return <LoadingSpinner message="Loading dashboard operational metrics..." size="lg" />;
  }

  if (error && !stats) {
    return (
      <EmptyState
        icon={<AlertCircle className="w-10 h-10 text-red-500" />}
        title="Unable to load dashboard"
        description={error}
        actionText="Try Again"
        onAction={() => fetchData()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Operations Overview</h2>
          <p className="text-sm text-gray-500">
            Real-time fleet, assignment, and delivery dispatch metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="btn-secondary text-xs"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Updating...' : 'Refresh'}
          </button>
          <button
            onClick={() => navigate('/optimize')}
            className="btn-primary text-xs"
          >
            Run Route Optimizer &rarr;
          </button>
        </div>
      </div>

      {/* Row 1: Order KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Orders"
          value={stats?.total_orders ?? 0}
          icon={<Package className="w-5 h-5 text-primary-600" />}
          subtitle="Orders logged today"
          onClick={() => navigate('/orders')}
        />
        <KPICard
          title="Pending Dispatch"
          value={stats?.pending_orders ?? 0}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          subtitle="Awaiting route optimization"
          onClick={() => navigate('/orders?status=pending')}
        />
        <KPICard
          title="In Progress"
          value={stats?.in_progress_orders ?? 0}
          icon={<Truck className="w-5 h-5 text-indigo-600" />}
          subtitle="Out for active delivery"
          onClick={() => navigate('/orders?status=in_progress')}
        />
        <KPICard
          title="Completed"
          value={stats?.completed_orders ?? 0}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          subtitle="Delivered successfully"
          onClick={() => navigate('/orders?status=completed')}
        />
      </div>

      {/* Row 2: Fleet & Dispatch KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Active Agents"
          value={`${stats?.available_agents ?? 0} / ${stats?.total_agents ?? 0}`}
          icon={<Users className="w-5 h-5 text-blue-600" />}
          subtitle="Available drivers & couriers"
          onClick={() => navigate('/agents')}
        />
        <KPICard
          title="Unassigned Orders"
          value={stats?.unassigned_orders ?? 0}
          icon={<AlertTriangle className="w-5 h-5 text-yellow-600" />}
          subtitle="Not currently routed"
          onClick={() => navigate('/optimize')}
        />
        <KPICard
          title="Late Deliveries"
          value={stats?.late_deliveries ?? 0}
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          subtitle="Beyond estimated deadline"
          changeType={stats?.late_deliveries ? 'negative' : 'neutral'}
        />
        <KPICard
          title="Planned Distance"
          value={formatDistance(stats?.total_planned_distance ?? 0)}
          icon={<Navigation className="w-5 h-5 text-purple-600" />}
          subtitle="Total routed mileage"
          onClick={() => navigate('/map')}
        />
      </div>

      {/* Row 3: 2-Column Split (Recent Orders & Agent Status Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Orders */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Recent Orders</h3>
              <p className="text-xs text-gray-400">Latest active delivery requests</p>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              View all ({stats?.total_orders ?? 0})
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No recent orders found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Weight</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() => navigate('/orders')}
                    >
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">
                        #{truncateId(order.id)}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {order.customer_name}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {formatWeight(order.package_weight)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={order.priority} type="priority" />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Agent Status Summary */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Fleet Status Summary</h3>
              <p className="text-xs text-gray-400">Current courier availability & capacity</p>
            </div>
            <button
              onClick={() => navigate('/agents')}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              Manage agents ({agents.length})
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {agents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No agents registered in fleet.
            </div>
          ) : (
            <div className="p-4 divide-y divide-gray-100">
              {agents.slice(0, 5).map((agent) => {
                const capacityPct = Math.min(
                  100,
                  Math.round(((agent.current_load || 0) / (agent.max_capacity || 1)) * 100)
                );

                return (
                  <div key={agent.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: agent.color || '#3b82f6' }}
                        />
                        <span className="font-medium text-sm text-gray-900">{agent.name}</span>
                        <span className="text-xs text-gray-400 capitalize">
                          ({agent.vehicle_type})
                        </span>
                      </div>
                      <StatusBadge status={agent.status} />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Payload capacity</span>
                      <span>
                        {formatWeight(agent.current_load || 0)} / {formatWeight(agent.max_capacity)} (
                        {capacityPct}%)
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          capacityPct > 90
                            ? 'bg-red-500'
                            : capacityPct > 70
                            ? 'bg-amber-500'
                            : 'bg-primary-500'
                        }`}
                        style={{ width: `${capacityPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
