import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  RefreshCw,
  Bike,
  Truck,
  Car,
  Clock,
  MapPin,
  Package,
  AlertCircle,
  ToggleLeft,
} from 'lucide-react';
import { api } from '../services/api';
import { Agent } from '../types';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Modal } from '../components/shared/Modal';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useToast } from '../context/ToastContext';
import { formatWeight } from '../utils/formatters';

interface AgentFormData {
  name: string;
  depot_address: string;
  latitude: number | '';
  longitude: number | '';
  vehicle_type: string;
  max_capacity: number | '';
  max_volume?: number | '';
  shift_start: string;
  shift_end: string;
  color: string;
}

const defaultAgentColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

const initialFormData: AgentFormData = {
  name: '',
  depot_address: '',
  latitude: '',
  longitude: '',
  vehicle_type: 'van',
  max_capacity: 100,
  max_volume: 500,
  shift_start: '08:00',
  shift_end: '17:00',
  color: '#3b82f6',
};

export const AgentsPage: React.FC = () => {
  const { showToast } = useToast();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form modal
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Delete confirm
  const [deleteConfirmAgent, setDeleteConfirmAgent] = useState<Agent | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAgents();
      setAgents(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load agents');
      showToast(err?.message || 'Failed to load agents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Agent name is required';
    }
    if (!formData.depot_address.trim()) {
      errors.depot_address = 'Depot address is required';
    }

    if (formData.latitude === '' || isNaN(Number(formData.latitude))) {
      errors.latitude = 'Valid latitude is required';
    } else {
      const lat = Number(formData.latitude);
      if (lat < -90 || lat > 90) {
        errors.latitude = 'Latitude must be between -90 and 90';
      }
    }

    if (formData.longitude === '' || isNaN(Number(formData.longitude))) {
      errors.longitude = 'Valid longitude is required';
    } else {
      const lng = Number(formData.longitude);
      if (lng < -180 || lng > 180) {
        errors.longitude = 'Longitude must be between -180 and 180';
      }
    }

    if (formData.max_capacity === '' || isNaN(Number(formData.max_capacity))) {
      errors.max_capacity = 'Max capacity is required';
    } else if (Number(formData.max_capacity) <= 0) {
      errors.max_capacity = 'Capacity must be greater than 0 kg';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setEditingAgent(null);
    setFormData({
      ...initialFormData,
      color: defaultAgentColors[Math.floor(Math.random() * defaultAgentColors.length)],
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name || '',
      depot_address: agent.depot_address || '',
      latitude: agent.latitude ?? '',
      longitude: agent.longitude ?? '',
      vehicle_type: agent.vehicle_type || 'van',
      max_capacity: agent.max_capacity ?? 100,
      max_volume: agent.max_volume ?? '',
      shift_start: agent.shift_start || '08:00',
      shift_end: agent.shift_end || '17:00',
      color: agent.color || '#3b82f6',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    const payload: Partial<Agent> = {
      name: formData.name.trim(),
      depot_address: formData.depot_address.trim(),
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      vehicle_type: formData.vehicle_type,
      max_capacity: Number(formData.max_capacity),
      max_volume: formData.max_volume ? Number(formData.max_volume) : undefined,
      shift_start: formData.shift_start,
      shift_end: formData.shift_end,
      color: formData.color,
    };

    try {
      if (editingAgent) {
        const updated = await api.updateAgent(editingAgent.id, payload);
        setAgents((prev) => prev.map((a) => (a.id === editingAgent.id ? updated : a)));
        showToast('Agent details updated', 'success');
      } else {
        const created = await api.createAgent(payload);
        setAgents((prev) => [...prev, created]);
        showToast('Agent successfully added to fleet', 'success');
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save agent', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    const statusCycle: Record<string, string> = {
      available: 'busy',
      busy: 'on_break',
      on_break: 'offline',
      offline: 'available',
    };
    const nextStatus = statusCycle[agent.status] || 'available';

    try {
      const updated = await api.updateAgentStatus(agent.id, nextStatus);
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
      showToast(`${agent.name} status updated to ${nextStatus.replace('_', ' ')}`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update agent status', 'error');
    }
  };

  const handleDeleteAgent = async () => {
    if (!deleteConfirmAgent) return;
    if ((deleteConfirmAgent.assigned_orders || 0) > 0) {
      showToast('Cannot delete agent with active assigned orders', 'warning');
      setDeleteConfirmAgent(null);
      return;
    }

    setActionLoading(true);
    try {
      await api.deleteAgent(deleteConfirmAgent.id);
      setAgents((prev) => prev.filter((a) => a.id !== deleteConfirmAgent.id));
      showToast('Agent deleted from fleet', 'success');
      setDeleteConfirmAgent(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete agent', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'bike':
      case 'bicycle':
        return <Bike className="w-4 h-4" />;
      case 'truck':
        return <Truck className="w-4 h-4" />;
      default:
        return <Car className="w-4 h-4" />;
    }
  };

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchSearch =
        agent.name.toLowerCase().includes(search.toLowerCase()) ||
        agent.depot_address.toLowerCase().includes(search.toLowerCase()) ||
        agent.vehicle_type.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'all' || agent.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [agents, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Fleet & Courier Management</h2>
          <p className="text-sm text-gray-500">
            Monitor agent availability, vehicle capacities, shift rosters, and route allocations
          </p>
        </div>

        <button onClick={handleOpenCreate} className="btn-primary text-xs">
          <Plus className="w-4 h-4" />
          Add Agent
        </button>
      </div>

      {/* Search, Filter & View Controls */}
      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search agent name, vehicle, or depot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 py-2 text-xs"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field py-1.5 text-xs w-36"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="on_break">On Break</option>
            <option value="offline">Offline</option>
          </select>

          <div className="flex items-center border border-gray-200 rounded-lg p-0.5 bg-gray-50">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchAgents}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
            title="Refresh Agents"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Agents Body */}
      {loading ? (
        <LoadingSpinner message="Loading fleet agents..." />
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="w-10 h-10 text-red-500" />}
          title="Could not load fleet"
          description={error}
          actionText="Retry"
          onAction={fetchAgents}
        />
      ) : filteredAgents.length === 0 ? (
        <EmptyState
          title="No agents found"
          description={
            agents.length === 0
              ? 'No drivers or couriers registered yet. Add your first fleet agent to begin.'
              : 'No agents match your current filters.'
          }
          actionText={agents.length === 0 ? 'Add First Agent' : 'Clear Filters'}
          onAction={
            agents.length === 0
              ? handleOpenCreate
              : () => {
                  setSearch('');
                  setStatusFilter('all');
                }
          }
        />
      ) : viewMode === 'grid' ? (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAgents.map((agent) => {
            const capacityPct = Math.min(
              100,
              Math.round(((agent.current_load || 0) / (agent.max_capacity || 1)) * 100)
            );

            return (
              <div
                key={agent.id}
                className="card p-5 relative overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Color highlight bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: agent.color || '#3b82f6' }}
                />

                <div className="flex items-start justify-between gap-3 mb-3 pt-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-base">{agent.name}</h3>
                      <div
                        className="p-1 rounded-md bg-gray-100 text-gray-700"
                        title={`Vehicle: ${agent.vehicle_type}`}
                      >
                        {getVehicleIcon(agent.vehicle_type)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[190px]" title={agent.depot_address}>
                        {agent.depot_address}
                      </span>
                    </div>
                  </div>

                  <StatusBadge status={agent.status} />
                </div>

                {/* Workload Capacity Bar */}
                <div className="my-4 p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5 font-medium">
                    <span>Load Utilization</span>
                    <span>
                      {formatWeight(agent.current_load || 0)} / {formatWeight(agent.max_capacity)} (
                      {capacityPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
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

                {/* Metrics Meta */}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                      {agent.shift_start} - {agent.shift_end}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Package className="w-3.5 h-3.5 text-gray-400" />
                    <span>{agent.assigned_orders || 0} stops assigned</span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleStatus(agent)}
                    className="btn-secondary text-xs flex-1 py-1.5"
                    title="Cycle agent status"
                  >
                    <ToggleLeft className="w-3.5 h-3.5 text-gray-500" />
                    Toggle Status
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(agent)}
                      className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit Agent Details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmAgent(agent)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Agent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Agent Name</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Depot Address</th>
                  <th className="py-3 px-4">Shift Hours</th>
                  <th className="py-3 px-4">Capacity Utilization</th>
                  <th className="py-3 px-4">Assigned Orders</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredAgents.map((agent) => {
                  const capacityPct = Math.min(
                    100,
                    Math.round(((agent.current_load || 0) / (agent.max_capacity || 1)) * 100)
                  );

                  return (
                    <tr key={agent.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: agent.color || '#3b82f6' }}
                          />
                          <span>{agent.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 capitalize text-gray-700 text-xs">
                        <div className="flex items-center gap-1.5">
                          {getVehicleIcon(agent.vehicle_type)}
                          <span>{agent.vehicle_type}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-xs max-w-xs truncate" title={agent.depot_address}>
                        {agent.depot_address}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 text-xs">
                        {agent.shift_start} - {agent.shift_end}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="w-36">
                          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                            <span>{formatWeight(agent.current_load || 0)}</span>
                            <span>{capacityPct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 bg-primary-500 rounded-full"
                              style={{ width: `${capacityPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-gray-700">
                        {agent.assigned_orders || 0}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={agent.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(agent)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Toggle Status"
                          >
                            <ToggleLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(agent)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Agent"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmAgent(agent)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Agent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Agent Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingAgent ? 'Edit Fleet Agent' : 'Register New Fleet Agent'}
        size="md"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Agent Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. John Doe"
              className={`input-field ${formErrors.name ? 'border-red-500' : ''}`}
            />
            {formErrors.name && (
              <p className="text-[11px] text-red-500 mt-1">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Depot / Hub Address *
            </label>
            <input
              type="text"
              value={formData.depot_address}
              onChange={(e) => setFormData({ ...formData, depot_address: e.target.value })}
              placeholder="e.g. Central Depot, 100 Market St"
              className={`input-field ${formErrors.depot_address ? 'border-red-500' : ''}`}
            />
            {formErrors.depot_address && (
              <p className="text-[11px] text-red-500 mt-1">{formErrors.depot_address}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Depot Latitude *
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="37.7749"
                className={`input-field ${formErrors.latitude ? 'border-red-500' : ''}`}
              />
              {formErrors.latitude && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.latitude}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Depot Longitude *
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="-122.4194"
                className={`input-field ${formErrors.longitude ? 'border-red-500' : ''}`}
              />
              {formErrors.longitude && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.longitude}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vehicle Type
              </label>
              <select
                value={formData.vehicle_type}
                onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                className="input-field"
              >
                <option value="bike">Bike / Cargo Bicycle</option>
                <option value="van">Delivery Van</option>
                <option value="truck">Box Truck</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Max Capacity (kg) *
              </label>
              <input
                type="number"
                step="1"
                value={formData.max_capacity}
                onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="100"
                className={`input-field ${formErrors.max_capacity ? 'border-red-500' : ''}`}
              />
              {formErrors.max_capacity && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.max_capacity}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Shift Start (HH:MM)
              </label>
              <input
                type="time"
                value={formData.shift_start}
                onChange={(e) => setFormData({ ...formData, shift_start: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Shift End (HH:MM)
              </label>
              <input
                type="time"
                value={formData.shift_end}
                onChange={(e) => setFormData({ ...formData, shift_end: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Route Identifier Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {defaultAgentColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      formData.color === color ? 'scale-110 border-gray-900' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Saving...' : editingAgent ? 'Update Agent' : 'Create Agent'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Agent Confirm */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmAgent)}
        onClose={() => setDeleteConfirmAgent(null)}
        onConfirm={handleDeleteAgent}
        title="Remove Fleet Agent"
        message={`Are you sure you want to remove ${deleteConfirmAgent?.name} from active fleet operations?`}
        confirmText="Remove Agent"
        type="danger"
        loading={actionLoading}
      />
    </div>
  );
};
