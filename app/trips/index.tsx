import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchAllTrips, TripListItem } from "../../lib/trips";

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTrips() {
    try {
      const data = await fetchAllTrips();
      setTrips(data);
    } catch (error: any) {
      console.error("[Trips] Error loading trips:", error);
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTrips();
  }, []);

  // Reload when screen comes into focus (e.g. after creating a new trip)
  useFocusEffect(
    useCallback(() => {
      loadTrips();
      return () => {};
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading trips...</Text>
      </View>
    );
  }

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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptyText}>
              Create your first trip from the home screen
            </Text>
          </View>
        ) : (
          <>
            {trips.map((trip) => (
              <Pressable
                key={trip.id}
                style={({ pressed }) => [styles.tripCard, pressed && styles.tripCardPressed]}
                onPress={() => router.push(`/trips/${trip.id}`)}
              >
                <View style={styles.tripCardLeft}>
                  <View style={styles.tripIdRow}>
                    <Text style={styles.tripId}>#{trip.tripReference}</Text>
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
          </>
        )}
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
  scrollView: {
    flex: 1,
  },
  list: {
    padding: 12,
    gap: 6,
    flexGrow: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "center",
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
