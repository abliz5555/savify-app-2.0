import AsyncStorage from "@react-native-async-storage/async-storage";

// In-memory cache so reads are instant after markSetupSeen is called
// within the same JS runtime (avoids the AsyncStorage round-trip race)
const seenUsers = new Set<string>();

function key(userId: string) {
  return `setup_seen_${userId}`;
}

export async function markSetupSeen(userId: string): Promise<void> {
  seenUsers.add(userId); // immediate — no async delay
  await AsyncStorage.setItem(key(userId), "1");
}

// Synchronous check — safe to call inside React effects with no async gap
export function isSetupSeenSync(userId: string): boolean {
  return seenUsers.has(userId);
}

export async function getSetupSeen(userId: string): Promise<boolean> {
  if (seenUsers.has(userId)) return true; // instant cache hit
  try {
    const val = await AsyncStorage.getItem(key(userId));
    if (val === "1") seenUsers.add(userId);
    return val === "1";
  } catch {
    return false;
  }
}
