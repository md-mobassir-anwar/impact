import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  Eye,
  EyeOff,
  Maximize2,
  RefreshCw,
  Zap,
  MapPin,
  Clock,
  Package,
  User,
  AlertCircle,
  Truck,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { Agent, OptimizationResult, RoutePlan, RouteStop, Order } from '../types';
import { formatDistance, formatDuration, formatDateTime, formatWeight, getPriorityColor } from '../utils/formatters';

// Map controller to handle programmatic panning/zooming to bounds
function MapBoundsController({
  bounds,
  triggerFit,
}: {
  bounds: L.LatLngBoundsExpression | null;
  triggerFit: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (bounds && triggerFit > 0) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (err) {
        console.warn('Could not fit map bounds:', err);
      }
    }
  }, [bounds, triggerFit, map]);

  return null;
}

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [ordersMap, setOrdersMap] = useState<Map<string, Order>>(new Map());
  const [visibleAgentIds, setVisibleAgentIds] = useState<Set<string>>(new Set());
  const [showToggles, setShowToggles] = useState<boolean>(true);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  // Default center on Bangalore
  const bangaloreCenter: [number, number] = [12.9716, 77.5946];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [optData, agentsData, ordersData] = await Promise.all([
        api.getCurrentOptimization().catch(() => null),
        api.getAgents().catch(() => [] as Agent[]),
        api.getOrders().catch(() => ({ orders: [], total: 0 })),
      ]);

      setOptimization(optData);
      setAgents(agentsData);

      const ordMap = new Map<string, Order>();
      if (ordersData && Array.isArray(ordersData.orders)) {
        ordersData.orders.forEach((o) => ordMap.set(o.id, o));
      }
      setOrdersMap(ordMap);

      if (agentsData && agentsData.length > 0) {
        setVisibleAgentIds(new Set(agentsData.map((a) => a.id)));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load route data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Parse stops safely from route
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

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  // Compute all coordinates to calculate bounds
  const mapBounds = useMemo(() => {
    const points: [number, number][] = [];

    // Add agent depots
    agents.forEach((a) => {
      if (visibleAgentIds.has(a.id) && a.latitude && a.longitude) {
        points.push([a.latitude, a.longitude]);
      }
    });

    // Add stops for visible routes
    if (optimization?.routes) {
      optimization.routes.forEach((route) => {
        if (visibleAgentIds.has(route.agent_id)) {
          const stops = parseRouteStops(route);
          stops.forEach((s) => {
            if (s.latitude && s.longitude) {
              points.push([s.latitude, s.longitude]);
            }
          });
        }
      });
    }

    if (points.length === 0) return null;
    return L.latLngBounds(points);
  }, [agents, optimization, visibleAgentIds]);

  const toggleAgentVisibility = (agentId: string) => {
    setVisibleAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const showAllAgents = () => {
    setVisibleAgentIds(new Set(agents.map((a) => a.id)));
  };

  const hideAllAgents = () => {
    setVisibleAgentIds(new Set());
  };

  const handleFitRoutes = () => {
    setFitTrigger((prev) => prev + 1);
  };

  // Helper to create numbered stop marker
  const createStopIcon = (color: string, number: number) => {
    return L.divIcon({
      className: '',
      html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer;">${number}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  };

  // Helper to create depot marker
  const createDepotIcon = (color: string) => {
    return L.divIcon({
      className: '',
      html: `<div style="background:${color};color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">🏭</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  };

  const hasRoutes = Boolean(optimization?.routes && optimization.routes.length > 0);

  return (
    <div className="relative w-full h-[calc(100vh-10rem)] min-h-[580px] flex flex-col bg-gray-100 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Top Map Control Bar */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-2.5 z-10 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Live Route Map</h1>
            <p className="text-xs text-gray-500">
              {hasRoutes
                ? `${optimization?.routes.length} active routes • ${optimization?.metrics?.assigned_orders ?? 0} deliveries planned`
                : 'No routes generated yet'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-2xs"
            title="Refresh routes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleFitRoutes}
            disabled={!hasRoutes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-2xs disabled:opacity-50"
            title="Fit zoom to show all routes"
          >
            <Maximize2 className="w-3.5 h-3.5 text-gray-500" />
            Fit to Routes
          </button>

          <button
            onClick={() => setShowToggles((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors shadow-2xs"
          >
            <Layers className="w-3.5 h-3.5" />
            {showToggles ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Main Map Canvas */}
      <div className="relative flex-1 w-full h-full">
        {loading && (
          <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 bg-white px-5 py-4 rounded-xl shadow-lg border border-gray-200">
              <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
              <span className="text-sm font-medium text-gray-700">Loading map data...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg shadow-md flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <MapContainer
          center={bangaloreCenter}
          zoom={12}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', zIndex: 1 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsController bounds={mapBounds} triggerFit={fitTrigger} />

          {/* Render Agent Depots */}
          {agents.map((agent) => {
            if (!visibleAgentIds.has(agent.id) || !agent.latitude || !agent.longitude) {
              return null;
            }

            const agentColor = agent.color || '#3b82f6';
            const depotIcon = createDepotIcon(agentColor);

            return (
              <Marker
                key={`depot-${agent.id}`}
                position={[agent.latitude, agent.longitude]}
                icon={depotIcon}
              >
                <Popup>
                  <div className="p-1 min-w-[200px] text-xs font-sans text-gray-800">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-gray-200 mb-2">
                      <span className="text-base">🏭</span>
                      <div>
                        <div className="font-bold text-sm text-gray-900">{agent.name} (Depot)</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                          {agent.vehicle_type}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Address:</span>
                        <span className="font-medium text-right max-w-[130px] truncate">
                          {agent.depot_address || 'Bangalore Depot'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Max Capacity:</span>
                        <span className="font-medium">{agent.max_capacity} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Shift Window:</span>
                        <span className="font-medium">
                          {agent.shift_start} - {agent.shift_end}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                        <span className="text-gray-500">Status:</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            agent.status === 'available'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Render Route Polylines and Stop Markers */}
          {optimization?.routes?.map((route) => {
            const agent = agentMap.get(route.agent_id);
            const agentColor = route.agent_color || agent?.color || '#3b82f6';
            const isVisible = visibleAgentIds.has(route.agent_id);

            if (!isVisible) return null;

            const stops = parseRouteStops(route);
            const pathCoordinates: [number, number][] = [];

            // Add starting depot position if available
            if (agent?.latitude && agent?.longitude) {
              pathCoordinates.push([agent.latitude, agent.longitude]);
            }

            stops.forEach((s) => {
              if (s.latitude && s.longitude) {
                pathCoordinates.push([s.latitude, s.longitude]);
              }
            });

            return (
              <React.Fragment key={`route-group-${route.id}`}>
                {/* Route Polyline */}
                {pathCoordinates.length > 1 && (
                  <Polyline
                    positions={pathCoordinates}
                    pathOptions={{
                      color: agentColor,
                      weight: 4,
                      opacity: 0.85,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                )}

                {/* Delivery Stops */}
                {stops.map((stop, sIndex) => {
                  if (!stop.latitude || !stop.longitude) return null;

                  const stopIcon = createStopIcon(agentColor, sIndex + 1);
                  const orderDetails = ordersMap.get(stop.orderId);
                  const weight = orderDetails?.package_weight ?? stop.load ?? 0;
                  const priority = orderDetails?.priority ?? 'normal';
                  const address = stop.address || orderDetails?.delivery_address || 'Delivery Address';
                  const customer = stop.customerName || orderDetails?.customer_name || 'Customer';

                  return (
                    <Marker
                      key={`stop-${route.id}-${stop.orderId}-${sIndex}`}
                      position={[stop.latitude, stop.longitude]}
                      icon={stopIcon}
                    >
                      <Popup>
                        <div className="p-1 min-w-[220px] text-xs font-sans text-gray-800">
                          <div className="flex items-center justify-between pb-1.5 border-b border-gray-200 mb-2">
                            <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                              <span
                                className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold"
                                style={{ backgroundColor: agentColor }}
                              >
                                {sIndex + 1}
                              </span>
                              Stop #{sIndex + 1}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${getPriorityColor(
                                priority
                              )}`}
                            >
                              {priority}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div>
                              <span className="text-gray-500 block text-[10px] uppercase tracking-wider">
                                Order ID
                              </span>
                              <span className="font-mono font-medium text-gray-700">
                                {stop.orderId}
                              </span>
                            </div>

                            <div>
                              <span className="text-gray-500 block text-[10px] uppercase tracking-wider">
                                Customer & Address
                              </span>
                              <div className="font-semibold text-gray-900">{customer}</div>
                              <div className="text-gray-600 line-clamp-2">{address}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                              <div>
                                <span className="text-gray-500 block text-[10px]">Weight:</span>
                                <span className="font-semibold">{formatWeight(weight)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block text-[10px]">Est. Arrival:</span>
                                <span className="font-semibold text-primary-700">
                                  {stop.arrivalTime || 'TBD'}
                                </span>
                              </div>
                            </div>

                            {agent && (
                              <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-[11px]">
                                <span className="text-gray-500">Courier:</span>
                                <span className="font-medium" style={{ color: agentColor }}>
                                  {agent.name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Empty State Overlay */}
        {!hasRoutes && !loading && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-4">
            <div className="pointer-events-auto max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 p-6 text-center">
              <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">No Optimized Routes Yet</h2>
              <p className="text-sm text-gray-600 mb-5">
                Go to the Optimize page to run the routing algorithm and generate optimal delivery paths for your fleet.
              </p>
              <button
                onClick={() => navigate('/optimize')}
                className="btn-primary w-full shadow-md"
              >
                <Zap className="w-4 h-4" />
                Go to Optimize
              </button>
            </div>
          </div>
        )}

        {/* Floating Route Visibility Toggle Panel (Top-Right) */}
        {showToggles && (
          <div className="absolute top-4 right-4 z-20 w-72 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 p-3.5 transition-all">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Active Routes
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={showAllAgents}
                  className="text-[11px] font-medium text-primary-600 hover:text-primary-800 px-1 py-0.5 rounded hover:bg-primary-50 transition-colors"
                >
                  Show All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={hideAllAgents}
                  className="text-[11px] font-medium text-gray-500 hover:text-gray-700 px-1 py-0.5 rounded hover:bg-gray-100 transition-colors"
                >
                  Hide All
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {agents.length === 0 ? (
                <div className="text-xs text-gray-500 py-3 text-center">No agents registered</div>
              ) : (
                agents.map((agent) => {
                  const isChecked = visibleAgentIds.has(agent.id);
                  const agentColor = agent.color || '#3b82f6';
                  const agentRoute = optimization?.routes?.find((r) => r.agent_id === agent.id);
                  const stopCount = agentRoute ? parseRouteStops(agentRoute).length : 0;

                  return (
                    <label
                      key={`toggle-${agent.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer text-xs transition-colors border border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAgentVisibility(agent.id)}
                          className="rounded text-primary-600 focus:ring-primary-500 h-3.5 w-3.5 border-gray-300 cursor-pointer"
                        />
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: agentColor }}
                        />
                        <span className="font-medium text-gray-800 truncate">{agent.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {stopCount} stops
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Legend Panel (Bottom-Left) */}
        <div className="absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 p-3.5 max-w-xs transition-all">
          <div className="text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-2">
            Map Legend
          </div>

          <div className="space-y-2 text-xs text-gray-600">
            {/* Markers representation */}
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs shadow-xs border border-white">
                🏭
              </div>
              <span className="font-medium text-gray-700">Agent Depot (Start & End)</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs border border-white">
                1
              </div>
              <span className="font-medium text-gray-700">Numbered Delivery Stop</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-6 h-1 rounded-full bg-primary-600"></div>
              <span className="font-medium text-gray-700">Assigned Transit Polyline</span>
            </div>
          </div>

          {/* Color Key */}
          {agents.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Couriers
              </div>
              <div className="flex flex-wrap gap-1.5">
                {agents.slice(0, 6).map((agent) => (
                  <span
                    key={`legend-agent-${agent.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: agent.color || '#3b82f6' }}
                    />
                    {agent.name.split(' ')[0]}
                  </span>
                ))}
                {agents.length > 6 && (
                  <span className="text-[10px] text-gray-400 self-center">
                    +{agents.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapPage;
