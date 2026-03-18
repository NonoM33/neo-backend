interface GeocodeResult {
  lat: number;
  lng: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode an address using OpenStreetMap Nominatim
 * Rate limit: 1 request per second (we cache results in the session)
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      format: 'json',
      q: address,
      limit: '1',
      countrycodes: 'fr',
    });

    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        'User-Agent': 'NeoDomotique/1.0 (contact@neo-domotique.fr)',
        'Accept-Language': 'fr',
      },
    });

    if (!response.ok) {
      console.error(`[Geocode] HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[Geocode] No results for address: ${address}`);
      return null;
    }

    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
  } catch (error) {
    console.error('[Geocode] Error:', error);
    return null;
  }
}
