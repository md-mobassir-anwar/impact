"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.setDb = setDb;
exports.initializeDatabase = initializeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
let dbInstance = null;
function getDb() {
    if (!dbInstance) {
        const defaultPath = path_1.default.resolve(__dirname, '..', 'routewise.db');
        return initializeDatabase(defaultPath);
    }
    return dbInstance;
}
function setDb(db) {
    dbInstance = db;
}
function initializeDatabase(dbPath) {
    const resolvedPath = dbPath || path_1.default.resolve(__dirname, '..', 'routewise.db');
    if (dbInstance && dbPath && dbInstance.name !== resolvedPath) {
        try {
            dbInstance.close();
        }
        catch {
            // Ignore close error on existing
        }
        dbInstance = null;
    }
    const db = new better_sqlite3_1.default(resolvedPath);
    dbInstance = db;
    // Performance and integrity settings
    if (resolvedPath !== ':memory:') {
        db.pragma('journal_mode = WAL');
    }
    db.pragma('foreign_keys = ON');
    // Schema creation
    db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      package_weight REAL NOT NULL DEFAULT 1.0,
      package_length REAL,
      package_width REAL,
      package_height REAL,
      service_duration INTEGER NOT NULL DEFAULT 10,
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      time_window_start TEXT,
      time_window_end TEXT,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','assigned','in_progress','completed','cancelled','failed')),
      assigned_agent_id TEXT,
      special_instructions TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_demo_data INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      depot_address TEXT NOT NULL DEFAULT 'Depot',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      vehicle_type TEXT NOT NULL DEFAULT 'van',
      max_capacity REAL NOT NULL DEFAULT 100.0,
      max_volume REAL,
      shift_start TEXT NOT NULL DEFAULT '08:00',
      shift_end TEXT NOT NULL DEFAULT '18:00',
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','busy','offline','on_break')),
      current_load REAL NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_demo_data INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS optimization_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
      algorithm TEXT NOT NULL,
      total_orders INTEGER NOT NULL,
      assigned_orders INTEGER NOT NULL DEFAULT 0,
      unassigned_orders INTEGER NOT NULL DEFAULT 0,
      total_distance REAL NOT NULL DEFAULT 0,
      total_duration REAL NOT NULL DEFAULT 0,
      total_travel_time REAL NOT NULL DEFAULT 0,
      objective_value REAL NOT NULL DEFAULT 0,
      computation_time_ms REAL NOT NULL DEFAULT 0,
      solution_quality TEXT DEFAULT 'heuristic',
      baseline_distance REAL,
      baseline_duration REAL,
      improvement_pct REAL,
      config TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_reoptimization INTEGER NOT NULL DEFAULT 0,
      trigger_event TEXT
    );

    CREATE TABLE IF NOT EXISTS route_plans (
      id TEXT PRIMARY KEY,
      optimization_run_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      stop_sequence TEXT NOT NULL,
      total_distance REAL NOT NULL DEFAULT 0,
      total_duration REAL NOT NULL DEFAULT 0,
      total_load REAL NOT NULL DEFAULT 0,
      departure_time TEXT,
      estimated_completion TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (optimization_run_id) REFERENCES optimization_runs(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS simulation_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      is_running INTEGER NOT NULL DEFAULT 0,
      current_time TEXT,
      speed_multiplier REAL NOT NULL DEFAULT 1.0,
      events TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info','warning','error','success')),
      is_read INTEGER NOT NULL DEFAULT 0,
      related_entity_type TEXT,
      related_entity_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
    // Default settings
    const defaultSettings = {
        routing_provider: 'haversine',
        osrm_url: 'http://router.project-osrm.org',
        default_speed_kmh: '40',
        optimization_algorithm: 'nearest_neighbor_2opt',
        max_optimization_time_ms: '30000',
    };
    const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `);
    const txSettings = db.transaction(() => {
        for (const [key, value] of Object.entries(defaultSettings)) {
            insertSetting.run(key, value);
        }
    });
    txSettings();
    // Initialize simulation_state if row 1 does not exist
    const existingSim = db.prepare('SELECT id FROM simulation_state WHERE id = 1').get();
    if (!existingSim) {
        db.prepare(`
      INSERT INTO simulation_state (id, is_running, current_time, speed_multiplier, events)
      VALUES (1, 0, datetime('now'), 1.0, '[]')
    `).run();
    }
    return db;
}
//# sourceMappingURL=database.js.map