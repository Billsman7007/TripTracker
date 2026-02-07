import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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

type Stop = {
  id: string;
  type: keyof typeof STOP_TYPES;
  company: string;
  expectedDate: string;
  isLate: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  mileageToNext: number | null;
};

// Hardcoded dummy data
const MOCK_STOPS: Stop[] = [
  {
    id: "1",
    type: "empty_start",
    company: "Home Terminal",
    expectedDate: "Feb 4, 2026",
    isLate: false,
    isCompleted: true,
    isCurrent: false,
    mileageToNext: 85,
  },
  {
    id: "2",
    type: "pickup",
    company: "ABC Manufacturing",
    expectedDate: "Feb 5, 2026",
    isLate: false,
    isCompleted: true,
    isCurrent: false,
    mileageToNext: 142,
  },
  {
    id: "3",
    type: "terminal",
    company: "Stock Corporation",
    expectedDate: "Feb 6, 2026",
    isLate: false,
    isCompleted: false,
    isCurrent: true,
    mileageToNext: 127,
  },
  {
    id: "4",
    type: "delivery",
    company: "XYZ Distribution",
    expectedDate: "Feb 7, 2026",
    isLate: true,
    isCompleted: false,
    isCurrent: false,
    mileageToNext: 133,
  },
  {
    id: "5",
    type: "reposition",
    company: "Return Terminal",
    expectedDate: "Feb 8, 2026",
    isLate: false,
    isCompleted: false,
    isCurrent: false,
    mileageToNext: null,
  },
];

export default function TripDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [stops, setStops] = useState<Stop[]>(MOCK_STOPS);

  const completedCount = stops.filter((s) => s.isCompleted).length;
  const totalMileage = stops.reduce(
    (sum, s) => sum + (s.mileageToNext || 0),
    0
  );

  function toggleComplete(stopId: string) {
    setStops((prev) =>
      prev.map((s) =>
        s.id === stopId ? { ...s, isCompleted: !s.isCompleted } : s
      )
    );
  }

  function moveStop(index: number, direction: "up" | "down") {
    const newStops = [...stops];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    // Don't allow moving past boundaries
    if (targetIndex < 0 || targetIndex >= newStops.length) return;

    // Lock: Empty Start always first, Reposition always last
    const moving = newStops[index];
    const target = newStops[targetIndex];
    if (moving.type === "empty_start" || moving.type === "reposition") return;
    if (
      (direction === "up" && target.type === "empty_start") ||
      (direction === "down" && target.type === "reposition")
    )
      return;

    // Swap
    [newStops[index], newStops[targetIndex]] = [
      newStops[targetIndex],
      newStops[index],
    ];
    setStops(newStops);
  }

  function addStop(afterIndex: number) {
    const newStop: Stop = {
      id: Date.now().toString(),
      type: "stop",
      company: "New Stop",
      expectedDate: "TBD",
      isLate: false,
      isCompleted: false,
      isCurrent: false,
      mileageToNext: 0,
    };
    const newStops = [...stops];
    newStops.splice(afterIndex + 1, 0, newStop);
    setStops(newStops);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header - minimal */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>#{id}</Text>
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
                  {/* Line above dot */}
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
                  {/* Dot */}
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
                  {/* Line below dot */}
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

                {/* Card */}
                <Pressable
                  style={[
                    styles.card,
                    stop.isCompleted && styles.cardCompleted,
                    stop.isCurrent && styles.cardCurrent,
                    !stop.isCompleted && !stop.isCurrent && styles.cardUpcoming,
                    { borderLeftColor: stop.isCompleted ? "#16a34a" : stop.isCurrent ? typeConfig.color : "#d1d5db" },
                  ]}
                >
                  {/* Card header row */}
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.typeLabel,
                        {
                          color:
                            stop.isCompleted
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
                      onPress={() => toggleComplete(stop.id)}
                      hitSlop={8}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          stop.isCompleted && styles.checkboxDone,
                          stop.isCurrent && {
                            borderColor: typeConfig.color,
                          },
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

                  {/* Company */}
                  <Text
                    style={[
                      styles.company,
                      stop.isCompleted && styles.textMuted,
                      !stop.isCompleted && !stop.isCurrent && styles.textLight,
                    ]}
                  >
                    {stop.company}
                  </Text>

                  {/* Date row */}
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
                      {stop.expectedDate}
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
                    {stop.mileageToNext != null && stop.mileageToNext > 0 && (
                      <Text style={styles.mileageText}>
                        {stop.mileageToNext} mi
                      </Text>
                    )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },

  // Header
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

  // Progress
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

  // Scroll
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
    paddingRight: 6,
  },

  // Stop row
  stopRow: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 56,
  },

  // Timeline column
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
    // React Native doesn't support dashed borders on Views easily,
    // so we use a lighter solid line for "upcoming"
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

  // Card
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

  // Reorder arrows
  arrowCol: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  arrowBtn: {
    padding: 2,
  },

  // Between stops
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

  // Bottom summary bar
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
});
