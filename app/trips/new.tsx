import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  searchLocations,
  formatLocationAddress,
  DatabaseLocation,
} from "../../lib/locations";

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

type NewStop = {
  id: string;
  type: string;
  company: string;
  address: string;
  expectedDate: string;
  expectedTime: string;
  notes: string;
  locationId?: string | null;
};

function makeId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 6);
}

export default function NewTripScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tripId, setTripId] = useState(""); // Display only - auto-generated on create
  const [revenue, setRevenue] = useState("");
  const [stops, setStops] = useState<NewStop[]>([
    {
      id: makeId(),
      type: "empty_start",
      company: "",
      address: "",
      expectedDate: "",
      expectedTime: "",
      notes: "",
      locationId: null,
    },
    {
      id: makeId(),
      type: "pickup",
      company: "",
      address: "",
      expectedDate: "",
      expectedTime: "",
      notes: "",
      locationId: null,
    },
    {
      id: makeId(),
      type: "delivery",
      company: "",
      address: "",
      expectedDate: "",
      expectedTime: "",
      notes: "",
      locationId: null,
    },
  ]);

  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  
  // Location search state
  const [searchMode, setSearchMode] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState<{ [key: string]: string }>({});
  const [searchResults, setSearchResults] = useState<{ [key: string]: DatabaseLocation[] }>({});
  const [searchLoading, setSearchLoading] = useState<{ [key: string]: boolean }>({});
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState<{ [key: string]: boolean }>({});
  const [tempDate, setTempDate] = useState<{ [key: string]: Date }>({});

  function addStop() {
    const newStop: NewStop = {
      id: makeId(),
      type: "stop",
      company: "",
      address: "",
      expectedDate: "",
      expectedTime: "",
      notes: "",
      locationId: null,
    };
    // Insert before the last stop (reposition or delivery)
    const newStops = [...stops];
    newStops.splice(newStops.length - 1, 0, newStop);
    setStops(newStops);
    setExpandedStop(newStop.id);
  }

  function removeStop(id: string) {
    if (stops.length <= 2) {
      Alert.alert("Minimum Stops", "A trip needs at least 2 stops.");
      return;
    }
    setStops((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStop(id: string, field: keyof NewStop, value: string) {
    setStops((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function moveStop(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= stops.length) return;
    const newStops = [...stops];
    [newStops[index], newStops[target]] = [newStops[target], newStops[index]];
    setStops(newStops);
  }

  // Debounced location search
  useEffect(() => {
    const searchTimers: { [key: string]: NodeJS.Timeout } = {};
    
    Object.keys(searchQuery).forEach((stopId) => {
      const query = searchQuery[stopId];
      const isSearching = searchMode[stopId];
      
      if (!isSearching || !query?.trim()) {
        setSearchResults((prev) => ({ ...prev, [stopId]: [] }));
        return;
      }

      searchTimers[stopId] = setTimeout(async () => {
        try {
          setSearchLoading((prev) => ({ ...prev, [stopId]: true }));
          const results = await searchLocations(query);
          setSearchResults((prev) => ({ ...prev, [stopId]: results }));
        } catch (error: any) {
          console.error("[NewTrip] Error searching locations:", error);
          Alert.alert("Error", `Failed to search locations: ${error.message || "Unknown error"}`);
        } finally {
          setSearchLoading((prev) => ({ ...prev, [stopId]: false }));
        }
      }, 300);
    });

    return () => {
      Object.values(searchTimers).forEach((timer) => clearTimeout(timer));
    };
  }, [searchQuery, searchMode]);

  function toggleSearchMode(stopId: string) {
    setSearchMode((prev) => ({ ...prev, [stopId]: !prev[stopId] }));
    setSearchQuery((prev) => ({ ...prev, [stopId]: "" }));
    setSearchResults((prev) => ({ ...prev, [stopId]: [] }));
  }

  function handleSelectLocation(stopId: string, location: DatabaseLocation) {
    const address = formatLocationAddress(location);
    setStops((prev) =>
      prev.map((s) =>
        s.id === stopId
          ? { ...s, company: location.name, address, locationId: location.id }
          : s
      )
    );
    setSearchMode((prev) => ({ ...prev, [stopId]: false }));
    setSearchQuery((prev) => ({ ...prev, [stopId]: "" }));
    setSearchResults((prev) => ({ ...prev, [stopId]: [] }));
  }

  function openDatePicker(stopId: string) {
    // Get current date or today (parse as local to avoid timezone shift)
    const stop = stops.find((s) => s.id === stopId);
    let initialDate = new Date();
    
    if (stop?.expectedDate) {
      try {
        // Parse "Feb 12, 2026" as local date
        const parsed = new Date(stop.expectedDate);
        if (!isNaN(parsed.getTime())) {
          initialDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
      } catch {
        initialDate = new Date();
      }
    }
    
    setTempDate((prev) => ({ ...prev, [stopId]: initialDate }));
    setShowDatePicker((prev) => ({ ...prev, [stopId]: true }));
  }

  function handleDateChange(stopId: string, event: any, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowDatePicker((prev) => ({ ...prev, [stopId]: false }));
    }
    
    if (event.type === "set" && selectedDate) {
      // Use local date parts to avoid timezone off-by-one
      const formatted = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      updateStop(stopId, "expectedDate", formatted);
      
      if (Platform.OS === "ios") {
        setShowDatePicker((prev) => ({ ...prev, [stopId]: false }));
      }
    } else if (event.type === "dismissed") {
      setShowDatePicker((prev) => ({ ...prev, [stopId]: false }));
    }
  }

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    setCreateError(null);
    
    const hasCompany = stops.some((s) => s.company.trim());
    if (!hasCompany) {
      setCreateError("Please fill in at least one stop company name.");
      return;
    }

    setCreating(true);

    try {
      const { createNewTrip, saveStop } = await import("../../lib/trips");
      const { getNextTripNumber } = await import("../../lib/sequences");
      
      // Get next trip number from sequences (100, 101, 102, ...)
      const tripNumber = await getNextTripNumber();
      const tripReference = tripNumber.toString();
      
      // Create the trip (DB generates UUID, we use trip number as reference)
      const newTrip = await createNewTrip(tripReference);

      // Save each stop
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        const uiStop = {
          id: crypto.randomUUID ? crypto.randomUUID() : `temp-${stop.id}`,
          type: stop.type as any,
          company: stop.company,
          address: stop.address,
          expectedDate: stop.expectedDate,
          expectedTime: stop.expectedTime || "",
          actualDate: "",
          actualTime: "",
          odometer: "",
          notes: stop.notes,
          isLate: false,
          isCompleted: false,
          isCurrent: i === 0,
          mileageToNext: null,
          locationId: stop.locationId || null,
        };
        await saveStop(newTrip.id, uiStop, i);
      }

      setCreating(false);
      
      // Update displayed trip number and navigate
      setTripId(tripReference);
      router.push(`/trips/${newTrip.id}`);
    } catch (error: any) {
      console.error("[NewTrip] Error creating trip:", error);
      setCreating(false);
      setCreateError(error.message || "Failed to create trip. Check console for details.");
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>New Trip</Text>
        <Pressable
          onPress={handleCreate}
          style={[styles.createBtn, creating && styles.createBtnDisabled]}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </Pressable>
      </View>

      {/* Error / Success messages */}
      {createError && (
        <View style={styles.messageBanner}>
          <Text style={styles.errorText}>{createError}</Text>
          <Pressable
            onPress={() => setCreateError(null)}
            style={styles.dismissError}
          >
            <Ionicons name="close" size={16} color="#dc2626" />
          </Pressable>
        </View>
      )}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trip info */}
        <View style={styles.section}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TRIP NUMBER</Text>
            <Text style={styles.tripNumberHint}>
              Auto-assigned on Create (e.g. 100, 101, 102). Set starting value in Settings → Sequences.
            </Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>REVENUE</Text>
              <TextInput
                style={styles.input}
                value={revenue}
                onChangeText={setRevenue}
                placeholder="$0.00"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Stops */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Stops</Text>
            <Pressable onPress={addStop} style={styles.addStopBtn}>
              <Ionicons name="add" size={14} color="#2563eb" />
              <Text style={styles.addStopText}>Add Stop</Text>
            </Pressable>
          </View>

          {stops.map((stop, index) => {
            const typeConfig = STOP_TYPES[stop.type] || STOP_TYPES.stop;
            const isExpanded = expandedStop === stop.id;

            return (
              <View key={stop.id} style={styles.stopCard}>
                {/* Stop header - always visible */}
                <Pressable
                  style={styles.stopHeader}
                  onPress={() =>
                    setExpandedStop(isExpanded ? null : stop.id)
                  }
                >
                  <View style={styles.stopHeaderLeft}>
                    <View
                      style={[
                        styles.stopDot,
                        { backgroundColor: typeConfig.color },
                      ]}
                    />
                    <Text style={styles.stopIndex}>{index + 1}</Text>
                    <Text
                      style={[styles.stopTypeText, { color: typeConfig.color }]}
                    >
                      {typeConfig.label}
                    </Text>
                    {stop.company ? (
                      <Text style={styles.stopCompanyPreview} numberOfLines={1}>
                        — {stop.company}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.stopHeaderRight}>
                    {/* Reorder */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        moveStop(index, "up");
                      }}
                      hitSlop={4}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={14}
                        color={index === 0 ? "#e5e7eb" : "#9ca3af"}
                      />
                    </Pressable>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        moveStop(index, "down");
                      }}
                      hitSlop={4}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color={
                          index === stops.length - 1 ? "#e5e7eb" : "#9ca3af"
                        }
                      />
                    </Pressable>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#6b7280"
                    />
                  </View>
                </Pressable>

                {/* Expanded form */}
                {isExpanded && (
                  <View style={styles.stopBody}>
                    {/* Type picker */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>TYPE</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.typePicker}
                      >
                        {STOP_TYPE_KEYS.map((key) => {
                          const cfg = STOP_TYPES[key];
                          const selected = stop.type === key;
                          return (
                            <Pressable
                              key={key}
                              onPress={() => updateStop(stop.id, "type", key)}
                              style={[
                                styles.typeChip,
                                selected && {
                                  backgroundColor: cfg.bgColor,
                                  borderColor: cfg.color,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.typeChipText,
                                  selected && {
                                    color: cfg.color,
                                    fontWeight: "600",
                                  },
                                ]}
                              >
                                {cfg.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Location Search Toggle */}
                    <View style={styles.fieldGroup}>
                      <View style={styles.toggleRow}>
                        <Text style={styles.fieldLabel}>LOCATION</Text>
                        <Pressable
                          onPress={() => toggleSearchMode(stop.id)}
                          style={styles.toggleBtn}
                        >
                          <Ionicons
                            name={searchMode[stop.id] ? "create-outline" : "search-outline"}
                            size={14}
                            color="#2563eb"
                          />
                          <Text style={styles.toggleBtnText}>
                            {searchMode[stop.id] ? "Manual Entry" : "Search Saved"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* Search Mode */}
                    {searchMode[stop.id] ? (
                      <View style={styles.fieldGroup}>
                        <TextInput
                          style={styles.input}
                          value={searchQuery[stop.id] || ""}
                          onChangeText={(text) =>
                            setSearchQuery((prev) => ({ ...prev, [stop.id]: text }))
                          }
                          placeholder="Search locations (use % for wildcards)..."
                          autoFocus
                        />
                        {searchLoading[stop.id] && (
                          <ActivityIndicator
                            size="small"
                            color="#2563eb"
                            style={styles.searchLoader}
                          />
                        )}
                        {(searchResults[stop.id]?.length || 0) > 0 && (
                          <View style={styles.searchResults}>
                            <ScrollView
                              style={styles.searchResultsList}
                              nestedScrollEnabled
                              keyboardShouldPersistTaps="handled"
                            >
                              {(searchResults[stop.id] || []).map((item) => (
                                <Pressable
                                  key={item.id}
                                  onPress={() => handleSelectLocation(stop.id, item)}
                                  style={styles.searchResultItem}
                                >
                                  <View>
                                    <Text style={styles.searchResultName}>{item.name}</Text>
                                    <Text style={styles.searchResultAddress}>
                                      {formatLocationAddress(item)}
                                    </Text>
                                  </View>
                                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                                </Pressable>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                        {!searchLoading[stop.id] &&
                          (searchQuery[stop.id]?.trim() || "") &&
                          (searchResults[stop.id]?.length || 0) === 0 && (
                            <Text style={styles.noResults}>No locations found</Text>
                          )}
                      </View>
                    ) : (
                      <>
                        {/* Company */}
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>COMPANY</Text>
                          <TextInput
                            style={styles.input}
                            value={stop.company}
                            onChangeText={(t) =>
                              updateStop(stop.id, "company", t)
                            }
                            placeholder="Company name"
                          />
                        </View>

                        {/* Address */}
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>ADDRESS</Text>
                          <TextInput
                            style={styles.input}
                            value={stop.address}
                            onChangeText={(t) =>
                              updateStop(stop.id, "address", t)
                            }
                            placeholder="Full address"
                          />
                        </View>
                      </>
                    )}

                    {/* Expected Date */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>EXPECTED DATE</Text>
                      {Platform.OS === "web" ? (
                        <View style={styles.dateInputRow}>
                          <TextInput
                            style={[styles.input, styles.dateInput]}
                            value={stop.expectedDate}
                            onChangeText={(t) =>
                              updateStop(stop.id, "expectedDate", t)
                            }
                            placeholder="e.g. Feb 10, 2026"
                          />
                          <Pressable
                            onPress={() => openDatePicker(stop.id)}
                            style={styles.datePickerButton}
                            accessibilityLabel="Open date picker"
                          >
                            <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                            <Text style={styles.datePickerButtonText}>Pick Date</Text>
                          </Pressable>
                          {showDatePicker[stop.id] && (
                            <View style={styles.webDatePicker}>
                              <input
                                type="date"
                                value={
                                  tempDate[stop.id]
                                    ? `${tempDate[stop.id].getFullYear()}-${String(tempDate[stop.id].getMonth() + 1).padStart(2, "0")}-${String(tempDate[stop.id].getDate()).padStart(2, "0")}`
                                    : (() => {
                                        const now = new Date();
                                        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                                      })()
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    // Parse as local date to avoid timezone off-by-one
                                    const [y, m, day] = val.split("-").map(Number);
                                    const d = new Date(y, m - 1, day);
                                    const formatted = d.toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    });
                                    updateStop(stop.id, "expectedDate", formatted);
                                  }
                                  setShowDatePicker((prev) => ({ ...prev, [stop.id]: false }));
                                }}
                                style={{
                                  padding: 8,
                                  fontSize: 14,
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 5,
                                  width: "100%",
                                }}
                                autoFocus
                              />
                              <Pressable
                                onPress={() => setShowDatePicker((prev) => ({ ...prev, [stop.id]: false }))}
                                style={styles.datePickerClose}
                              >
                                <Text style={styles.datePickerCloseText}>Close</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      ) : (
                        <>
                          <Pressable
                            onPress={() => openDatePicker(stop.id)}
                            style={styles.dateButton}
                          >
                            <Text style={styles.dateButtonText}>
                              {stop.expectedDate || "Select date..."}
                            </Text>
                            <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                          </Pressable>
                          {showDatePicker[stop.id] && (
                            <DateTimePicker
                              value={tempDate[stop.id] || new Date()}
                              mode="date"
                              display={Platform.OS === "ios" ? "spinner" : "default"}
                              onChange={(event, date) => handleDateChange(stop.id, event, date)}
                            />
                          )}
                        </>
                      )}
                    </View>

                    {/* Expected Time */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>EXPECTED TIME</Text>
                      <TextInput
                        style={styles.input}
                        value={stop.expectedTime}
                        onChangeText={(t) =>
                          updateStop(stop.id, "expectedTime", t)
                        }
                        placeholder="e.g. 14:30 (optional)"
                      />
                    </View>

                    {/* Notes */}
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>NOTES</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={stop.notes}
                        onChangeText={(t) =>
                          updateStop(stop.id, "notes", t)
                        }
                        placeholder="Optional notes"
                        multiline
                      />
                    </View>

                    {/* Remove */}
                    {stops.length > 2 && (
                      <Pressable
                        onPress={() => removeStop(stop.id)}
                        style={styles.removeBtn}
                      >
                        <Ionicons name="trash-outline" size={12} color="#dc2626" />
                        <Text style={styles.removeBtnText}>Remove Stop</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Add stop inline */}
          <Pressable onPress={addStop} style={styles.addStopInline}>
            <Ionicons name="add-circle-outline" size={16} color="#d1d5db" />
            <Text style={styles.addStopInlineText}>Add another stop</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

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
  createBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 14,
  },

  // Sections
  section: {},
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },

  // Row
  row: {
    flexDirection: "row",
    gap: 10,
  },

  // Fields
  fieldGroup: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  tripNumberHint: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 16,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: "#1e293b",
  },
  textArea: {
    minHeight: 48,
    textAlignVertical: "top",
  },

  // Type picker
  typePicker: {
    flexDirection: "row",
    gap: 5,
    paddingBottom: 2,
  },
  typeChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#6b7280",
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
    backgroundColor: "#ffffff",
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
  dateInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateInput: {
    flex: 1,
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  datePickerButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  webDatePicker: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  datePickerClose: {
    marginTop: 8,
    padding: 6,
    alignItems: "center",
  },
  datePickerCloseText: {
    fontSize: 12,
    color: "#6b7280",
  },
  createBtnDisabled: {
    opacity: 0.7,
  },
  messageBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    marginHorizontal: 14,
    marginTop: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "500",
  },
  dismissError: {
    padding: 4,
  },

  // Stop card
  stopCard: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 6,
    overflow: "hidden",
  },
  stopHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  stopHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  stopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stopIndex: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9ca3af",
    width: 14,
  },
  stopTypeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  stopCompanyPreview: {
    fontSize: 11,
    color: "#6b7280",
    flex: 1,
  },
  stopHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stopBody: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 8,
  },

  // Add stop
  addStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#eff6ff",
  },
  addStopText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },
  addStopInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  addStopInlineText: {
    fontSize: 11,
    color: "#d1d5db",
  },

  // Remove
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginTop: 2,
  },
  removeBtnText: {
    fontSize: 11,
    color: "#dc2626",
    fontWeight: "500",
  },
});
