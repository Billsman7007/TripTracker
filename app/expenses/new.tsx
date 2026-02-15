import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  Alert, Platform, Modal, ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentTrip, getCountrySetting } from "../../lib/currentTrip";

type PickerItem = { id: string; label: string; sublabel?: string };

export default function NewExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ receipt_id?: string }>();

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Country setting determines whether to show Net/GST
  const [countryOfOp, setCountryOfOp] = useState("US");
  const showTaxBreakdown = countryOfOp === "CA" || countryOfOp === "BOTH";

  // Dropdown data
  const [vendors, setVendors] = useState<PickerItem[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<PickerItem[]>([]);
  const [trips, setTrips] = useState<PickerItem[]>([]);

  // Form fields
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorText, setVendorText] = useState(""); // free-form vendor name
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseTypeId, setExpenseTypeId] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [currentTripLabel, setCurrentTripLabel] = useState<string | null>(null);
  const [netAmount, setNetAmount] = useState("");
  const [gst, setGst] = useState("");
  const [total, setTotal] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(params.receipt_id || null);

  // Picker modals
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [showExpenseTypePicker, setShowExpenseTypePicker] = useState(false);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(date);

  useEffect(() => {
    loadDropdownData();
  }, []);

  // Track which field the user last edited for smart calculation
  const [lastEdited, setLastEdited] = useState<"net" | "gst" | "total" | null>(null);

  // Smart bi-directional calculation:
  //   Net + GST → Total   (when user edits net or gst)
  //   Total - GST → Net   (when user edits total or gst while total is filled)
  useEffect(() => {
    if (!showTaxBreakdown) return;

    const net = parseFloat(netAmount) || 0;
    const tax = parseFloat(gst) || 0;
    const tot = parseFloat(total) || 0;

    if (lastEdited === "net" || (lastEdited === "gst" && netAmount)) {
      // User entered/changed net or gst (with net filled) → calc total
      setTotal((net + tax).toFixed(2));
    } else if (lastEdited === "total" || (lastEdited === "gst" && total && !netAmount)) {
      // User entered/changed total or gst (with total filled, no net) → calc net
      const calcNet = tot - tax;
      setNetAmount(calcNet >= 0 ? calcNet.toFixed(2) : "0.00");
    }
  }, [netAmount, gst, total, lastEdited, showTaxBreakdown]);

  function onNetChange(val: string) {
    setNetAmount(val);
    setLastEdited("net");
  }
  function onGstChange(val: string) {
    setGst(val);
    setLastEdited("gst");
  }
  function onTotalChange(val: string) {
    setTotal(val);
    setLastEdited("total");
  }

  async function loadDropdownData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      // Load dropdowns, current trip, and country setting in parallel
      const [vendorRes, expTypeRes, tripRes, currentTrip, country] = await Promise.all([
        supabase
          .from("vendors")
          .select("id, name")
          .eq("tenant_id", tenantUser.tenant_id)
          .order("name"),
        supabase
          .from("expense_types")
          .select("id, code, name")
          .eq("tenant_id", tenantUser.tenant_id)
          .order("sort_order")
          .order("code"),
        supabase
          .from("trips")
          .select("id, trip_reference, origin_name, destination_name")
          .eq("tenant_id", tenantUser.tenant_id)
          .order("trip_reference", { ascending: false })
          .limit(50),
        getCurrentTrip(),
        getCountrySetting(),
      ]);

      setVendors(
        (vendorRes.data || []).map((v: any) => ({
          id: v.id,
          label: v.name,
        }))
      );

      setExpenseTypes(
        (expTypeRes.data || []).map((et: any) => ({
          id: et.id,
          label: et.code ? `${et.code} – ${et.name}` : et.name,
          sublabel: et.code || undefined,
        }))
      );

      setTrips(
        (tripRes.data || []).map((t: any) => ({
          id: t.id,
          label: t.trip_reference
            ? `#${t.trip_reference}${t.origin_name ? ` – ${t.origin_name}` : ""}${t.destination_name ? ` → ${t.destination_name}` : ""}`
            : `${t.origin_name || "?"} → ${t.destination_name || "?"}`,
        }))
      );

      // Set country
      setCountryOfOp(country);

      // Default trip to current trip
      if (currentTrip) {
        setTripId(currentTrip.id);
        setCurrentTripLabel(
          `#${currentTrip.trip_reference}${currentTrip.origin_name ? ` – ${currentTrip.origin_name}` : ""}${currentTrip.destination_name ? ` → ${currentTrip.destination_name}` : ""}`
        );
      }
    } catch (error) {
      console.error("Error loading dropdown data:", error);
    } finally {
      setLoadingData(false);
    }
  }

  async function handleSave() {
    if (!date) {
      Alert.alert("Error", "Date is required.");
      return;
    }

    const totalNum = parseFloat(total);
    if (!totalNum || totalNum <= 0) {
      Alert.alert("Error", "Total amount is required.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) throw new Error("No tenant found");

      // Use vendorText as description if no vendor_id selected
      const descriptionValue = vendorId
        ? (description.trim() || null)
        : (vendorText.trim() || description.trim() || null);

      const payload = {
        tenant_id: tenantUser.tenant_id,
        vendor_id: vendorId || null,
        date,
        expense_type_id: expenseTypeId || null,
        trip_id: tripId || null,
        amount: showTaxBreakdown ? (parseFloat(netAmount) || 0) : totalNum,
        tax: showTaxBreakdown ? (parseFloat(gst) || 0) : 0,
        total: totalNum,
        description: descriptionValue,
        notes: notes.trim() || null,
        receipt_id: receiptId || null,
      };

      const { error } = await supabase.from("misc_expenses").insert(payload);
      if (error) throw error;

      // If this expense came from a receipt, mark the receipt as processed
      if (receiptId) {
        await supabase
          .from("receipts")
          .update({ status: "processed", receipt_type: "expense", linked_id: null })
          .eq("id", receiptId);
      }

      // Close the form immediately after saving
      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save expense.");
      setSaving(false);
    }
  }

  function getSelectedLabel(items: PickerItem[], id: string | null) {
    if (!id) return null;
    return items.find((i) => i.id === id)?.label || null;
  }

  // When picking a vendor from dropdown, set vendorId and clear free-form text
  function handleVendorSelect(id: string) {
    setVendorId(id);
    const vendor = vendors.find((v) => v.id === id);
    setVendorText(vendor?.label || "");
    setShowVendorPicker(false);
  }

  // When user types in vendor field, clear vendor_id (it's now free-form)
  function handleVendorTextChange(text: string) {
    setVendorText(text);
    // If text doesn't match the selected vendor, clear vendorId
    const selectedVendor = vendors.find((v) => v.id === vendorId);
    if (selectedVendor && text !== selectedVendor.label) {
      setVendorId(null);
    }
  }

  if (loadingData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </Pressable>
          <Text style={styles.headerTitle}>New Expense</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>New Expense</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Vendor (combo: free-form + dropdown) ── */}
          <Text style={styles.label}>Vendor</Text>
          <View style={styles.comboRow}>
            <TextInput
              style={styles.comboInput}
              value={vendorText}
              onChangeText={handleVendorTextChange}
              placeholder="Type or select vendor..."
              placeholderTextColor="#9ca3af"
            />
            <Pressable
              style={styles.comboButton}
              onPress={() => setShowVendorPicker(true)}
            >
              <Ionicons name="chevron-down" size={18} color="#64748b" />
            </Pressable>
          </View>
          {vendorId && (
            <Text style={styles.comboHint}>
              Linked to saved vendor
            </Text>
          )}

          {/* ── Date ───────────────────────────── */}
          <Text style={styles.label}>Date</Text>
          {Platform.OS === "web" ? (
            <input
              type="date"
              value={date}
              onChange={(e: any) => setDate(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 15,
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                fontFamily: "system-ui",
                color: "#1e293b",
                backgroundColor: "#ffffff",
                marginBottom: 16,
                boxSizing: "border-box",
              } as any}
            />
          ) : (
            <Pressable style={styles.picker} onPress={() => { setTempDate(date); setShowDatePicker(true); }}>
              <Text style={styles.pickerText}>
                {date ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Select date..."}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
            </Pressable>
          )}

          {/* ── Expense Type ───────────────────── */}
          <Text style={styles.label}>Expense Type</Text>
          <Pressable style={styles.picker} onPress={() => setShowExpenseTypePicker(true)}>
            <Text style={expenseTypeId ? styles.pickerText : styles.pickerPlaceholder}>
              {getSelectedLabel(expenseTypes, expenseTypeId) || "Select expense type..."}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9ca3af" />
          </Pressable>

          {/* ── Trip (defaults to current trip) ── */}
          <Text style={styles.label}>Trip</Text>
          <Pressable style={styles.picker} onPress={() => setShowTripPicker(true)}>
            <Text style={tripId ? styles.pickerText : styles.pickerPlaceholder}>
              {getSelectedLabel(trips, tripId) || "Select trip..."}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9ca3af" />
          </Pressable>
          {currentTripLabel && tripId && (
            <Text style={styles.currentTripHint}>
              Current trip: {currentTripLabel}
            </Text>
          )}

          {/* ── Divider ────────────────────────── */}
          <View style={styles.divider} />

          {/* ── Amounts ────────────────────────── */}
          <Text style={styles.sectionLabel}>Amounts</Text>

          {showTaxBreakdown && (
            <>
              <Text style={styles.label}>Net Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={netAmount}
                  onChangeText={onNetChange}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <Text style={styles.label}>GST</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={gst}
                  onChangeText={onGstChange}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </>
          )}

          <Text style={styles.label}>Total</Text>
          <View style={[styles.amountRow, styles.totalRow]}>
            <Text style={[styles.currencySymbol, styles.totalSymbol]}>$</Text>
            <TextInput
              style={[styles.amountInput, styles.totalInput]}
              value={total}
              onChangeText={showTaxBreakdown ? onTotalChange : setTotal}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9ca3af"
            />
          </View>
          {showTaxBreakdown && (
            <Text style={styles.autoCalcHint}>
              Enter Net + GST to calculate Total, or Total + GST to calculate Net
            </Text>
          )}

          {/* ── Divider ────────────────────────── */}
          <View style={styles.divider} />

          {/* ── Description / Notes ────────────── */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes..."
            placeholderTextColor="#9ca3af"
            multiline
          />

          {/* ── Receipt link ───────────────────── */}
          {receiptId ? (
            <View style={styles.receiptLinked}>
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
              <Text style={styles.receiptLinkedText}>Receipt attached</Text>
              <Pressable onPress={() => setReceiptId(null)}>
                <Text style={styles.receiptRemoveText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.receiptAttach}
              onPress={() => {
                Alert.alert(
                  "Attach Receipt",
                  "You can attach a receipt from the Receipt Inbox by classifying it as an expense.",
                  [{ text: "OK" }]
                );
              }}
            >
              <Ionicons name="camera-outline" size={22} color="#64748b" />
              <Text style={styles.receiptAttachText}>Attach receipt photo</Text>
            </Pressable>
          )}

          {/* ── Save Button ────────────────────── */}
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Expense</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Vendor Picker Modal ─────────────── */}
      <PickerModal
        visible={showVendorPicker}
        title="Select Vendor"
        items={vendors}
        selectedId={vendorId}
        onSelect={handleVendorSelect}
        onClear={() => { setVendorId(null); setVendorText(""); setShowVendorPicker(false); }}
        onClose={() => setShowVendorPicker(false)}
      />

      {/* ── Expense Type Picker Modal ──────── */}
      <PickerModal
        visible={showExpenseTypePicker}
        title="Select Expense Type"
        items={expenseTypes}
        selectedId={expenseTypeId}
        onSelect={(id) => { setExpenseTypeId(id); setShowExpenseTypePicker(false); }}
        onClear={() => { setExpenseTypeId(null); setShowExpenseTypePicker(false); }}
        onClose={() => setShowExpenseTypePicker(false)}
      />

      {/* ── Trip Picker Modal ──────────────── */}
      <PickerModal
        visible={showTripPicker}
        title="Select Trip"
        items={trips}
        selectedId={tripId}
        onSelect={(id) => { setTripId(id); setShowTripPicker(false); }}
        onClear={() => { setTripId(null); setShowTripPicker(false); }}
        onClose={() => setShowTripPicker(false)}
      />

      {/* ── Date Picker Modal (mobile) ─────── */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Date</Text>
            <Text style={styles.modalHint}>Format: YYYY-MM-DD</Text>
            <TextInput
              style={styles.modalInput}
              value={tempDate}
              onChangeText={setTempDate}
              placeholder="2026-02-06"
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(tempDate)) {
                    setDate(tempDate);
                    setShowDatePicker(false);
                  } else {
                    Alert.alert("Invalid date", "Use format YYYY-MM-DD");
                  }
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>Set Date</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Reusable Picker Modal ──────────────────────────────────
function PickerModal({
  visible, title, items, selectedId, onSelect, onClear, onClose,
}: {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerModalOverlay}>
        <View style={styles.pickerModalContent}>
          <View style={styles.pickerModalHeader}>
            <Text style={styles.pickerModalTitle}>{title}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>

          {items.length > 5 && (
            <TextInput
              style={styles.pickerSearch}
              value={search}
              onChangeText={setSearch}
              placeholder="Search..."
              placeholderTextColor="#9ca3af"
              autoFocus={Platform.OS === "web"}
            />
          )}

          <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
            {selectedId && (
              <Pressable style={styles.pickerClearRow} onPress={() => { setSearch(""); onClear(); }}>
                <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                <Text style={styles.pickerClearText}>Clear selection</Text>
              </Pressable>
            )}

            {filtered.length === 0 ? (
              <Text style={styles.pickerEmpty}>No items found</Text>
            ) : (
              filtered.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.pickerItem,
                    item.id === selectedId && styles.pickerItemSelected,
                  ]}
                  onPress={() => { setSearch(""); onSelect(item.id); }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    item.id === selectedId && styles.pickerItemTextSelected,
                  ]}>
                    {item.label}
                  </Text>
                  {item.id === selectedId && (
                    <Ionicons name="checkmark" size={18} color="#2563eb" />
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  headerPlaceholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },

  // Labels & inputs
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
    marginBottom: 16,
  },
  textArea: {
    height: 72,
    textAlignVertical: "top",
  },

  // Combo field (text input + dropdown button)
  comboRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    marginBottom: 4,
  },
  comboInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
  },
  comboButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderLeftColor: "#e5e7eb",
  },
  comboHint: {
    fontSize: 11,
    color: "#10b981",
    marginBottom: 12,
    fontStyle: "italic",
  },

  // Picker (dropdown) button
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 16,
  },
  pickerText: {
    fontSize: 15,
    color: "#1e293b",
  },
  pickerPlaceholder: {
    fontSize: 15,
    color: "#9ca3af",
  },

  // Current trip hint
  currentTripHint: {
    fontSize: 11,
    color: "#2563eb",
    marginTop: -12,
    marginBottom: 16,
    fontStyle: "italic",
  },

  // Amount fields
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    marginBottom: 16,
    paddingLeft: 14,
  },
  currencySymbol: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748b",
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
    fontSize: 15,
    color: "#1e293b",
  },
  totalRow: {
    borderColor: "#2563eb",
    borderWidth: 1.5,
    backgroundColor: "#f0f7ff",
  },
  totalSymbol: {
    color: "#2563eb",
    fontWeight: "700",
  },
  totalInput: {
    fontWeight: "700",
    color: "#1e293b",
  },
  autoCalcHint: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: -12,
    marginBottom: 16,
    fontStyle: "italic",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 8,
    marginBottom: 16,
  },

  // Receipt
  receiptAttach: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 16,
    marginBottom: 24,
  },
  receiptAttachText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  receiptLinked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  receiptLinkedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
  },
  receiptRemoveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dc2626",
  },

  // Save button
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Picker modal
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingBottom: 30,
  },
  pickerModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  pickerSearch: {
    backgroundColor: "#f3f4f6",
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1e293b",
  },
  pickerList: {
    paddingHorizontal: 8,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerItemSelected: {
    backgroundColor: "#eff6ff",
  },
  pickerItemText: {
    fontSize: 15,
    color: "#1e293b",
  },
  pickerItemTextSelected: {
    fontWeight: "600",
    color: "#2563eb",
  },
  pickerClearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerClearText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "500",
  },
  pickerEmpty: {
    textAlign: "center",
    padding: 24,
    fontSize: 14,
    color: "#9ca3af",
  },

  // Date picker modal (mobile)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    width: "85%",
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  modalHint: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1e293b",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalBtnSecondary: {
    backgroundColor: "#f3f4f6",
  },
  modalBtnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  modalBtnPrimary: {
    backgroundColor: "#2563eb",
  },
  modalBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
});
