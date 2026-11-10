import * as LocalAuthentication from "expo-local-authentication";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";

import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, AppState, Image, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";
import { F } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { registerDevice, validateDevice } from "@/lib/deviceSession";
import { AuthProvider, useAuth } from "@/lib/auth";
import { QuickAddProvider } from "@/components/QuickAddSheet";
import { SUPABASE_CONFIGURED } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();
initializeRevenueCat();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      throwOnError: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
});

// ─── In-App Splash Screen ────────────────────────────────────────────────────

function AppSplash({ onDone }: { onDone: () => void }) {
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const scale       = useRef(new Animated.Value(0.88)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }).start();
    Animated.timing(tagOpacity, { toValue: 1, duration: 400, delay: 250, useNativeDriver: true }).start();

    const fadeOut = setTimeout(() => {
      Animated.timing(rootOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
    }, 1600);

    return () => clearTimeout(fadeOut);
  }, []);

  return (
    <Animated.View style={[ss.splashRoot, { opacity: rootOpacity }]} pointerEvents="none">
      <Animated.View style={[ss.splashContent, { transform: [{ scale }] }]}>
        <Image
          source={require("../assets/images/logo.jpg")}
          style={ss.splashLogo}
          resizeMode="contain"
        />
        <Animated.Text style={[ss.splashTag, { opacity: tagOpacity }]}>
          Track. Save. Grow.
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  splashRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f0f0f",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  splashContent: { alignItems: "center", gap: 18 },
  splashLogo: { width: 150, height: 150, borderRadius: 34 },
  splashTag: {
    color: "#6b7280",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1.2,
  },
});

// ─── Auth Gate ───────────────────────────────────────────────────────────────

function AuthGate() {
  const { isSignedIn, isLoaded, userId, signOut } = useAuth();
  const segments = useSegments();
  const nav = useRouter();
  const qc = useQueryClient();
  const prevUserId = useRef<string | null | undefined>(undefined);

  // Clear cached data when the user changes (so one user never sees another's data)
  useEffect(() => {
    const current = userId ?? null;
    if (prevUserId.current === undefined) {
      prevUserId.current = current;
      return;
    }
    if (prevUserId.current !== current) {
      qc.clear();
      prevUserId.current = current;
    }
  }, [userId, qc]);

  // Route guard — signed out → welcome · signed in on a login screen → home
  useEffect(() => {
    if (!isLoaded) return;
    const inAuth = (segments as string[])[0] === "(auth)";
    if (!isSignedIn && !inAuth) {
      nav.replace("/(auth)/welcome");
    } else if (isSignedIn && inAuth) {
      nav.replace("/(tabs)");
    }
  }, [isSignedIn, isLoaded, segments]);

  // One phone per account — register this phone after sign-in,
  // then check every 60 s and whenever the app is opened again.
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let cancelled = false;

    registerDevice(userId);

    const validate = async () => {
      if (cancelled) return;
      const valid = await validateDevice(userId);
      if (!valid && !cancelled) await signOut();
    };

    const interval = setInterval(validate, 60_000);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") validate();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [isSignedIn, userId]);

  // "Remember me" off → sign out when the app goes to the background
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (!isSignedIn) return;
      if (nextState === "background") {
        try {
          const val = await AsyncStorage.getItem("@savify_remember_me");
          if (val === "false") await signOut();
        } catch {}
      }
    });
    return () => sub.remove();
  }, [isSignedIn, signOut]);

  return null;
}

// ─── Biometric Gate ──────────────────────────────────────────────────────────

function BiometricGate({ children }: { children: React.ReactNode }) {
  const { biometricsEnabled, setBiometricsEnabled } = useSettings();
  const colors = useColors();
  const [unlocked, setUnlocked] = useState(false);

  const authenticate = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to access Savify",
        fallbackLabel: "Use Passcode",
      });
      if (result.success) setUnlocked(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!biometricsEnabled) {
      setUnlocked(true);
      return;
    }

    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ])
      .then(([hasHardware, isEnrolled]) => {
        if (!hasHardware || !isEnrolled) {
          setBiometricsEnabled(false);
          setUnlocked(true);
        } else {
          setUnlocked(false);
          authenticate();
        }
      })
      .catch(() => setUnlocked(true));
  }, [biometricsEnabled]);

  if (biometricsEnabled && !unlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={{ fontSize: 20, fontFamily: F.bold, color: colors.foreground }}>
          Savify is Locked
        </Text>
        <TouchableOpacity
          onPress={authenticate}
          style={{ backgroundColor: colors.accent, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: "#fff", fontFamily: F.semibold }}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function RootLayoutNav() {
  const colors = useColors();

  return (
    <>
      <StatusBar style={colors.isDark ? "light" : "dark"} />
      <BiometricGate>
        <Stack screenOptions={{ headerShown: false }} />
      </BiometricGate>
    </>
  );
}

// ─── Missing Config Screen ───────────────────────────────────────────────────

function MissingConfigScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0f0f0f", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <Feather name="alert-triangle" size={48} color="#ef4444" />
      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 20, textAlign: "center" }}>
        Configuration Error
      </Text>
      <Text style={{ color: "#9ca3af", fontSize: 15, marginTop: 12, textAlign: "center", lineHeight: 22 }}>
        EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing.{"\n\n"}
        Add them to your .env file (and eas.json for builds), then restart the app.
      </Text>
    </View>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!SUPABASE_CONFIGURED) {
    return (
      <SafeAreaProvider>
        <MissingConfigScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SettingsProvider>
              <SubscriptionProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <QuickAddProvider>
                    <AuthGate />
                    <RootLayoutNav />
                    {!splashDone && (
                      <AppSplash onDone={() => setSplashDone(true)} />
                    )}
                    </QuickAddProvider>
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SubscriptionProvider>
            </SettingsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
