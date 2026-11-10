import { useUser } from "@/lib/auth";
import { APP_CONFIG } from "@/lib/config";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { useSettings } from "@/contexts/SettingsContext";
import { useSubscription } from "@/lib/revenuecat";
import { useT } from "@/lib/i18n";
import { F } from "@/components/ui";

import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { FinancialProfileSection } from "@/components/settings/FinancialProfileSection";
import { SubscriptionSection } from "@/components/settings/SubscriptionSection";
import { AccountSection } from "@/components/settings/AccountSection";
import { DataSection } from "@/components/settings/DataSection";
import { LegalSection } from "@/components/settings/LegalSection";
import { DevSection } from "@/components/settings/DevSection";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { displayName } = useSettings();
  const { isSubscribed, isAdmin } = useSubscription();
  const { user } = useUser();

  const { isTablet, hz } = useLayout();
  const topInsets = Platform.OS === "web" ? 67 : insets.top;
  const s = makeStyles(colors, topInsets, hz);

  return (
    <View style={s.root}>
      <View style={[s.stickyHeader, { paddingTop: topInsets + 10, backgroundColor: colors.background, borderBottomColor: colors.borderSoft }]}>
        <View style={[s.profileRow, { flex: 1 }]}>
          <Pressable onPress={() => router.navigate("/(tabs)")} hitSlop={10} accessibilityLabel="Back to Home"
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </Pressable>
          <View style={[s.avatarCircle, { backgroundColor: colors.accentBg, borderColor: colors.accent + "40" }]}>
            <Text style={[s.avatarInitial, { color: colors.accent }]}>
              {(displayName || user?.emailAddresses?.[0]?.emailAddress || "U").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>{t("settings")}</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {displayName || user?.emailAddresses?.[0]?.emailAddress || "Your Account"}
            </Text>
          </View>
          {isSubscribed && APP_CONFIG.PRO_ENABLED && (
            <View style={[s.proBadge, { backgroundColor: colors.accentBg, borderColor: colors.accent + "50" }]}>
              <Feather name="zap" size={10} color={colors.accent} />
              <Text style={[s.proBadgeText, { color: colors.accent }]}>PRO</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scroll]} showsVerticalScrollIndicator={false}>
        <PreferencesSection />
        <FinancialProfileSection />
        {APP_CONFIG.PRO_ENABLED && <SubscriptionSection />}
        <AccountSection />
        <DataSection />
        <LegalSection />
        {isAdmin && <DevSection />}
        <View style={{ height: Platform.OS === "web" ? 34 : 110 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, _topInsets: number, hz: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    stickyHeader: {
      flexDirection: "row", alignItems: "flex-end",
      paddingHorizontal: hz, paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 10,
    },
    headerTitle: { fontSize: 22, fontFamily: F.extrabold, letterSpacing: -0.3 },
    headerSub: { fontSize: 12.5, fontFamily: F.regular, marginTop: 3 },
    scroll: { paddingHorizontal: hz, paddingTop: 18, paddingBottom: 40 },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarCircle: {
      width: 42, height: 42, borderRadius: 21,
      alignItems: "center", justifyContent: "center", borderWidth: 1.5,
    },
    avatarInitial: { fontSize: 18, fontFamily: F.bold },
    proBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 20, borderWidth: 1,
    },
    proBadgeText: { fontSize: 11, fontFamily: F.bold, letterSpacing: 0.5 },
  });
}
