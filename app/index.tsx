import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type MenuButton = {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const menuButtons: MenuButton[] = [
  { label: "New Trip", route: "/trips/new", icon: "add-circle", color: "#2563eb" },
  { label: "Trips", route: "/trips", icon: "map", color: "#0891b2" },
  { label: "Fuel", route: "/fuel", icon: "water", color: "#d97706" },
  { label: "Expenses", route: "/expenses", icon: "receipt", color: "#7c3aed" },
  { label: "Repairs", route: "/repairs", icon: "construct", color: "#dc2626" },
  { label: "Setup", route: "/setup", icon: "settings", color: "#64748b" },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }
      ]}
    >
      <View style={styles.header}>
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
              <Ionicons name={btn.icon} size={20} color={btn.color} />
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
    backgroundColor: "#f9fafb",
  },
  content: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    maxWidth: 400,
  },
  button: {
    width: "45%",
    minWidth: 140,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonPressed: {
    backgroundColor: "#f3f4f6",
    transform: [{ scale: 0.98 }],
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    textAlign: "center",
  },
});
