import Database from 'better-sqlite3';
import { SimulationEvent, SimulationState, Notification } from '../models/types';
/**
 * Creates and inserts a notification into the notifications table.
 */
export declare function createNotification(db: Database.Database, type: string, title: string, message: string, severity?: 'info' | 'warning' | 'error' | 'success', relatedEntityType?: string, relatedEntityId?: string): Notification;
/**
 * Gets the current simulation state from the database.
 */
export declare function getSimulationState(db: Database.Database): SimulationState;
/**
 * Starts the delivery simulation.
 */
export declare function startSimulation(db: Database.Database, speedMultiplier?: number): SimulationState;
/**
 * Stops the delivery simulation.
 */
export declare function stopSimulation(db: Database.Database): SimulationState;
/**
 * Resets the simulation state.
 */
export declare function resetSimulation(db: Database.Database): SimulationState;
/**
 * Advances the simulation by one step.
 */
export declare function stepSimulation(db: Database.Database): {
    success: boolean;
    currentTime: string;
    events: SimulationEvent[];
    completedCount: number;
};
/**
 * Injects a dynamic real-time event and handles re-optimization if necessary.
 */
export declare function injectSimulationEvent(db: Database.Database, eventInput: {
    type: 'new_order' | 'cancel_order' | 'agent_unavailable' | 'delay' | 'complete_delivery';
    data: any;
}): {
    success: boolean;
    event: SimulationEvent;
    reoptimizationResult?: any;
};
/**
 * Re-runs optimization while preserving completed deliveries.
 */
export declare function triggerReoptimization(db: Database.Database, triggerEvent: string, affectedOrderId?: string, affectedAgentId?: string): import("../models/types").OptimizationResult | null;
//# sourceMappingURL=simulation-service.d.ts.map