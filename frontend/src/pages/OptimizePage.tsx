import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Play,
  RotateCcw,
  Map as MapIcon,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingDown,
  Navigation,
  Sliders,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import { Order, Agent, OptimizationResult, RoutePlan } from '../types';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { formatDistance, formatDuration, formatWeight, truncateId } from '../utils/formatters';

export const OptimizePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Configuration options
  const [algorithm, setAlgorithm] = useState<string>('nn_2opt');
  const [maxTimeSec, setMaxTimeSec] = useState<number>(30);
  const [balanceWorkload, setBalanceWorkload] = useState<boolean>(true);

  // Available orders and agents for selection
  const [orders, setOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  // State
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

  // Confirmation dialogs
  const [clearConfirmOpen, setClearConfirmOpen] = useState<boolean>(false);

  // Load data on mount
  const loadData = async () => {
    setLoadingInitial(true);
    try {
      const [ordersRes, agentsRes, currentOpt] = await Promise.all([
        api.getOrders(),
        api.getAgents(),
        api.getCurrentOptimization().catch(() => null),
      ]);

      const allOrders = ordersRes.orders || [];
      const allAgents = agentsRes || [];
      setOrders(allOrders);
      setAgents(allAgents);

      // Default selection: pending orders
      const pendingOrders = allOrders.filter((o) => o.status === 'pending');
      setSelectedOrderIds(
        pendingOrders.length > 0
          ? pendingOrders.map((o) => o.id)
          : allOrders.map((o) => o.id)
      );

      // Default selection: available agents
      const availableAgents = allAgents.filter((a) => a.status === 'available');
      setSelectedAgentIds(
        availableAgents.length > 0
          ? availableAgents.map((a) => a.id)
          : allAgents.map((a) => a.id)
      );

      if (currentOpt && currentOpt.routes && currentOpt.routes.length > 0) {
        setResult(currentOpt);
        // Expand first route by default
        if (currentOpt.routes[0]) {
          setExpandedRoutes({ [currentOpt.routes[0].id]: true });
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to initialize optimizer data', 'error');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Run Optimization
  const handleRunOptimization = async (isReopt = false) => {
    if (selectedAgentIds.length === 0) {
      showToast('Please select at least one agent to assign routes to', 'warning');
      return;
    }

    if (selectedOrderIds.length === 0) {
      showToast('Please select at least one order to optimize', 'warning');
      return;
    }

    setOptimizing(true);
    try {
      const payload = {
        algorithm,
        max_time_seconds: maxTimeSec,
        balance_workload: balanceWorkload,
        order_ids: selectedOrderIds,
        agent_ids: selectedAgentIds,
      };

      const optResult = isReopt
        ? await api.reoptimize(payload)
        : await api.runOptimization(payload);

      setResult(optResult);

      // Expand all routes initially for good visibility
      const expState: Record<string, boolean> = {};
      optResult.routes?.forEach((r) => {
        expState[r.id] = true;
      });
      setExpandedRoutes(expState);

      showToast(
        `Optimization completed! Assigned ${optResult.metrics?.assigned_orders ?? 0} of ${
          optResult.metrics?.total_orders ?? 0
        } orders.`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Optimization failed to complete', 'error');
    } finally {
      setOptimizing(false);
    }
  };

  // Toggle order selection
  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle agent selection
  const toggleAgentSelection = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all pending orders
  const selectAllPendingOrders = () => {
    const pendingIds = orders.filter((o) => o.status === 'pending').map((o) => o.id);
    setSelectedOrderIds(pendingIds);
  };

  // Select all available agents
  const selectAllAvailableAgents = () => {
    const availIds = agents.filter((a) => a.status === 'available').map((a) => a.id);
    setSelectedAgentIds(availIds);
  };

  // Toggle route expand
  const toggleRouteExpand = (routeId: string) => {
    setExpandedRoutes((prev) => ({
      ...prev,
      [routeId]: !prev[routeId],
    }));
  };

  // Clear current routes
  const handleClearRoutes = async () => {
    setResult(null);
    setClearConfirmOpen(false);
    showToast('Optimization plans cleared from workspace', 'info');
  };

  if (loadingInitial) {
    return <LoadingSpinner message="Preparing optimization engine..." size="lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Route Optimization Workspace
          </h2>
          <p className="text-sm text-gray-500">
            Configure algorithmic parameters, match fleet capacity, and solve vehicle routing (VRP)
          </p>
        </div>

        {result && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setClearConfirmOpen(true)}
              className="btn-secondary text-xs text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Routes
            </button>
            <button onClick={() => navigate('/map')} className="btn-secondary text-xs">
              <MapIcon className="w-3.5 h-3.5 text-primary-600" />
              View on Map
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Left Config Panel, Right Results Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration & Inputs (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card p-5 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <Sliders className="w-4 h-4 text-primary-600" />
              <h3 className="font-semibold text-gray-900 text-sm">Optimization Parameters</h3>
            </div>

            {/* Algorithm Choice */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Dispatch Algorithm
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="input-field text-xs font-medium"
              >
                <option value="nn_2opt">Nearest Neighbor + 2-Opt Local Search (Recommended)</option>
                <option value="nearest_neighbor">Greedy Nearest Neighbor (Fastest)</option>
                <option value="clarke_wright">Clarke-Wright Savings Heuristic</option>
              </select>
            </div>

            {/* Max Optimization Time Slider */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700 mb-1.5">
                <span>Max Compute Time</span>
                <span className="text-primary-600 font-bold">{maxTimeSec} seconds</span>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={maxTimeSec}
                onChange={(e) => setMaxTimeSec(Number(e.target.value))}
                className="w-full accent-primary-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Fast (5s)</span>
                <span>Balanced (30s)</span>
                <span>Deep Search (120s)</span>
              </div>
            </div>

            {/* Workload balance checkbox */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={balanceWorkload}
                onChange={(e) => setBalanceWorkload(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              />
              <span className="text-xs font-medium text-gray-700">
                Balance workload evenly across selected agents
              </span>
            </label>

            {/* Order Selection Filter */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">
                  Select Orders ({selectedOrderIds.length}/{orders.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllPendingOrders}
                    className="text-[11px] text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Pending Only
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedOrderIds(
                        selectedOrderIds.length === orders.length ? [] : orders.map((o) => o.id)
                      )
                    }
                    className="text-[11px] text-gray-500 hover:text-gray-700"
                  >
                    {selectedOrderIds.length === orders.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-gray-50 rounded-xl border border-gray-100">
                {orders.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No orders available</p>
                ) : (
                  orders.map((order) => {
                    const isSelected = selectedOrderIds.includes(order.id);
                    return (
                      <div
                        key={order.id}
                        onClick={() => toggleOrderSelection(order.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          isSelected ? 'bg-white shadow-sm border border-primary-200' : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="font-medium text-gray-900 truncate">
                            {order.customer_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-gray-500">{formatWeight(order.package_weight)}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              order.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Agent Selection Filter */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">
                  Select Fleet Agents ({selectedAgentIds.length}/{agents.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllAvailableAgents}
                    className="text-[11px] text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Available Only
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAgentIds(
                        selectedAgentIds.length === agents.length ? [] : agents.map((a) => a.id)
                      )
                    }
                    className="text-[11px] text-gray-500 hover:text-gray-700"
                  >
                    {selectedAgentIds.length === agents.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-gray-50 rounded-xl border border-gray-100">
                {agents.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No agents available</p>
                ) : (
                  agents.map((agent) => {
                    const isSelected = selectedAgentIds.includes(agent.id);
                    return (
                      <div
                        key={agent.id}
                        onClick={() => toggleAgentSelection(agent.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                          isSelected ? 'bg-white shadow-sm border border-primary-200' : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          )}
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: agent.color || '#3b82f6' }}
                          />
                          <span className="font-medium text-gray-900">{agent.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 capitalize">{agent.vehicle_type}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              agent.status === 'available'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {agent.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleRunOptimization(false)}
                disabled={optimizing || selectedOrderIds.length === 0 || selectedAgentIds.length === 0}
                className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 shadow-md shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                <Zap className="w-4 h-4" />
                {optimizing ? 'Calculating Optimal Routes...' : 'Run Route Optimization'}
              </button>

              {result && (
                <button
                  type="button"
                  onClick={() => handleRunOptimization(true)}
                  disabled={optimizing}
                  className="w-full mt-2 py-2.5 btn-secondary text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                  Re-Optimize Current Routes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Optimization Results & Route Manifests (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {optimizing ? (
            <div className="card p-12 text-center">
              <LoadingSpinner
                message="Solving multi-agent Vehicle Routing Problem (VRP)... Applying 2-opt pairwise exchanges..."
                size="lg"
              />
            </div>
          ) : !result ? (
            <EmptyState
              icon={<Zap className="w-10 h-10 text-primary-500" />}
              title="No optimization plan active"
              description="Configure your algorithm preferences on the left and click 'Run Route Optimization' to generate delivery schedules."
              actionText="Run Optimization Now"
              onAction={() => handleRunOptimization(false)}
            />
          ) : (
            <>
              {/* Summary Metrics Card */}
              <div className="card p-5 bg-gradient-to-br from-white to-gray-50/50">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-bold text-gray-900 text-sm">Optimization Run Summary</h3>
                  </div>
                  <span className="badge badge-completed text-xs uppercase">
                    {result.metrics?.solution_quality || 'Optimal'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div>
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                      Assigned Orders
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {result.metrics?.assigned_orders ?? 0} / {result.metrics?.total_orders ?? 0}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                      Total Mileage
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatDistance(result.metrics?.total_distance ?? 0)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                      Total Travel Time
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatDuration(result.metrics?.total_duration ?? 0)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                      Compute Time
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {(result.metrics?.computation_time_ms ?? 0) < 1000
                        ? `${result.metrics?.computation_time_ms ?? 0} ms`
                        : `${((result.metrics?.computation_time_ms ?? 0) / 1000).toFixed(2)} s`}
                    </span>
                  </div>
                </div>

                {/* Baseline vs Optimized Improvement Banner */}
                {result.metrics?.improvement_pct !== undefined && result.metrics.improvement_pct > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-medium">
                      <TrendingDown className="w-4 h-4 text-emerald-600" />
                      <span>
                        Route optimization reduced total travel distance by{' '}
                        <strong>{result.metrics.improvement_pct.toFixed(1)}%</strong> compared to unoptimized baseline!
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Per-Agent Route Plans */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-primary-600" />
                  Assigned Route Plans ({result.routes?.length || 0})
                </h3>

                {result.routes?.map((route: RoutePlan) => {
                  const isExpanded = expandedRoutes[route.id] ?? false;
                  const stops = route.stop_sequence || [];

                  return (
                    <div key={route.id} className="card overflow-hidden">
                      {/* Route Card Header */}
                      <div
                        onClick={() => toggleRouteExpand(route.id)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: route.agent_color || '#3b82f6' }}
                          />
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm">
                              {route.agent_name || `Agent #${truncateId(route.agent_id)}`}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {stops.length} delivery stops &bull; {formatDistance(route.total_distance)} &bull;{' '}
                              {formatDuration(route.total_duration)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">
                            Load: {formatWeight(route.total_load)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Stops Manifest */}
                      {isExpanded && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                          {stops.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No delivery stops assigned</p>
                          ) : (
                            <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                              {stops.map((stop, idx) => (
                                <div key={stop.orderId || idx} className="relative flex items-start gap-3">
                                  {/* Step Circle */}
                                  <span
                                    className="absolute -left-6 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white shadow-sm"
                                    style={{ backgroundColor: route.agent_color || '#3b82f6' }}
                                  >
                                    {idx + 1}
                                  </span>

                                  <div className="bg-white p-3 rounded-xl border border-gray-200/80 shadow-sm flex-1 text-xs">
                                    <div className="flex items-center justify-between font-medium text-gray-900 mb-0.5">
                                      <span>{stop.customerName || `Stop #${idx + 1}`}</span>
                                      <span className="text-gray-400 font-mono text-[10px]">
                                        #{truncateId(stop.orderId)}
                                      </span>
                                    </div>
                                    <p className="text-gray-500 text-[11px] mb-2">{stop.address}</p>

                                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-gray-400" />
                                        ETA: {stop.arrivalTime ? stop.arrivalTime.slice(11, 16) : '-'}
                                      </span>
                                      <span>&bull;</span>
                                      <span>Weight: {formatWeight(stop.load)}</span>
                                      {stop.distanceFromPrev > 0 && (
                                        <>
                                          <span>&bull;</span>
                                          <span>+{formatDistance(stop.distanceFromPrev)} from prev</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unassigned Orders Warning */}
              {result.unassigned && result.unassigned.length > 0 && (
                <div className="card p-5 border-amber-200 bg-amber-50/50">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h4 className="font-semibold text-amber-900 text-sm">
                      Unassigned Orders ({result.unassigned.length})
                    </h4>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    The following orders could not be dispatched within vehicle capacity, shift duration, or time window constraints:
                  </p>
                  <div className="space-y-2">
                    {result.unassigned.map((item, idx) => (
                      <div
                        key={item.orderId || idx}
                        className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-gray-900">
                          {item.customerName || `Order #${truncateId(item.orderId)}`}
                        </span>
                        <span className="text-red-600 font-medium">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Clear Confirmation */}
      <ConfirmDialog
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={handleClearRoutes}
        title="Clear Optimization Results"
        message="Are you sure you want to clear the current route solution from the workspace? This will remove generated route stops from view."
        confirmText="Clear Workspace"
        type="warning"
      />
    </div>
  );
};
