import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Compass,
  Zap,
  Database,
  Info,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  HelpCircle,
  Check,
  Server,
  Sliders,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/shared/Toast';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingOsrm, setTestingOsrm] = useState<boolean>(false);
  const [osrmTestStatus, setOsrmTestStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  // Settings values
  const [routingProvider, setRoutingProvider] = useState<string>('haversine');
  const [osrmUrl, setOsrmUrl] = useState<string>('https://router.project-osrm.org');
  const [defaultSpeed, setDefaultSpeed] = useState<number>(30);
  const [algorithm, setAlgorithm] = useState<string>('2opt');
  const [maxTime, setMaxTime] = useState<number>(10);
  const [isDemoDataLoaded, setIsDemoDataLoaded] = useState<boolean>(false);

  // Reset confirmation modal
  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false);
  const [resettingData, setResettingData] = useState<boolean>(false);
  const [loadingDemoData, setLoadingDemoData] = useState<boolean>(false);

  // Fetch settings from API
  const loadSettings = async () => {
    setLoading(true);
    try {
      const raw = await api.getSettings().catch(() => ({} as Record<string, string>));
      const data = raw as Record<string, string>;
      if (data) {
        if (data['routing_provider']) setRoutingProvider(data['routing_provider']);
        if (data['osrm_url']) setOsrmUrl(data['osrm_url']);
        if (data['default_speed']) setDefaultSpeed(Number(data['default_speed']) || 30);
        if (data['algorithm']) setAlgorithm(data['algorithm']);
        if (data['max_time']) setMaxTime(Number(data['max_time']) || 10);
        if (data['demo_data_loaded'] !== undefined) {
          setIsDemoDataLoaded(data['demo_data_loaded'] === 'true' || data['demo_data_loaded'] === '1');
        }
      }

      // Also check if any orders or agents have is_demo_data
      const [ordersRes, agentsRes] = await Promise.all([
        api.getOrders().catch(() => ({ orders: [] })),
        api.getAgents().catch(() => []),
      ]);

      const hasDemo =
        ordersRes?.orders?.some((o) => o.is_demo_data === 1) ||
        agentsRes?.some((a) => a.is_demo_data === 1);
      if (hasDemo) setIsDemoDataLoaded(true);
    } catch (err: any) {
      showToast('Could not load current settings', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Save Settings to Backend
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        routing_provider: routingProvider,
        osrm_url: osrmUrl,
        default_speed: String(defaultSpeed),
        algorithm,
        max_time: String(maxTime),
      };

      await api.updateSettings(payload);
      showToast('Settings saved successfully', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Test OSRM Connection
  const handleTestOsrm = async () => {
    setTestingOsrm(true);
    setOsrmTestStatus(null);
    try {
      // Test Bangalore coordinates ping
      const testEndpoint = `${osrmUrl.replace(/\/$/, '')}/nearest/v1/driving/77.5946,12.9716`;
      const response = await fetch(testEndpoint, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        setOsrmTestStatus({ success: true, message: 'Connection successful! OSRM is reachable.' });
        showToast('OSRM connection verified', 'success');
      } else {
        setOsrmTestStatus({
          success: false,
          message: `OSRM responded with status: ${response.status}`,
        });
      }
    } catch (err: any) {
      setOsrmTestStatus({
        success: false,
        message: 'Could not connect to OSRM endpoint. Check URL or CORS settings.',
      });
      showToast('OSRM test failed', 'error');
    } finally {
      setTestingOsrm(false);
    }
  };

  // Load Demo Data
  const handleLoadDemoData = async () => {
    setLoadingDemoData(true);
    try {
      await api.loadDemoData();
      setIsDemoDataLoaded(true);
      showToast('Sample dataset with orders and couriers loaded successfully!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to load demo data', 'error');
    } finally {
      setLoadingDemoData(false);
    }
  };

  // Reset All Data
  const handleConfirmReset = async () => {
    setResettingData(true);
    try {
      await api.resetDemoData();
      setIsDemoDataLoaded(true);
      setConfirmResetOpen(false);
      showToast('All system data wiped and reset to baseline demo dataset', 'info');
      await loadSettings();
    } catch (err: any) {
      showToast(err?.message || 'Failed to reset data', 'error');
    } finally {
      setResettingData(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-primary-600" />
            System & Routing Settings
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure geographic distance calculation, optimization heuristics, and demo dataset
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving || loading}
          className="btn-primary text-xs self-start sm:self-auto shadow-sm"
        >
          <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* CARD 1: Routing Provider */}
        <div className="card p-6 border border-gray-200">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-5">
            <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Routing & Distance Provider
              </h2>
              <p className="text-xs text-gray-500">
                Choose how transit distances and durations between delivery stops are calculated
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Distance Calculator
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    routingProvider === 'haversine'
                      ? 'border-primary-500 bg-primary-50/40 ring-2 ring-primary-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="routing_provider"
                    value="haversine"
                    checked={routingProvider === 'haversine'}
                    onChange={(e) => setRoutingProvider(e.target.value)}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">
                      Haversine (Great-Circle)
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Default fast approximation. Uses a 1.3x road circuitous factor. Requires no external API.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    routingProvider === 'osrm'
                      ? 'border-primary-500 bg-primary-50/40 ring-2 ring-primary-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="routing_provider"
                    value="osrm"
                    checked={routingProvider === 'osrm'}
                    onChange={(e) => setRoutingProvider(e.target.value)}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">
                      OSRM (Open Source Routing Machine)
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Real street-network distances and turn-by-turn navigation data via HTTP service.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* OSRM URL Input (Shown only when OSRM selected) */}
            {routingProvider === 'osrm' && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    OSRM Service URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={osrmUrl}
                      onChange={(e) => setOsrmUrl(e.target.value)}
                      placeholder="https://router.project-osrm.org"
                      className="input-field flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleTestOsrm}
                      disabled={testingOsrm || !osrmUrl}
                      className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Server className="w-3.5 h-3.5 text-gray-500" />
                      {testingOsrm ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                </div>

                {osrmTestStatus && (
                  <div
                    className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium ${
                      osrmTestStatus.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {osrmTestStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span>{osrmTestStatus.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Default Speed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Default Travel Speed (km/h)
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={defaultSpeed}
                  onChange={(e) => setDefaultSpeed(Number(e.target.value) || 30)}
                  className="input-field text-xs"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Used to estimate driving durations for urban delivery routes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Optimization Engine */}
        <div className="card p-6 border border-gray-200">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Optimization Engine Configuration
              </h2>
              <p className="text-xs text-gray-500">
                Tune the heuristic solver algorithm and search time limits
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Routing Algorithm
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="input-field text-xs font-medium"
              >
                <option value="2opt">
                  Nearest Neighbor + 2-Opt Local Search (Recommended - High Quality)
                </option>
                <option value="nearest_neighbor">
                  Nearest Neighbor Greedy Baseline (Fastest, Basic Heuristic)
                </option>
              </select>
              <span className="text-[11px] text-gray-500 mt-1 block">
                2-Opt iteratively improves routes by reversing intersecting path segments to eliminate crossover loops.
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Max Computation Time Limit
                </label>
                <span className="text-xs font-mono font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                  {maxTime} seconds
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="60"
                step="1"
                value={maxTime}
                onChange={(e) => setMaxTime(Number(e.target.value))}
                className="w-full accent-primary-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>2s (Quick test)</span>
                <span>30s</span>
                <span>60s (Maximum iterations)</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: Demo Data Management */}
        <div className="card p-6 border border-gray-200">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Demo Data & Seed Datasets
              </h2>
              <p className="text-xs text-gray-500">
                Populate orders, agents, and depot locations in Bangalore for sandbox testing
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Dataset Status</span>
                <span className="text-xs text-gray-500">
                  {isDemoDataLoaded
                    ? 'Sample dataset with Bangalore delivery stops is currently active.'
                    : 'No demo data currently detected.'}
                </span>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  isDemoDataLoaded
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {isDemoDataLoaded ? 'Demo Loaded' : 'Empty / Custom'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleLoadDemoData}
                disabled={loadingDemoData}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDemoData ? 'animate-spin' : ''}`} />
                {loadingDemoData ? 'Loading...' : 'Load Demo Data'}
              </button>

              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="btn-danger text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset All Data
              </button>
            </div>
          </div>
        </div>

        {/* CARD 4: About & Platform Specs */}
        <div className="card p-6 border border-gray-200">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-4">
            <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                About RouteWise Dispatch Pro
              </h2>
              <p className="text-xs text-gray-500">Platform architecture and version information</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-gray-600">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">App Version</span>
                <span className="font-semibold text-gray-900">v1.0.0-production (Ready)</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Tech Stack</span>
                <span className="font-semibold text-gray-900">
                  React 18 • TypeScript • Tailwind CSS • Leaflet • SQLite
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-gray-500">Need help understanding optimization constraints?</span>
              <Link
                to="/help"
                className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-bold"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                View Documentation & Guides
              </Link>
            </div>
          </div>
        </div>
      </form>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleConfirmReset}
        title="Reset All Platform Data?"
        message="This will delete ALL data (orders, agents, route plans, simulation logs) and reload the initial demo dataset. Are you sure?"
        confirmText="Yes, Reset All Data"
        cancelText="Cancel"
        type="danger"
        loading={resettingData}
      />
    </div>
  );
};

export default SettingsPage;
