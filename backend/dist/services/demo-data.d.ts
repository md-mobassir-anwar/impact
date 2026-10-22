import Database from 'better-sqlite3';
import { Agent, Order } from '../models/types';
export declare const DEMO_AGENTS: Omit<Agent, 'created_at' | 'updated_at' | 'current_load' | 'assigned_orders'>[];
export declare function getDemoOrders(): Omit<Order, 'created_at' | 'updated_at'>[];
/**
 * Checks whether demo data is already loaded in the database.
 */
export declare function isDemoDataLoaded(db: Database.Database): boolean;
/**
 * Loads demo agents and orders into the database.
 */
export declare function loadDemoData(db: Database.Database): {
    agentsLoaded: number;
    ordersLoaded: number;
};
/**
 * Deletes all data from tables and reloads the fresh demo data.
 */
export declare function resetDemoData(db: Database.Database): {
    agentsLoaded: number;
    ordersLoaded: number;
};
//# sourceMappingURL=demo-data.d.ts.map