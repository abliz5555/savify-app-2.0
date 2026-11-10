import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator, Linking, Platform, Pressable,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSubscription } from "@/lib/revenuecat";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { F } from "@/components/ui";
import Constants from "expo-constants";
import { useT } from "@/lib/i18n";

const PRO_FEATURES = [
  { icon: "trending-up" as const,   label: "6-Month Trend Analytics",  free: false },
  { icon: "activity" as const,      label: "Financial Health Score",   free: false },
  { icon: "cpu" as const,           label: "AI Financial Coach",       free: false },
  { icon: "bar-chart-2" as const,   label: "AI Spending Insights",     free: false },
  { icon: "zap" as const,           label: "Smart Income Insights",    free: false },
  { icon: "target" as const,        label: "Budget Goals & Tracking",  free: false },
  { icon: "trending-down" as const, label: "Debt Payoff Planner",      free: false },
  { icon: "camera" as const,        label: "Bill & Receipt Scanner",   free: false },
  { icon: "file-text" as const,     label: "PDF Report Export",        free: false },
  { icon: "download" as const,      label: "CSV & Excel Export",       free: false },
  { icon: "dollar-sign" as const,   label: "Manual Expense Tracking",  free: true  },
  { icon: "list" as const,          label: "Transaction History",      free: true  },
  { icon: "credit-card" as const,   label: "Loan Tracking",            free: true  },
];

const isExpoGo = Constants.executionEnvironment === "storeClient";

