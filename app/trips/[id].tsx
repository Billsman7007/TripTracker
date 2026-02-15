import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  fetchTripStops,
  fetchTrip,
  ensureTrip,
  saveStop,
  deleteStop,
  reorderStops,
  completeStop,
  UIStop,
} from "../../lib/trips";
import {
  searchLocations,
  formatLocationAddress,
  DatabaseLocation,
} from "../../lib/locations";
import { supabase } from "../../lib/supabaseClient";

// Helper to get tenant_id (duplicated from trips.ts for use in toggleComplete)
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
    console.error("[TripDetail] Error fetching tenant_id:", error);
    return null;
  }

  return data.tenant_id;
}

// Stop type configuration
const STOP_TYPES: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  empty_start: { label: "Empty Start", color: "#2563eb", bgColor: "#eff6ff" },
  pickup: { label: "Pickup", color: "#16a34a", bgColor: "#f0fdf4" },
  stop: { label: "Stop", color: "#d97706", bgColor: "#fffbeb" },
  terminal: { label: "Terminal", color: "#7c3aed", bgColor: "#f5f3ff" },
  delivery: { label: "Delivery", color: "#dc2626", bgColor: "#fef2f2" },
  reposition: { label: "Reposition", color: "#2563eb", bgColor: "#eff6ff" },
};

const STOP_TYPE_KEYS = Object.keys(STOP_TYPES);

type Stop = UIStop;


