import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { useAuth } from "@/lib/auth";

type SchemePreference = "system" | "light" | "dark";
import type { ThemeId } from "@/constants/colors";

export const LANGUAGES = [
  "English", "Arabic", "Spanish", "French", "German",
  "Chinese (Simplified)", "Hindi", "Portuguese", "Russian",
  "Japanese", "Korean", "Italian", "Turkish", "Dutch", "Polish",
];

interface SettingsContextType {
  currency: string;
  setCurrency: (c: string) => void;
  schemePreference: SchemePreference;
  setSchemePreference: (s: SchemePreference) => void;
  isDark: boolean;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  language: string;
  setLanguage: (l: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  displayName: string;
  setDisplayName: (n: string) => void;
  biometricsEnabled: boolean;
  setBiometricsEnabled: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  currency: "AED", setCurrency: () => {},
  schemePreference: "system", setSchemePreference: () => {},
  isDark: false,
  theme: "emerald", setTheme: () => {},
  language: "English", setLanguage: () => {},
  notificationsEnabled: true, setNotificationsEnabled: () => {},
  displayName: "", setDisplayName: () => {},
  biometricsEnabled: false, setBiometricsEnabled: () => {},
});

function userKey(userId: string, name: string) {
  return `savify_${userId}_${name}`;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { userId } = useAuth();

  const [currency, setCurrencyState] = useState("AED");
  const [schemePreference, setSchemePreferenceState] = useState<SchemePreference>("system");
  const [language, setLanguageState] = useState("English");
  const [notificationsEnabled, setNotificationsState] = useState(true);
  const [displayName, setDisplayNameState] = useState("");
  const [biometricsEnabled, setBiometricsState] = useState(false);
  const [theme, setThemeState] = useState<ThemeId>("emerald");

  useEffect(() => {
    if (userId === undefined) return;

    if (!userId) {
      setCurrencyState("AED");
      setSchemePreferenceState("system");
      setLanguageState("English");
      setNotificationsState(true);
      setDisplayNameState("");
      setBiometricsState(false);
      setThemeState("emerald");
      return;
    }

    AsyncStorage.multiGet([
      userKey(userId, "currency"),
      userKey(userId, "scheme"),
      userKey(userId, "language"),
      userKey(userId, "notifications"),
      userKey(userId, "display_name"),
      userKey(userId, "biometrics"),
      userKey(userId, "theme"),
    ]).then((pairs) => {
      const [c, s, l, n, dn, bio, th] = pairs.map((p) => p[1]);
      if (th === "emerald" || th === "indigo" || th === "sand" || th === "graphite") setThemeState(th);
      if (c)  setCurrencyState(c);
      if (s)  setSchemePreferenceState(s as SchemePreference);
      if (l)  setLanguageState(l);
      if (n !== null && n !== undefined) setNotificationsState(n === "true");
      if (dn !== null && dn !== undefined) setDisplayNameState(dn);
      if (bio === "true") setBiometricsState(true);
    });
  }, [userId]);

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    if (userId) AsyncStorage.setItem(userKey(userId, "currency"), c);
  };
  const setSchemePreference = (s: SchemePreference) => {
    setSchemePreferenceState(s);
    if (userId) AsyncStorage.setItem(userKey(userId, "scheme"), s);
  };
  const setLanguage = (l: string) => {
    setLanguageState(l);
    if (userId) AsyncStorage.setItem(userKey(userId, "language"), l);
  };
  const setNotificationsEnabled = (v: boolean) => {
    setNotificationsState(v);
    if (userId) AsyncStorage.setItem(userKey(userId, "notifications"), String(v));
    if (v) {
      // ask the phone for permission right away
      import("@/lib/notifications").then((m) => m.ensureNotificationPermission()).catch(() => {});
    } else {
      // switched off → cancel every scheduled reminder
      import("expo-notifications").then((N) => N.cancelAllScheduledNotificationsAsync()).catch(() => {});
    }
  };
  const setDisplayName = (n: string) => {
    setDisplayNameState(n);
    if (userId) AsyncStorage.setItem(userKey(userId, "display_name"), n);
  };
  const setBiometricsEnabled = (v: boolean) => {
    setBiometricsState(v);
    if (userId) AsyncStorage.setItem(userKey(userId, "biometrics"), String(v));
  };

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    if (userId) AsyncStorage.setItem(userKey(userId, "theme"), t);
  };

  const isDark = schemePreference === "dark" || (schemePreference === "system" && system === "dark");

  return (
    <SettingsContext.Provider value={{
      currency, setCurrency,
      schemePreference, setSchemePreference,
      isDark,
      theme, setTheme,
      language, setLanguage,
      notificationsEnabled, setNotificationsEnabled,
      displayName, setDisplayName,
      biometricsEnabled, setBiometricsEnabled,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