export default function ProScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isTablet, hz } = useLayout();
  const insets = useSafeAreaInsets();
  const {
    monthlyPackage, annualPackage, isOfferingsLoading, isOfferingsError, refetchOfferings,
    purchase, restore, isPurchasing, isRestoring,
  } = useSubscription();

  const { t } = useT();
  const [selected, setSelected] = useState<"annual" | "monthly">("annual");
  const [purchaseError, setPurchaseError] = useState("");

  const selectedPackage = selected === "annual" ? annualPackage : monthlyPackage;
  const annualPrice = annualPackage?.product.priceString ?? "$39.99";
  const monthlyPrice = monthlyPackage?.product.priceString ?? "$4.99";
  const annualMonthly = annualPackage?.product.price != null
    ? `$${(annualPackage.product.price / 12).toFixed(2)}/month`
    : `$${(39.99 / 12).toFixed(2)}/month`;
  const hasTrialAnnual = !!(annualPackage?.product as any)?.introPrice;

  const handleSubscribe = async () => {
    if (!selectedPackage || isPurchasing) return;
    setPurchaseError("");
    try {
      await purchase(selectedPackage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      // userCancelled = user dismissed Apple's dialog — not an error
      if (!e?.userCancelled) {
        setPurchaseError(e?.message ?? "Purchase failed. Please try again.");
      }
    }
  };

  const handleRestore = async () => {
    setPurchaseError("");
    try {
      await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setPurchaseError("Could not restore purchases. Please try again.");
    }
  };

  const busy = isPurchasing || isRestoring;

  return (
    <View style={[p.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={p.header}>
        <Pressable onPress={() => router.back()} style={[p.closeBtn, { backgroundColor: colors.muted }]} hitSlop={12}>
          <Feather name="x" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[p.scroll, { paddingHorizontal: hz }]} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={p.hero}>
          <View style={[p.heroIcon, { backgroundColor: colors.accentBg }]}>
            <Feather name="zap" size={32} color={colors.accent} />
          </View>
          <Text style={[p.heroTitle, { color: colors.foreground }]}>{t("savifyPro")}</Text>
          <Text style={[p.heroSub, { color: colors.mutedForeground }]}>
            {t("proHeroSub")}
          </Text>
        </View>

        {/* Features */}
        <View style={[p.featureCard, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <View style={p.featureHeader}>
            <Text style={[p.featureHeaderFree, { color: colors.mutedForeground }]}>Free</Text>
            <Text style={[p.featureHeaderPro, { color: colors.accent }]}>Pro ⚡</Text>
          </View>
          {PRO_FEATURES.map((f, i) => (
            <View key={f.label} style={[p.featureRow, i < PRO_FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft }]}>
              <View style={p.featureLeft}>
                <View style={[p.featureIconBox, { backgroundColor: f.free ? colors.muted : colors.accentBg }]}>
                  <Feather name={f.icon} size={13} color={f.free ? colors.mutedForeground : colors.accent} />
                </View>
                <Text style={[p.featureLabel, { color: colors.foreground }]}>{f.label}</Text>
              </View>
              <View style={p.featureChecks}>
                <View style={p.featureCheck}>
                  {f.free
                    ? <Feather name="check" size={14} color={colors.green} />
                    : <Feather name="minus" size={14} color={colors.borderSoft} />
                  }
                </View>
                <View style={p.featureCheck}>
                  <Feather name="check" size={14} color={colors.accent} />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Plan selection */}
        <Text style={[p.planTitle, { color: colors.foreground }]}>{t("choosePlan")}</Text>

        {isOfferingsLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
        ) : isOfferingsError ? (
          <View style={[p.offeringsError, { backgroundColor: colors.muted }]}>
            <Feather name="wifi-off" size={20} color={colors.mutedForeground} />
            <Text style={[p.offeringsErrorText, { color: colors.mutedForeground }]}>
              Could not load subscription plans.{"\n"}Check your connection and try again.
            </Text>
            <TouchableOpacity onPress={() => refetchOfferings()} style={[p.retryBtn, { backgroundColor: colors.accent }]}>
              <Text style={{ color: "#fff", fontFamily: F.semibold, fontSize: 13 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !monthlyPackage && !annualPackage ? (
          <View style={[p.offeringsError, { backgroundColor: colors.muted }]}>
            <Feather name="package" size={20} color={colors.mutedForeground} />
            <Text style={[p.offeringsErrorText, { color: colors.mutedForeground }]}>
              {isExpoGo
                ? "Subscriptions are not available in Expo Go.\nUse a TestFlight or production build."
                : "Subscription plans are currently unavailable.\nPlease try again later."}
            </Text>
          </View>
        ) : (
          <>
            {/* Annual — highlighted */}
            <Pressable
              style={[p.planCard, { borderColor: selected === "annual" ? colors.accent : colors.border, backgroundColor: colors.card }]}
              onPress={() => setSelected("annual")}
            >
              <View style={p.planRadioRow}>
                <View style={[p.radio, { borderColor: selected === "annual" ? colors.accent : colors.border }]}>
                  {selected === "annual" && <View style={[p.radioDot, { backgroundColor: colors.accent }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={p.planLabelRow}>
                    <Text style={[p.planName, { color: colors.foreground }]}>{t("annual")}</Text>
                    <View style={[p.badge, { backgroundColor: colors.accent }]}>
                      <Text style={p.badgeText}>{t("bestValueBadge")}</Text>
                    </View>
                  </View>
                  <Text style={[p.planPrice, { color: colors.foreground }]}>
                    {annualPrice}
                    <Text style={[p.planPeriod, { color: colors.mutedForeground }]}>{" "}{t("perYear")}</Text>
                  </Text>
                  <Text style={[p.planNote, { color: colors.mutedForeground }]}>
                    ~{annualMonthly}
                    {hasTrialAnnual ? " · 7-day free trial" : ""}
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Monthly */}
            <Pressable
              style={[p.planCard, { borderColor: selected === "monthly" ? colors.accent : colors.border, backgroundColor: colors.card, marginTop: 10 }]}
              onPress={() => setSelected("monthly")}
            >
              <View style={p.planRadioRow}>
                <View style={[p.radio, { borderColor: selected === "monthly" ? colors.accent : colors.border }]}>
                  {selected === "monthly" && <View style={[p.radioDot, { backgroundColor: colors.accent }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[p.planName, { color: colors.foreground }]}>{t("monthly")}</Text>
                  <Text style={[p.planPrice, { color: colors.foreground }]}>
                    {monthlyPrice}
                    <Text style={[p.planPeriod, { color: colors.mutedForeground }]}>{" "}{t("perMonth")}</Text>
                  </Text>
                  <Text style={[p.planNote, { color: colors.mutedForeground }]}>{t("cancelAnytime")}</Text>
                </View>
              </View>
            </Pressable>
          </>
        )}

        {/* Error */}
        {!!purchaseError && (
          <Text style={[p.errorText, { color: colors.destructive }]}>{purchaseError}</Text>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[p.ctaBtn, { backgroundColor: colors.accent, opacity: busy || !selectedPackage ? 0.55 : 1 }]}
          onPress={handleSubscribe}
          disabled={busy || !selectedPackage}
          activeOpacity={0.85}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={p.ctaText}>
              {hasTrialAnnual && selected === "annual" ? "Start 7-Day Free Trial" : t("subscribeNow")}
            </Text>
          )}
        </TouchableOpacity>

        {/* Expo Go notice */}
        {isExpoGo && (
          <Text style={[p.expoGoNote, { color: colors.mutedForeground }]}>
            ⚠ Purchases require a TestFlight or App Store build.
          </Text>
        )}

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} disabled={busy} style={p.restoreBtn}>
          {isRestoring
            ? <ActivityIndicator color={colors.mutedForeground} size="small" />
            : <Text style={[p.restoreText, { color: colors.mutedForeground }]}>Restore Purchases</Text>
          }
        </TouchableOpacity>

        {/* Fine print */}
        <Text style={[p.finePrint, { color: colors.mutedForeground }]}>
          Payment charged to your Apple ID at confirmation. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.{"\n"}
          <Text
            style={{ textDecorationLine: "underline" }}
            onPress={() => Linking.openURL("itms-apps://apps.apple.com/account/subscriptions")}
          >
            Manage in App Store
          </Text>
        </Text>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}

const p = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 0, alignItems: "flex-end" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  hero: { alignItems: "center", paddingTop: 10, paddingBottom: 16, gap: 8 },
  heroIcon: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  heroTitle: { fontSize: 28, fontFamily: F.bold, letterSpacing: -0.5 },
  heroSub: { fontSize: 14, fontFamily: F.regular, textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },

  featureCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", marginBottom: 24 },
  featureHeader: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 4 },
  featureHeaderFree: { fontSize: 12, fontFamily: F.medium, width: 40, textAlign: "center" },
  featureHeaderPro: { fontSize: 12, fontFamily: F.semibold, width: 40, textAlign: "center" },
  featureRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 16 },
  featureLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  featureIconBox: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 13, fontFamily: F.medium },
  featureChecks: { flexDirection: "row", gap: 4 },
  featureCheck: { width: 40, alignItems: "center" },

  planTitle: { fontSize: 17, fontFamily: F.semibold, marginBottom: 12 },
  planCard: { borderRadius: 14, borderWidth: 1.5, padding: 16 },
  planRadioRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  planLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  planName: { fontSize: 16, fontFamily: F.semibold },
  planPrice: { fontSize: 20, fontFamily: F.bold, marginTop: 2 },
  planPeriod: { fontSize: 14, fontFamily: F.regular },
  planNote: { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: F.semibold, letterSpacing: 0.3 },

  offeringsError: { borderRadius: 14, padding: 20, alignItems: "center", gap: 10, marginBottom: 8 },
  offeringsErrorText: { fontSize: 13, fontFamily: F.regular, textAlign: "center", lineHeight: 20 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10, marginTop: 4 },

  errorText: { fontSize: 13, fontFamily: F.regular, textAlign: "center", marginTop: 8 },

  ctaBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  ctaText: { color: "#fff", fontSize: 17, fontFamily: F.semibold },

  expoGoNote: { fontSize: 12, fontFamily: F.regular, textAlign: "center", marginTop: 10 },

  restoreBtn: { alignItems: "center", paddingVertical: 14 },
  restoreText: { fontSize: 14, fontFamily: F.medium, textDecorationLine: "underline" },

  finePrint: { fontSize: 11, fontFamily: F.regular, textAlign: "center", lineHeight: 17, paddingHorizontal: 8, marginTop: 4 },
});
