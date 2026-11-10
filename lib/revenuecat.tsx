import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useUser } from "@/lib/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ADMIN_EMAILS } from "./admin";
import { APP_CONFIG } from "./config";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "Savify Pro";

// Tracks whether Purchases.configure() was actually called successfully.
// All SDK calls MUST be gated on this flag — calling any Purchases method
// before configure() throws a native iOS exception that crashes the app.
let _revenueCatConfigured = false;
export function isRevenueCatConfigured() { return _revenueCatConfigured; }

// Validates that a key is a real RC key, not a placeholder.
// Real keys: appl_... (iOS prod), goog_... (Android prod), rcb_... (test/sandbox)
function isValidRCKey(key: string): boolean {
  if (!key || key.length < 20) return false;
  if (key.includes("REPLACE") || key.includes("YOUR_") || key.includes("PLACEHOLDER")) return false;
  return key.startsWith("appl_") || key.startsWith("goog_") || key.startsWith("rcb_");
}

function getRevenueCatApiKey(): string | null {
  // Expo Go (storeClient) and dev builds always use the test key.
  // Standalone TestFlight / production builds use platform-specific live keys.
  const isExpoGo = Constants.executionEnvironment === "storeClient";
  if (__DEV__ || Platform.OS === "web" || isExpoGo) {
    const key = REVENUECAT_TEST_API_KEY ?? null;
    if (!key || !isValidRCKey(key)) return null;
    return key;
  }
  if (Platform.OS === "ios") {
    const key = REVENUECAT_IOS_API_KEY ?? null;
    if (!key || !isValidRCKey(key)) return null;
    return key;
  }
  if (Platform.OS === "android") {
    const key = REVENUECAT_ANDROID_API_KEY ?? null;
    if (!key || !isValidRCKey(key)) return null;
    return key;
  }
  const key = REVENUECAT_TEST_API_KEY ?? null;
  if (!key || !isValidRCKey(key)) return null;
  return key;
}

export function initializeRevenueCat() {
  if (!APP_CONFIG.PRO_ENABLED) return; // Pro is off → no payments, everything free
  const isExpoGo = Constants.executionEnvironment === "storeClient";
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    if (isExpoGo) {
      console.info(
        "[RevenueCat] Subscription features disabled in Expo Go.\n" +
        "  To enable: set EXPO_PUBLIC_REVENUECAT_TEST_API_KEY to your 'rcb_...' test key in .env\n" +
        "  Get it from: app.revenuecat.com → API Keys → Test Store key\n" +
        "  This is expected — the app runs normally without it."
      );
    } else {
      console.warn(
        "[RevenueCat] No valid API key found. Subscription features disabled.\n" +
        "  Dev/Expo Go: set EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=rcb_... in .env\n" +
        "  TestFlight/Production: set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in eas.json env"
      );
    }
    return;
  }

  // In Expo Go, only rcb_ (test store) keys are accepted by the RC SDK.
  if (isExpoGo && !apiKey.startsWith("rcb_")) {
    console.info(
      "[RevenueCat] App Store keys (appl_...) don't work in Expo Go.\n" +
      "  Use your Test Store key (rcb_...) from app.revenuecat.com → API Keys.\n" +
      "  Subscription features are disabled for this Expo Go session."
    );
    return;
  }

  try {
    Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    _revenueCatConfigured = true;
    console.log("[RevenueCat] Initialized successfully.");
  } catch (e) {
    console.warn("[RevenueCat] configure() failed:", e);
  }
}

const DEV_PRO_KEY = "@savify_dev_pro_enabled";

