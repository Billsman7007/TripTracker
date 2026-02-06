import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabaseClient";

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your email...");

  useEffect(() => {
    async function confirmEmail() {
      try {
        // Extract token and type from URL hash or query params
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const urlParams = new URLSearchParams(hash.substring(1));
        const token = urlParams.get("access_token") || params.token;
        const type = urlParams.get("type") || params.type;

        if (!token) {
          // Try to get from Supabase session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session) {
            setStatus("success");
            setMessage("Email confirmed! Redirecting...");
            setTimeout(() => {
              router.replace("/");
            }, 1500);
            return;
          }

          if (error) {
            throw error;
          }

          throw new Error("No confirmation token found");
        }

        // If we have a token, verify it
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type === "email" ? "email" : "signup",
        });

        if (verifyError) throw verifyError;

        setStatus("success");
        setMessage("Email confirmed successfully! Redirecting...");
        setTimeout(() => {
          router.replace("/");
        }, 1500);
      } catch (error: any) {
        console.error("Email confirmation error:", error);
        setStatus("error");
        setMessage(error.message || "Failed to confirm email. Please try signing in.");
      }
    }

    confirmEmail();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      {status === "loading" && (
        <>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.message}>{message}</Text>
        </>
      )}

      {status === "success" && (
        <>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.message}>{message}</Text>
        </>
      )}

      {status === "error" && (
        <>
          <Text style={styles.errorIcon}>✗</Text>
          <Text style={styles.errorMessage}>{message}</Text>
          <Pressable
            style={styles.button}
            onPress={() => router.replace("/auth/login")}
          >
            <Text style={styles.buttonText}>Go to Login</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  message: {
    marginTop: 24,
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  successIcon: {
    fontSize: 64,
    color: "#059669",
    fontWeight: "bold",
  },
  errorIcon: {
    fontSize: 64,
    color: "#dc2626",
    fontWeight: "bold",
  },
  errorMessage: {
    marginTop: 24,
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
