import { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabaseClient";

type Expense = {
  id: string;
  date: string;
  amount: number;
  tax: number;
  total: number;
  description: string | null;
  notes: string | null;
  expense_type_id: string | null;
  vendor_id: string | null;
  trip_id: string | null;
  receipt_id: string | null;
  vendor_name?: string;
  expense_type_name?: string;
  expense_type_code?: string;
};

export default function ExpensesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [])
  );

  async function loadExpenses() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const { data, error } = await supabase
        .from("misc_expenses")
        .select(`
          *,
          vendors(name),
          expense_types(name, code)
        `)
        .eq("tenant_id", tenantUser.tenant_id)
        .order("date", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((e: any) => ({
        ...e,
        vendor_name: e.vendors?.name || null,
        expense_type_name: e.expense_types?.name || null,
        expense_type_code: e.expense_types?.code || null,
      }));

      setExpenses(mapped);
    } catch (error) {
      console.error("Error loading expenses:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatCurrency(amount: number) {
    return `$${Number(amount || 0).toFixed(2)}`;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push("/")} style={styles.backButton}>
          <Ionicons name="home" size={24} color="#1e293b" />
        </Pressable>
        <Text style={styles.headerTitle}>Expenses</Text>
        <Pressable onPress={() => router.push("/expenses/new")} style={styles.addButton}>
          <Ionicons name="add-circle" size={26} color="#2563eb" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading expenses...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {expenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No expenses yet</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first expense</Text>
            </View>
          ) : (
            expenses.map((expense) => (
              <Pressable
                key={expense.id}
                style={({ pressed }) => [
                  styles.expenseCard,
                  pressed && styles.expenseCardPressed,
                ]}
                onPress={() => router.push(`/expenses/${expense.id}`)}
              >
                <View style={styles.expenseLeft}>
                  <Text style={styles.expenseDate}>{formatDate(expense.date)}</Text>
                  <Text style={styles.expenseVendor}>
                    {expense.vendor_name || expense.description || "No vendor"}
                  </Text>
                  <View style={styles.expenseBadges}>
                    {expense.expense_type_code && (
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{expense.expense_type_code}</Text>
                      </View>
                    )}
                    {expense.expense_type_name && !expense.expense_type_code && (
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{expense.expense_type_name}</Text>
                      </View>
                    )}
                    {expense.receipt_id && (
                      <Ionicons name="camera" size={12} color="#10b981" />
                    )}
                  </View>
                </View>
                <Text style={styles.expenseTotal}>{formatCurrency(expense.total)}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
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
  addButton: {
    padding: 4,
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
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#d1d5db",
    marginTop: 4,
  },
  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 10,
  },
  expenseCardPressed: {
    backgroundColor: "#f9fafb",
    transform: [{ scale: 0.99 }],
  },
  expenseLeft: {
    flex: 1,
    marginRight: 12,
  },
  expenseDate: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
  expenseVendor: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  expenseBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  codeBadge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#16a34a",
  },
  expenseTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
});
