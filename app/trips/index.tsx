import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const DUMMY_TRIPS = [
  {
    id: "1092",
    status: "In Progress",
    stops: 5,
    completed: 2,
    origin: "Home Terminal",
    destination: "XYZ Distribution",
    date: "Feb 4–7, 2026",
  },
  {
    id: "1091",
    status: "Completed",
    stops: 3,
    completed: 3,
    origin: "Chicago Terminal",
    destination: "Atlanta Hub",
    date: "Jan 28–30, 2026",
  },
  {
    id: "1090",
    status: "Completed",
    stops: 4,
    completed: 4,
    origin: "Dallas Yard",
    destination: "Miami Depot",
    date: "Jan 22–25, 2026",
  },
];

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#1e293b" />
        </Pressable>
        <Text style={styles.title}>Trips</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Trip List */}
      <View style={styles.list}>
        {DUMMY_TRIPS.map((trip) => (
          <Pressable
            key={trip.id}
            style={({ pressed }) => [styles.tripCard, pressed && styles.tripCardPressed]}
            onPress={() => router.push(`/trips/${trip.id}`)}
          >
            <View style={styles.tripCardLeft}>
              <View style={styles.tripIdRow}>
                <Text style={styles.tripId}>#{trip.id}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    trip.status === "Completed" ? styles.statusCompleted : styles.statusActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      trip.status === "Completed" ? styles.statusTextCompleted : styles.statusTextActive,
                    ]}
                  >
                    {trip.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.tripRoute}>
                {trip.origin} → {trip.destination}
              </Text>
              <Text style={styles.tripMeta}>
                {trip.date} · {trip.completed}/{trip.stops} stops
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </Pressable>
        ))}
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  placeholder: {
    width: 24,
  },
  list: {
    padding: 12,
    gap: 6,
  },
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tripCardPressed: {
    backgroundColor: "#f3f4f6",
  },
  tripCardLeft: {
    flex: 1,
  },
  tripIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  tripId: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  statusActive: {
    backgroundColor: "#eff6ff",
  },
  statusCompleted: {
    backgroundColor: "#f0fdf4",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statusTextActive: {
    color: "#2563eb",
  },
  statusTextCompleted: {
    color: "#16a34a",
  },
  tripRoute: {
    fontSize: 12,
    color: "#374151",
    marginBottom: 1,
  },
  tripMeta: {
    fontSize: 11,
    color: "#9ca3af",
  },
});
