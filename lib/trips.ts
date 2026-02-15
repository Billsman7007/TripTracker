import { supabase } from "./supabaseClient";

// Types matching the database schema
export type StopType = 
  | "empty_start" 
  | "pickup" 
  | "stop" 
  | "terminal" 
  | "delivery" 
  | "reposition";

export type StopStatus = "pending" | "complete";

export interface DatabaseStop {
  id: string;
  tenant_id: string;
  trip_id: string;
  stop_order: number;
  location_id: string | null;
  type: StopType;
  name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  odometer_reading: number | null;
  status: StopStatus;
  completed_at: string | null;
  notes: string | null;
  expected_date: string | null;
  expected_time: string | null;
  created_at: string;
}

export interface DatabaseTrip {
  id: string;
  tenant_id: string;
  trip_reference: string | null;
  date: string;
  expected_mileage: number | null;
  actual_mileage: number | null;
  origin_location_id: string | null;
  origin_name: string | null;
  origin_address1: string | null;
  origin_address2: string | null;
  origin_city: string | null;
  origin_state: string | null;
  origin_zip: string | null;
  destination_location_id: string | null;
  destination_name: string | null;
  destination_address1: string | null;
  destination_address2: string | null;
  destination_city: string | null;
  destination_state: string | null;
  destination_zip: string | null;
  created_at: string;
  updated_at: string;
}

// UI Stop type (from trip detail screen)
export interface UIStop {
  id: string;
  type: StopType;
  company: string;
  address: string;
  expectedDate: string;
  expectedTime: string; // HH:MM 24h e.g. "14:30" - optional
  actualDate: string;
  actualTime: string; // HH:MM 24h - optional
  odometer: string;
  notes: string;
  isLate: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  mileageToNext: number | null;
  locationId?: string | null; // Optional reference to saved location
}

// Helper to get tenant_id from current user
async function getTenantId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", session.user.id)
    .single();

  if (error || !data) {
    console.error("[trips] Error fetching tenant_id:", error);
    return null;
  }

  return data.tenant_id;
}

