import { supabase } from "./supabaseClient";

async function getTenantId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", session.user.id)
    .single();

  if (error || !data) return null;
  return data.tenant_id;
}

/**
 * Get the next trip number, increment the sequence, and return it.
 * Default starting value is 100 if not set.
 */
export async function getNextTripNumber(): Promise<number> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  // Fetch current settings
  const { data: settings, error: fetchError } = await supabase
    .from("settings")
    .select("trip_number_sequence")
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("[sequences] Error fetching settings:", fetchError);
    throw fetchError;
  }

  const current = settings?.trip_number_sequence ?? 100;
  const next = current + 1;

  // Update only the sequence (preserves other settings)
  const { error: updateError } = await supabase
    .from("settings")
    .update({ trip_number_sequence: next })
    .eq("tenant_id", tenantId);

  if (updateError) {
    // Row might not exist yet - try upsert
    const { error: upsertError } = await supabase.from("settings").upsert(
      { tenant_id: tenantId, trip_number_sequence: next },
      { onConflict: "tenant_id" }
    );
    if (upsertError) {
      console.error("[sequences] Error updating trip number:", upsertError);
      throw upsertError;
    }
  }

  return current;
}

/**
 * Get the next order number, increment the sequence, and return it.
 */
export async function getNextOrderNumber(): Promise<number> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found. Please ensure you're logged in.");
  }

  const { data: settings, error: fetchError } = await supabase
    .from("settings")
    .select("order_number_sequence")
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("[sequences] Error fetching settings:", fetchError);
    throw fetchError;
  }

  const current = settings?.order_number_sequence ?? 1;
  const next = current + 1;

  const { error: updateError } = await supabase
    .from("settings")
    .update({ order_number_sequence: next })
    .eq("tenant_id", tenantId);

  if (updateError) {
    const { error: upsertError } = await supabase.from("settings").upsert(
      { tenant_id: tenantId, order_number_sequence: next },
      { onConflict: "tenant_id" }
    );
    if (upsertError) {
      console.error("[sequences] Error updating order number:", upsertError);
      throw upsertError;
    }
  }

  return current;
}

/**
 * Get current sequence values (for display in Settings).
 */
export async function getSequences(): Promise<{
  trip_number_sequence: number;
  order_number_sequence: number;
}> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found.");
  }

  const { data, error } = await supabase
    .from("settings")
    .select("trip_number_sequence, order_number_sequence")
    .eq("tenant_id", tenantId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return {
    trip_number_sequence: data?.trip_number_sequence ?? 100,
    order_number_sequence: data?.order_number_sequence ?? 1,
  };
}

/**
 * Update sequence values (for Settings form).
 */
export async function updateSequences(
  trip_number_sequence: number,
  order_number_sequence: number
): Promise<void> {
  const tenantId = await getTenantId();
  if (!tenantId) {
    throw new Error("No tenant_id found.");
  }

  const { error } = await supabase.from("settings").upsert(
    {
      tenant_id: tenantId,
      trip_number_sequence,
      order_number_sequence,
    },
    { onConflict: "tenant_id" }
  );

  if (error) throw error;
}
