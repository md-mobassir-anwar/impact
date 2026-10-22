import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Edit2,
  Trash2,
  Ban,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Database,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Order, Agent } from '../types';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Modal } from '../components/shared/Modal';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useToast } from '../context/ToastContext';
import { formatWeight, formatDateTime, truncateId } from '../utils/formatters';

interface OrderFormData {
  customer_name: string;
  delivery_address: string;
  latitude: number | '';
  longitude: number | '';
  package_weight: number | '';
  package_length?: number | '';
  package_width?: number | '';
  package_height?: number | '';
  service_duration: number | '';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  time_window_start?: string;
  time_window_end?: string;
  deadline?: string;
  special_instructions?: string;
}

const initialFormData: OrderFormData = {
  customer_name: '',
  delivery_address: '',
  latitude: '',
  longitude: '',
  package_weight: '',
  package_length: '',
  package_width: '',
  package_height: '',
  service_duration: 10,
  priority: 'normal',
  time_window_start: '',
  time_window_end: '',
  deadline: '',
  special_instructions: '',
};

type SortField = 'id' | 'customer_name' | 'delivery_address' | 'package_weight' | 'priority' | 'deadline' | 'status';
type SortDirection = 'asc' | 'desc';

export const OrdersPage: React.FC = () => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('deadline');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modals & Actions
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<OrderFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Confirm delete / cancel
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Order | null>(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Load initial data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, agentsRes] = await Promise.all([
        api.getOrders(),
        api.getAgents().catch(() => []),
      ]);
      setOrders(ordersRes.orders || []);
      setAgents(agentsRes || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load orders');
      showToast(err?.message || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Agents lookup map
  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.customer_name.trim()) {
      errors.customer_name = 'Customer name is required';
    }
    if (!formData.delivery_address.trim()) {
      errors.delivery_address = 'Delivery address is required';
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

    if (formData.package_weight === '' || isNaN(Number(formData.package_weight))) {
      errors.package_weight = 'Package weight is required';
    } else if (Number(formData.package_weight) <= 0) {
      errors.package_weight = 'Weight must be greater than 0 kg';
    }

    if (formData.service_duration !== '' && Number(formData.service_duration) < 0) {
      errors.service_duration = 'Duration cannot be negative';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingOrder(null);
    setFormData(initialFormData);
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      customer_name: order.customer_name || '',
      delivery_address: order.delivery_address || '',
      latitude: order.latitude ?? '',
      longitude: order.longitude ?? '',
      package_weight: order.package_weight ?? '',
      package_length: order.package_length ?? '',
      package_width: order.package_width ?? '',
      package_height: order.package_height ?? '',
      service_duration: order.service_duration ?? 10,
      priority: order.priority || 'normal',
      time_window_start: order.time_window_start ? order.time_window_start.slice(0, 16) : '',
      time_window_end: order.time_window_end ? order.time_window_end.slice(0, 16) : '',
      deadline: order.deadline ? order.deadline.slice(0, 16) : '',
      special_instructions: order.special_instructions || '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Submit Order Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    const payload: Partial<Order> = {
      customer_name: formData.customer_name.trim(),
      delivery_address: formData.delivery_address.trim(),
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      package_weight: Number(formData.package_weight),
      package_length: formData.package_length ? Number(formData.package_length) : undefined,
      package_width: formData.package_width ? Number(formData.package_width) : undefined,
      package_height: formData.package_height ? Number(formData.package_height) : undefined,
      service_duration: formData.service_duration ? Number(formData.service_duration) : 10,
      priority: formData.priority,
      time_window_start: formData.time_window_start ? new Date(formData.time_window_start).toISOString() : undefined,
      time_window_end: formData.time_window_end ? new Date(formData.time_window_end).toISOString() : undefined,
      deadline: formData.deadline ? new Date(formData.deadline).toISOString() : undefined,
      special_instructions: formData.special_instructions?.trim() || undefined,
    };

    try {
      if (editingOrder) {
        const updated = await api.updateOrder(editingOrder.id, payload);
        setOrders((prev) => prev.map((o) => (o.id === editingOrder.id ? updated : o)));
        showToast('Order updated successfully', 'success');
      } else {
        const created = await api.createOrder(payload);
        setOrders((prev) => [created, ...prev]);
        showToast('Order created successfully', 'success');
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Order
  const handleDeleteOrder = async () => {
    if (!deleteConfirmOrder) return;
    setActionLoading(true);
    try {
      await api.deleteOrder(deleteConfirmOrder.id);
      setOrders((prev) => prev.filter((o) => o.id !== deleteConfirmOrder.id));
      showToast('Order deleted successfully', 'success');
      setDeleteConfirmOrder(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete order', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Order
  const handleCancelOrder = async () => {
    if (!cancelConfirmOrder) return;
    setActionLoading(true);
    try {
      const updated = await api.cancelOrder(cancelConfirmOrder.id);
      setOrders((prev) => prev.map((o) => (o.id === cancelConfirmOrder.id ? updated : o)));
      showToast('Order cancelled', 'success');
      setCancelConfirmOrder(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel order', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const blob = await api.exportOrdersCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Orders exported to CSV', 'success');
    } catch (err: any) {
      showToast(err?.message || 'CSV export failed', 'error');
    }
  };

  // Load Demo Data
  const handleLoadDemoData = async () => {
    try {
      await api.loadDemoData();
      showToast('Demo data loaded successfully', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to load demo data', 'error');
    }
  };

  // Bulk Import handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let ordersToUpload: Partial<Order>[] = [];

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        ordersToUpload = Array.isArray(parsed) ? parsed : [parsed];
      } else if (file.name.endsWith('.csv')) {
        // Simple CSV parser
        const lines = text.trim().split('\n');
        if (lines.length > 1) {
          const headers = lines[0].split(',').map((h) => h.trim());
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map((v) => v.trim());
            const rowObj: any = {};
            headers.forEach((h, index) => {
              rowObj[h] = values[index];
            });

            if (rowObj.customer_name && rowObj.delivery_address) {
              ordersToUpload.push({
                customer_name: rowObj.customer_name,
                delivery_address: rowObj.delivery_address,
                latitude: Number(rowObj.latitude) || 37.7749,
                longitude: Number(rowObj.longitude) || -122.4194,
                package_weight: Number(rowObj.package_weight) || 2.5,
                priority: (rowObj.priority as any) || 'normal',
                service_duration: Number(rowObj.service_duration) || 10,
              });
            }
          }
        }
      }

      if (ordersToUpload.length === 0) {
        showToast('No valid order records found in file', 'warning');
        return;
      }

      const res = await api.bulkCreateOrders(ordersToUpload);
      showToast(`Successfully imported ${res.created} orders`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(`Import error: ${err?.message || 'Invalid file format'}`, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Filtered & Sorted orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const matchSearch =
          order.customer_name.toLowerCase().includes(search.toLowerCase()) ||
          order.delivery_address.toLowerCase().includes(search.toLowerCase()) ||
          order.id.toLowerCase().includes(search.toLowerCase());

        const matchStatus = statusFilter === 'all' || order.status === statusFilter;
        const matchPriority = priorityFilter === 'all' || order.priority === priorityFilter;

        return matchSearch && matchStatus && matchPriority;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'deadline') {
          valA = a.deadline ? new Date(a.deadline).getTime() : 0;
          valB = b.deadline ? new Date(b.deadline).getTime() : 0;
        }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [orders, search, statusFilter, priorityFilter, sortField, sortDir]);

  // Paginated data
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const currentOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage]);

  return (
    <div className="space-y-6">
      {/* Hidden file input for bulk upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,.json"
        className="hidden"
      />

      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Orders Management</h2>
          <p className="text-sm text-gray-500">
            Dispatch, track, and manage all delivery orders across your network
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleLoadDemoData}
            className="btn-secondary text-xs"
            title="Load sample demo data"
          >
            <Database className="w-3.5 h-3.5 text-gray-500" />
            Load Demo Data
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs"
            title="Import from CSV or JSON"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            Bulk Import
          </button>
          <button
            onClick={handleExportCsv}
            className="btn-secondary text-xs"
            title="Export to CSV"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            Export CSV
          </button>
          <button onClick={handleOpenCreate} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            Add Order
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search customer, address, or ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="input-field pl-9 py-2 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field py-1.5 text-xs w-36"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="input-field py-1.5 text-xs w-32"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Refresh */}
          <button
            onClick={fetchData}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
            title="Refresh order list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <LoadingSpinner message="Loading orders..." />
      ) : error ? (
        <EmptyState
          icon={<AlertCircle className="w-10 h-10 text-red-500" />}
          title="Could not load orders"
          description={error}
          actionText="Retry"
          onAction={fetchData}
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No orders found"
          description={
            orders.length === 0
              ? 'Get started by creating your first order or loading demo test data.'
              : 'No orders match your active search or filter criteria.'
          }
          actionText={orders.length === 0 ? 'Create Order' : 'Clear Filters'}
          onAction={
            orders.length === 0
              ? handleOpenCreate
              : () => {
                  setSearch('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center gap-1">
                      ID <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('customer_name')}
                  >
                    <div className="flex items-center gap-1">
                      Customer <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('delivery_address')}
                  >
                    <div className="flex items-center gap-1">
                      Address <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('package_weight')}
                  >
                    <div className="flex items-center gap-1">
                      Weight <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center gap-1">
                      Priority <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('deadline')}
                  >
                    <div className="flex items-center gap-1">
                      Deadline <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {currentOrders.map((order) => {
                  const assignedAgent = order.assigned_agent_id
                    ? agentMap.get(order.assigned_agent_id)
                    : null;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-500">
                        #{truncateId(order.id)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        {order.customer_name}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 text-xs max-w-xs truncate" title={order.delivery_address}>
                        {order.delivery_address}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 text-xs">
                        {formatWeight(order.package_weight)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.priority} type="priority" />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500">
                        {formatDateTime(order.deadline)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {assignedAgent ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: assignedAgent.color || '#3b82f6' }}
                            />
                            <span className="font-medium text-gray-800">{assignedAgent.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(order)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Order"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {order.status !== 'cancelled' && order.status !== 'completed' && (
                            <button
                              onClick={() => setCancelConfirmOrder(order)}
                              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Cancel Order"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {order.status === 'pending' && (
                            <button
                              onClick={() => setDeleteConfirmOrder(order)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Pending Order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 text-xs text-gray-500">
            <div>
              Showing{' '}
              <span className="font-medium text-gray-700">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-gray-700">
                {Math.min(currentPage * pageSize, filteredOrders.length)}
              </span>{' '}
              of <span className="font-medium text-gray-700">{filteredOrders.length}</span> orders
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Order Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingOrder ? 'Edit Delivery Order' : 'Create New Delivery Order'}
        size="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="e.g. Acme Corp"
                className={`input-field ${formErrors.customer_name ? 'border-red-500' : ''}`}
              />
              {formErrors.customer_name && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.customer_name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Delivery Address *
              </label>
              <input
                type="text"
                value={formData.delivery_address}
                onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                placeholder="e.g. 742 Evergreen Terrace"
                className={`input-field ${formErrors.delivery_address ? 'border-red-500' : ''}`}
              />
              {formErrors.delivery_address && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.delivery_address}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Latitude (-90 to 90) *
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
                Longitude (-180 to 180) *
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

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Package Weight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.package_weight}
                onChange={(e) => setFormData({ ...formData, package_weight: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="2.5"
                className={`input-field ${formErrors.package_weight ? 'border-red-500' : ''}`}
              />
              {formErrors.package_weight && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.package_weight}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Service Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.service_duration}
                onChange={(e) => setFormData({ ...formData, service_duration: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="10"
                className={`input-field ${formErrors.service_duration ? 'border-red-500' : ''}`}
              />
              {formErrors.service_duration && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.service_duration}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Priority Level
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="input-field"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hard Delivery Deadline
              </label>
              <input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Time Window Start
              </label>
              <input
                type="datetime-local"
                value={formData.time_window_start}
                onChange={(e) => setFormData({ ...formData, time_window_start: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Time Window End
              </label>
              <input
                type="datetime-local"
                value={formData.time_window_end}
                onChange={(e) => setFormData({ ...formData, time_window_end: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Package Dimensions (cm) - Optional
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="Length"
                value={formData.package_length || ''}
                onChange={(e) => setFormData({ ...formData, package_length: e.target.value === '' ? '' : Number(e.target.value) })}
                className="input-field text-xs"
              />
              <input
                type="number"
                placeholder="Width"
                value={formData.package_width || ''}
                onChange={(e) => setFormData({ ...formData, package_width: e.target.value === '' ? '' : Number(e.target.value) })}
                className="input-field text-xs"
              />
              <input
                type="number"
                placeholder="Height"
                value={formData.package_height || ''}
                onChange={(e) => setFormData({ ...formData, package_height: e.target.value === '' ? '' : Number(e.target.value) })}
                className="input-field text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Special Instructions
            </label>
            <textarea
              rows={2}
              value={formData.special_instructions}
              onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
              placeholder="e.g. Ring side doorbell, leave in front lobby"
              className="input-field"
            />
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
              {submitting ? 'Saving...' : editingOrder ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Order Confirm */}
      <ConfirmDialog
        isOpen={Boolean(cancelConfirmOrder)}
        onClose={() => setCancelConfirmOrder(null)}
        onConfirm={handleCancelOrder}
        title="Cancel Delivery Order"
        message={`Are you sure you want to cancel order #${truncateId(cancelConfirmOrder?.id)} for ${cancelConfirmOrder?.customer_name}?`}
        confirmText="Yes, Cancel Order"
        type="warning"
        loading={actionLoading}
      />

      {/* Delete Order Confirm */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmOrder)}
        onClose={() => setDeleteConfirmOrder(null)}
        onConfirm={handleDeleteOrder}
        title="Delete Pending Order"
        message={`Are you sure you want to permanently delete order #${truncateId(deleteConfirmOrder?.id)}? This action cannot be undone.`}
        confirmText="Delete Order"
        type="danger"
        loading={actionLoading}
      />
    </div>
  );
};