function useSubscriptionContext() {
  const { user } = useUser();
  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";
  const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());

  // ── Dev Pro toggle (admin only) ──────────────────────────────────────────
  const [devProEnabled, setDevProEnabled] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    AsyncStorage.getItem(DEV_PRO_KEY).then((v) => {
      if (v !== null) setDevProEnabled(v === "true");
    }).catch(() => {});
  }, [isAdmin]);

  const toggleDevPro = useCallback(async () => {
    const next = !devProEnabled;
    setDevProEnabled(next);
    await AsyncStorage.setItem(DEV_PRO_KEY, String(next)).catch(() => {});
  }, [devProEnabled]);

  // ── User identity sync ───────────────────────────────────────────────────
  // Sync the Savify user ID into RevenueCat so purchases are tied to the
  // account and restore works correctly after reinstall or device switch.
  useEffect(() => {
    if (!isRevenueCatConfigured()) return;
    if (user?.id) {
      Purchases.logIn(user.id)
        .then(({ customerInfo, created }) => {
          console.log(
            `[RevenueCat] logIn: userId=${user.id} newUser=${created}`,
            `entitlements=${Object.keys(customerInfo.entitlements.active).join(", ") || "none"}`
          );
        })
        .catch((e) => console.warn("[RevenueCat] logIn error:", e));
    } else {
      // User signed out — reset RC to an anonymous identity.
      Purchases.logOut()
        .then(() => console.log("[RevenueCat] logOut: reset to anonymous user."))
        .catch((e) => console.warn("[RevenueCat] logOut error:", e));
    }
  }, [user?.id]);

  const configured = isRevenueCatConfigured();

  // ── Customer info ────────────────────────────────────────────────────────
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info", user?.id],
    queryFn: async () => {
      const info = await Purchases.getCustomerInfo();
      const active = Object.keys(info.entitlements.active);
      console.log(
        `[RevenueCat] CustomerInfo fetched. Active entitlements: [${active.join(", ") || "none"}]`
      );
      return info;
    },
    staleTime: 60 * 1000,
    retry: 2,
    throwOnError: false,
    enabled: configured,
  });

  // ── Offerings ────────────────────────────────────────────────────────────
  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current) {
        console.warn("[RevenueCat] getOfferings: no current offering returned. Check RevenueCat dashboard.");
      } else {
        console.log(
          `[RevenueCat] Offerings loaded. current="${current.identifier}"`,
          `packages=[${current.availablePackages.map((p) => p.identifier).join(", ")}]`
        );
      }
      return offerings;
    },
    staleTime: 300 * 1000,
    retry: 2,
    throwOnError: false,
    enabled: configured,
  });

  // ── Purchase ─────────────────────────────────────────────────────────────
  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      if (!isRevenueCatConfigured()) throw new Error("Subscription service is not available.");
      console.log(`[RevenueCat] Purchase started: ${pkg.identifier} (${pkg.packageType})`);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = Object.keys(customerInfo.entitlements.active);
      console.log(`[RevenueCat] Purchase success. Active entitlements: [${active.join(", ")}]`);
      return customerInfo;
    },
    onSuccess: () => {
      customerInfoQuery.refetch();
    },
    onError: (e: unknown) => {
      const err = e as any;
      if (!err?.userCancelled) {
        console.warn("[RevenueCat] Purchase failed:", err?.message ?? e);
      } else {
        console.log("[RevenueCat] Purchase cancelled by user.");
      }
    },
  });

  // ── Restore ──────────────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!isRevenueCatConfigured()) throw new Error("Subscription service is not available.");
      console.log("[RevenueCat] Restore purchases started.");
      const info = await Purchases.restorePurchases();
      const active = Object.keys(info.entitlements.active);
      console.log(`[RevenueCat] Restore complete. Active entitlements: [${active.join(", ") || "none"}]`);
      return info;
    },
    onSuccess: () => {
      customerInfoQuery.refetch();
    },
    onError: (e: unknown) => {
      console.warn("[RevenueCat] Restore failed:", (e as Error)?.message ?? e);
    },
  });

  // ── Derived state ────────────────────────────────────────────────────────
  const activeEntitlement =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  // When Pro is turned off in lib/config.ts, everyone gets every feature for free.
  const isSubscribed = !APP_CONFIG.PRO_ENABLED || (isAdmin && devProEnabled) || activeEntitlement !== undefined;

  const currentOffering = offeringsQuery.data?.current ?? null;
  const monthlyPackage = currentOffering?.availablePackages.find(
    (p) => p.packageType === "MONTHLY" || p.identifier === "$rc_monthly",
  ) ?? null;
  const annualPackage = currentOffering?.availablePackages.find(
    (p) => p.packageType === "ANNUAL" || p.identifier === "$rc_annual",
  ) ?? null;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    currentOffering,
    isSubscribed,
    activeEntitlement,
    monthlyPackage,
    annualPackage,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    isOfferingsLoading: offeringsQuery.isLoading,
    isOfferingsError: offeringsQuery.isError,
    refetchOfferings: offeringsQuery.refetch,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchaseError: purchaseMutation.error,
    refetchCustomerInfo: customerInfoQuery.refetch,
    isAdmin,
    devProEnabled,
    toggleDevPro,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}
