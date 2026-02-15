const MAPBOX_TOKEN =
  (typeof window !== "undefined" && (window as any).__ENV__?.EXPO_PUBLIC_MAPBOX_TOKEN) ||
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
  "";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

/**
 * Forward-geocode an address string into lat/lng using Mapbox Geocoding API.
 * Returns null if the address cannot be resolved.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  if (!address.trim()) return null;
  if (!MAPBOX_TOKEN) {
    console.warn("Mapbox token not configured");
    return null;
  }

  const encoded = encodeURIComponent(address.trim());
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place,postcode`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Mapbox geocoding error:", response.status);
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const [lng, lat] = feature.center; // Mapbox returns [lng, lat]

    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: feature.place_name || address,
    };
  } catch (error) {
    console.error("Mapbox geocoding failed:", error);
    return null;
  }
}
