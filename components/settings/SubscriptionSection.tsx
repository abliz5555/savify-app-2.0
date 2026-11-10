import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { useSubscription } from "@/lib/revenuecat";
import { F } from "@/components/ui";
import { Divider, SectionHeader, SettingCard, SettingRow } from "./SettingHelpers";

export function SubscriptionSection() {
  const colors = useColors();
  const { t } = useT();
  const router = useRouter();
  const { isSubscribed, activeEntitlement, restore } = useSubscription();

  const planLabel =
    activeEntitlement?.productIdentifier?.includes("yearly") || activeEntitlement?.productIdentifier?.includes("annual")
      ? t("annualPlanLabel")
      : t("monthlyPlanLabel");

  const renewalDate = activeEntitlement?.expirationDate
    ? new Date(activeEntitlement.expirationDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const handleRestorePurchases = async () => {
    try {
      await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Restored", "Your purchases have been restored successfully.");
    } catch {
      Alert.alert("Error", "Could not restore purchases. Please try again.");
    }
  };

  return (
    <>
      <SectionHeader label={t("savifyPro")} colors={colors} />
      {isSubscribed ? (
        <SettingCard colors={colors}>
          <View style={ss.activeCard}>
            <View style={[ss.activeBadge, { backgroundColor: colors.greenBg }]}>
              <Feather name="check-circle" size={17} color={colors.green} />
              <Text style={[ss.activeBadgeText, { color: colors.green }]}>{t("subscriptionActive")}</Text>
            </View>
            <Text style={[ss.activePlan, { color: colors.mutedForeground }]}>{planLabel}</Text>
            {!!renewalDate && (
              <Text style={[ss.activeFeatures, { color: colors.foreground }]}>Renews {renewalDate}</Text>
            )}
          </View>
          <Divider colors={colors} />
          <SettingRow
            label="Manage Subscription"
            icon="external-link"
            colors={colors}
            onPress={() => Linking.openURL("itms-apps://apps.apple.com/account/subscriptions")}
          />
          <Divider colors={colors} />
          <SettingRow label="Restore Purchases" icon="refresh-cw" colors={colors} onPress={handleRestorePurchases} />
        </SettingCard>
      ) : (
        <Pressable onPress={() => router.push("/pro")}>
          <View style={[ss.proCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
            <View style={ss.proCardHeader}>
              <View style={[ss.proIconWrap, { backgroundColor: colors.accentBg }]}>
                <Feather name="zap" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ss.proCardTitle, { color: colors.foreground }]}>{t("savifyPro")}</Text>
                <Text style={[ss.proCardSub, { color: colors.mutedForeground }]}>{t("unlockPremiumDesc")}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <View style={[ss.proFeatures, { borderTopColor: colors.borderSoft }]}>
              {[t("proFeatureScanBills"), t("proFeatureAIInsights"), t("proFeaturePDFReports")].map((f) => (
                <Text key={f} style={[ss.proFeatureItem, { color: colors.mutedForeground }]}>{f}</Text>
              ))}
            </View>
            <View style={[ss.proPriceRow, { borderTopColor: colors.borderSoft }]}>
              <Text style={[ss.proPriceFrom, { color: colors.accent }]}>{t("fromPriceMonthly")}</Text>
            </View>
          </View>
        </Pressable>
      )}
    </>
  );
}

const ss = StyleSheet.create({
  activeCard: { padding: 14, gap: 8 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, alignSelf: "flex-start" },
  activeBadgeText: { fontSize: 13.5, fontFamily: F.semibold },
  activePlan: { fontSize: 13, fontFamily: F.regular },
  activeFeatures: { fontSize: 13, fontFamily: F.medium },
  proCard: { borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  proCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  proIconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  proCardTitle: { fontSize: 16, fontFamily: F.bold },
  proCardSub: { fontSize: 12.5, fontFamily: F.regular, marginTop: 1 },
  proFeatures: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  proFeatureItem: { fontSize: 13, fontFamily: F.regular },
  proPriceRow: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  proPriceFrom: { fontSize: 13, fontFamily: F.semibold, textAlign: "center" },
});
