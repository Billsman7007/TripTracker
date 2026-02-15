import { supabase } from "./supabaseClient";

// Database location type
export interface DatabaseLocation {
  id: string;
  tenant_id: string;
  name: string;
  quick_code: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
  updated_at: string;
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
    console.error("[locations] Error fetching tenant_id:", error);
    return null;
  }

  return data.tenant_id;
}

// Format location address into single string
export function formatLocationAddress(location: DatabaseLocation): string {
  const parts = [
    location.address1,
    location.city,
    location.state && location.zip_code
      ? `${location.state} ${location.zip_code}`
      : location.state || location.zip_code,
  ].filter(Boolean);
  return parts.join(", ") || "";
}

// Search locations by name (supports wildcards)
export async function searchLocations(query: string): Promise<DatabaseLocation[]> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  if (!query.trim()) {
    return [];
  }

  // Handle wildcard characters
  let searchPattern = query.trim();
  
  // If user includes wildcards (% or _), use them as-is
  // Otherwise, add % at start and end for "contains" search
  if (!searchPattern.includes("%") && !searchPattern.includes("_")) {
    searchPattern = `%${searchPattern}%`;
  }

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("tenant_id", tenantId)
    .or(`name.ilike.${searchPattern},quick_code.ilike.${searchPattern}`)
    .order("name", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[locations] Error searching locations:", error);
    throw error;
  }

  return (data || []) as DatabaseLocation[];
}

// Fetch a single location by ID
export async function fetchLocation(locationId: string): Promise<DatabaseLocation | null> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("id", locationId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Not found
      return null;
    }
    console.error("[locations] Error fetching location:", error);
    throw error;
  }

  return data as DatabaseLocation;
}

// Fetch all locations for current tenant
export async function fetchAllLocations(): Promise<DatabaseLocation[]> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[locations] Error fetching locations:", error);
    throw error;
  }

  return (data || []) as DatabaseLocation[];
}
