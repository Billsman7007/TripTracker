import { useState, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabaseClient";

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadExpense();
  }, [id]);

  async function loadExpense() {
    try {
      const { data, error } = await supabase
        .from("misc_expenses")
        .select(`
          *,
          vendors(name),
          expense_types(name, code),
          receipts(id, image_path, status)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setExpense(data);
    } catch (error: any) {
      Alert.alert("Error", "Failed to load expense.");
      router.back();
    } finally {
      setLoading(false);
    }
  }

  async function deleteExpense() {
    Alert.alert(
      "Delete Expense",
      "Are you sure you want to delete this expense?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("misc_expenses").delete().eq("id", id);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              router.back();
            }
          },
        },
      ]
    );
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatCurrency(amount: number) {
    return `$${Number(amount || 0).toFixed(2)}`;
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </Pressable>
          <Text style={styles.headerTitle}>Expense</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    );
  }

  if (!expense) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>Expense</Text>
        <Pressable onPress={deleteExpense} style={styles.headerBtn}>
          <Ionicons name="trash-outline" size={22} color="#dc2626" />
        </Pressable>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Total amount - prominent */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatCurrency(expense.total)}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailCard}>
          <DetailRow label="Vendor" value={expense.vendors?.name || "—"} />
          <DetailRow label="Date" value={formatDate(expense.date)} />
          <DetailRow
            label="Expense Type"
            value={
              expense.expense_types
                ? expense.expense_types.code
                  ? `${expense.expense_types.code} – ${expense.expense_types.name}`
                  : expense.expense_types.name
                : "—"
            }
          />
          <DetailRow label="Description" value={expense.description || "—"} />

          <View style={styles.divider} />

          <DetailRow label="Net Amount" value={formatCurrency(expense.amount)} />
          <DetailRow label="GST" value={formatCurrency(expense.tax)} />
          <DetailRow label="Total" value={formatCurrency(expense.total)} bold />

          {expense.notes && (
            <>
              <View style={styles.divider} />
              <DetailRow label="Notes" value={expense.notes} />
            </>
          )}

          {expense.receipts && (
            <>
              <View style={styles.divider} />
              <View style={styles.receiptRow}>
                <Ionicons name="camera" size={16} color="#10b981" />
                <Text style={styles.receiptText}>Receipt attached</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={[detailStyles.value, bold && detailStyles.valueBold]}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  label: {
    fontSize: 13,
    color: "#64748b",
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  valueBold: {
    fontWeight: "700",
    fontSize: 15,
  },
});

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
  headerBtn: {
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
  totalCard: {
    backgroundColor: "#2563eb",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
  },
  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 4,
  },
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  receiptText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
  },
});
