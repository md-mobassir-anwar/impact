import { getDb } from '../database';

const EARTH_RADIUS_KM = 6371;
export const DEFAULT_ROAD_FACTOR = 1.3;
export const DEFAULT_SPEED_KMH = 40;

/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = EARTH_RADIUS_KM * c;
  return Math.round(dist * 1000) / 1000; // Round to 3 decimal places (meters)
}

/**
 * Calculates estimated road distance and travel duration.
 * Distance is in kilometers, duration is in minutes.
 */
export function roadDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  speedKmh: number = DEFAULT_SPEED_KMH,
  roadFactor: number = DEFAULT_ROAD_FACTOR
): { distance: number; duration: number } {
  const straightDist = haversineDistance(lat1, lon1, lat2, lon2);
  const dist = Math.round(straightDist * roadFactor * 100) / 100;
  const speed = speedKmh > 0 ? speedKmh : DEFAULT_SPEED_KMH;
  const duration = Math.round((dist / speed) * 60 * 10) / 10; // in minutes

  return {
    distance: dist,
    duration,
  };
}

/**
 * Gets the current routing provider setting from database.
 */
export function getRoutingProvider(): string {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('routing_provider') as { value: string } | undefined;
    return row?.value || 'haversine';
  } catch {
    return 'haversine';
  }
}

/**
 * Gets the default speed setting from database in km/h.
 */
export function getDefaultSpeedKmh(): number {
  try {
    const db = getDb();
    const row = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('default_speed_kmh') as { value: string } | undefined;
    if (row && !isNaN(Number(row.value))) {
      return Number(row.value);
    }
  } catch {
    // Fall back to default
  }
  return DEFAULT_SPEED_KMH;
}

/**
 * Builds an NxN distance and duration matrix for a list of locations.
 */
export function buildDistanceMatrix(
  locations: { lat: number; lon: number }[],
  speedKmh?: number,
  roadFactor: number = DEFAULT_ROAD_FACTOR
): { distances: number[][]; durations: number[][] } {
  const speed = speedKmh ?? getDefaultSpeedKmh();
  const n = locations.length;
  const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const durations: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distances[i][j] = 0;
        durations[i][j] = 0;
      } else if (j > i) {
        const { distance, duration } = roadDistance(
          locations[i].lat,
          locations[i].lon,
          locations[j].lat,
          locations[j].lon,
          speed,
          roadFactor
        );
        distances[i][j] = distance;
        durations[i][j] = duration;
        distances[j][i] = distance;
        durations[j][i] = duration;
      }
    }
  }

  return { distances, durations };
}

/**
 * OSRM matrix API caller with haversine fallback
 */
export async function getOsrmMatrix(
  locations: { lat: number; lon: number }[],
  speedKmh: number = DEFAULT_SPEED_KMH
): Promise<{ distances: number[][]; durations: number[][] }> {
  try {
    const db = getDb();
    const urlSetting = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('osrm_url') as { value: string } | undefined;
    const baseUrl = urlSetting?.value || 'http://router.project-osrm.org';

    // Form coordinate string lon,lat;lon,lat
    const coordsStr = locations.map((loc) => `${loc.lon},${loc.lat}`).join(';');
    const url = `${baseUrl}/table/v1/driving/${coordsStr}?annotations=distance,duration`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as {
        code: string;
        distances: number[][]; // in meters
        durations: number[][]; // in seconds
      };
      if (data.code === 'Ok' && data.distances && data.durations) {
        const distances = data.distances.map((row) =>
          row.map((val) => Math.round((val / 1000) * 100) / 100)
        );
        const durations = data.durations.map((row) =>
          row.map((val) => Math.round((val / 60) * 10) / 10)
        );
        return { distances, durations };
      }
    }
  } catch {
    // Silently fall back to haversine road matrix
  }

  return buildDistanceMatrix(locations, speedKmh);
}