// Parse time string to HH:MM 24h (e.g. "14:30", "2:30 PM" -> "14:30")
function parseTimeToHHMM(input: string): string {
  const t = input.trim();
  if (!t) return "12:00";
  // Already HH:MM or H:MM
  const match24 = t.match(/^(\d{1,2}):(\d{2})\s*$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  // Try 12h format: "2:30 PM", "2:30 pm"
  const match12 = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const ampm = (match12[3] || "").toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  // Try parsing as Date
  try {
    const d = new Date(`1970-01-01T${t}`);
    if (!isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  } catch {
    // ignore
  }
  return "12:00";
}

// Parse address string into components
function parseAddress(address: string): {
  address1: string;
  city: string;
  state: string;
  zip: string;
} {
  // Simple parsing - assumes format like "123 Street, City, ST 12345"
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const zipState = parts[parts.length - 1].split(" ");
    const state = zipState[zipState.length - 2] || "";
    const zip = zipState[zipState.length - 1] || "";
    const city = parts[parts.length - 2] || "";
    const address1 = parts.slice(0, parts.length - 2).join(", ");
    return { address1, city, state, zip };
  }
  return { address1: address, city: "", state: "", zip: "" };
}

// Format address components into string
function formatAddress(
  address1: string | null,
  city: string | null,
  state: string | null,
  zip: string | null
): string {
  const parts = [address1, city, state && zip ? `${state} ${zip}` : state || zip].filter(Boolean);
  return parts.join(", ") || "";
}

// Convert database stop to UI stop
function dbStopToUIStop(dbStop: DatabaseStop, index: number, allStops: DatabaseStop[]): UIStop {
  const address = formatAddress(
    dbStop.address1,
    dbStop.city,
    dbStop.state,
    dbStop.zip_code
  );

  // Determine if this is the current stop (first incomplete one)
  const completedStops = allStops.filter((s) => s.status === "complete").length;
  const isCurrent = index === completedStops && dbStop.status === "pending";

  // Parse dates (separate date and time for UI)
  const expectedDate = dbStop.expected_date
    ? new Date(dbStop.expected_date + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const expectedTime = dbStop.expected_time || "";
  const actualDate = dbStop.completed_at
    ? new Date(dbStop.completed_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const actualTime = dbStop.completed_at
    ? new Date(dbStop.completed_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";

  // Format odometer
  const odometer = dbStop.odometer_reading
    ? dbStop.odometer_reading.toLocaleString()
    : "";

  // Calculate mileage to next stop
  const nextStop = allStops[index + 1];
  const mileageToNext =
    nextStop && dbStop.odometer_reading && nextStop.odometer_reading
      ? nextStop.odometer_reading - dbStop.odometer_reading
      : null;

  // Calculate if late (compare expected date+time with completed_at)
  let isLate = false;
  if (dbStop.expected_date && dbStop.completed_at) {
    const expectedStr = dbStop.expected_time
      ? `${dbStop.expected_date}T${dbStop.expected_time.length === 5 ? dbStop.expected_time + ":00" : dbStop.expected_time}`
      : `${dbStop.expected_date}T23:59:59`;
    isLate = new Date(dbStop.completed_at) > new Date(expectedStr);
  }

  return {
    id: dbStop.id,
    type: dbStop.type,
    company: dbStop.name || "",
    address,
    expectedDate,
    expectedTime,
    actualDate,
    actualTime,
    odometer,
    notes: dbStop.notes || "",
    isLate: isLate || false,
    isCompleted: dbStop.status === "complete",
    isCurrent,
    mileageToNext,
    locationId: dbStop.location_id,
  };
}

// Convert UI stop to database stop
function uiStopToDBStop(
  uiStop: UIStop,
  tenantId: string,
  tripId: string,
  stopOrder: number
): Partial<DatabaseStop> {
  const { address1, city, state, zip } = parseAddress(uiStop.address);
  const odometerReading = uiStop.odometer
    ? parseFloat(uiStop.odometer.replace(/[^0-9.]/g, ""))
    : null;

  // Parse expectedDate (format: "Feb 6, 2026" or similar)
  let expectedDate: string | null = null;
  if (uiStop.expectedDate && uiStop.expectedDate !== "TBD") {
    try {
      const parsed = new Date(uiStop.expectedDate);
      if (!isNaN(parsed.getTime())) {
        expectedDate = parsed.toISOString().split("T")[0]; // YYYY-MM-DD format
      }
    } catch (e) {
      // Invalid date, leave as null
    }
  }

  // expected_time: store HH:MM 24h (e.g. "14:30")
  const expectedTime = uiStop.expectedTime?.trim()
    ? parseTimeToHHMM(uiStop.expectedTime)
    : null;

  // completed_at: combine actualDate + actualTime
  let completedAt: string | null = null;
  if (uiStop.isCompleted && (uiStop.actualDate || uiStop.actualTime)) {
    try {
      const fallbackDate = new Date();
      const dateSource = uiStop.actualDate || fallbackDate.toLocaleDateString("en-US");
      const parsedDate = new Date(dateSource);
      if (!isNaN(parsedDate.getTime())) {
        const [th, tm] = (uiStop.actualTime ? parseTimeToHHMM(uiStop.actualTime) : "12:00").split(":").map(Number);
        const combined = new Date(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          parsedDate.getDate(),
          th || 12,
          tm || 0,
          0
        );
        completedAt = combined.toISOString();
      }
    } catch {
      // Invalid, leave null
    }
  }

  return {
    tenant_id: tenantId,
    trip_id: tripId,
    stop_order: stopOrder,
    type: uiStop.type,
    name: uiStop.company || null,
    address1: address1 || null,
    city: city || null,
    state: state || null,
    zip_code: zip || null,
    odometer_reading: odometerReading,
    status: uiStop.isCompleted ? "complete" : "pending",
    completed_at: completedAt,
    notes: uiStop.notes || null,
    expected_date: expectedDate,
    expected_time: expectedTime,
    location_id: uiStop.locationId || null,
  };
}

// Fetch all stops for a trip
export async function fetchTripStops(tripId: string): Promise<UIStop[]> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { data, error } = await supabase
    .from("stops")
    .select("*")
    .eq("trip_id", tripId)
    .eq("tenant_id", tenantId)
    .order("stop_order", { ascending: true });

  if (error) {
    console.error("[trips] Error fetching stops:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Convert to UI stops
  return data.map((dbStop, index) =>
    dbStopToUIStop(dbStop as DatabaseStop, index, data as DatabaseStop[])
  );
}

// Trip list item for the trips screen
export interface TripListItem {
  id: string;
  tripReference: string;
  date: string;
  origin: string;
  destination: string;
  stops: number;
  completed: number;
  status: "In Progress" | "Completed";
}

// Fetch all trips for the current tenant (for trips list)
export async function fetchAllTrips(): Promise<TripListItem[]> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, trip_reference, date, origin_name, destination_name")
    .eq("tenant_id", tenantId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (tripsError) {
    console.error("[trips] Error fetching trips:", tripsError);
    throw tripsError;
  }

  if (!trips || trips.length === 0) {
    return [];
  }

  // Fetch stops for all trips to get counts and origin/destination from first/last stop
  const { data: stops, error: stopsError } = await supabase
    .from("stops")
    .select("trip_id, stop_order, name, status")
    .eq("tenant_id", tenantId)
    .in("trip_id", trips.map((t) => t.id))
    .order("stop_order", { ascending: true });

  if (stopsError) {
    console.error("[trips] Error fetching stops for list:", stopsError);
  }

  // Group stops by trip_id
  const stopsByTrip = new Map<string, { name: string; status: string }[]>();
  for (const stop of stops || []) {
    const list = stopsByTrip.get(stop.trip_id) || [];
    list.push({ name: stop.name || "—", status: stop.status || "pending" });
    stopsByTrip.set(stop.trip_id, list);
  }

  return trips.map((trip) => {
    const tripStops = stopsByTrip.get(trip.id) || [];
    const completed = tripStops.filter((s) => s.status === "complete").length;
    const origin =
      trip.origin_name ||
      (tripStops[0]?.name ?? "—");
    const destination =
      trip.destination_name ||
      (tripStops[tripStops.length - 1]?.name ?? "—");
    const dateFormatted = trip.date
      ? new Date(trip.date + "T12:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

    return {
      id: trip.id,
      tripReference: trip.trip_reference || trip.id,
      date: dateFormatted,
      origin,
      destination,
      stops: tripStops.length,
      completed,
      status:
        completed === tripStops.length && tripStops.length > 0
          ? "Completed"
          : "In Progress",
    };
  });
}

// Fetch a single trip
export async function fetchTrip(tripId: string): Promise<DatabaseTrip | null> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Not found
      return null;
    }
    console.error("[trips] Error fetching trip:", error);
    throw error;
  }

  return data as DatabaseTrip;
}

// Create or get trip (ensures trip exists)
export async function ensureTrip(
  tripId: string,
  tripReference?: string
): Promise<DatabaseTrip> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  // Try to fetch existing trip by id (UUID) or by trip_reference
  const existing = await fetchTrip(tripId);
  if (existing) {
    return existing;
  }

  // Create new trip
  const { data, error } = await supabase
    .from("trips")
    .insert({
      id: tripId,
      tenant_id: tenantId,
      trip_reference: tripReference || tripId,
      date: new Date().toISOString().split("T")[0], // Today's date
    })
    .select()
    .single();

  if (error) {
    console.error("[trips] Error creating trip:", error);
    throw error;
  }

  return data as DatabaseTrip;
}

// Create a brand new trip (database generates UUID, uses tripReference for display)
export async function createNewTrip(tripReference: string): Promise<DatabaseTrip> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { data, error } = await supabase
    .from("trips")
    .insert({
      tenant_id: tenantId,
      trip_reference: tripReference.trim(),
      date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) {
    console.error("[trips] Error creating trip:", error);
    throw error;
  }

  return data as DatabaseTrip;
}

// Save a stop (insert or update)
export async function saveStop(
  tripId: string,
  uiStop: UIStop,
  stopOrder: number
): Promise<void> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const dbStop = uiStopToDBStop(uiStop, tenantId, tripId, stopOrder);

  // Check if stop exists (only if id looks like a UUID)
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uiStop.id);
  let existing = null;
  if (isValidUuid) {
    const result = await supabase
      .from("stops")
      .select("id")
      .eq("id", uiStop.id)
      .eq("tenant_id", tenantId)
      .single();
    existing = result.data;
  }

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("stops")
      .update(dbStop)
      .eq("id", uiStop.id)
      .eq("tenant_id", tenantId);

    if (error) {
      console.error("[trips] Error updating stop:", error);
      throw error;
    }
  } else {
    // Insert new - let DB generate UUID
    const { error } = await supabase.from("stops").insert({
      ...dbStop,
      // Omit id to let database generate UUID
    } as any);

    if (error) {
      console.error("[trips] Error inserting stop:", error);
      throw error;
    }
  }
}

// Delete a stop
export async function deleteStop(stopId: string): Promise<void> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { error } = await supabase
    .from("stops")
    .delete()
    .eq("id", stopId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[trips] Error deleting stop:", error);
    throw error;
  }
}

// Reorder stops (update stop_order for all stops)
export async function reorderStops(
  tripId: string,
  stopIds: string[]
): Promise<void> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  // Update each stop's order
  const updates = stopIds.map((stopId, index) =>
    supabase
      .from("stops")
      .update({ stop_order: index })
      .eq("id", stopId)
      .eq("tenant_id", tenantId)
      .eq("trip_id", tripId)
  );

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    console.error("[trips] Error reordering stops:", errors);
    throw errors[0].error;
  }
}

// Complete a stop
export async function completeStop(stopId: string): Promise<void> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { error } = await supabase
    .from("stops")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", stopId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[trips] Error completing stop:", error);
    throw error;
  }
}
