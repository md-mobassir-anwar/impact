import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Truck,
  Package,
} from 'lucide-react';
import { api } from '../services/api';
import { OptimizationResult, RoutePlan, RouteStop } from '../types';
import { Pagination } from '../components/shared/Pagination';
import {
  formatDistance,
  formatDuration,
  formatDateTime,
  formatWeight,
  truncateId,
} from '../utils/formatters';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [runs, setRuns] = useState<OptimizationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Expanded row ID set
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOptimizationHistory();
      if (Array.isArray(data)) {
        // Sort descending by created_at
        const sorted = [...data].sort((a, b) => {
          const tA = new Date(a.created_at || 0).getTime();
          const tB = new Date(b.created_at || 0).getTime();
          return tB - tA;
        });
        setRuns(sorted);
      } else {
        setRuns([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load optimization history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const parseRouteStops = (route: RoutePlan): RouteStop[] => {
    if (Array.isArray(route.stop_sequence)) return route.stop_sequence;
    if (typeof (route as any).stop_sequence === 'string') {
      try {
        return JSON.parse((route as any).stop_sequence);
      } catch {
        return [];
      }
    }
    if (Array.isArray((route as any).stops)) return (route as any).stops;
    return [];
  };

  // Paginated runs
  const totalPages = Math.ceil(runs.length / itemsPerPage);
  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return runs.slice(start, start + itemsPerPage);
  }, [runs, currentPage, itemsPerPage]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary-600" />
            Optimization Run History
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Historical audit log of all initial and dynamic re-optimization runs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh History
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
            <span className="text-sm font-medium">Retrieving past optimization records...</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">No Optimization Runs Yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-5">
              You haven't run any route optimizations yet. Launch an optimization run to start logging results.
            </p>
            <button
              onClick={() => navigate('/optimize')}
              className="btn-primary text-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              Go to Optimize
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3.5">Run ID</th>
                    <th className="px-4 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Algorithm</th>
                    <th className="px-4 py-3.5">Orders</th>
                    <th className="px-4 py-3.5">Assigned</th>
                    <th className="px-4 py-3.5">Distance</th>
                    <th className="px-4 py-3.5">Duration</th>
                    <th className="px-4 py-3.5">Improvement</th>
                    <th className="px-4 py-3.5">Quality</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Trigger</th>
                    <th className="px-4 py-3.5 text-right">Details</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedRuns.map((run) => {
                    const isExpanded = expandedRunIds.has(run.id);
                    const totalDistance = run.metrics?.total_distance ?? 0;
                    const totalDuration = run.metrics?.total_duration ?? 0;
                    const totalOrders = run.metrics?.total_orders ?? 0;
                    const assignedOrders = run.metrics?.assigned_orders ?? 0;
                    const improvement = run.metrics?.improvement_pct;

                    return (
                      <React.Fragment key={`history-row-${run.id}`}>
                        <tr
                          onClick={() => toggleExpand(run.id)}
                          className="hover:bg-primary-50/40 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-primary-600">
                            {truncateId(run.id)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {formatDateTime(run.created_at)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {run.algorithm || 'Nearest Neighbor + 2-Opt'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{totalOrders}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-emerald-700">
                              {assignedOrders}
                            </span>
                            {run.metrics?.unassigned_orders ? (
                              <span className="text-[10px] text-rose-500 ml-1">
                                ({run.metrics.unassigned_orders} unassigned)
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {formatDistance(totalDistance)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {formatDuration(totalDuration)}
                          </td>
                          <td className="px-4 py-3">
                            {improvement !== undefined && improvement !== null ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold">
                                <TrendingDown className="w-3 h-3" />
                                {Number(improvement).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {run.metrics?.solution_quality || 'Heuristic'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {run.is_reoptimization ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                                Re-optimization
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                                Initial
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">
                            {run.trigger_event || 'Manual execution'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(run.id);
                              }}
                              className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Details Pane */}
                        {isExpanded && (
                          <tr className="bg-gray-50/70 border-y border-gray-200">
                            <td colSpan={12} className="px-6 py-4">
                              <div className="space-y-4">
                                {/* Header Summary */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-200 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800">
                                      Detailed Run Summary:
                                    </span>
                                    <span className="font-mono text-gray-600">{run.id}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-gray-600">
                                    <span>
                                      Computation Time:{' '}
                                      <strong className="text-gray-900">
                                        {run.metrics?.computation_time_ms ?? 0} ms
                                      </strong>
                                    </span>
                                    <span>
                                      Travel Time:{' '}
                                      <strong className="text-gray-900">
                                        {formatDuration(run.metrics?.total_travel_time)}
                                      </strong>
                                    </span>
                                    <span>
                                      Objective Value:{' '}
                                      <strong className="text-gray-900">
                                        {run.metrics?.objective_value?.toFixed(2) ?? '-'}
                                      </strong>
                                    </span>
                                  </div>
                                </div>

                                {/* Per-Agent Route Summaries */}
                                <div>
                                  <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                                    Per-Courier Route Breakdown
                                  </h4>
                                  {run.routes && run.routes.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {run.routes.map((rt) => {
                                        const stops = parseRouteStops(rt);
                                        return (
                                          <div
                                            key={`exp-route-${rt.id}`}
                                            className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1.5"
                                          >
                                            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                                                <Truck className="w-3.5 h-3.5 text-primary-600" />
                                                {rt.agent_name || `Agent ${rt.agent_id.substring(0, 8)}`}
                                              </span>
                                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-50 text-primary-700">
                                                {stops.length} stops
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                                              <div>
                                                <span className="text-gray-400 block text-[10px]">
                                                  Distance:
                                                </span>
                                                <span className="font-semibold text-gray-700">
                                                  {formatDistance(rt.total_distance)}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-400 block text-[10px]">
                                                  Duration:
                                                </span>
                                                <span className="font-semibold text-gray-700">
                                                  {formatDuration(rt.total_duration)}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-400 block text-[10px]">
                                                  Total Load:
                                                </span>
                                                <span className="font-semibold text-gray-700">
                                                  {formatWeight(rt.total_load)}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-400 block text-[10px]">
                                                  Route Status:
                                                </span>
                                                <span className="font-semibold uppercase text-emerald-600">
                                                  {rt.status || 'Active'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500 italic">
                                      No routes generated in this optimization run.
                                    </div>
                                  )}
                                </div>

                                {/* Unassigned Orders Section */}
                                {run.unassigned && run.unassigned.length > 0 && (
                                  <div className="pt-2 border-t border-gray-200">
                                    <h4 className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      Unassigned Orders ({run.unassigned.length})
                                    </h4>
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                      {run.unassigned.map((u, uIdx) => (
                                        <div
                                          key={`unassigned-${u.orderId}-${uIdx}`}
                                          className="flex items-center justify-between p-2 rounded-lg bg-rose-50/70 border border-rose-200 text-xs text-rose-900"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold">
                                              {u.orderId}
                                            </span>
                                            {u.customerName && (
                                              <span className="text-gray-700 font-medium">
                                                ({u.customerName})
                                              </span>
                                            )}
                                          </div>
                                          <span className="font-medium text-rose-700 italic">
                                            {u.reason}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
