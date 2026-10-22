import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Package,
  Users,
  Zap,
  Play,
  Compass,
  Keyboard,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Database,
  ArrowRight,
  Clock,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/shared/Toast';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  content: React.ReactNode;
}

export const HelpPage: React.FC = () => {
  const { showToast } = useToast();
  const [loadingDemo, setLoadingDemo] = useState<boolean>(false);

  // Accordion state: open section IDs
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['getting-started', 'route-optimization'])
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(
      new Set([
        'getting-started',
        'managing-orders',
        'managing-agents',
        'route-optimization',
        'simulation',
        'routing-providers',
        'shortcuts',
        'limitations',
      ])
    );
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  const handleLoadDemoData = async () => {
    setLoadingDemo(true);
    try {
      await api.loadDemoData();
      showToast('Sample dataset loaded successfully! Ready for dispatching.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to load demo data', 'error');
    } finally {
      setLoadingDemo(false);
    }
  };

  const sections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Section 1: Getting Started Walkthrough',
      icon: PlayCircle,
      badge: 'Quick Start',
      content: (
        <div className="space-y-4 text-xs text-gray-700 leading-relaxed">
          <p>
            RouteWise is an end-to-end delivery route optimization and dispatch system. Follow these
            simple steps to run a complete delivery optimization workflow:
          </p>

          <ol className="space-y-3 list-decimal list-inside font-medium bg-gray-50/80 p-4 rounded-xl border border-gray-200">
            <li className="pl-1">
              <strong className="text-gray-900">Load the demo dataset:</strong> Click the button
              below to populate sample delivery orders and couriers in Bangalore.
            </li>
            <li className="pl-1">
              <strong className="text-gray-900">Review Agents & Orders:</strong> Visit the{' '}
              <span className="font-semibold text-primary-700">Orders</span> and{' '}
              <span className="font-semibold text-primary-700">Agents</span> pages to inspect package
              weights, priority tags, courier capacities, and shift hours.
            </li>
            <li className="pl-1">
              <strong className="text-gray-900">Run Optimization:</strong> Navigate to the{' '}
              <span className="font-semibold text-primary-700">Optimize</span> tab and click{' '}
              <span className="text-gray-900 font-bold">"Run Optimization"</span> to calculate optimal routes.
            </li>
            <li className="pl-1">
              <strong className="text-gray-900">Inspect on Interactive Map:</strong> Head to the{' '}
              <span className="font-semibold text-primary-700">Map</span> page to view color-coded
              polylines, depot hubs, and numbered sequence markers.
            </li>
            <li className="pl-1">
              <strong className="text-gray-900">Test Live Simulation:</strong> Use the{' '}
              <span className="font-semibold text-primary-700">Simulation</span> tool to test
              dispatching, advance simulated time, inject traffic delays, or add rush orders.
            </li>
            <li className="pl-1">
              <strong className="text-gray-900">Analyze Fleet Efficiency:</strong> Check the{' '}
              <span className="font-semibold text-primary-700">Analytics</span> dashboard to compare
              savings versus unoptimized routing.
            </li>
          </ol>

          <div className="pt-2">
            <button
              onClick={handleLoadDemoData}
              disabled={loadingDemo}
              className="btn-primary text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDemo ? 'animate-spin' : ''}`} />
              {loadingDemo ? 'Loading Demo Data...' : 'Load Demo Data Now'}
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'managing-orders',
      title: 'Section 2: Managing Delivery Orders',
      icon: Package,
      content: (
        <div className="space-y-4 text-xs text-gray-700 leading-relaxed">
          <p>
            Orders represent individual parcels to be delivered to customers across the service
            territory.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">Key Fields & Validation</h4>
              <ul className="space-y-1 text-gray-600 list-disc list-inside">
                <li>
                  <strong>Package Weight (kg):</strong> Must not exceed courier vehicle payload limits.
                </li>
                <li>
                  <strong>Coordinates (Lat/Lng):</strong> Decimal degrees for geocoded destination.
                </li>
                <li>
                  <strong>Priority Level:</strong> Urgent, High, Normal, or Low.
                </li>
                <li>
                  <strong>Time Window:</strong> Optional delivery window (e.g. 10:00 - 13:00).
                </li>
                <li>
                  <strong>Service Duration:</strong> Time required to hand off package (mins).
                </li>
              </ul>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">Lifecycle Statuses</h4>
              <ul className="space-y-1 text-gray-600 list-disc list-inside">
                <li>
                  <span className="font-semibold text-amber-700">Pending:</span> Newly logged, ready
                  for routing.
                </li>
                <li>
                  <span className="font-semibold text-blue-700">Assigned:</span> Assigned to an
                  agent route sequence.
                </li>
                <li>
                  <span className="font-semibold text-purple-700">In Progress:</span> Courier is
                  en route.
                </li>
                <li>
                  <span className="font-semibold text-emerald-700">Completed:</span> Parcel delivered.
                </li>
                <li>
                  <span className="font-semibold text-gray-700">Cancelled / Failed:</span> Aborted.
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-1">CSV Import / Export</h4>
            <p className="text-gray-600">
              You can bulk-import orders via CSV on the Orders page. The CSV must contain headers:{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">
                customer_name, delivery_address, latitude, longitude, package_weight, priority
              </code>
              . You can also export current orders into a downloadable CSV file at any time.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'managing-agents',
      title: 'Section 3: Managing Delivery Agents & Couriers',
      icon: Users,
      content: (
        <div className="space-y-4 text-xs text-gray-700 leading-relaxed">
          <p>
            Agents represent your delivery drivers and vehicles (bikes, scooters, vans, and mini-trucks).
          </p>

          <div className="space-y-2">
            <h4 className="font-bold text-gray-900">Vehicle Types & Capacity Defaults:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-bold text-gray-900 block">Motorbike / Scooter</span>
                <span className="text-gray-500 block mt-1">Capacity: ~20 - 35 kg</span>
                <span className="text-[11px] text-gray-400">Nimble for dense traffic zones</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-bold text-gray-900 block">Cargo Van</span>
                <span className="text-gray-500 block mt-1">Capacity: ~100 - 150 kg</span>
                <span className="text-[11px] text-gray-400">High capacity, multi-stop routing</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-bold text-gray-900 block">Electric Cargo 3-Wheeler</span>
                <span className="text-gray-500 block mt-1">Capacity: ~60 - 80 kg</span>
                <span className="text-[11px] text-gray-400">Eco-friendly city delivery</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-1">Shift and Depot Constraints</h4>
            <p className="text-gray-600">
              Each courier starts and terminates their route at their designated depot address. The
              optimization algorithm guarantees that total travel time plus service durations does not
              exceed the courier's configured shift window (<code className="bg-gray-100 px-1 py-0.5 rounded">shift_start</code> to <code className="bg-gray-100 px-1 py-0.5 rounded">shift_end</code>).
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'route-optimization',
      title: 'Section 4: Route Optimization & 2-Opt Algorithm',
      icon: Zap,
      badge: 'Core Engine',
      content: (
        <div className="space-y-4 text-xs text-gray-700 leading-relaxed">
          <p>
            RouteWise formulates routing as a Capacitated Vehicle Routing Problem with Time Windows
            (CVRPTW), solved using constructive heuristics and iterative local improvement.
          </p>

          <div className="space-y-3">
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
              <h4 className="font-bold text-blue-900 mb-1">1. Nearest Neighbor Heuristic (Greedy Baseline)</h4>
              <p className="text-blue-800">
                The greedy phase builds initial routes starting from each courier depot, sequentially
                inserting the closest unvisited delivery stop that satisfies capacity, shift, and
                time-window constraints.
              </p>
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <h4 className="font-bold text-emerald-900 mb-1">2. 2-Opt Local Search Improvement</h4>
              <p className="text-emerald-800">
                The 2-Opt algorithm systematically checks pairs of route segments and tests reversing
                sub-sequences. If reversing a segment eliminates crossover loops and decreases total
                path distance without violating delivery time constraints, the tour is updated. This
                iterates until no further 2-edge swaps produce distance savings.
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-1">What Makes an Order Unassignable?</h4>
            <p className="text-gray-600 mb-2">
              If an order cannot fit into any active courier's schedule, it is tagged as unassigned with
              an explicit reason. Common reasons include:
            </p>
            <ul className="space-y-1 text-gray-600 list-disc list-inside bg-gray-50 p-3 rounded-lg border border-gray-200">
              <li>
                <strong>Capacity Exceeded:</strong> Package weight exceeds remaining payload capacity of
                all available couriers.
              </li>
              <li>
                <strong>Shift Overrun:</strong> Travel time to stop and return to depot exceeds courier
                shift end.
              </li>
              <li>
                <strong>Time Window Violation:</strong> Arrival time would be past the customer's
                specified delivery deadline.
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'simulation',
      title: 'Section 5: Dynamic Dispatch Simulation',
      icon: Play,
      content: (
        <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
          <p>
            The simulation module allows dispatchers to stress-test their operation in a sandbox
            environment before deploying routes to real couriers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">Execution Controls</h4>
              <p className="text-gray-600">
                Use <strong>Start</strong> to advance the simulated clock continuously,{' '}
                <strong>Step</strong> to step forward in discrete increments, and{' '}
                <strong>Speed Multipliers (1x - 10x)</strong> to fast-forward through a shift.
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">Dynamic Event Injection</h4>
              <p className="text-gray-600">
                Inject sudden disruptions on the fly: rush orders, customer cancellations, courier
                breakdowns, or severe traffic delays. The engine immediately triggers dynamic
                re-optimization and shows a before/after impact comparison.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'routing-providers',
      title: 'Section 6: Routing Providers (Haversine vs OSRM)',
      icon: Compass,
      content: (
        <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
          <p>RouteWise supports two distance computation backends:</p>

          <div className="space-y-2">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">Haversine Great-Circle (Default)</h4>
              <p className="text-gray-600">
                Computes straight-line spherical distance multiplied by an empirical road circuitous
                factor of <strong>1.3x</strong>. Extremely fast, zero network overhead, and works
                offline without external API dependencies.
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-1">OSRM (Open Source Routing Machine)</h4>
              <p className="text-gray-600">
                Uses real road network graphs from OpenStreetMap to determine actual turn-by-turn driving
                mileage and speed limits. Requires connection to an OSRM HTTP endpoint (e.g.,{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">
                  https://router.project-osrm.org
                </code>
                ).
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'shortcuts',
      title: 'Section 7: Keyboard Navigation & Shortcuts',
      icon: Keyboard,
      content: (
        <div className="space-y-2 text-xs text-gray-700 leading-relaxed">
          <p>Quick navigation shortcuts supported in RouteWise:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <span>Close active modal</span>
              <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded text-gray-800 font-mono text-[10px]">
                Esc
              </kbd>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <span>Submit modal form</span>
              <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded text-gray-800 font-mono text-[10px]">
                Enter
              </kbd>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'limitations',
      title: 'Section 8: Known System Limitations & Assumptions',
      icon: ShieldAlert,
      badge: 'Important',
      content: (
        <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
          <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
            <h4 className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Operational Considerations
            </h4>
            <ul className="space-y-1.5 text-amber-800 list-disc list-inside mt-2">
              <li>
                <strong>Heuristic Nature:</strong> The Vehicle Routing Problem is NP-hard. The 2-Opt
                local search heuristic finds near-optimal solutions rapidly, but mathematical global
                optimality is not guaranteed.
              </li>
              <li>
                <strong>Haversine Approximation:</strong> While calibrated with a 1.3x road factor,
                spherical distances do not account for one-way streets, bridges, or physical terrain
                barriers unless OSRM is enabled.
              </li>
              <li>
                <strong>Simulated GPS:</strong> The simulation environment runs on simulated virtual time
                rather than live vehicle telematics or hardware GPS tracking.
              </li>
              <li>
                <strong>Embedded Database:</strong> The backend utilizes SQLite for prototype
                simplicity and zero external database setup overhead.
              </li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-primary-600" />
            Help Center & Dispatch Documentation
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Comprehensive guide to routing algorithms, constraint models, and sandbox testing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2.5 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs font-semibold text-gray-600 hover:text-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = openSections.has(section.id);
          const Icon = section.icon;

          return (
            <div
              key={`help-sec-${section.id}`}
              className="card overflow-hidden border border-gray-200 transition-shadow duration-200"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-gray-50 transition-colors"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{section.title}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {section.badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-100 text-primary-800">
                      {section.badge}
                    </span>
                  )}
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="p-5 pt-3 border-t border-gray-100 bg-white">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HelpPage;
