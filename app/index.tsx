import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";

type MenuButton = {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const menuButtons: MenuButton[] = [
  { label: "New Trip", route: "/trips/new", icon: "add-circle", color: "#2563eb" },
  { label: "Existing Trips", route: "/trips", icon: "map", color: "#0891b2" },
  { label: "Fuel Purchase", route: "/fuel", icon: "water", color: "#d97706" },
  { label: "Expenses", route: "/expenses", icon: "receipt", color: "#7c3aed" },
  { label: "Repairs", route: "/repairs", icon: "construct", color: "#dc2626" },
  { label: "Odometer", route: "/odometer", icon: "speedometer", color: "#059669" },
  { label: "Setup", route: "/setup", icon: "settings", color: "#64748b" },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, loading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return null; // Or a loading spinner
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userInfo}>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
          <Pressable onPress={signOut} style={styles.signOutButton}>
            <Ionicons name="log-out-outline" size={20} color="#64748b" />
          </Pressable>
        </View>
        <Text style={styles.title}>Trip Tracker</Text>
        <Text style={styles.subtitle}>Manage trips, expenses, and repairs</Text>
      </View>

      <View style={styles.grid}>
        {menuButtons.map((btn) => (
          <Pressable
            key={btn.route}
            onPress={() => router.push(btn.route)}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: btn.color + "15" }]}>
              <Ionicons name={btn.icon} size={32} color={btn.color} />
            </View>
            <Text style={styles.buttonLabel}>{btn.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    width: "100%",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  signOutButton: {
    padding: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: 0.5,
    ...(Platform.OS === "web" && {
      fontFamily: "system-ui, -apple-system, sans-serif"
    }),
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    width: "100%",
    maxWidth: 400,
  },
  button: {
    width: "45%",
    minWidth: 150,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: "#f1f5f9",
    transform: [{ scale: 0.97 }],
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
  },
});
