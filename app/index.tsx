import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

type MenuButton = {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const menuButtons: MenuButton[] = [
  { label: "New Trip", route: "/trips/new", icon: "add-circle", color: "#2563eb" },
  { label: "Trips", route: "/trips", icon: "map", color: "#0891b2" },
  { label: "Receipts", route: "/receipts", icon: "images", color: "#f59e0b" },
  { label: "Expenses", route: "/expenses", icon: "receipt", color: "#7c3aed" },
  { label: "Repairs", route: "/repairs", icon: "construct", color: "#dc2626" },
  { label: "Setup", route: "/setup", icon: "settings", color: "#64748b" },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [unprocessedCount, setUnprocessedCount] = useState(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [authLoading, user]);

  // Reload unprocessed count every time screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadUnprocessedCount();
      }
    }, [user])
  );

  async function loadUnprocessedCount() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const { count, error } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("status", "unprocessed");

      if (!error && count !== null) {
        setUnprocessedCount(count);
      }
    } catch (error) {
      console.error("Error loading receipt count:", error);
    }
  }

  async function handleSnapReceipt() {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera access is required to snap receipts.");
        return;
      }

      // Open camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const image = result.assets[0];
      await uploadReceipt(image);
    } catch (error: any) {
      console.error("Camera error:", error);
      // Fallback to photo library on web or if camera fails
      handlePickFromLibrary();
    }
  }

  async function handlePickFromLibrary() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Photo library access is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const image = result.assets[0];
      await uploadReceipt(image);
    } catch (error: any) {
      Alert.alert("Error", "Failed to pick image: " + error.message);
    }
  }

  async function uploadReceipt(image: ImagePicker.ImagePickerAsset) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "Please sign in to save receipts.");
        return;
      }

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) {
        Alert.alert("Error", "Account not found.");
        return;
      }

      // Generate a unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = image.uri.split(".").pop() || "jpg";
      const fileName = `${tenantUser.tenant_id}/${timestamp}.${ext}`;

      // Fetch the image as a blob
      const response = await fetch(image.uri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, blob, {
          contentType: image.mimeType || "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create receipt record in database
      const { error: dbError } = await supabase
        .from("receipts")
        .insert({
          tenant_id: tenantUser.tenant_id,
          image_path: fileName,
          status: "unprocessed",
        });

      if (dbError) throw dbError;

      setUnprocessedCount((prev) => prev + 1);
      Alert.alert(
        "Receipt Saved!",
        "Your receipt has been added to the inbox.",
        [
          { text: "View Inbox", onPress: () => router.push("/receipts") },
          { text: "OK", style: "cancel" },
        ]
      );
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Upload Failed", error.message || "Failed to upload receipt.");
    }
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <View style={[styles.page, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Don't render if not authenticated (will redirect to login)
  if (!user) return null;

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

      {/* Snap Receipt - Big prominent button */}
      <Pressable
        onPress={handleSnapReceipt}
        style={({ pressed }) => [
          styles.snapButton,
          pressed && styles.snapButtonPressed
        ]}
      >
        <Ionicons name="camera" size={28} color="#ffffff" />
        <Text style={styles.snapButtonText}>Snap Receipt</Text>
      </Pressable>

      {/* Unprocessed receipt count */}
      {unprocessedCount > 0 && (
        <Pressable
          onPress={() => router.push("/receipts")}
          style={styles.inboxBanner}
        >
          <View style={styles.inboxBannerLeft}>
            <Ionicons name="mail-unread" size={20} color="#f59e0b" />
            <Text style={styles.inboxBannerText}>
              {unprocessedCount} unprocessed receipt{unprocessedCount !== 1 ? "s" : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </Pressable>
      )}

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
  snapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    maxWidth: 400,
    marginBottom: 12,
    gap: 10,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  snapButtonPressed: {
    backgroundColor: "#1d4ed8",
    transform: [{ scale: 0.98 }],
  },
  snapButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  inboxBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "100%",
    maxWidth: 400,
    marginBottom: 16,
  },
  inboxBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inboxBannerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
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
