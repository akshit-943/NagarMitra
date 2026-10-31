/**
 * CivicPulse India Geocoding & Validation Service
 * Uses OpenStreetMap Nominatim restricted to India bounding box (6°N - 38°N, 68°E - 98°E)
 */

export const isWithinIndia = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) return false;
  return numLat >= 6.0 && numLat <= 38.5 && numLng >= 68.0 && numLng <= 98.5;
};

/**
 * Geocode Indian address to exact latitude and longitude
 * @param {string} address
 * @returns {Promise<{ latitude: number, longitude: number, displayName: string } | null>}
 */
export const geocodeIndianAddress = async (address) => {
  if (!address || typeof address !== 'string' || address.trim().length < 3) {
    return null;
  }

  // Pre-clean address for higher search hit rates
  const cleanQuery = address
    .replace(/\s+/g, ' ')
    .trim();

  // Try queries progressively: full address, then without pin/country suffix
  const queryCandidates = [
    cleanQuery,
    cleanQuery.replace(/,\s*(India|\d{6})\b/gi, '').trim(),
  ];

  for (const q of queryCandidates) {
    if (!q || q.length < 3) continue;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&countrycodes=in&limit=1&addressdetails=1`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'CivicPulse-AI-Platform/2.0 (civicpulse@municipal.internal)',
          'Accept-Language': 'en',
        },
      });

      if (!res.ok) continue;
      const data = await res.json();

      if (Array.isArray(data) && data[0]) {
        const lat = Number(data[0].lat);
        const lon = Number(data[0].lon);
        if (isWithinIndia(lat, lon)) {
          return {
            latitude: lat,
            longitude: lon,
            displayName: data[0].display_name,
          };
        }
      }
    } catch (err) {
      console.warn('⚠️ [GeocodingService] Nominatim fetch error:', err.message);
    }
  }

  return null;
};
