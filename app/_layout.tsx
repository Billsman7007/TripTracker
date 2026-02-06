import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Platform, ActivityIndicator, Text } from "react-native";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function RootLayoutNav() {
  const { loading } = useAuth();

  // Shorter loading timeout for mobile
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 16, color: "#64748b", fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#f8fafc",
        ...(Platform.OS === "web" && {
          height: "100vh",
          width: "100%"
        })
      }}
    >
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
