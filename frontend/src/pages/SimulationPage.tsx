import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Play,
  Square,
  StepForward,
  RotateCcw,
  Clock,
  PlusCircle,
  XCircle,
  UserX,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Package,
  Truck,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Zap,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Agent,
  Order,
  OptimizationResult,
  RoutePlan,
  RouteStop,
  SimulationState,
  SimulationEvent,
} from '../types';
import { useToast } from '../components/shared/Toast';
import { Modal } from '../components/shared/Modal';
import { formatDistance, formatDuration, formatDateTime, formatWeight } from '../utils/formatters';

interface ReoptComparisonData {
  previousDistance: number;
  newDistance: number;
  distanceChange: number;
  distanceChangePct: number;
  previousDuration: number;
  newDuration: number;
  reassignedOrders: { orderId: string; fromAgent: string; toAgent: string }[];
  addedOrders: string[];
  removedOrders: string[];
}

export const SimulationPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);

  // Simulation state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<string>('09:00:00');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [completedStopIds, setCompletedStopIds] = useState<Set<string>>(new Set());

  // Modals & form states
  const [isAddOrderOpen, setIsAddOrderOpen] = useState<boolean>(false);
  const [newOrderForm, setNewOrderForm] = useState({
    customer_name: '',
    delivery_address: '',
    latitude: 12.9716,
    longitude: 77.5946,
    package_weight: 5,
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    time_window_start: '09:00',
    time_window_end: '18:00',
  });

  const [cancelOrderId, setCancelOrderId] = useState<string>('');
  const [unavailableAgentId, setUnavailableAgentId] = useState<string>('');
  const [delayAgentId, setDelayAgentId] = useState<string>('');
  const [delayMinutes, setDelayMinutes] = useState<number>(15);

  // Comparison modal
  const [comparisonModalOpen, setComparisonModalOpen] = useState<boolean>(false);
  const [comparisonData, setComparisonData] = useState<ReoptComparisonData | null>(null);

  const bangaloreCenter: [number, number] = [12.9716, 77.5946];
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Parse stops safely
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

  // Initial load
  const loadInitialData = useCallback(async () => {
    try {
      const [optData, agentsData, ordersData, stateData, eventsData] = await Promise.all([
        api.getCurrentOptimization().catch(() => null),
        api.getAgents().catch(() => []),
        api.getOrders().catch(() => ({ orders: [], total: 0 })),
        api.getSimulationState().catch(() => null),
        api.getSimulationEvents().catch(() => []),
      ]);

      setOptimization(optData);
      setAgents(agentsData);
      setOrders(ordersData?.orders || []);

      if (stateData) {
        setIsRunning(Boolean(stateData.is_running));
        if (stateData.current_time) setSimTime(stateData.current_time);
        if (stateData.speed_multiplier) setSpeedMultiplier(stateData.speed_multiplier);
      }

      if (eventsData && Array.isArray(eventsData)) {
        setEvents(eventsData);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load simulation environment', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Polling simulation state when running
  useEffect(() => {
    if (isRunning) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const [state, evts] = await Promise.all([
            api.getSimulationState().catch(() => null),
            api.getSimulationEvents().catch(() => null),
          ]);

          if (state) {
            setIsRunning(Boolean(state.is_running));
            if (state.current_time) setSimTime(state.current_time);
          }
          if (evts && Array.isArray(evts)) {
            setEvents(evts);
          }
        } catch {
          // ignore transient poll failure
        }
      }, 2000);
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isRunning]);

  // Handle controls
  const handleStart = async () => {
    try {
      await api.startSimulation(speedMultiplier);
      setIsRunning(true);
      showToast('Simulation started', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to start simulation', 'error');
    }
  };

  const handleStop = async () => {
    try {
      await api.stopSimulation();
      setIsRunning(false);
      showToast('Simulation stopped', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to stop simulation', 'error');
    }
  };

  const handleStep = async () => {
    try {
      const stepRes = await api.stepSimulation();
      if (stepRes?.current_time) {
        setSimTime(stepRes.current_time);
      } else {
        // Advance local clock fallback
        const [hh, mm, ss] = simTime.split(':').map(Number);
        const nextMin = (mm + 5) % 60;
        const nextHour = (hh + Math.floor((mm + 5) / 60)) % 24;
        setSimTime(
          `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}:${String(
            ss || 0
          ).padStart(2, '0')}`
        );
      }

      // Refresh events
      const latestEvents = await api.getSimulationEvents().catch(() => []);
      if (Array.isArray(latestEvents)) {
        setEvents(latestEvents);
      }

      // Check if any stops were completed
      if (stepRes?.completed_order_id) {
        setCompletedStopIds((prev) => new Set([...prev, stepRes.completed_order_id]));
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to step simulation', 'error');
    }
  };

  const handleReset = async () => {
    try {
      await api.resetSimulation();
      setIsRunning(false);
      setSimTime('09:00:00');
      setCompletedStopIds(new Set());
      await loadInitialData();
      showToast('Simulation reset to initial state', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reset simulation', 'error');
    }
  };

  // Compare previous optimization with new optimization
  const triggerReoptimizationWithComparison = async (triggerDescription: string, eventData?: any) => {
    showToast('Event injected. Re-optimizing delivery routes...', 'info');

    const previousOpt = optimization;
    const prevDistance = previousOpt?.metrics?.total_distance || 0;
    const prevDuration = previousOpt?.metrics?.total_duration || 0;

    // Previous assignments map: orderId -> agentId
    const prevAssignments = new Map<string, string>();
    if (previousOpt?.routes) {
      previousOpt.routes.forEach((r) => {
        parseRouteStops(r).forEach((s) => prevAssignments.set(s.orderId, r.agent_id));
      });
    }

    try {
      // 1. Inject event to backend
      await api.injectEvent({
        type: eventData?.type || 'event',
        description: triggerDescription,
        data: eventData,
      }).catch(() => null);

      // 2. Trigger reoptimize
      const reoptResult = await api.reoptimize({
        trigger_event: triggerDescription,
      });

      setOptimization(reoptResult);

      // 3. Compute difference
      const newDistance = reoptResult?.metrics?.total_distance || 0;
      const newDuration = reoptResult?.metrics?.total_duration || 0;
      const distanceChange = newDistance - prevDistance;
      const distanceChangePct =
        prevDistance > 0 ? ((newDistance - prevDistance) / prevDistance) * 100 : 0;

      const newAssignments = new Map<string, string>();
      const reassigned: { orderId: string; fromAgent: string; toAgent: string }[] = [];
      const added: string[] = [];
      const removed: string[] = [];

      if (reoptResult?.routes) {
        reoptResult.routes.forEach((r) => {
          parseRouteStops(r).forEach((s) => {
            newAssignments.set(s.orderId, r.agent_id);
            if (!prevAssignments.has(s.orderId)) {
              added.push(s.orderId);
            } else if (prevAssignments.get(s.orderId) !== r.agent_id) {
              const fromAgentObj = agents.find((a) => a.id === prevAssignments.get(s.orderId));
              const toAgentObj = agents.find((a) => a.id === r.agent_id);
              reassigned.push({
                orderId: s.orderId,
                fromAgent: fromAgentObj?.name || 'Previous Agent',
                toAgent: toAgentObj?.name || 'New Agent',
              });
            }
          });
        });
      }

      prevAssignments.forEach((agentId, orderId) => {
        if (!newAssignments.has(orderId)) {
          removed.push(orderId);
        }
      });

      setComparisonData({
        previousDistance: prevDistance,
        newDistance,
        distanceChange,
        distanceChangePct,
        previousDuration: prevDuration,
        newDuration,
        reassignedOrders: reassigned,
        addedOrders: added,
        removedOrders: removed,
      });

      setComparisonModalOpen(true);

      // Add local event to top of event list
      const newEvt: SimulationEvent = {
        type: eventData?.type || 'reoptimization',
        description: `Re-optimization completed: ${triggerDescription}`,
        timestamp: new Date().toLocaleTimeString(),
        data: eventData,
      };
      setEvents((prev) => [newEvt, ...prev]);

      showToast('Re-optimization complete!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Re-optimization failed', 'error');
    }
  };

  // Event Injection Handlers
  const handleAddNewOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.customer_name || !newOrderForm.delivery_address) {
      showToast('Please fill in customer name and address', 'warning');
      return;
    }

    try {
      // Create random offset near Bangalore if default
      const lat = newOrderForm.latitude + (Math.random() - 0.5) * 0.05;
      const lng = newOrderForm.longitude + (Math.random() - 0.5) * 0.05;

      const created = await api.createOrder({
        customer_name: newOrderForm.customer_name,
        delivery_address: newOrderForm.delivery_address,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        package_weight: Number(newOrderForm.package_weight),
        priority: newOrderForm.priority,
        service_duration: 10,
        status: 'pending',
      });

      setIsAddOrderOpen(false);
      setNewOrderForm({
        customer_name: '',
        delivery_address: '',
        latitude: 12.9716,
        longitude: 77.5946,
        package_weight: 5,
        priority: 'normal',
        time_window_start: '09:00',
        time_window_end: '18:00',
      });

      await triggerReoptimizationWithComparison(
        `New order ${created.id.substring(0, 8)} added for ${created.customer_name}`,
        { type: 'new_order', orderId: created.id }
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to create new order', 'error');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderId) {
      showToast('Please select an order to cancel', 'warning');
      return;
    }

    try {
      await api.cancelOrder(cancelOrderId);
      const selectedOrder = orders.find((o) => o.id === cancelOrderId);
      const orderDesc = selectedOrder?.customer_name || cancelOrderId.substring(0, 8);

      setCancelOrderId('');
      await triggerReoptimizationWithComparison(
        `Order ${cancelOrderId.substring(0, 8)} (${orderDesc}) was cancelled`,
        { type: 'cancel_order', orderId: cancelOrderId }
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel order', 'error');
    }
  };

  const handleAgentUnavailable = async () => {
    if (!unavailableAgentId) {
      showToast('Please select an agent', 'warning');
      return;
    }

    try {
      await api.updateAgentStatus(unavailableAgentId, 'offline');
      const agentObj = agents.find((a) => a.id === unavailableAgentId);

      setUnavailableAgentId('');
      await triggerReoptimizationWithComparison(
        `Agent ${agentObj?.name || unavailableAgentId} went offline`,
        { type: 'agent_unavailable', agentId: unavailableAgentId }
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update agent status', 'error');
    }
  };

  const handleAddDelay = async () => {
    if (!delayAgentId) {
      showToast('Please select an agent to delay', 'warning');
      return;
    }

    const agentObj = agents.find((a) => a.id === delayAgentId);
    await triggerReoptimizationWithComparison(
      `Agent ${agentObj?.name || delayAgentId} delayed by ${delayMinutes} mins (traffic/breakdown)`,
      { type: 'delay', agentId: delayAgentId, delayMinutes }
    );
  };

  // Agent Current Position Calculation
  const agentPositions = useMemo(() => {
    const posMap = new Map<string, { lat: number; lng: number; statusText: string }>();

    if (optimization?.routes) {
      optimization.routes.forEach((r) => {
        const agent = agents.find((a) => a.id === r.agent_id);
        const stops = parseRouteStops(r);

        if (!agent || !agent.latitude || !agent.longitude) return;

        if (stops.length === 0) {
          posMap.set(r.agent_id, {
            lat: agent.latitude,
            lng: agent.longitude,
            statusText: 'At Depot (No stops)',
          });
          return;
        }

        // Find current stop
        const pendingStops = stops.filter((s) => !completedStopIds.has(s.orderId));
        if (pendingStops.length === 0) {
          posMap.set(r.agent_id, {
            lat: agent.latitude,
            lng: agent.longitude,
            statusText: 'All deliveries completed! Returned to depot.',
          });
        } else {
          const currentTarget = pendingStops[0];
          posMap.set(r.agent_id, {
            lat: currentTarget.latitude,
            lng: currentTarget.longitude,
            statusText: `En route to Stop #${currentTarget.sequenceIndex + 1} (${currentTarget.customerName})`,
          });
        }
      });
    }

    return posMap;
  }, [optimization, agents, completedStopIds]);

  // Marker icons
  const createStopMarkerIcon = (number: number, color: string, isCompleted: boolean) => {
    if (isCompleted) {
      return L.divIcon({
        className: '',
        html: `<div style="background:#6b7280;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.2);opacity:0.65;">✓</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12],
      });
    }

    return L.divIcon({
      className: '',
      html: `<div style="background:${color};color:white;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.25);">${number}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13],
    });
  };

  const createAgentVehicleIcon = (color: string) => {
    return L.divIcon({
      className: '',
      html: `<div style="background:${color};color:white;width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:17px;border:2px solid white;box-shadow:0 3px 6px rgba(0,0,0,0.35);">🚚</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -17],
    });
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'new_order':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancel_order':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'agent_unavailable':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'delay':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-[calc(100vh-10rem)] min-h-[600px] overflow-hidden bg-gray-50 rounded-2xl shadow-sm border border-gray-200">
      {/* LEFT PANEL: Controls, Injection & Event Log (1/3 width on desktop) */}
      <div className="w-full lg:w-1/3 h-full flex flex-col border-r border-gray-200 bg-white overflow-y-auto">
        {/* Header & Status Bar */}
        <div className="p-4 border-b border-gray-200 bg-gray-900 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-gray-400'}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                Simulation Engine
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wide">
                {isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>

          {/* Prominent Simulated Clock */}
          <div className="bg-gray-800/90 rounded-xl p-3.5 border border-gray-700/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-medium">
                Simulated Time
              </span>
              <div className="text-3xl font-mono font-bold tracking-tight text-white flex items-center gap-2">
                <Clock className="w-6 h-6 text-primary-400" />
                {simTime}
              </div>
            </div>

            {/* Speed Multiplier Selector */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                Speed
              </span>
              <div className="inline-flex rounded-lg bg-gray-900 p-0.5 border border-gray-700">
                {[1, 2, 5, 10].map((speed) => (
                  <button
                    key={`speed-${speed}`}
                    onClick={() => setSpeedMultiplier(speed)}
                    className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-colors ${
                      speedMultiplier === speed
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Execution Controls */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <button
              onClick={handleStart}
              disabled={isRunning}
              className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start
            </button>
            <button
              onClick={handleStop}
              disabled={!isRunning}
              className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
            <button
              onClick={handleStep}
              className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold transition-colors disabled:opacity-40"
            >
              <StepForward className="w-3.5 h-3.5" />
              Step
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Dynamic Event Injection Section */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Inject Dynamic Event</span>
            <span className="text-[10px] text-primary-600 font-semibold bg-primary-50 px-2 py-0.5 rounded-full">
              Triggers Re-optimization
            </span>
          </h2>

          <div className="space-y-3">
            {/* 1. Add New Order Button */}
            <div>
              <button
                onClick={() => setIsAddOrderOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                Add New Order (Rush / On-Demand)
              </button>
            </div>

            {/* 2. Cancel Order Selector */}
            <div className="flex gap-2">
              <select
                value={cancelOrderId}
                onChange={(e) => setCancelOrderId(e.target.value)}
                className="flex-1 input-field text-xs py-1.5"
              >
                <option value="">Select active order to cancel...</option>
                {orders
                  .filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
                  .slice(0, 20)
                  .map((o) => (
                    <option key={`cancel-opt-${o.id}`} value={o.id}>
                      {o.id.substring(0, 8)} - {o.customer_name} ({o.package_weight}kg)
                    </option>
                  ))}
              </select>
              <button
                onClick={handleCancelOrder}
                disabled={!cancelOrderId}
                className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>

            {/* 3. Agent Unavailable Selector */}
            <div className="flex gap-2">
              <select
                value={unavailableAgentId}
                onChange={(e) => setUnavailableAgentId(e.target.value)}
                className="flex-1 input-field text-xs py-1.5"
              >
                <option value="">Select agent to mark offline...</option>
                {agents
                  .filter((a) => a.status === 'available' || a.status === 'busy')
                  .map((a) => (
                    <option key={`unavail-opt-${a.id}`} value={a.id}>
                      {a.name} ({a.vehicle_type} - {a.max_capacity}kg)
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAgentUnavailable}
                disabled={!unavailableAgentId}
                className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <UserX className="w-3.5 h-3.5" />
                Set Offline
              </button>
            </div>

            {/* 4. Add Delay Selector */}
            <div className="flex gap-2 items-center">
              <select
                value={delayAgentId}
                onChange={(e) => setDelayAgentId(e.target.value)}
                className="flex-1 input-field text-xs py-1.5"
              >
                <option value="">Select agent to delay...</option>
                {agents.map((a) => (
                  <option key={`delay-opt-${a.id}`} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <select
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
                className="w-20 input-field text-xs py-1.5"
              >
                <option value={15}>+15m</option>
                <option value={30}>+30m</option>
                <option value={45}>+45m</option>
                <option value={60}>+60m</option>
              </select>

              <button
                onClick={handleAddDelay}
                disabled={!delayAgentId}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Delay
              </button>
            </div>
          </div>
        </div>

        {/* Live Simulation Event Log */}
        <div className="flex-1 flex flex-col p-4 min-h-[220px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Simulation Event Log
            </span>
            <span className="text-[11px] text-gray-500 font-medium">
              {events.length} events recorded
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px]">
            {events.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                No events recorded yet. Start simulation or inject an event above.
              </div>
            ) : (
              events.map((evt, idx) => (
                <div
                  key={`sim-event-${idx}`}
                  className="p-2.5 rounded-lg border border-gray-100 bg-white shadow-2xs hover:border-gray-200 transition-colors text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getEventBadgeClass(
                        evt.type
                      )}`}
                    >
                      {evt.type?.replace('_', ' ') || 'Event'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {evt.timestamp || 'Just now'}
                    </span>
                  </div>
                  <p className="text-gray-700 font-medium leading-relaxed">
                    {evt.description || (evt as any).message || 'Event processed'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Live Map & Courier Status Overlays (2/3 width) */}
      <div className="w-full lg:w-2/3 h-full relative flex flex-col">
        {/* Active Fleet Delivery Progress Overlay (Top of Map) */}
        <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-2.5 z-10 flex items-center justify-between overflow-x-auto gap-4 shadow-xs">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
              Active Fleet Progress:
            </span>
            <div className="flex items-center gap-3">
              {optimization?.routes?.map((r) => {
                const agent = agents.find((a) => a.id === r.agent_id);
                const stops = parseRouteStops(r);
                const doneCount = stops.filter((s) => completedStopIds.has(s.orderId)).length;
                const total = stops.length;
                const pct = total > 0 ? Math.round((doneCount / total) * 100) : 100;

                return (
                  <div
                    key={`fleet-prog-${r.id}`}
                    className="flex items-center gap-2 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: agent?.color || '#3b82f6' }}
                    />
                    <span className="font-semibold text-gray-800">{agent?.name}</span>
                    <span className="text-gray-500 font-mono text-[11px]">
                      {doneCount}/{total} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-gray-500 whitespace-nowrap">
            {completedStopIds.size} completed
          </div>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 w-full h-full">
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

            {/* Render Agent Depot Markers */}
            {agents.map((agent) => {
              if (!agent.latitude || !agent.longitude) return null;
              const depotIcon = L.divIcon({
                className: '',
                html: `<div style="background:${agent.color || '#3b82f6'};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;border:2.5px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);">🏭</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              });

              return (
                <Marker
                  key={`sim-depot-${agent.id}`}
                  position={[agent.latitude, agent.longitude]}
                  icon={depotIcon}
                >
                  <Popup>
                    <div className="text-xs font-sans">
                      <div className="font-bold text-gray-900">{agent.name} (Depot)</div>
                      <div className="text-gray-500">{agent.depot_address}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Render Route Polylines and Delivery Stops */}
            {optimization?.routes?.map((route) => {
              const agent = agents.find((a) => a.id === route.agent_id);
              const color = route.agent_color || agent?.color || '#3b82f6';
              const stops = parseRouteStops(route);

              const coords: [number, number][] = [];
              if (agent?.latitude && agent?.longitude) {
                coords.push([agent.latitude, agent.longitude]);
              }
              stops.forEach((s) => {
                if (s.latitude && s.longitude) coords.push([s.latitude, s.longitude]);
              });

              return (
                <React.Fragment key={`sim-route-${route.id}`}>
                  {/* Polyline */}
                  {coords.length > 1 && (
                    <Polyline
                      positions={coords}
                      pathOptions={{
                        color,
                        weight: 3.5,
                        opacity: 0.8,
                        dashArray: isRunning ? '6, 6' : undefined,
                      }}
                    />
                  )}

                  {/* Stops */}
                  {stops.map((stop, sIndex) => {
                    if (!stop.latitude || !stop.longitude) return null;
                    const isCompleted = completedStopIds.has(stop.orderId);
                    const stopIcon = createStopMarkerIcon(sIndex + 1, color, isCompleted);

                    return (
                      <Marker
                        key={`sim-stop-${route.id}-${stop.orderId}`}
                        position={[stop.latitude, stop.longitude]}
                        icon={stopIcon}
                      >
                        <Popup>
                          <div className="p-1 min-w-[190px] text-xs font-sans">
                            <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-100">
                              <span className="font-bold text-gray-900">
                                Stop #{sIndex + 1}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  isCompleted
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {isCompleted ? 'Completed' : 'Pending'}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="font-medium text-gray-800">
                                {stop.customerName}
                              </div>
                              <div className="text-gray-500 truncate">{stop.address}</div>
                              <div className="text-gray-600 flex justify-between">
                                <span>Est. Arrival:</span>
                                <span className="font-semibold">{stop.arrivalTime || '-'}</span>
                              </div>
                              <div className="text-gray-600 flex justify-between">
                                <span>Courier:</span>
                                <span className="font-medium" style={{ color }}>
                                  {agent?.name}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Current Real-Time Agent Positions */}
            {Array.from(agentPositions.entries()).map(([agentId, pos]) => {
              const agent = agents.find((a) => a.id === agentId);
              const color = agent?.color || '#3b82f6';
              const truckIcon = createAgentVehicleIcon(color);

              return (
                <Marker
                  key={`sim-vehicle-${agentId}`}
                  position={[pos.lat, pos.lng]}
                  icon={truckIcon}
                >
                  <Popup>
                    <div className="p-1 text-xs font-sans">
                      <div className="font-bold text-gray-900 flex items-center gap-1.5 mb-1">
                        <Truck className="w-4 h-4 text-primary-600" />
                        {agent?.name}
                      </div>
                      <div className="text-gray-600 font-medium mb-1">{pos.statusText}</div>
                      <div className="text-[11px] text-gray-500">
                        Vehicle: {agent?.vehicle_type} • Max Load: {agent?.max_capacity}kg
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Quick Add Order Modal */}
      <Modal
        isOpen={isAddOrderOpen}
        onClose={() => setIsAddOrderOpen(false)}
        title="Add Dynamic On-Demand Order"
        size="md"
      >
        <form onSubmit={handleAddNewOrder} className="space-y-4 text-xs font-medium">
          <div>
            <label className="block text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              required
              value={newOrderForm.customer_name}
              onChange={(e) =>
                setNewOrderForm((prev) => ({ ...prev, customer_name: e.target.value }))
              }
              placeholder="e.g. Maya Sharma"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Delivery Address</label>
            <input
              type="text"
              required
              value={newOrderForm.delivery_address}
              onChange={(e) =>
                setNewOrderForm((prev) => ({ ...prev, delivery_address: e.target.value }))
              }
              placeholder="e.g. Koramangala 5th Block, Bangalore"
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 mb-1">Package Weight (kg)</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={newOrderForm.package_weight}
                onChange={(e) =>
                  setNewOrderForm((prev) => ({
                    ...prev,
                    package_weight: parseFloat(e.target.value) || 1,
                  }))
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1">Priority</label>
              <select
                value={newOrderForm.priority}
                onChange={(e) =>
                  setNewOrderForm((prev) => ({
                    ...prev,
                    priority: e.target.value as any,
                  }))
                }
                className="input-field"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsAddOrderOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <PlusCircle className="w-4 h-4" />
              Add Order & Re-optimize
            </button>
          </div>
        </form>
      </Modal>

      {/* Re-optimization Before/After Comparison Modal */}
      <Modal
        isOpen={comparisonModalOpen}
        onClose={() => setComparisonModalOpen(false)}
        title="Dynamic Re-optimization Impact"
        size="lg"
      >
        {comparisonData && (
          <div className="space-y-6 text-sm">
            {/* Metric Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Distance Impact */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Total Fleet Distance
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-gray-900">
                    {formatDistance(comparisonData.newDistance)}
                  </span>
                  <span className="text-xs text-gray-500 line-through">
                    {formatDistance(comparisonData.previousDistance)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                  {comparisonData.distanceChange <= 0 ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {Math.abs(comparisonData.distanceChange).toFixed(1)} km saved (
                      {Math.abs(comparisonData.distanceChangePct).toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />+
                      {comparisonData.distanceChange.toFixed(1)} km added (+
                      {comparisonData.distanceChangePct.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>

              {/* Time Impact */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Total Delivery Duration
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-gray-900">
                    {formatDuration(comparisonData.newDuration)}
                  </span>
                  <span className="text-xs text-gray-500 line-through">
                    {formatDuration(comparisonData.previousDuration)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Updated based on road travel factor and service times
                </div>
              </div>
            </div>

            {/* Changes in Assignments */}
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
                Reassigned Stops ({comparisonData.reassignedOrders.length})
              </h3>
              {comparisonData.reassignedOrders.length === 0 ? (
                <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-lg border border-gray-100">
                  No existing orders were moved between agents.
                </div>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {comparisonData.reassignedOrders.map((ro, i) => (
                    <div
                      key={`reassign-${i}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs"
                    >
                      <span className="font-mono font-medium text-gray-700">
                        Order #{ro.orderId.substring(0, 8)}
                      </span>
                      <div className="flex items-center gap-2 font-medium">
                        <span className="text-rose-600">{ro.fromAgent}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-emerald-600">{ro.toAgent}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Added and Removed summary */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="font-bold text-emerald-800 block mb-1">
                  Newly Inserted Stops:
                </span>
                <span className="text-gray-700">
                  {comparisonData.addedOrders.length > 0
                    ? `${comparisonData.addedOrders.length} stop(s) added to route sequence`
                    : 'None'}
                </span>
              </div>
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                <span className="font-bold text-rose-800 block mb-1">Removed Stops:</span>
                <span className="text-gray-700">
                  {comparisonData.removedOrders.length > 0
                    ? `${comparisonData.removedOrders.length} stop(s) removed`
                    : 'None'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setComparisonModalOpen(false)}
                className="btn-primary"
              >
                Apply & Continue Simulation
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SimulationPage;
