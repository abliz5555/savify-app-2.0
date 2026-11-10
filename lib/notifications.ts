import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "savify_bill_notif_ids_v2";

/** Has the user switched notifications OFF in Settings? (stored per user) */
async function notificationsTurnedOff(): Promise<boolean> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const k = keys.find((x) => x.startsWith("savify_") && x.endsWith("_notifications"));
    return k ? (await AsyncStorage.getItem(k)) === "false" : false;
  } catch { return false; }
}

/**
 * Ask for permission to show notifications.
 * Android 8+ needs a "channel" created BEFORE asking, otherwise nothing shows.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const Notifications = await import("expo-notifications");
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#4f46e5",
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

type NotifMap = Record<string, string[]>;

async function getMap(): Promise<NotifMap> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return v ? (JSON.parse(v) as NotifMap) : {};
  } catch {
    return {};
  }
}

async function saveMap(m: NotifMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {}
}

export async function cancelBillNotifications(billId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    const map = await getMap();
    for (const id of map[billId] ?? []) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
    delete map[billId];
    await saveMap(map);
  } catch {}
}

export async function scheduleBillNotifications(
  billId: string,
  billName: string,
  amount: number,
  currency: string,
  nextDueDateStr: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    await cancelBillNotifications(billId);

    if (await notificationsTurnedOff()) return;
    if (!(await ensureNotificationPermission())) return;

    const dueDate = new Date(nextDueDateStr + "T09:00:00");
    const now = new Date();

    const points = [
      {
        days: -7,
        title: "Bill Due in 7 Days",
        body: `${billName}: ${currency} ${amount.toFixed(2)} due in a week`,
      },
      {
        days: -3,
        title: "Bill Due in 3 Days",
        body: `${billName}: ${currency} ${amount.toFixed(2)} due in 3 days`,
      },
      {
        days: -1,
        title: "Bill Due Tomorrow",
        body: `${billName} (${currency} ${amount.toFixed(2)}) is due tomorrow`,
      },
      {
        days: 0,
        title: "Bill Due Today",
        body: `${billName} (${currency} ${amount.toFixed(2)}) is due today`,
      },
      {
        days: 1,
        title: "Bill Overdue!",
        body: `${billName} (${currency} ${amount.toFixed(2)}) was due yesterday`,
      },
    ];

    const ids: string[] = [];

    for (const { days, title, body } of points) {
      const trigger = new Date(dueDate);
      trigger.setDate(trigger.getDate() + days);
      if (trigger > now) {
        try {
          const id = await Notifications.scheduleNotificationAsync({
            content: { title, body, data: { billId } },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: trigger,
            },
          });
          ids.push(id);
        } catch {}
      }
    }

    const map = await getMap();
    map[billId] = ids;
    await saveMap(map);
  } catch {}
}

// ── Budget alerts (local notification, free) ────────────────────────────────

const BUDGET_KEY = "savify_budget_alerts_sent_v1";

/**
 * Call after adding an expense. If that category's budget just passed 80% or 100%
 * this month, show ONE notification (never repeats the same alert in a month).
 */
export async function notifyBudgetIfNeeded(params: {
  category: string; spentBefore: number; amount: number; limit: number; currency: string; monthKey: string;
}): Promise<void> {
  const { category, spentBefore, amount, limit, currency, monthKey } = params;
  if (Platform.OS === "web" || limit <= 0) return;
  const after = spentBefore + amount;
  const level = after >= limit && spentBefore < limit ? 100 : after >= limit * 0.8 && spentBefore < limit * 0.8 ? 80 : 0;
  if (!level) return;
  try {
    const sentRaw = await AsyncStorage.getItem(BUDGET_KEY);
    const sent: Record<string, true> = sentRaw ? JSON.parse(sentRaw) : {};
    const id = `${monthKey}|${category}|${level}`;
    if (sent[id]) return;

    if (await notificationsTurnedOff()) return;
    const Notifications = await import("expo-notifications");
    if (!(await ensureNotificationPermission())) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: level === 100 ? `${category} budget used up` : `${category} budget at 80%`,
        body: level === 100
          ? `You've spent ${currency} ${after.toFixed(0)} of your ${currency} ${limit.toFixed(0)} budget this month.`
          : `${currency} ${(limit - after).toFixed(0)} left for the rest of the month.`,
      },
      trigger: null,
    });
    sent[id] = true;
    await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(sent));
  } catch {}
}
