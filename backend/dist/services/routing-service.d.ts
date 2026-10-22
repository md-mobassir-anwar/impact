export declare const DEFAULT_ROAD_FACTOR = 1.3;
export declare const DEFAULT_SPEED_KMH = 40;
/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 */
export declare function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
/**
 * Calculates estimated road distance and travel duration.
 * Distance is in kilometers, duration is in minutes.
 */
export declare function roadDistance(lat1: number, lon1: number, lat2: number, lon2: number, speedKmh?: number, roadFactor?: number): {
    distance: number;
    duration: number;
};
/**
 * Gets the current routing provider setting from database.
 */
export declare function getRoutingProvider(): string;
/**
 * Gets the default speed setting from database in km/h.
 */
export declare function getDefaultSpeedKmh(): number;
/**
 * Builds an NxN distance and duration matrix for a list of locations.
 */
export declare function buildDistanceMatrix(locations: {
    lat: number;
    lon: number;
}[], speedKmh?: number, roadFactor?: number): {
    distances: number[][];
    durations: number[][];
};
/**
 * OSRM matrix API caller with haversine fallback
 */
export declare function getOsrmMatrix(locations: {
    lat: number;
    lon: number;
}[], speedKmh?: number): Promise<{
    distances: number[][];
    durations: number[][];
}>;
//# sourceMappingURL=routing-service.d.ts.map