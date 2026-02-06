import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";

type Tab = "settings" | "trucks" | "locations" | "vendors";

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "settings", label: "Settings", icon: "settings-outline" },
    { id: "trucks", label: "Trucks", icon: "car-outline" },
    { id: "locations", label: "Locations", icon: "location-outline" },
    { id: "vendors", label: "Vendors", icon: "storefront-outline" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <Text style={styles.title}>Setup</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabContainer}
        contentContainerStyle={styles.tabScrollContent}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[
              styles.tab,
              activeTab === tab.id && styles.tabActive,
            ]}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.id ? "#2563eb" : "#64748b"}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "trucks" && <TrucksTab />}
        {activeTab === "locations" && <LocationsTab />}
        {activeTab === "vendors" && <VendorsTab />}
      </ScrollView>
    </View>
  );
}

function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    driver_name: "",
    default_currency: "USD",
    default_fuel_unit: "gallons",
    rate_per_mile_loaded: "",
    rate_per_mile_empty: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("Error getting user:", userError);
        setLoading(false);
        return;
      }

      // Get tenant_id
      const { data: tenantUser, error: tenantError } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (tenantError || !tenantUser) {
        console.error("Error getting tenant:", tenantError);
        setLoading(false);
        return;
      }

      // Get settings
      const { data, error: settingsError } = await supabase
        .from("settings")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is OK for first time
        console.error("Error loading settings:", settingsError);
      }

      if (data) {
        setSettings({
          driver_name: data.driver_name || "",
          default_currency: data.default_currency || "USD",
          default_fuel_unit: data.default_fuel_unit || "gallons",
          rate_per_mile_loaded: data.rate_per_mile_loaded?.toString() || "",
          rate_per_mile_empty: data.rate_per_mile_empty?.toString() || "",
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert("Error", "Please sign in to save settings");
        setSaving(false);
        return;
      }

      const { data: tenantUser, error: tenantError } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (tenantError || !tenantUser) {
        Alert.alert("Error", "Unable to find your account. Please try signing out and back in.");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("settings")
        .upsert({
          tenant_id: tenantUser.tenant_id,
          driver_name: settings.driver_name || null,
          default_currency: settings.default_currency,
          default_fuel_unit: settings.default_fuel_unit,
          rate_per_mile_loaded: settings.rate_per_mile_loaded ? parseFloat(settings.rate_per_mile_loaded) : null,
          rate_per_mile_empty: settings.rate_per_mile_empty ? parseFloat(settings.rate_per_mile_empty) : null,
        });

      if (error) throw error;
      
      Alert.alert("Success", "Settings saved successfully!");
    } catch (error: any) {
      Alert.alert("Error", "Error saving settings: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>General Settings</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Driver Name</Text>
        <TextInput
          style={styles.input}
          value={settings.driver_name}
          onChangeText={(text) => setSettings({ ...settings, driver_name: text })}
          placeholder="Enter driver name"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Default Currency</Text>
        <View style={styles.radioGroup}>
          <Pressable
            style={[
              styles.radioButton,
              settings.default_currency === "USD" && styles.radioButtonActive,
            ]}
            onPress={() => setSettings({ ...settings, default_currency: "USD" })}
          >
            <Text
              style={[
                styles.radioLabel,
                settings.default_currency === "USD" && styles.radioLabelActive,
              ]}
            >
              USD
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.radioButton,
              settings.default_currency === "CAD" && styles.radioButtonActive,
            ]}
            onPress={() => setSettings({ ...settings, default_currency: "CAD" })}
          >
            <Text
              style={[
                styles.radioLabel,
                settings.default_currency === "CAD" && styles.radioLabelActive,
              ]}
            >
              CAD
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Default Fuel Unit</Text>
        <View style={styles.radioGroup}>
          <Pressable
            style={[
              styles.radioButton,
              settings.default_fuel_unit === "gallons" && styles.radioButtonActive,
            ]}
            onPress={() => setSettings({ ...settings, default_fuel_unit: "gallons" })}
          >
            <Text
              style={[
                styles.radioLabel,
                settings.default_fuel_unit === "gallons" && styles.radioLabelActive,
              ]}
            >
              Gallons
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.radioButton,
              settings.default_fuel_unit === "liters" && styles.radioButtonActive,
            ]}
            onPress={() => setSettings({ ...settings, default_fuel_unit: "liters" })}
          >
            <Text
              style={[
                styles.radioLabel,
                settings.default_fuel_unit === "liters" && styles.radioLabelActive,
              ]}
            >
              Liters
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Rate per Mile (Loaded)</Text>
        <TextInput
          style={styles.input}
          value={settings.rate_per_mile_loaded}
          onChangeText={(text) => setSettings({ ...settings, rate_per_mile_loaded: text })}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Rate per Mile (Empty)</Text>
        <TextInput
          style={styles.input}
          value={settings.rate_per_mile_empty}
          onChangeText={(text) => setSettings({ ...settings, rate_per_mile_empty: text })}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      </View>

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveSettings}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving..." : "Save Settings"}
        </Text>
      </Pressable>
    </View>
  );
}

function TrucksTab() {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Trucks</Text>
      <Text style={styles.comingSoon}>Truck management coming soon...</Text>
    </View>
  );
}

function LocationsTab() {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Locations</Text>
      <Text style={styles.comingSoon}>Location management coming soon...</Text>
    </View>
  );
}

function VendorsTab() {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Vendors</Text>
      <Text style={styles.comingSoon}>Vendor management coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  placeholder: {
    width: 32,
  },
  tabContainer: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tabScrollContent: {
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 8,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  tabLabelActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 24,
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1e293b",
  },
  radioGroup: {
    flexDirection: "row",
    gap: 12,
  },
  radioButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  radioButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#64748b",
  },
  radioLabelActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 24,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#64748b",
  },
  comingSoon: {
    fontSize: 16,
    color: "#64748b",
    fontStyle: "italic",
  },
});
