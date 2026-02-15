import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Alert, ActivityIndicator, Dimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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

const screenWidth = Dimensions.get("window").width;

export default function ReceiptDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) loadReceipt();
  }, [id]);

  async function loadReceipt() {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Get signed URL for image
      const { data: urlData } = await supabase.storage
        .from("receipts")
        .createSignedUrl(data.image_path, 3600);

      setReceipt({
        ...data,
        image_url: urlData?.signedUrl || "",
      });
    } catch (error: any) {
      console.error("Error loading receipt:", error);
      Alert.alert("Error", "Failed to load receipt.");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function classifyReceipt(type: "fuel" | "expense" | "repair") {
    if (!receipt) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          receipt_type: type,
          status: "processed",
        })
        .eq("id", receipt.id);

      if (error) throw error;

      setReceipt({ ...receipt, receipt_type: type, status: "processed" });

      const labels = { fuel: "Fuel Purchase", expense: "Expense", repair: "Repair" };
      Alert.alert(
        "Classified!",
        `Receipt tagged as "${labels[type]}". The entry form will be available soon.`,
        [
          { text: "Back to Inbox", onPress: () => router.back() },
          { text: "OK", style: "cancel" },
        ]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to classify receipt.");
    } finally {
      setSaving(false);
    }
  }

  async function unclassifyReceipt() {
    if (!receipt) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          receipt_type: null,
          status: "unprocessed",
        })
        .eq("id", receipt.id);

      if (error) throw error;

      setReceipt({ ...receipt, receipt_type: null, status: "unprocessed" });
      Alert.alert("Reset", "Receipt moved back to unprocessed.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteReceipt() {
    if (!receipt) return;

    Alert.alert(
      "Delete Receipt",
      "Are you sure? This will delete the receipt and its photo permanently.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete from storage
              await supabase.storage
                .from("receipts")
                .remove([receipt.image_path]);

              // Delete from database
              const { error } = await supabase
                .from("receipts")
                .delete()
                .eq("id", receipt.id);

              if (error) throw error;

              Alert.alert("Deleted", "Receipt removed.");
              router.back();
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getTypeLabel(type: string | null) {
    switch (type) {
      case "fuel": return "Fuel Purchase";
      case "expense": return "Expense";
      case "repair": return "Repair";
      default: return "Unclassified";
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </Pressable>
          <Text style={styles.headerTitle}>Receipt</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    );
  }

  if (!receipt) return null;

  const isProcessed = receipt.status === "processed";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>Receipt</Text>
        <Pressable onPress={deleteReceipt} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={22} color="#dc2626" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Receipt image */}
        {receipt.image_url ? (
          <Image
            source={{ uri: receipt.image_url }}
            style={[styles.receiptImage, { width: screenWidth - 32, height: (screenWidth - 32) * 1.3 }]}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { width: screenWidth - 32, height: 200 }]}>
            <Ionicons name="image-outline" size={48} color="#d1d5db" />
            <Text style={styles.placeholderText}>Image not available</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.dateText}>{formatDate(receipt.created_at)}</Text>

          {isProcessed && (
            <View style={styles.classifiedBanner}>
              <View style={styles.classifiedBannerLeft}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.classifiedText}>
                  Tagged as: {getTypeLabel(receipt.receipt_type)}
                </Text>
              </View>
              <Pressable onPress={unclassifyReceipt} disabled={saving}>
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Classify buttons */}
        {!isProcessed && (
          <View style={styles.classifySection}>
            <Text style={styles.classifyTitle}>What is this receipt for?</Text>

            <Pressable
              onPress={() => classifyReceipt("fuel")}
              disabled={saving}
              style={({ pressed }) => [
                styles.classifyButton,
                styles.classifyFuel,
                pressed && styles.classifyButtonPressed,
              ]}
            >
              <Ionicons name="water" size={24} color="#d97706" />
              <View style={styles.classifyButtonContent}>
                <Text style={styles.classifyButtonTitle}>Fuel Purchase</Text>
                <Text style={styles.classifyButtonDesc}>Gas, diesel, DEF</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </Pressable>

            <Pressable
              onPress={() => classifyReceipt("expense")}
              disabled={saving}
              style={({ pressed }) => [
                styles.classifyButton,
                styles.classifyExpense,
                pressed && styles.classifyButtonPressed,
              ]}
            >
              <Ionicons name="receipt" size={24} color="#7c3aed" />
              <View style={styles.classifyButtonContent}>
                <Text style={styles.classifyButtonTitle}>Expense</Text>
                <Text style={styles.classifyButtonDesc}>Hotel, tolls, food, supplies</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </Pressable>

            <Pressable
              onPress={() => classifyReceipt("repair")}
              disabled={saving}
              style={({ pressed }) => [
                styles.classifyButton,
                styles.classifyRepair,
                pressed && styles.classifyButtonPressed,
              ]}
            >
              <Ionicons name="construct" size={24} color="#dc2626" />
              <View style={styles.classifyButtonContent}>
                <Text style={styles.classifyButtonTitle}>Repair</Text>
                <Text style={styles.classifyButtonDesc}>Truck or trailer repair</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </Pressable>

            <Pressable
              onPress={() => {
                supabase
                  .from("receipts")
                  .update({ status: "skipped" })
                  .eq("id", receipt.id)
                  .then(() => {
                    Alert.alert("Skipped", "Receipt moved to skipped.");
                    router.back();
                  });
              }}
              style={styles.skipButton}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </Pressable>
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
    width: 30,
  },
  deleteButton: {
    padding: 4,
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
  receiptImage: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  imagePlaceholder: {
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  placeholderText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
  },
  infoSection: {
    marginTop: 16,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  classifiedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  classifiedBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  classifiedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
  },
  resetText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
  },
  classifySection: {
    marginTop: 8,
  },
  classifyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  classifyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 10,
    gap: 14,
  },
  classifyButtonPressed: {
    backgroundColor: "#f9fafb",
    transform: [{ scale: 0.99 }],
  },
  classifyFuel: {},
  classifyExpense: {},
  classifyRepair: {},
  classifyButtonContent: {
    flex: 1,
  },
  classifyButtonTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  classifyButtonDesc: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94a3b8",
  },
});