// Parse odometer string like "148,315" to number 148315
function parseOdometer(val: string): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ─── Stop Detail Modal ─────────────────────────────────────────────────
function StopDetailModal({
  stop,
  visible,
  onClose,
  onSave,
  onComplete,
  onDelete,
  stopCount,
  lastOdometer,
}: {
  stop: Stop | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updated: Stop) => void;
  onComplete: (stopId: string, completedStop?: Stop) => void;
  onDelete: (stopId: string) => void;
  stopCount: number;
  lastOdometer: string;
}) {
  const showOdometer = true; // Odometer available on every stop
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Stop | null>(null);
  
  // Location search state
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DatabaseLocation[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  
  // Date/time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerFor, setDatePickerFor] = useState<"expected" | "actual">("expected");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerFor, setTimePickerFor] = useState<"expected" | "actual">("expected");
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // Reset state when modal opens with a new stop
  const handleOpen = () => {
    if (stop) {
      setDraft({ ...stop });
      setEditing(false);
      setSearchMode(false);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedLocationId(null);
    }
  };

  // Debounced location search
  useEffect(() => {
    if (!searchMode || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const results = await searchLocations(searchQuery);
        setSearchResults(results);
      } catch (error: any) {
        console.error("[StopModal] Error searching locations:", error);
        Alert.alert("Error", `Failed to search locations: ${error.message || "Unknown error"}`);
      } finally {
        setSearchLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode]);

  // Handle location selection
  const handleSelectLocation = (location: DatabaseLocation) => {
    if (!draft) return;

    const address = formatLocationAddress(location);
    setDraft({
      ...draft,
      company: location.name,
      address: address,
      locationId: location.id,
    });
    setSelectedLocationId(location.id);
    setSearchMode(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Handle date picker
  const openDatePicker = (forField: "expected" | "actual") => {
    if (!draft) return;
    setDatePickerFor(forField);
    const dateStr = forField === "expected" ? draft.expectedDate : draft.actualDate;
    let initialDate = new Date();
    if (dateStr) {
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          initialDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
      } catch {
        initialDate = new Date();
      }
    }
    setTempDate(initialDate);
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate && draft) {
      const formatted = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      setDraft({
        ...draft,
        [datePickerFor === "expected" ? "expectedDate" : "actualDate"]: formatted,
      });
      if (Platform.OS === "ios") {
        setShowDatePicker(false);
      }
    } else if (event.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  const openTimePicker = (forField: "expected" | "actual") => {
    if (!draft) return;
    setTimePickerFor(forField);
    const timeStr = forField === "expected" ? draft.expectedTime : draft.actualTime;
    let initial = new Date();
    if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
      const [h, m] = timeStr.split(":").map(Number);
      initial = new Date(1970, 0, 1, h, m, 0);
    }
    setTempDate(initial);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (event.type === "set" && selectedDate && draft) {
      const formatted = `${String(selectedDate.getHours()).padStart(2, "0")}:${String(selectedDate.getMinutes()).padStart(2, "0")}`;
      setDraft({
        ...draft,
        [timePickerFor === "expected" ? "expectedTime" : "actualTime"]: formatted,
      });
      if (Platform.OS === "ios") {
        setShowTimePicker(false);
      }
    } else if (event.type === "dismissed") {
      setShowTimePicker(false);
    }
  };

  if (!stop || !visible) return null;

  const current = editing && draft ? draft : stop;
  const typeConfig = STOP_TYPES[current.type];

  const handleSave = () => {
    if (draft) {
      onSave(draft);
      setEditing(false);
    }
  };

  const handleNow = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (draft) {
      setDraft({ ...draft, actualDate: dateStr, actualTime: timeStr });
    }
  };

  const handleComplete = () => {
    if (draft) {
      let actualDate = draft.actualDate;
      let actualTime = draft.actualTime;
      if (!actualDate && !actualTime) {
        const now = new Date();
        actualDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        actualTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      }
      // Pass completed draft so custom date/time is persisted
      const completedDraft = { ...draft, isCompleted: true, actualDate, actualTime };
      onComplete(stop.id, completedDraft);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={handleOpen}
      onRequestClose={onClose}
    >
      <Pressable style={ds.overlay} onPress={onClose}>
        <Pressable style={ds.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Sheet header */}
            <View style={ds.sheetHeader}>
              <View style={ds.sheetHeaderLeft}>
                <View style={[ds.typeDot, { backgroundColor: typeConfig.color }]} />
                <Text style={[ds.sheetType, { color: typeConfig.color }]}>
                  {typeConfig.label}
                </Text>
              </View>
              <View style={ds.sheetHeaderRight}>
                {!editing ? (
                  <Pressable
                    onPress={() => {
                      setDraft({ ...stop });
                      setEditing(true);
                    }}
                    style={ds.editBtn}
                  >
                    <Ionicons name="pencil" size={14} color="#6b7280" />
                    <Text style={ds.editBtnText}>Edit</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={handleSave} style={ds.saveBtn}>
                    <Ionicons name="checkmark" size={14} color="#2563eb" />
                    <Text style={ds.saveBtnText}>Save</Text>
                  </Pressable>
                )}
                <Pressable onPress={onClose} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#9ca3af" />
                </Pressable>
              </View>
            </View>

            {/* Stop type picker (edit mode only) */}
            {editing && (
              <View style={ds.fieldGroup}>
                <Text style={ds.fieldLabel}>STOP TYPE</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={ds.typePicker}
                >
                  {STOP_TYPE_KEYS.map((key) => {
                    const cfg = STOP_TYPES[key];
                    const selected = draft?.type === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => draft && setDraft({ ...draft, type: key })}
                        style={[
                          ds.typeChip,
                          selected && { backgroundColor: cfg.bgColor, borderColor: cfg.color },
                        ]}
                      >
                        <Text
                          style={[
                            ds.typeChipText,
                            selected && { color: cfg.color, fontWeight: "600" },
                          ]}
                        >
                          {cfg.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Location Search / Manual Entry Toggle */}
            {editing && (
              <View style={ds.fieldGroup}>
                <View style={ds.toggleRow}>
                  <Text style={ds.fieldLabel}>LOCATION</Text>
                  <Pressable
                    onPress={() => {
                      setSearchMode(!searchMode);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    style={ds.toggleBtn}
                  >
                    <Ionicons
                      name={searchMode ? "create-outline" : "search-outline"}
                      size={14}
                      color="#2563eb"
                    />
                    <Text style={ds.toggleBtnText}>
                      {searchMode ? "Manual Entry" : "Search Saved"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Location Search Mode */}
            {editing && searchMode ? (
              <View style={ds.fieldGroup}>
                <TextInput
                  style={ds.input}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search locations (use % for wildcards)..."
                  autoFocus
                />
                {searchLoading && (
                  <ActivityIndicator
                    size="small"
                    color="#2563eb"
                    style={ds.searchLoader}
                  />
                )}
                {searchResults.length > 0 && (
                  <View style={ds.searchResults}>
                    <ScrollView
                      style={ds.searchResultsList}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {searchResults.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => handleSelectLocation(item)}
                          style={ds.searchResultItem}
                        >
                          <View>
                            <Text style={ds.searchResultName}>{item.name}</Text>
                            <Text style={ds.searchResultAddress}>
                              {formatLocationAddress(item)}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
                {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                  <Text style={ds.noResults}>No locations found</Text>
                )}
              </View>
            ) : (
              <>
                {/* Company */}
                <View style={ds.fieldGroup}>
                  <Text style={ds.fieldLabel}>COMPANY</Text>
                  {editing ? (
                    <TextInput
                      style={ds.input}
                      value={draft?.company}
                      onChangeText={(t) => draft && setDraft({ ...draft, company: t })}
                      placeholder="Company name"
                    />
                  ) : (
                    <Text style={ds.fieldValue}>{current.company}</Text>
                  )}
                </View>

                {/* Address */}
                <View style={ds.fieldGroup}>
                  <Text style={ds.fieldLabel}>ADDRESS</Text>
                  {editing ? (
                    <TextInput
                      style={ds.input}
                      value={draft?.address}
                      onChangeText={(t) => draft && setDraft({ ...draft, address: t })}
                      placeholder="Full address"
                    />
                  ) : (
                    <Text style={ds.fieldValue}>{current.address || "—"}</Text>
                  )}
                </View>
              </>
            )}

            {/* Expected Date & Time — same row */}
            <View style={ds.fieldGroup}>
              <Text style={ds.fieldLabel}>EXPECTED DATE & TIME</Text>
              {editing ? (
                <View style={ds.dateTimeRow}>
                  <View style={ds.dateTimeCell}>
                    <TextInput
                      style={[ds.input, ds.dateTimeInput]}
                      value={draft?.expectedDate}
                      onChangeText={(t) => draft && setDraft({ ...draft, expectedDate: t })}
                      placeholder="Date"
                    />
                    <Pressable
                      onPress={() => openDatePicker("expected")}
                      style={ds.iconBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#2563eb" />
                    </Pressable>
                  </View>
                  <View style={ds.dateTimeCell}>
                    <TextInput
                      style={[ds.input, ds.dateTimeInput]}
                      value={draft?.expectedTime}
                      onChangeText={(t) => draft && setDraft({ ...draft, expectedTime: t })}
                      placeholder="Time"
                    />
                    <Pressable
                      onPress={() => openTimePicker("expected")}
                      style={ds.iconBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="time-outline" size={18} color="#2563eb" />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text
                  style={[ds.fieldValue, current.isLate && { color: "#dc2626", fontWeight: "600" }]}
                >
                  {[current.expectedDate, current.expectedTime].filter(Boolean).join(" ") || "—"}
                  {current.isLate ? "  LATE" : ""}
                </Text>
              )}
              {/* Web: HTML date/time inputs (DateTimePicker doesn't work on web) */}
              {editing && Platform.OS === "web" && showDatePicker && datePickerFor === "expected" && (
                <View style={ds.webPickerWrap}>
                  <input
                    type="date"
                    value={
                      tempDate
                        ? `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, "0")}-${String(tempDate.getDate()).padStart(2, "0")}`
                        : new Date().toISOString().slice(0, 10)
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && draft) {
                        const [y, m, day] = val.split("-").map(Number);
                        const d = new Date(y, m - 1, day);
                        setDraft({
                          ...draft,
                          expectedDate: d.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }),
                        });
                      }
                      setShowDatePicker(false);
                    }}
                    style={{
                      padding: 10,
                      fontSize: 14,
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      backgroundColor: "#ffffff",
                      width: "100%",
                    }}
                    autoFocus
                  />
                  <Pressable onPress={() => setShowDatePicker(false)} style={ds.webPickerClose}>
                    <Text style={ds.webPickerCloseText}>Close</Text>
                  </Pressable>
                </View>
              )}
              {editing && Platform.OS === "web" && showTimePicker && timePickerFor === "expected" && (
                <View style={ds.webPickerWrap}>
                  <input
                    type="time"
                    value={
                      tempDate
                        ? `${String(tempDate.getHours()).padStart(2, "0")}:${String(tempDate.getMinutes()).padStart(2, "0")}`
                        : "12:00"
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && draft) {
                        setDraft({ ...draft, expectedTime: val });
                      }
                      setShowTimePicker(false);
                    }}
                    style={{
                      padding: 10,
                      fontSize: 14,
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      backgroundColor: "#ffffff",
                      width: "100%",
                    }}
                    autoFocus
                  />
                  <Pressable onPress={() => setShowTimePicker(false)} style={ds.webPickerClose}>
                    <Text style={ds.webPickerCloseText}>Close</Text>
                  </Pressable>
                </View>
              )}
              {/* Native: DateTimePicker */}
              {editing && Platform.OS !== "web" && showDatePicker && datePickerFor === "expected" && (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                />
              )}
              {editing && Platform.OS !== "web" && showTimePicker && timePickerFor === "expected" && (
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleTimeChange}
                />
              )}
            </View>

            {/* Actual Date & Time — same row */}
            <View style={ds.fieldGroup}>
              <Text style={ds.fieldLabel}>ACTUAL DATE & TIME</Text>
              {editing ? (
                <View style={ds.dateTimeRow}>
                  <View style={ds.dateTimeCell}>
                    <TextInput
                      style={[ds.input, ds.dateTimeInput]}
                      value={draft?.actualDate}
                      onChangeText={(t) => draft && setDraft({ ...draft, actualDate: t })}
                      placeholder="Date"
                    />
                    <Pressable
                      onPress={() => openDatePicker("actual")}
                      style={ds.iconBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#2563eb" />
                    </Pressable>
                  </View>
                  <View style={ds.dateTimeCell}>
                    <TextInput
                      style={[ds.input, ds.dateTimeInput]}
                      value={draft?.actualTime}
                      onChangeText={(t) => draft && setDraft({ ...draft, actualTime: t })}
                      placeholder="Time"
                    />
                    <Pressable
                      onPress={() => openTimePicker("actual")}
                      style={ds.iconBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="time-outline" size={18} color="#2563eb" />
                    </Pressable>
                  </View>
                  <Pressable onPress={handleNow} style={[ds.nowBtn, { flexShrink: 0 }]}>
                    <Text style={ds.nowBtnText}>NOW</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={ds.fieldValue}>
                  {[current.actualDate, current.actualTime].filter(Boolean).join(" ") || "—"}
                </Text>
              )}
              {/* Web: HTML date/time inputs */}
              {editing && Platform.OS === "web" && showDatePicker && datePickerFor === "actual" && (
                <View style={ds.webPickerWrap}>
                  <input
                    type="date"
                    value={
                      tempDate
                        ? `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, "0")}-${String(tempDate.getDate()).padStart(2, "0")}`
                        : new Date().toISOString().slice(0, 10)
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && draft) {
                        const [y, m, day] = val.split("-").map(Number);
                        const d = new Date(y, m - 1, day);
                        setDraft({
                          ...draft,
                          actualDate: d.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }),
                        });
                      }
                      setShowDatePicker(false);
                    }}
                    style={{
                      padding: 10,
                      fontSize: 14,
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      backgroundColor: "#ffffff",
                      width: "100%",
                    }}
                    autoFocus
                  />
                  <Pressable onPress={() => setShowDatePicker(false)} style={ds.webPickerClose}>
                    <Text style={ds.webPickerCloseText}>Close</Text>
                  </Pressable>
                </View>
              )}
              {editing && Platform.OS === "web" && showTimePicker && timePickerFor === "actual" && (
                <View style={ds.webPickerWrap}>
                  <input
                    type="time"
                    value={
                      tempDate
                        ? `${String(tempDate.getHours()).padStart(2, "0")}:${String(tempDate.getMinutes()).padStart(2, "0")}`
                        : "12:00"
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && draft) {
                        setDraft({ ...draft, actualTime: val });
                      }
                      setShowTimePicker(false);
                    }}
                    style={{
                      padding: 10,
                      fontSize: 14,
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      backgroundColor: "#ffffff",
                      width: "100%",
                    }}
                    autoFocus
                  />
                  <Pressable onPress={() => setShowTimePicker(false)} style={ds.webPickerClose}>
                    <Text style={ds.webPickerCloseText}>Close</Text>
                  </Pressable>
                </View>
              )}
              {/* Native: DateTimePicker */}
              {editing && Platform.OS !== "web" && showDatePicker && datePickerFor === "actual" && (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                />
              )}
              {editing && Platform.OS !== "web" && showTimePicker && timePickerFor === "actual" && (
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleTimeChange}
                />
              )}
            </View>

            {/* Odometer — only for pickup and delivery */}
            {showOdometer && (
              <View style={ds.fieldGroup}>
                <Text style={ds.fieldLabel}>ODOMETER</Text>
                {editing ? (
                  <TextInput
                    style={[
                      ds.input,
                      !draft?.odometer && lastOdometer ? ds.inputFaded : null,
                    ]}
                    value={draft?.odometer}
                    onChangeText={(t) => draft && setDraft({ ...draft, odometer: t })}
                    placeholder={lastOdometer ? `prev: ${lastOdometer}` : "e.g. 148,315"}
                    placeholderTextColor="#c7c7cc"
                    keyboardType="numeric"
                  />
                ) : (
                  <View style={ds.odometerRow}>
                    <Text style={ds.fieldValue}>{current.odometer || "—"}</Text>
                    {!current.odometer && lastOdometer ? (
                      <Text style={ds.odometerHint}>prev: {lastOdometer}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            )}

            {/* Mileage to next */}
            <View style={ds.fieldGroup}>
              <Text style={ds.fieldLabel}>MILES TO NEXT STOP</Text>
              {editing ? (
                <TextInput
                  style={ds.input}
                  value={draft?.mileageToNext?.toString() || ""}
                  onChangeText={(t) =>
                    draft &&
                    setDraft({
                      ...draft,
                      mileageToNext: t ? parseInt(t, 10) || 0 : null,
                    })
                  }
                  placeholder="0"
                  keyboardType="numeric"
                />
              ) : (
                <Text style={ds.fieldValue}>
                  {current.mileageToNext != null ? `${current.mileageToNext} mi` : "—"}
                </Text>
              )}
            </View>

            {/* Notes */}
            <View style={ds.fieldGroup}>
              <Text style={ds.fieldLabel}>NOTES</Text>
              {editing ? (
                <TextInput
                  style={[ds.input, ds.textArea]}
                  value={draft?.notes}
                  onChangeText={(t) => draft && setDraft({ ...draft, notes: t })}
                  placeholder="Add notes..."
                  multiline
                  numberOfLines={3}
                />
              ) : (
                <Text style={ds.fieldValue}>{current.notes || "—"}</Text>
              )}
            </View>

            {/* Status / Complete */}
            <View style={ds.statusRow}>
              <View style={ds.statusLeft}>
                <View
                  style={[
                    ds.statusDot,
                    current.isCompleted
                      ? ds.statusDotDone
                      : current.isCurrent
                      ? ds.statusDotActive
                      : ds.statusDotPending,
                  ]}
                />
                <Text style={ds.statusLabel}>
                  {current.isCompleted
                    ? "Completed"
                    : current.isCurrent
                    ? "In Progress"
                    : "Pending"}
                </Text>
              </View>
              {!current.isCompleted && (
                <Pressable onPress={handleComplete} style={ds.completeBtn}>
                  <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                  <Text style={ds.completeBtnText}>Complete</Text>
                </Pressable>
              )}
            </View>

            {/* Cancel edit */}
            {editing && (
              <Pressable
                onPress={() => {
                  setDraft({ ...stop });
                  setEditing(false);
                }}
                style={ds.cancelBtn}
              >
                <Text style={ds.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}

            {/* Delete stop */}
            {stopCount > 2 && (
              <Pressable
                onPress={() => {
                  onDelete(stop.id);
                  onClose();
                }}
                style={ds.deleteBtn}
              >
                <Ionicons name="trash-outline" size={12} color="#dc2626" />
                <Text style={ds.deleteBtnText}>Delete Stop</Text>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Detail Modal Styles ────────────────────────────────────────────────
const ds = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    maxHeight: "85%",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  sheetHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sheetType: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sheetHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#eff6ff",
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 13,
    color: "#1e293b",
    lineHeight: 18,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: "#1e293b",
  },
  textArea: {
    minHeight: 56,
    textAlignVertical: "top",
  },
  rowInput: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  dateTimeCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: 100,
  },
  dateTimeInput: {
    flex: 1,
    minWidth: 70,
  },
  iconBtn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  webPickerWrap: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  webPickerClose: {
    marginTop: 8,
    padding: 8,
    alignItems: "center",
  },
  webPickerCloseText: {
    fontSize: 12,
    color: "#6b7280",
  },
  nowBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  nowBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  typePicker: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 2,
  },
  typeChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6b7280",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotDone: {
    backgroundColor: "#16a34a",
  },
  statusDotActive: {
    backgroundColor: "#2563eb",
  },
  statusDotPending: {
    backgroundColor: "#d1d5db",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
  },
  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#16a34a",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  completeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 6,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9ca3af",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#dc2626",
  },
  inputFaded: {
    color: "#c7c7cc",
  },
  odometerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  odometerHint: {
    fontSize: 11,
    color: "#d1d5db",
    fontStyle: "italic",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#eff6ff",
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },
  searchLoader: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  searchResults: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 5,
    maxHeight: 200,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  searchResultName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  searchResultAddress: {
    fontSize: 11,
    color: "#6b7280",
  },
  noResults: {
    marginTop: 8,
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  dateButton: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateButtonText: {
    fontSize: 13,
    color: "#1e293b",
  },
});

// ─── Main Trip Detail Screen ────────────────────────────────────────────
export default function TripDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const tripId = Array.isArray(id) ? id[0] : id || "";
  
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tripReference, setTripReference] = useState<string | null>(null);

  // Load trip and stops from Supabase on mount
  useEffect(() => {
    async function loadTripData() {
      if (!tripId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch trip for display (trip_reference) and ensure it exists
        let trip = await fetchTrip(tripId);
        if (!trip) {
          trip = await ensureTrip(tripId, tripId);
        }
        setTripReference(trip?.trip_reference || tripId);
        // Load stops
        const loadedStops = await fetchTripStops(tripId);
        setStops(loadedStops);
      } catch (error: any) {
        console.error("[TripDetail] Error loading trip:", error);
        Alert.alert(
          "Error",
          `Failed to load trip: ${error.message || "Unknown error"}`
        );
        // Fall back to empty array or MOCK_STOPS for development
        setStops([]);
      } finally {
        setLoading(false);
      }
    }

    loadTripData();
  }, [tripId]);

  const completedCount = stops.filter((s) => s.isCompleted).length;

  // Calculate mileage between stops using odometer readings where available
  function getComputedMileage(index: number): number | null {
    const current = stops[index];
    const next = stops[index + 1];
    if (!next) return null;

    // If both stops have odometer readings, compute the difference
    const curOdo = parseOdometer(current.odometer);
    const nextOdo = parseOdometer(next.odometer);
    if (curOdo !== null && nextOdo !== null && nextOdo > curOdo) {
      return nextOdo - curOdo;
    }
    // Fall back to the static mileageToNext value
    return current.mileageToNext;
  }

  const totalMileage = stops.reduce((sum, _s, i) => {
    const mi = getComputedMileage(i);
    return sum + (mi || 0);
  }, 0);

  // Find the last odometer reading before the selected stop
  function getLastOdometer(stopId: string): string {
    const idx = stops.findIndex((s) => s.id === stopId);
    if (idx <= 0) return "";
    // Walk backwards to find the most recent stop with an odometer
    for (let i = idx - 1; i >= 0; i--) {
      if (stops[i].odometer) return stops[i].odometer;
    }
    return "";
  }

  function openDetail(stop: Stop) {
    setSelectedStop(stop);
    setModalVisible(true);
  }

  async function handleSave(updated: Stop) {
    try {
      setSaving(true);
      const stopOrder = stops.findIndex((s) => s.id === updated.id);
      if (stopOrder === -1) {
        throw new Error("Stop not found");
      }
      
      await saveStop(tripId, updated, stopOrder);
      
      // Update local state
      setStops((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      setSelectedStop(updated);
    } catch (error: any) {
      console.error("[TripDetail] Error saving stop:", error);
      Alert.alert("Error", `Failed to save stop: ${error.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete(stopId: string, completedStop?: Stop) {
    try {
      setSaving(true);
      if (completedStop) {
        // Save with custom date/time from modal
        const stopOrder = stops.findIndex((s) => s.id === stopId);
        if (stopOrder >= 0) {
          await saveStop(tripId, completedStop, stopOrder);
        }
      } else {
        await completeStop(stopId);
      }
      
      // Update local state
      setStops((prev) =>
        prev.map((s) =>
          s.id === stopId
            ? { ...s, isCompleted: true, isCurrent: false, ...(completedStop || {}) }
            : s
        )
      );
    } catch (error: any) {
      console.error("[TripDetail] Error completing stop:", error);
      Alert.alert("Error", `Failed to complete stop: ${error.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(stopId: string) {
    if (stops.length <= 2) {
      Alert.alert("Cannot Delete", "A trip must have at least 2 stops.");
      return;
    }

    try {
      setSaving(true);
      await deleteStop(stopId);
      
      // Update local state and reorder remaining stops
      const newStops = stops.filter((s) => s.id !== stopId);
      const stopIds = newStops.map((s) => s.id);
      await reorderStops(tripId, stopIds);
      
      setStops(newStops);
      setSelectedStop(null);
    } catch (error: any) {
      console.error("[TripDetail] Error deleting stop:", error);
      Alert.alert("Error", `Failed to delete stop: ${error.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(stopId: string) {
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) return;

    try {
      setSaving(true);
      if (stop.isCompleted) {
        // Uncomplete - update status to pending
        const tenantId = await getTenantId();
        if (!tenantId) throw new Error("No tenant_id found");
        
        await supabase
          .from("stops")
          .update({ status: "pending", completed_at: null })
          .eq("id", stopId)
          .eq("tenant_id", tenantId);
      } else {
        await completeStop(stopId);
      }
      
      // Update local state
      setStops((prev) =>
        prev.map((s) =>
          s.id === stopId ? { ...s, isCompleted: !s.isCompleted } : s
        )
      );
    } catch (error: any) {
      console.error("[TripDetail] Error toggling stop:", error);
      Alert.alert("Error", `Failed to update stop: ${error.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function moveStop(index: number, direction: "up" | "down") {
    const newStops = [...stops];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStops.length) return;

    const moving = newStops[index];
    const target = newStops[targetIndex];
    if (moving.type === "empty_start" || moving.type === "reposition") return;
    if (
      (direction === "up" && target.type === "empty_start") ||
      (direction === "down" && target.type === "reposition")
    )
      return;

    // Swap in local state first for immediate UI feedback
    [newStops[index], newStops[targetIndex]] = [
      newStops[targetIndex],
      newStops[index],
    ];
    setStops(newStops);

    // Persist reorder to database
    try {
      setSaving(true);
      const stopIds = newStops.map((s) => s.id);
      await reorderStops(tripId, stopIds);
    } catch (error: any) {
      console.error("[TripDetail] Error reordering stops:", error);
      // Revert on error
      setStops(stops);
      Alert.alert("Error", `Failed to reorder stops: ${error.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function addStop(afterIndex: number) {
    const newStop: Stop = {
      id: Date.now().toString(),
      type: "stop",
      company: "New Stop",
      address: "",
      expectedDate: "TBD",
      expectedTime: "",
      actualDate: "",
      actualTime: "",
      odometer: "",
      notes: "",
      isLate: false,
      isCompleted: false,
      isCurrent: false,
      mileageToNext: 0,
      locationId: null,
    };
    
    const newStops = [...stops];
    newStops.splice(afterIndex + 1, 0, newStop);
    
    // Update local state first
    setStops(newStops);
    
    // Save to database
    try {
      setSaving(true);
      const stopOrder = afterIndex + 1;
      await saveStop(tripId, newStop, stopOrder);
      
      // Reorder all stops to ensure correct order
      const stopIds = newStops.map((s) => s.id);
      await reorderStops(tripId, stopIds);
    } catch (error: any) {
      console.error("[TripDetail] Error adding stop:", error);
      // Revert on error
      setStops(stops);
      Alert.alert("Error", `Failed to add stop: ${error.message || "Unknown error"}`);
      return;
    } finally {
      setSaving(false);
    }
    
    // Open the detail modal for the new stop so user can fill it in
    setSelectedStop(newStop);
    setModalVisible(true);
  }

  // Show loading indicator while loading initial data
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>#{tripReference ?? id}</Text>
        <Pressable style={styles.headerBtn}>
          <Ionicons name="menu" size={20} color="#1e293b" />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {completedCount}/{stops.length}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(completedCount / stops.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Timeline */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {stops.map((stop, index) => {
          const typeConfig = STOP_TYPES[stop.type];
          const isFirst = index === 0;
          const isLast = index === stops.length - 1;

          return (
            <View key={stop.id}>
              {/* Stop card row */}
              <View style={styles.stopRow}>
                {/* Timeline column */}
                <View style={styles.timelineCol}>
                  {!isFirst && (
                    <View
                      style={[
                        styles.lineSegment,
                        stop.isCompleted || stop.isCurrent
                          ? styles.lineSolid
                          : styles.lineDashed,
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.dot,
                      stop.isCompleted && styles.dotCompleted,
                      stop.isCurrent && [
                        styles.dotCurrent,
                        { borderColor: typeConfig.color },
                      ],
                      !stop.isCompleted &&
                        !stop.isCurrent &&
                        styles.dotUpcoming,
                    ]}
                  >
                    {stop.isCompleted && (
                      <Ionicons name="checkmark" size={8} color="#ffffff" />
                    )}
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.lineSegment,
                        styles.lineFlex,
                        stop.isCompleted
                          ? styles.lineSolid
                          : styles.lineDashed,
                      ]}
                    />
                  )}
                </View>

                {/* Card — tap to drill down */}
                <Pressable
                  onPress={() => openDetail(stop)}
                  style={[
                    styles.card,
                    stop.isCompleted && styles.cardCompleted,
                    stop.isCurrent && styles.cardCurrent,
                    !stop.isCompleted && !stop.isCurrent && styles.cardUpcoming,
                    {
                      borderLeftColor: stop.isCompleted
                        ? "#16a34a"
                        : stop.isCurrent
                        ? typeConfig.color
                        : "#d1d5db",
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.typeLabel,
                        {
                          color: stop.isCompleted
                            ? "#6b7280"
                            : stop.isCurrent
                            ? typeConfig.color
                            : "#9ca3af",
                        },
                      ]}
                    >
                      {typeConfig.label}
                    </Text>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleComplete(stop.id);
                      }}
                      hitSlop={8}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          stop.isCompleted && styles.checkboxDone,
                          stop.isCurrent && { borderColor: typeConfig.color },
                        ]}
                      >
                        {stop.isCompleted && (
                          <Ionicons
                            name="checkmark"
                            size={10}
                            color="#ffffff"
                          />
                        )}
                      </View>
                    </Pressable>
                  </View>

                  <Text
                    style={[
                      styles.company,
                      stop.isCompleted && styles.textMuted,
                      !stop.isCompleted && !stop.isCurrent && styles.textLight,
                    ]}
                  >
                    {stop.company}
                  </Text>

                  {stop.address ? (
                    <Text
                      style={[
                        styles.addressSubtext,
                        stop.isCompleted && styles.textMuted,
                        !stop.isCompleted && !stop.isCurrent && styles.textLight,
                      ]}
                      numberOfLines={2}
                    >
                      {stop.address}
                    </Text>
                  ) : null}

                  <View style={styles.dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={10}
                      color={stop.isLate ? "#dc2626" : "#9ca3af"}
                    />
                    <Text
                      style={[
                        styles.dateText,
                        stop.isLate && styles.dateLate,
                        stop.isCompleted && styles.textMuted,
                      ]}
                    >
                      {[stop.expectedDate, stop.expectedTime].filter(Boolean).join(" ") || "—"}
                    </Text>
                    {stop.isLate && (
                      <Text style={styles.lateBadge}>LATE</Text>
                    )}
                  </View>
                </Pressable>

                {/* Reorder arrows */}
                <View style={styles.arrowCol}>
                  {stop.type !== "empty_start" && (
                    <Pressable
                      onPress={() => moveStop(index, "up")}
                      hitSlop={4}
                      style={styles.arrowBtn}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={14}
                        color={index === 0 ? "#e5e7eb" : "#9ca3af"}
                      />
                    </Pressable>
                  )}
                  {stop.type !== "reposition" && (
                    <Pressable
                      onPress={() => moveStop(index, "down")}
                      hitSlop={4}
                      style={styles.arrowBtn}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color={
                          index === stops.length - 1 ? "#e5e7eb" : "#9ca3af"
                        }
                      />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Mileage + Add button between stops */}
              {!isLast && (
                <View style={styles.betweenRow}>
                  <View style={styles.timelineCol}>
                    <View
                      style={[
                        styles.lineSegment,
                        styles.lineFlex,
                        stop.isCompleted
                          ? styles.lineSolid
                          : styles.lineDashed,
                      ]}
                    />
                  </View>
                  <View style={styles.betweenContent}>
                    {(() => {
                      const mi = getComputedMileage(index);
                      return mi != null && mi > 0 ? (
                        <Text style={styles.mileageText}>{mi} mi</Text>
                      ) : null;
                    })()}
                    <Pressable
                      onPress={() => addStop(index)}
                      hitSlop={6}
                      style={styles.addBtn}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={14}
                        color="#d1d5db"
                      />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom summary bar */}
      <View style={[styles.summaryBar, { paddingBottom: insets.bottom + 6 }]}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>REV</Text>
          <Text style={styles.summaryValue}>$1,215</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>DIST</Text>
          <Text style={styles.summaryValue}>{totalMileage}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>R/M</Text>
          <Text style={styles.summaryValue}>
            ${totalMileage > 0 ? (1215 / totalMileage).toFixed(2) : "—"}
          </Text>
        </View>
      </View>

      {/* Detail Modal */}
      <StopDetailModal
        stop={selectedStop}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onComplete={handleComplete}
        onDelete={handleDelete}
        stopCount={stops.length}
        lastOdometer={selectedStop ? getLastOdometer(selectedStop.id) : ""}
      />
    </View>
  );
}

// ─── Timeline Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerBtn: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 8,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    width: 24,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
  },
  progressFill: {
    height: 3,
    backgroundColor: "#16a34a",
    borderRadius: 2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
    paddingRight: 6,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 56,
  },
  timelineCol: {
    width: 32,
    alignItems: "center",
  },
  lineSegment: {
    width: 1.5,
    minHeight: 8,
  },
  lineFlex: {
    flex: 1,
  },
  lineSolid: {
    backgroundColor: "#16a34a",
  },
  lineDashed: {
    backgroundColor: "#d1d5db",
    opacity: 0.5,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  dotCompleted: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  dotCurrent: {
    borderWidth: 2.5,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotUpcoming: {
    borderColor: "#d1d5db",
  },
  card: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderLeftWidth: 3,
  },
  cardCompleted: {
    backgroundColor: "#fafffe",
    opacity: 0.75,
  },
  cardCurrent: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardUpcoming: {
    backgroundColor: "#fafafa",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  checkboxDone: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  company: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1e293b",
    marginBottom: 2,
  },
  addressSubtext: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 4,
    lineHeight: 14,
  },
  textMuted: {
    color: "#9ca3af",
  },
  textLight: {
    color: "#6b7280",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: "#9ca3af",
  },
  dateLate: {
    color: "#dc2626",
    fontWeight: "600",
  },
  lateBadge: {
    fontSize: 9,
    fontWeight: "700",
    color: "#dc2626",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    overflow: "hidden",
  },
  arrowCol: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  arrowBtn: {
    padding: 2,
  },
  betweenRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 24,
  },
  betweenContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mileageText: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "500",
  },
  addBtn: {
    padding: 2,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#9ca3af",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#e5e7eb",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
});
