import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Alert, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabaseClient";

type Receipt = {
  id: string;
  image_path: string;
  status: string;
  receipt_type: string | null;
  notes: string | null;
  created_at: string;
  image_url?: string;
};

export default function ReceiptInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unprocessed" | "processed" | "all">("unprocessed");

  useFocusEffect(
    useCallback(() => {
      loadReceipts();
    }, [filter])
  );

  async function loadReceipts() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      let query = supabase
        .from("receipts")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get signed URLs for each receipt image
      const receiptsWithUrls = await Promise.all(
        (data || []).map(async (receipt) => {
          const { data: urlData } = await supabase.storage
            .from("receipts")
            .createSignedUrl(receipt.image_path, 3600);
          return {
            ...receipt,
            image_url: urlData?.signedUrl || "",
          };
        })
      );

      setReceipts(receiptsWithUrls);
    } catch (error) {
      console.error("Error loading receipts:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSnapReceipt() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera access is required.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });

      if (result.canceled) return;
      await uploadReceipt(result.assets[0]);
    } catch (error) {
      // Fallback to library
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (!result.canceled) {
        await uploadReceipt(result.assets[0]);
      }
    }
  }

  async function uploadReceipt(image: ImagePicker.ImagePickerAsset) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = image.uri.split(".").pop() || "jpg";
      const fileName = `${tenantUser.tenant_id}/${timestamp}.${ext}`;

      const response = await fetch(image.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, blob, {
          contentType: image.mimeType || "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("receipts")
        .insert({
          tenant_id: tenantUser.tenant_id,
          image_path: fileName,
          status: "unprocessed",
        });

      if (dbError) throw dbError;

      Alert.alert("Success", "Receipt uploaded!");
      loadReceipts();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to upload.");
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "unprocessed": return "#f59e0b";
      case "processed": return "#10b981";
      case "skipped": return "#94a3b8";
      default: return "#64748b";
    }
  }

  function getTypeLabel(type: string | null) {
    switch (type) {
      case "fuel": return "Fuel";
      case "expense": return "Expense";
      case "repair": return "Repair";
      default: return "";
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push("/")} style={styles.backButton}>
            <Ionicons name="home" size={24} color="#1e293b" />
          </Pressable>
          <Text style={styles.headerTitle}>Receipt Inbox</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading receipts...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push("/")} style={styles.backButton}>
          <Ionicons name="home" size={24} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>Receipt Inbox</Text>
        <Pressable onPress={handleSnapReceipt} style={styles.addButton}>
          <Ionicons name="camera" size={24} color="#2563eb" />
        </Pressable>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["unprocessed", "processed", "all"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === "unprocessed" ? "New" : f === "processed" ? "Done" : "All"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Receipt grid */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {receipts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {filter === "unprocessed"
                ? "No new receipts. Tap the camera to snap one!"
                : "No receipts found."}
            </Text>
          </View>
        ) : (
          <View style={styles.receiptGrid}>
            {receipts.map((receipt) => (
              <Pressable
                key={receipt.id}
                onPress={() => router.push(`/receipts/${receipt.id}`)}
                style={({ pressed }) => [
                  styles.receiptCard,
                  pressed && styles.receiptCardPressed,
                ]}
              >
                {receipt.image_url ? (
                  <Image
                    source={{ uri: receipt.image_url }}
                    style={styles.receiptImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.receiptImagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color="#d1d5db" />
                  </View>
                )}
                <View style={styles.receiptInfo}>
                  <Text style={styles.receiptDate}>{formatDate(receipt.created_at)}</Text>
                  <View style={styles.receiptBadges}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(receipt.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(receipt.status) }]}>
                      {receipt.status === "unprocessed" ? "New" : receipt.status}
                    </Text>
                    {receipt.receipt_type && (
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{getTypeLabel(receipt.receipt_type)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
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
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
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
  addButton: {
    padding: 4,
  },
  filterRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  filterTabActive: {
    borderBottomColor: "#2563eb",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  filterTabTextActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#9ca3af",
    marginTop: 12,
    textAlign: "center",
  },
  receiptGrid: {
    gap: 12,
  },
  receiptCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  receiptCardPressed: {
    backgroundColor: "#f9fafb",
    transform: [{ scale: 0.99 }],
  },
  receiptImage: {
    width: 80,
    height: 80,
  },
  receiptImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  receiptDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 6,
  },
  receiptBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  typeBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },
});
