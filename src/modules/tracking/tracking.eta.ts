interface ETAResult {
  durationMinutes: number;
  distanceMeters: number;
}

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

// Cache to avoid hitting rate limits (OSRM asks for max 1 req/s)
const etaCache = new Map<string, { result: ETAResult; expiry: number }>();

/**
 * Calculate ETA using OSRM (Open Source Routing Machine)
 * Public server rate limit: ~1 request per second
 */
export async function calculateETA(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<ETAResult | null> {
  // Check cache (valid for 30 seconds)
  const cacheKey = `${fromLat.toFixed(4)},${fromLng.toFixed(4)}-${toLat.toFixed(4)},${toLng.toFixed(4)}`;
  const cached = etaCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.result;
  }

  try {
    const url = `${OSRM_URL}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NeoDomotique/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[ETA] HTTP error: ${response.status}`);
      return calculateFallbackETA(fromLat, fromLng, toLat, toLng);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn('[ETA] No route found, using fallback');
      return calculateFallbackETA(fromLat, fromLng, toLat, toLng);
    }

    const route = data.routes[0];
    const result: ETAResult = {
      durationMinutes: Math.ceil(route.duration / 60),
      distanceMeters: Math.round(route.distance),
    };

    // Cache for 30 seconds
    etaCache.set(cacheKey, { result, expiry: Date.now() + 30000 });

    return result;
  } catch (error) {
    console.error('[ETA] Error:', error);
    return calculateFallbackETA(fromLat, fromLng, toLat, toLng);
  }
}

/**
 * Fallback ETA calculation using Haversine distance
 * Assumes average speed of 40 km/h in urban areas
 */
function calculateFallbackETA(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): ETAResult {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Assume 40 km/h average speed + 20% buffer for traffic
  const avgSpeedMps = (40 * 1000) / 3600; // 40 km/h in m/s
  const durationSeconds = (distance / avgSpeedMps) * 1.2;

  return {
    durationMinutes: Math.ceil(durationSeconds / 60),
    distanceMeters: Math.round(distance),
  };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Clean up cache every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of etaCache) {
    if (entry.expiry < now) {
      etaCache.delete(key);
    }
  }
}, 300000).unref();
