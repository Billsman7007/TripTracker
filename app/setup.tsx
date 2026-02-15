import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Alert, Platform, Modal, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabaseClient";
import { geocodeAddress } from "../lib/mapbox";

type Tab = "settings" | "trucks" | "locations" | "vendors" | "expense_types";

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "settings", label: "Settings", icon: "settings-outline" },
    { id: "trucks", label: "Assets", icon: "car-outline" },
    { id: "locations", label: "Locations", icon: "location-outline" },
    { id: "vendors", label: "Vendors", icon: "storefront-outline" },
    { id: "expense_types", label: "Exp Codes", icon: "pricetag-outline" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push("/")} style={styles.backButton}>
          <Ionicons name="home" size={24} color="#1e293b" />
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
              size={18}
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
        {activeTab === "expense_types" && <ExpenseTypesTab />}
      </ScrollView>
    </View>
  );
}

function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    driver_name: "",
    billing_address1: "",
    billing_address2: "",
    billing_city: "",
    billing_state: "",
    billing_zip: "",
    country_of_operation: "US",
    default_currency: "USD",
    default_fuel_unit: "gallons",
    rate_per_mile_loaded: "",
    rate_per_mile_empty: "",
    trip_number_sequence: "100",
    order_number_sequence: "1",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        // No active session - user needs to sign in first
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
        // No tenant found for this user
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
          billing_address1: data.billing_address1 || "",
          billing_address2: data.billing_address2 || "",
          billing_city: data.billing_city || "",
          billing_state: data.billing_state || "",
          billing_zip: data.billing_zip || "",
          country_of_operation: data.country_of_operation || "US",
          default_currency: data.default_currency || "USD",
          default_fuel_unit: data.default_fuel_unit || "gallons",
          rate_per_mile_loaded: data.rate_per_mile_loaded?.toString() || "",
          rate_per_mile_empty: data.rate_per_mile_empty?.toString() || "",
          trip_number_sequence: data.trip_number_sequence?.toString() || "100",
          order_number_sequence: data.order_number_sequence?.toString() || "1",
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
        .upsert(
          {
            tenant_id: tenantUser.tenant_id,
            driver_name: settings.driver_name || null,
            billing_address1: settings.billing_address1 || null,
            billing_address2: settings.billing_address2 || null,
            billing_city: settings.billing_city || null,
            billing_state: settings.billing_state || null,
            billing_zip: settings.billing_zip || null,
            country_of_operation: settings.country_of_operation || "US",
            default_currency: settings.default_currency,
            default_fuel_unit: settings.default_fuel_unit,
            rate_per_mile_loaded: settings.rate_per_mile_loaded ? parseFloat(settings.rate_per_mile_loaded) : null,
            rate_per_mile_empty: settings.rate_per_mile_empty ? parseFloat(settings.rate_per_mile_empty) : null,
            trip_number_sequence: parseInt(settings.trip_number_sequence, 10) || 100,
            order_number_sequence: parseInt(settings.order_number_sequence, 10) || 1,
          },
          { onConflict: "tenant_id" }
        );

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

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Billing Address</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Address Line 1</Text>
        <TextInput
          style={styles.input}
          value={settings.billing_address1}
          onChangeText={(text) => setSettings({ ...settings, billing_address1: text })}
          placeholder="Street address"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Address Line 2</Text>
        <TextInput
          style={styles.input}
          value={settings.billing_address2}
          onChangeText={(text) => setSettings({ ...settings, billing_address2: text })}
          placeholder="Suite, unit, etc. (optional)"
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 2 }]}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={settings.billing_city}
            onChangeText={(text) => setSettings({ ...settings, billing_city: text })}
            placeholder="City"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>State/Prov</Text>
          <TextInput
            style={styles.input}
            value={settings.billing_state}
            onChangeText={(text) => setSettings({ ...settings, billing_state: text })}
            placeholder="ST"
            autoCapitalize="characters"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>Zip/Postal</Text>
          <TextInput
            style={styles.input}
            value={settings.billing_zip}
            onChangeText={(text) => setSettings({ ...settings, billing_zip: text })}
            placeholder="Zip"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Country of Operation</Text>
        <View style={styles.radioGroup}>
          <Pressable
            style={[
              styles.radioButton,
              settings.country_of_operation === "US" && styles.radioButtonActive,
            ]}
            onPress={() => setSettings({ ...settings, country_of_operation: "US" })}
          >
            <Text
              style={[
                styles.radioLabel,
                settings.country_of_operation === "US" && styles.radioLabelActive,
              ]}
            >
              United States
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.radioButton,
              settings.country_of_operation === "CA" && styles.radioButtonActive,
            ]}
            onPress={() => setSettings({ ...settings, country_of_operation: "CA" })}
          >
            <Text
              style={[
                styles.radioLabel,
                settings.country_of_operation === "CA" && styles.radioLabelActive,
              ]}
            >
              Canada
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.radioButton,
              settings.country_of_operation === "BOTH" && styles.radioButtonActive,
            ]}
            onPress={() => setSettings({ ...settings, country_of_operation: "BOTH" })}
          >
            <Text
              style={[
                styles.radioLabel,
                settings.country_of_operation === "BOTH" && styles.radioLabelActive,
              ]}
            >
              Both
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Defaults & Rates</Text>

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

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Sequences</Text>
      <Text style={styles.sequenceHint}>
        These numbers auto-increment when you create trips or orders. Set the starting value.
      </Text>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Trip Number (next trip will use this)</Text>
        <TextInput
          style={styles.input}
          value={settings.trip_number_sequence}
          onChangeText={(text) => setSettings({ ...settings, trip_number_sequence: text.replace(/\D/g, "") })}
          placeholder="100"
          keyboardType="number-pad"
        />
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Order Number</Text>
        <TextInput
          style={styles.input}
          value={settings.order_number_sequence}
          onChangeText={(text) => setSettings({ ...settings, order_number_sequence: text.replace(/\D/g, "") })}
          placeholder="1"
          keyboardType="number-pad"
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
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
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
        .from("trucks")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("truck_number");

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error("Error loading assets:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAsset(assetData: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      if (editing) {
        const { error } = await supabase
          .from("trucks")
          .update(assetData)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trucks")
          .insert({
            ...assetData,
            tenant_id: tenantUser.tenant_id,
          });
        if (error) throw error;
      }

      Alert.alert("Success", "Asset saved!");
      setShowForm(false);
      setEditing(null);
      loadAssets();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  }

  async function deleteAsset(id: string) {
    Alert.alert(
      "Delete Asset",
      "Are you sure you want to delete this asset?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("trucks").delete().eq("id", id);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              loadAssets();
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading assets...</Text>
      </View>
    );
  }

  if (showForm) {
    return (
      <AssetForm
        asset={editing}
        onSave={saveAsset}
        onCancel={() => {
          setShowForm(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Trucks & Trailers</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add-circle" size={18} color="#2563eb" />
        </Pressable>
      </View>

      {assets.length === 0 ? (
        <Text style={styles.emptyText}>No assets yet. Tap + to add one.</Text>
      ) : (
        assets.map((asset) => (
          <View key={asset.id} style={styles.itemCard}>
            <View style={styles.itemContent}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{asset.truck_number}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, styles.badgeGray]}>
                    <Text style={styles.badgeTextGray}>{asset.asset_type || 'truck'}</Text>
                  </View>
                  <View style={[styles.badge, asset.ownership_type === 'owned' ? styles.badgeGreen : styles.badgeBlue]}>
                    <Text style={[styles.badgeText, asset.ownership_type === 'owned' ? styles.badgeTextGreen : styles.badgeTextBlue]}>
                      {asset.ownership_type || 'owned'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.itemActions}>
              <Pressable
                onPress={() => {
                  setEditing(asset);
                  setShowForm(true);
                }}
                style={styles.iconButton}
              >
                <Ionicons name="pencil" size={16} color="#6b7280" />
              </Pressable>
              <Pressable
                onPress={() => deleteAsset(asset.id)}
                style={styles.iconButton}
              >
                <Ionicons name="trash" size={16} color="#dc2626" />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function DateInput({ value, onChangeDate, placeholder }: any) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value || "");

  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChangeDate(e.target.value)}
        style={{
          width: "100%",
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: "#e5e7eb",
          borderRadius: 6,
          padding: 8,
          fontSize: 13,
          color: "#1e293b",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          fontFamily: "system-ui",
        }}
      />
    );
  }

  return (
    <>
      <Pressable
        style={styles.dateButton}
        onPress={() => setShowPicker(true)}
      >
        <Text style={value ? styles.dateButtonTextFilled : styles.dateButtonTextPlaceholder}>
          {value || placeholder || "Select date"}
        </Text>
        <Ionicons name="calendar-outline" size={16} color="#6b7280" />
      </Pressable>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Date</Text>
            <TextInput
              style={styles.input}
              value={tempDate}
              onChangeText={setTempDate}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => {
                  setTempDate(value || "");
                  setShowPicker(false);
                }}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.buttonPrimary]}
                onPress={() => {
                  onChangeDate(tempDate);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.buttonPrimaryText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function AssetForm({ asset, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    truck_number: asset?.truck_number || "",
    asset_type: asset?.asset_type || "truck",
    ownership_type: asset?.ownership_type || "owned",
    // Purchased fields
    purchase_date: asset?.purchase_date || "",
    purchase_price: asset?.purchase_price?.toString() || "",
    amortization_period: asset?.amortization_period?.toString() || "",
    residual_value: asset?.residual_value?.toString() || "",
    // Leased fields
    lease_monthly_rate: asset?.lease_monthly_rate?.toString() || "",
    lease_years: asset?.lease_years?.toString() || "",
    lease_buyoff: asset?.lease_buyoff?.toString() || "",
  });

  const handleSave = () => {
    const dataToSave: any = {
      truck_number: formData.truck_number,
      asset_type: formData.asset_type,
      ownership_type: formData.ownership_type,
    };

    if (formData.ownership_type === "owned") {
      dataToSave.purchase_date = formData.purchase_date || null;
      dataToSave.purchase_price = formData.purchase_price ? parseFloat(formData.purchase_price) : null;
      dataToSave.amortization_period = formData.amortization_period ? parseFloat(formData.amortization_period) : null;
      dataToSave.residual_value = formData.residual_value ? parseFloat(formData.residual_value) : null;
      // Clear lease fields
      dataToSave.lease_monthly_rate = null;
      dataToSave.lease_years = null;
      dataToSave.lease_buyoff = null;
    } else {
      dataToSave.lease_monthly_rate = formData.lease_monthly_rate ? parseFloat(formData.lease_monthly_rate) : null;
      dataToSave.lease_years = formData.lease_years ? parseFloat(formData.lease_years) : null;
      dataToSave.lease_buyoff = formData.lease_buyoff ? parseFloat(formData.lease_buyoff) : null;
      // Clear purchase fields
      dataToSave.purchase_date = null;
      dataToSave.purchase_price = null;
      dataToSave.amortization_period = null;
      dataToSave.residual_value = null;
    }

    onSave(dataToSave);
  };

  return (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>{asset ? "Edit Asset" : "New Asset"}</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Asset Name/ID *</Text>
        <TextInput
          style={styles.input}
          value={formData.truck_number}
          onChangeText={(text) => setFormData({ ...formData, truck_number: text })}
          placeholder="e.g., Truck 1, Trailer 42"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Asset Type</Text>
        <View style={styles.radioGroup}>
          <Pressable
            style={[
              styles.radioButton,
              formData.asset_type === "truck" && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, asset_type: "truck" })}
          >
            <Ionicons 
              name="car" 
              size={16} 
              color={formData.asset_type === "truck" ? "#2563eb" : "#6b7280"} 
            />
            <Text
              style={[
                styles.radioLabel,
                formData.asset_type === "truck" && styles.radioLabelActive,
              ]}
            >
              Truck
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.radioButton,
              formData.asset_type === "trailer" && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, asset_type: "trailer" })}
          >
            <Ionicons 
              name="cube" 
              size={16} 
              color={formData.asset_type === "trailer" ? "#2563eb" : "#6b7280"} 
            />
            <Text
              style={[
                styles.radioLabel,
                formData.asset_type === "trailer" && styles.radioLabelActive,
              ]}
            >
              Trailer
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Ownership Type</Text>
        <View style={styles.radioGroup}>
          <Pressable
            style={[
              styles.radioButton,
              formData.ownership_type === "owned" && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, ownership_type: "owned" })}
          >
            <Text
              style={[
                styles.radioLabel,
                formData.ownership_type === "owned" && styles.radioLabelActive,
              ]}
            >
              Purchased
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.radioButton,
              formData.ownership_type === "leased" && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, ownership_type: "leased" })}
          >
            <Text
              style={[
                styles.radioLabel,
                formData.ownership_type === "leased" && styles.radioLabelActive,
              ]}
            >
              Leased
            </Text>
          </Pressable>
        </View>
      </View>

      {formData.ownership_type === "owned" ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.subsectionTitle}>Purchase Details</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Purchase Date</Text>
            <DateInput
              value={formData.purchase_date}
              onChangeDate={(date: string) => setFormData({ ...formData, purchase_date: date })}
              placeholder="Select purchase date"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Purchase Price</Text>
            <TextInput
              style={styles.input}
              value={formData.purchase_price}
              onChangeText={(text) => setFormData({ ...formData, purchase_price: text })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Amortization Period (months)</Text>
            <TextInput
              style={styles.input}
              value={formData.amortization_period}
              onChangeText={(text) => setFormData({ ...formData, amortization_period: text })}
              placeholder="e.g., 60"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Residual Value</Text>
            <TextInput
              style={styles.input}
              value={formData.residual_value}
              onChangeText={(text) => setFormData({ ...formData, residual_value: text })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.divider} />
          <Text style={styles.subsectionTitle}>Lease Details</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Monthly Lease Rate</Text>
            <TextInput
              style={styles.input}
              value={formData.lease_monthly_rate}
              onChangeText={(text) => setFormData({ ...formData, lease_monthly_rate: text })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Lease Term (years)</Text>
            <TextInput
              style={styles.input}
              value={formData.lease_years}
              onChangeText={(text) => setFormData({ ...formData, lease_years: text })}
              placeholder="e.g., 4"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Buyoff Amount</Text>
            <TextInput
              style={styles.input}
              value={formData.lease_buyoff}
              onChangeText={(text) => setFormData({ ...formData, lease_buyoff: text })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </>
      )}

      <View style={styles.formActions}>
        <Pressable
          style={[styles.button, styles.buttonSecondary]}
          onPress={onCancel}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleSave}
        >
          <Text style={styles.buttonPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function LocationsTab() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
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
        .from("locations")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("name");

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error loading locations:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveLocation(locationData: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      if (editing) {
        const { error } = await supabase
          .from("locations")
          .update(locationData)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("locations")
          .insert({
            ...locationData,
            tenant_id: tenantUser.tenant_id,
          });
        if (error) throw error;
      }

      Alert.alert("Success", "Location saved!");
      setShowForm(false);
      setEditing(null);
      loadLocations();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  }

  async function deleteLocation(id: string) {
    Alert.alert(
      "Delete Location",
      "Are you sure you want to delete this location?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("locations").delete().eq("id", id);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              loadLocations();
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading locations...</Text>
      </View>
    );
  }

  if (showForm) {
    return (
      <LocationForm
        location={editing}
        onSave={saveLocation}
        onCancel={() => {
          setShowForm(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Locations</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add-circle" size={18} color="#2563eb" />
        </Pressable>
      </View>

      {locations.length === 0 ? (
        <Text style={styles.emptyText}>No locations yet. Tap + to add one.</Text>
      ) : (
        locations.map((location) => (
          <View key={location.id} style={styles.itemCard}>
            {/* Geocode status dot */}
            <View
              style={[
                styles.geoDot,
                location.latitude && location.longitude
                  ? styles.geoDotVerified
                  : styles.geoDotMissing,
              ]}
            />
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{location.name}</Text>
              <Text style={styles.itemSubtitle}>
                {location.city && location.state ? `${location.city}, ${location.state}` : location.city || location.state || ""}
              </Text>
              {location.is_frequent && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Frequent</Text>
                </View>
              )}
            </View>
            <View style={styles.itemActions}>
              <Pressable
                onPress={() => {
                  setEditing(location);
                  setShowForm(true);
                }}
                style={styles.iconButton}
              >
                <Ionicons name="pencil" size={16} color="#6b7280" />
              </Pressable>
              <Pressable
                onPress={() => deleteLocation(location.id)}
                style={styles.iconButton}
              >
                <Ionicons name="trash" size={16} color="#dc2626" />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function LocationForm({ location, onSave, onCancel }: any) {
  const [formData, setFormData] = useState({
    name: location?.name || "",
    address1: location?.address1 || "",
    address2: location?.address2 || "",
    city: location?.city || "",
    state: location?.state || "",
    zip_code: location?.zip_code || "",
    phone: location?.phone || "",
    contact_name: location?.contact_name || "",
    notes: location?.notes || "",
    is_frequent: location?.is_frequent || false,
  });

  // Geocoding state
  const [latitude, setLatitude] = useState<number | null>(location?.latitude || null);
  const [longitude, setLongitude] = useState<number | null>(location?.longitude || null);
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "loading" | "verified" | "failed">(
    location?.latitude && location?.longitude ? "verified" : "idle"
  );
  const [showMap, setShowMap] = useState(false);

  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";

  function buildAddressString() {
    const parts = [
      formData.address1,
      formData.city,
      formData.state,
      formData.zip_code,
    ].filter(Boolean);
    return parts.join(", ");
  }

  async function handleVerifyAddress() {
    const address = buildAddressString();
    if (!address.trim()) {
      Alert.alert("Missing Address", "Please enter an address, city, or zip code first.");
      return;
    }

    setGeocodeStatus("loading");
    const result = await geocodeAddress(address);

    if (result) {
      setLatitude(result.latitude);
      setLongitude(result.longitude);
      setGeocodeStatus("verified");
    } else {
      setLatitude(null);
      setLongitude(null);
      setGeocodeStatus("failed");
    }
  }

  function handleSave() {
    onSave({
      ...formData,
      latitude,
      longitude,
    });
  }

  return (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>{location ? "Edit Location" : "New Location"}</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Location Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="e.g., Chicago Terminal"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Address Line 1</Text>
        <TextInput
          style={styles.input}
          value={formData.address1}
          onChangeText={(text) => {
            setFormData({ ...formData, address1: text });
            if (geocodeStatus === "verified" || geocodeStatus === "failed") setGeocodeStatus("idle");
          }}
          placeholder="Street address"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Address Line 2</Text>
        <TextInput
          style={styles.input}
          value={formData.address2}
          onChangeText={(text) => setFormData({ ...formData, address2: text })}
          placeholder="Apt, suite, etc."
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 2 }]}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={formData.city}
            onChangeText={(text) => {
              setFormData({ ...formData, city: text });
              if (geocodeStatus === "verified" || geocodeStatus === "failed") setGeocodeStatus("idle");
            }}
            placeholder="City"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>State</Text>
          <TextInput
            style={styles.input}
            value={formData.state}
            onChangeText={(text) => {
              setFormData({ ...formData, state: text });
              if (geocodeStatus === "verified" || geocodeStatus === "failed") setGeocodeStatus("idle");
            }}
            placeholder="IL"
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Zip Code</Text>
        <TextInput
          style={styles.input}
          value={formData.zip_code}
          onChangeText={(text) => {
            setFormData({ ...formData, zip_code: text });
            if (geocodeStatus === "verified" || geocodeStatus === "failed") setGeocodeStatus("idle");
          }}
          placeholder="60601"
          keyboardType="numeric"
        />
      </View>

      {/* Verify Address Button + Status */}
      <View style={styles.formGroup}>
        <Pressable
          onPress={handleVerifyAddress}
          disabled={geocodeStatus === "loading"}
          style={[
            styles.verifyBtn,
            geocodeStatus === "verified" && styles.verifyBtnVerified,
            geocodeStatus === "failed" && styles.verifyBtnFailed,
          ]}
        >
          {geocodeStatus === "loading" ? (
            <ActivityIndicator size="small" color="#6b7280" />
          ) : geocodeStatus === "verified" ? (
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
          ) : geocodeStatus === "failed" ? (
            <Ionicons name="close-circle" size={14} color="#dc2626" />
          ) : (
            <Ionicons name="location" size={14} color="#2563eb" />
          )}
          <Text
            style={[
              styles.verifyBtnText,
              geocodeStatus === "verified" && { color: "#16a34a" },
              geocodeStatus === "failed" && { color: "#dc2626" },
            ]}
          >
            {geocodeStatus === "loading"
              ? "Verifying..."
              : geocodeStatus === "verified"
              ? "Address Verified"
              : geocodeStatus === "failed"
              ? "Not Found — Tap to Retry"
              : "Verify Address"}
          </Text>
        </Pressable>
        {geocodeStatus === "verified" && latitude && longitude && (
          <View style={styles.coordRow}>
            <Text style={styles.coordText}>
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </Text>
            <Pressable onPress={() => setShowMap(!showMap)} hitSlop={6}>
              <Ionicons
                name={showMap ? "map" : "map-outline"}
                size={14}
                color={showMap ? "#2563eb" : "#9ca3af"}
              />
            </Pressable>
          </View>
        )}
        {geocodeStatus === "verified" && showMap && latitude && longitude && mapboxToken && (
          <View style={styles.mapPreview}>
            <Image
              source={{
                uri: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+dc2626(${longitude},${latitude})/${longitude},${latitude},14,0/280x160@2x?access_token=${mapboxToken}`,
              }}
              style={styles.mapImage}
              resizeMode="cover"
            />
          </View>
        )}
        {geocodeStatus === "failed" && (
          <Text style={styles.coordTextWarn}>
            Address could not be geocoded. You can still save.
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Contact Name</Text>
        <TextInput
          style={styles.input}
          value={formData.contact_name}
          onChangeText={(text) => setFormData({ ...formData, contact_name: text })}
          placeholder="Contact person"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Additional notes"
          multiline
          numberOfLines={3}
        />
      </View>

      <Pressable
        style={styles.checkboxRow}
        onPress={() => setFormData({ ...formData, is_frequent: !formData.is_frequent })}
      >
        <View style={[styles.checkbox, formData.is_frequent && styles.checkboxChecked]}>
          {formData.is_frequent && <Ionicons name="checkmark" size={14} color="#2563eb" />}
        </View>
        <Text style={styles.checkboxLabel}>Frequent Location</Text>
      </Pressable>

      <View style={styles.formActions}>
        <Pressable
          style={[styles.button, styles.buttonSecondary]}
          onPress={onCancel}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleSave}
        >
          <Text style={styles.buttonPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function VendorsTab() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
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
        .from("vendors")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("name");

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error("Error loading vendors:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveVendor(vendorData: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      if (editing) {
        const { error } = await supabase
          .from("vendors")
          .update(vendorData)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vendors")
          .insert({
            ...vendorData,
            tenant_id: tenantUser.tenant_id,
          });
        if (error) throw error;
      }

      Alert.alert("Success", "Vendor saved!");
      setShowForm(false);
      setEditing(null);
      loadVendors();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  }

  async function deleteVendor(id: string) {
    Alert.alert(
      "Delete Vendor",
      "Are you sure you want to delete this vendor?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("vendors").delete().eq("id", id);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              loadVendors();
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading vendors...</Text>
      </View>
    );
  }

  if (showForm) {
    return (
      <VendorForm
        vendor={editing}
        onSave={saveVendor}
        onCancel={() => {
          setShowForm(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Vendors</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add-circle" size={18} color="#2563eb" />
        </Pressable>
      </View>

      {vendors.length === 0 ? (
        <Text style={styles.emptyText}>No vendors yet. Tap + to add one.</Text>
      ) : (
        vendors.map((vendor) => (
          <View key={vendor.id} style={styles.itemCard}>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{vendor.name}</Text>
              <Text style={styles.itemSubtitle}>
                {vendor.phone || "No phone"}
              </Text>
            </View>
            <View style={styles.itemActions}>
              <Pressable
                onPress={() => {
                  setEditing(vendor);
                  setShowForm(true);
                }}
                style={styles.iconButton}
              >
                <Ionicons name="pencil" size={16} color="#6b7280" />
              </Pressable>
              <Pressable
                onPress={() => deleteVendor(vendor.id)}
                style={styles.iconButton}
              >
                <Ionicons name="trash" size={16} color="#dc2626" />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function VendorForm({ vendor, onSave, onCancel }: any) {
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: vendor?.name || "",
    address1: vendor?.address1 || "",
    address2: vendor?.address2 || "",
    city: vendor?.city || "",
    state: vendor?.state || "",
    zip_code: vendor?.zip_code || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    notes: vendor?.notes || "",
    currency: vendor?.currency || defaultCurrency,
    default_expense_type_id: vendor?.default_expense_type_id || null,
  });

  useEffect(() => {
    loadDefaultCurrency();
    loadExpenseTypes();
  }, []);

  async function loadDefaultCurrency() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const { data: settings } = await supabase
        .from("settings")
        .select("default_currency")
        .eq("tenant_id", tenantUser.tenant_id)
        .single();

      if (settings?.default_currency && !vendor) {
        setDefaultCurrency(settings.default_currency);
        setFormData(prev => ({ ...prev, currency: settings.default_currency }));
      }
    } catch (error) {
      console.error("Error loading default currency:", error);
    }
  }

  async function loadExpenseTypes() {
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
        .from("expense_types")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("name");

      if (error) throw error;
      setExpenseTypes(data || []);
    } catch (error) {
      console.error("Error loading expense types:", error);
    }
  }

  return (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>{vendor ? "Edit Vendor" : "New Vendor"}</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Company Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="e.g., Bob's Repairs"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Address Line 1</Text>
        <TextInput
          style={styles.input}
          value={formData.address1}
          onChangeText={(text) => setFormData({ ...formData, address1: text })}
          placeholder="Street address"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Address Line 2</Text>
        <TextInput
          style={styles.input}
          value={formData.address2}
          onChangeText={(text) => setFormData({ ...formData, address2: text })}
          placeholder="Suite, unit, etc."
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 2 }]}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={formData.city}
            onChangeText={(text) => setFormData({ ...formData, city: text })}
            placeholder="City"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1 }]}>
          <Text style={styles.label}>State</Text>
          <TextInput
            style={styles.input}
            value={formData.state}
            onChangeText={(text) => setFormData({ ...formData, state: text })}
            placeholder="IL"
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Zip Code</Text>
        <TextInput
          style={styles.input}
          value={formData.zip_code}
          onChangeText={(text) => setFormData({ ...formData, zip_code: text })}
          placeholder="60601"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Currency</Text>
        <View style={styles.radioGroup}>
          <Pressable
            style={[
              styles.radioButton,
              formData.currency === "USD" && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, currency: "USD" })}
          >
            <Text
              style={[
                styles.radioLabel,
                formData.currency === "USD" && styles.radioLabelActive,
              ]}
            >
              USD
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.radioButton,
              formData.currency === "CAD" && styles.radioButtonActive,
            ]}
            onPress={() => setFormData({ ...formData, currency: "CAD" })}
          >
            <Text
              style={[
                styles.radioLabel,
                formData.currency === "CAD" && styles.radioLabelActive,
              ]}
            >
              CAD
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Additional notes"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.formActions}>
        <Pressable
          style={[styles.button, styles.buttonSecondary]}
          onPress={onCancel}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => onSave(formData)}
        >
          <Text style={styles.buttonPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Expense Types Tab ──────────────────────────────────────
function ExpenseTypesTab() {
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadExpenseTypes();
  }, []);

  async function loadExpenseTypes() {
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
        .from("expense_types")
        .select("*")
        .eq("tenant_id", tenantUser.tenant_id)
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true });

      if (error) throw error;
      setExpenseTypes(data || []);
    } catch (error) {
      console.error("Error loading expense types:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveExpenseType(formData: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const payload = {
        code: formData.code?.trim() || null,
        name: formData.name?.trim() || "",
        description: formData.description?.trim() || null,
        export_code: formData.export_code?.trim() || null,
        sort_order: parseInt(formData.sort_order) || 0,
      };

      if (!payload.name) {
        Alert.alert("Error", "Name is required.");
        return;
      }

      if (editing) {
        const { error } = await supabase
          .from("expense_types")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("expense_types")
          .insert({
            ...payload,
            tenant_id: tenantUser.tenant_id,
          });
        if (error) throw error;
      }

      Alert.alert("Success", "Expense type saved!");
      setShowForm(false);
      setEditing(null);
      loadExpenseTypes();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  }

  async function deleteExpenseType(id: string) {
    Alert.alert(
      "Delete Expense Type",
      "Are you sure? This may affect expenses and vendors using this code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("expense_types").delete().eq("id", id);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              loadExpenseTypes();
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading expense types...</Text>
      </View>
    );
  }

  if (showForm) {
    return (
      <ExpenseTypeForm
        expenseType={editing}
        onSave={saveExpenseType}
        onCancel={() => {
          setShowForm(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Expense Types</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Ionicons name="add-circle" size={20} color="#2563eb" />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      {expenseTypes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="pricetag-outline" size={36} color="#d1d5db" />
          <Text style={styles.emptyText}>No expense types yet</Text>
          <Text style={styles.emptySubtext}>Add codes for categorizing expenses</Text>
        </View>
      ) : (
        expenseTypes.map((et) => (
          <Pressable
            key={et.id}
            style={styles.listItem}
            onPress={() => {
              setEditing(et);
              setShowForm(true);
            }}
          >
            <View style={styles.itemHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {et.code && (
                  <View style={[styles.badge, { backgroundColor: "#f0fdf4" }]}>
                    <Text style={[styles.badgeText, { color: "#16a34a" }]}>{et.code}</Text>
                  </View>
                )}
                <Text style={styles.itemName}>{et.name}</Text>
              </View>
              {et.description && (
                <Text style={styles.itemSubtext}>{et.description}</Text>
              )}
              {et.export_code && (
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, styles.badgeGray]}>
                    <Text style={styles.badgeTextGray}>GL: {et.export_code}</Text>
                  </View>
                </View>
              )}
            </View>
            <Pressable
              onPress={() => deleteExpenseType(et.id)}
              style={styles.deleteButton}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
            </Pressable>
          </Pressable>
        ))
      )}
    </View>
  );
}

function ExpenseTypeForm({ expenseType, onSave, onCancel }: {
  expenseType: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    code: expenseType?.code || "",
    name: expenseType?.name || "",
    description: expenseType?.description || "",
    export_code: expenseType?.export_code || "",
    sort_order: String(expenseType?.sort_order ?? 0),
  });

  return (
    <ScrollView contentContainerStyle={styles.formContainer}>
      <Text style={styles.formTitle}>
        {expenseType ? "Edit Expense Type" : "New Expense Type"}
      </Text>

      <Text style={styles.inputLabel}>Code</Text>
      <TextInput
        style={styles.input}
        value={formData.code}
        onChangeText={(v) => setFormData({ ...formData, code: v })}
        placeholder="e.g. FUEL, HOTEL, TOLL"
        autoCapitalize="characters"
      />

      <Text style={styles.inputLabel}>Name *</Text>
      <TextInput
        style={styles.input}
        value={formData.name}
        onChangeText={(v) => setFormData({ ...formData, name: v })}
        placeholder="e.g. Fuel Purchase"
      />

      <Text style={styles.inputLabel}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.description}
        onChangeText={(v) => setFormData({ ...formData, description: v })}
        placeholder="Optional description"
        multiline
      />

      <Text style={styles.inputLabel}>Export / GL Code</Text>
      <TextInput
        style={styles.input}
        value={formData.export_code}
        onChangeText={(v) => setFormData({ ...formData, export_code: v })}
        placeholder="e.g. 5100, 6200"
      />

      <Text style={styles.inputLabel}>Sort Order</Text>
      <TextInput
        style={styles.input}
        value={formData.sort_order}
        onChangeText={(v) => setFormData({ ...formData, sort_order: v })}
        placeholder="0"
        keyboardType="number-pad"
      />

      <View style={styles.formActions}>
        <Pressable
          style={[styles.button, styles.buttonSecondary]}
          onPress={onCancel}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => onSave(formData)}
        >
          <Text style={styles.buttonPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </ScrollView>
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
    padding: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  placeholder: {
    width: 28,
  },
  tabContainer: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    maxHeight: 56,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginRight: 8,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomWidth: 3,
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
    backgroundColor: "#f9fafb",
  },
  contentInner: {
    padding: 16,
  },
  tabContent: {
    
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  sequenceHint: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
    lineHeight: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#1e293b",
  },
  radioGroup: {
    flexDirection: "row",
    gap: 8,
  },
  radioButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  radioButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  radioLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
  },
  radioLabelActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 14,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 12,
    color: "#6b7280",
  },
  comingSoon: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addButton: {
    padding: 2,
  },
  itemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 11,
    color: "#6b7280",
  },
  itemActions: {
    flexDirection: "row",
    gap: 4,
  },
  iconButton: {
    padding: 6,
  },
  emptyText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 20,
  },
  formActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  buttonPrimary: {
    backgroundColor: "#2563eb",
  },
  buttonSecondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  buttonPrimaryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonSecondaryText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
  formRow: {
    flexDirection: "row",
    gap: 8,
  },
  textArea: {
    height: 64,
    textAlignVertical: "top",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 4,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  checkboxLabel: {
    fontSize: 12,
    color: "#374151",
  },
  badge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#2563eb",
  },
  itemHeader: {
    width: "100%",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  badgeGray: {
    backgroundColor: "#f3f4f6",
  },
  badgeTextGray: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "capitalize",
  },
  badgeGreen: {
    backgroundColor: "#f0fdf4",
  },
  badgeTextGreen: {
    fontSize: 10,
    fontWeight: "600",
    color: "#16a34a",
    textTransform: "capitalize",
  },
  badgeBlue: {
    backgroundColor: "#eff6ff",
  },
  badgeTextBlue: {
    fontSize: 10,
    fontWeight: "600",
    color: "#2563eb",
    textTransform: "capitalize",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 12,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 10,
  },
  dateButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateButtonTextFilled: {
    fontSize: 13,
    color: "#1e293b",
  },
  dateButtonTextPlaceholder: {
    fontSize: 13,
    color: "#9ca3af",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    width: "85%",
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  // Geocoding styles
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    alignSelf: "flex-start",
  },
  verifyBtnVerified: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  verifyBtnFailed: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  verifyBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },
  coordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  coordText: {
    fontSize: 10,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  coordTextWarn: {
    fontSize: 10,
    color: "#dc2626",
    marginTop: 4,
  },
  mapPreview: {
    marginTop: 6,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  mapImage: {
    width: "100%",
    height: 140,
  },
  geoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  geoDotVerified: {
    backgroundColor: "#16a34a",
  },
  geoDotMissing: {
    backgroundColor: "#dc2626",
  },
});
