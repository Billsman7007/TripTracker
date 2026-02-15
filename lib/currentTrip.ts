import { supabase } from "./supabaseClient";

export type CurrentTrip = {
  id: string;
  trip_reference: string;
  date: string;
  origin_name: string | null;
  destination_name: string | null;
};

/**
 * Gets the "current trip" — the in-progress trip with the lowest trip_reference.
 * A trip is "in progress" if it has at least one stop that isn't complete.
 * Returns null if there are no in-progress trips.
 */
export async function getCurrentTrip(): Promise<CurrentTrip | null> {
  try {
    // Get user's tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return null;

    // Get all trips for this tenant, ordered by trip_reference ascending
    const { data: trips, error } = await supabase
      .from("trips")
      .select("id, trip_reference, date, origin_name, destination_name")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("trip_reference", { ascending: true });

    if (error || !trips || trips.length === 0) return null;

    // Get all stops for these trips
    const { data: stops } = await supabase
      .from("stops")
      .select("trip_id, status")
      .eq("tenant_id", tenantUser.tenant_id)
      .in("trip_id", trips.map((t) => t.id));

    // Find trips that have at least one non-complete stop (= in progress)
    const stopsByTrip = new Map<string, string[]>();
    (stops || []).forEach((s: any) => {
      const list = stopsByTrip.get(s.trip_id) || [];
      list.push(s.status);
      stopsByTrip.set(s.trip_id, list);
    });

    for (const trip of trips) {
      const tripStops = stopsByTrip.get(trip.id) || [];
      // A trip is in-progress if it has stops and not all are complete,
      // OR if it has no stops yet (just created)
      const allComplete = tripStops.length > 0 && tripStops.every((s) => s === "complete");
      if (!allComplete) {
        return {
          id: trip.id,
          trip_reference: trip.trip_reference || "—",
          date: trip.date,
          origin_name: trip.origin_name,
          destination_name: trip.destination_name,
        };
      }
    }

    return null; // All trips are completed
  } catch (error) {
    console.error("Error getting current trip:", error);
    return null;
  }
}

/**
 * Gets the user's country_of_operation setting.
 * Returns "US", "CA", or "BOTH". Defaults to "US".
 */
export async function getCountrySetting(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "US";

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) return "US";

    const { data } = await supabase
      .from("settings")
      .select("country_of_operation")
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    return data?.country_of_operation || "US";
  } catch {
    return "US";
  }
}
