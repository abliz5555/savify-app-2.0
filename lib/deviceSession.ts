import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";

/**
 * "One phone per account" protection (free — uses your Supabase database).
 * When you sign in on a new phone, the old phone is signed out automatically.
 */

const DEVICE_KEY = "@savify_device_id";

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_KEY, id).catch(() => {});
  }
  return id;
}

/** Mark this phone as the active one for this user. */
export async function registerDevice(userId: string): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await supabase.from("active_devices").upsert({ user_id: userId, device_id: deviceId, updated_at: new Date().toISOString() });
  } catch {
    // best-effort — never block sign-in
  }
}

/**
 * true  = this phone is still the active one (or we can't tell — e.g. offline)
 * false = the account was opened on another phone since
 */
export async function validateDevice(userId: string): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase
      .from("active_devices").select("device_id").eq("user_id", userId).maybeSingle();
    if (error || !data) return true;
    return data.device_id === deviceId;
  } catch {
    return true;
  }
}
