import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

/**
 * Savify uses ONE free Supabase project for login + data + receipt scanning.
 * The URL and "anon" key are safe to ship inside the app: the database only
 * lets each signed-in user read and change their OWN rows (see supabase/setup.sql).
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;

export const supabase = createClient(
  SUPABASE_URL || "https://not-configured.supabase.co",
  SUPABASE_ANON_KEY || "not-configured",
  {
    auth: {
      storage: Platform.OS === "web" && typeof window === "undefined" ? undefined : AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

// Keep the login fresh only while the app is open (Supabase recommendation for mobile)
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Kept for older imports — there is only one client now and it is always logged in as the user. */
export function getSupabaseClient(_token?: string | null) {
  return supabase;
}

/** Turn any Supabase / network error into a short, friendly sentence. */
export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const msg = (e as { message?: string })?.message ?? (typeof e === "string" ? e : "");
  if (!msg) return fallback;
  const m = msg.toLowerCase();
  if (m.includes("network request failed") || m.includes("failed to fetch")) return "No internet connection. Please try again.";
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first.";
  if (m.includes("user already registered")) return "An account with this email already exists. Please sign in.";
  if (m.includes("password should be")) return "Password must be at least 8 characters.";
  if (m.includes("token has expired") || m.includes("otp_expired")) return "This code has expired. Please request a new one.";
  if (m.includes("invalid") && m.includes("token")) return "That code is not correct.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Please wait a minute and try again.";
  if (m.includes("jwt")) return "Your session has ended. Please sign in again.";
  return msg;
}
