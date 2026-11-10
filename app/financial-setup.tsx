import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useFinancialProfile, useUpsertFinancialProfile } from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useT } from "@/lib/i18n";
import { markSetupSeen } from "@/lib/setupSeen";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { formatCurrency } from "@/lib/format";
import { F, FormError, FormInput, PrimaryButton } from "@/components/ui";

const STEPS = 3;

type FormState = {
  cashOnHand: string;
  bankBalance: string;
  savingsBalance: string;
  totalDebts: string;
  monthlyIncome: string;
};

function n(s: string) {
  const v = parseFloat(s);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function ProgressBar({
  step, total, colors,
}: { step: number; total: number; colors: ReturnType<typeof useColors> }) {
  const pct = `${Math.round((step / total) * 100)}%` as `${number}%`;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, fontFamily: F.medium, color: colors.mutedForeground }}>
          Step {step} of {total}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: F.medium, color: colors.accent }}>
          {Math.round((step / total) * 100)}% complete
        </Text>
      </View>
      <View style={{ height: 5, backgroundColor: colors.muted, borderRadius: 4, overflow: "hidden" }}>
        <View style={{ height: 5, width: pct, backgroundColor: colors.accent, borderRadius: 4 }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: i < step ? colors.accent : colors.muted,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function StepHeader({
  icon, title, subtitle, iconBg, colors,
}: {
  icon: string; title: string; subtitle: string;
  iconBg: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ alignItems: "center", gap: 12, paddingVertical: 8 }}>
      <View style={[sw.iconWrap, { backgroundColor: iconBg }]}>
        <Feather name={icon as "home"} size={26} color={colors.accent} />
      </View>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text style={[sw.stepTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[sw.stepSub, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function SummaryRow({
  label, value, currency, colors, accent,
}: { label: string; value: number; currency: string; colors: ReturnType<typeof useColors>; accent?: boolean }) {
  return (
    <View style={sw.summaryRow}>
      <Text style={[sw.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[sw.summaryValue, { color: accent ? colors.accent : colors.foreground }]}>
        {formatCurrency(value, currency)}
      </Text>
    </View>
  );
}

export default function FinancialSetupScreen() {
  const colors = useColors();
  const { hz } = useLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const { t } = useT();
  const { userId } = useAuth();
  const upsert = useUpsertFinancialProfile();
  const { data: existingProfile, isLoading: profileLoading } = useFinancialProfile();
  const isEditing = !!existingProfile;

  // true when user navigated here via push (e.g. from settings); false on initial replace from sign-up
  const canGoBack = router.canGoBack();

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [skipping, setSkipping] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [form, setForm] = useState<FormState>({
    cashOnHand: "", bankBalance: "", savingsBalance: "",
    totalDebts: "", monthlyIncome: "",
  });

  // Only auto-redirect when this is the initial setup flow (no back stack).
  // If the user pushed here from settings/home, canGoBack is true — let them edit.
  useEffect(() => {
    if (canGoBack) return;
    if (profileLoading) return;
    if (existingProfile && userId) {
      markSetupSeen(userId).catch(() => {});
      router.replace("/(tabs)" as any);
    }
  }, [existingProfile, profileLoading, userId, canGoBack]);

  // Pre-fill form with existing profile when editing
  useEffect(() => {
    if (existingProfile && !formReady) {
      const fmt = (v: number) => (v > 0 ? String(v) : "");
      setForm({
        cashOnHand:     fmt(existingProfile.cashOnHand),
        bankBalance:    fmt(existingProfile.bankBalance),
        savingsBalance: fmt(existingProfile.savingsBalance),
        totalDebts:     fmt(existingProfile.totalDebts),
        monthlyIncome:  existingProfile.monthlyIncome != null ? String(existingProfile.monthlyIncome) : "",
      });
      setFormReady(true);
    }
  }, [existingProfile, formReady]);

  function set(key: keyof FormState) {
    return (v: string) => {
      const filtered = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
      setForm((f) => ({ ...f, [key]: filtered }));
      setError("");
    };
  }

  function validateStep(s: number): boolean {
    const numFields: (keyof FormState)[] = s === 1
      ? ["cashOnHand", "bankBalance", "savingsBalance"]
      : s === 2 ? ["totalDebts"]
      : ["monthlyIncome"];
    for (const field of numFields) {
      if (form[field] && !Number.isFinite(parseFloat(form[field]))) {
        setError(t("fsValidErr"));
        return false;
      }
    }
    return true;
  }

  function next() {
    setError("");
    if (!validateStep(step)) return;
    setStep((s) => s + 1);
  }

  function back() {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  }

  async function save() {
    if (!validateStep(step)) return;
    try {
      await upsert.mutateAsync({
        cashOnHand: n(form.cashOnHand),
        bankBalance: n(form.bankBalance),
        savingsBalance: n(form.savingsBalance),
        investments: 0,
        otherAssets: 0,
        totalDebts: n(form.totalDebts),
        monthlyIncome: form.monthlyIncome ? n(form.monthlyIncome) : null,
        monthlyExpenses: null,
        savingsGoal: null,
      });
      if (userId) await markSetupSeen(userId);
      router.replace("/(tabs)" as any);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("fsSaveErr"));
    }
  }

  async function handleSkip() {
    // If editing an existing profile, go to tabs — no data change
    if (isEditing) {
      router.replace("/(tabs)" as any);
      return;
    }
    // First-time setup: save zeros so the profile row exists, then go to tabs
    setSkipping(true);
    try {
      await upsert.mutateAsync({
        cashOnHand: 0, bankBalance: 0, savingsBalance: 0,
        investments: 0, otherAssets: 0, totalDebts: 0,
        monthlyIncome: null, monthlyExpenses: null, savingsGoal: null,
      });
    } catch {
      // ignore
    }
    if (userId) await markSetupSeen(userId).catch(() => {});
    setSkipping(false);
    router.replace("/(tabs)" as any);
  }

  const totalAvailable = n(form.cashOnHand) + n(form.bankBalance) + n(form.savingsBalance);
  const netWorth = totalAvailable - n(form.totalDebts);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[sw.header, { paddingTop: insets.top + 12, paddingHorizontal: hz, backgroundColor: colors.background, borderBottomColor: colors.borderSoft }]}>
        <Pressable onPress={handleSkip} style={sw.closeBtn} disabled={skipping}>
          <Feather name="x" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[sw.headerTitle, { color: colors.foreground }]}>{t("fsTitle")}</Text>
        </View>
        <Pressable onPress={handleSkip} style={sw.skipBtn} disabled={skipping}>
          <Text style={{ fontSize: 14, fontFamily: F.medium, color: colors.mutedForeground }}>
            {skipping ? "..." : isEditing ? t("fsCancel") : t("fsSkip")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[sw.scroll, { paddingBottom: insets.bottom + 40, paddingHorizontal: hz }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ProgressBar step={step} total={STEPS} colors={colors} />

        {/* Step 1 — Cash & Bank Accounts */}
        {step === 1 && (
          <View style={sw.stepContent}>
            <StepHeader icon="credit-card" title={t("fsStep1Title")} subtitle={t("fsStep1Sub")} iconBg={colors.accentBg} colors={colors} />
            <View style={sw.fields}>
              <FormInput label={`${t("fsCashLabel")} (${currency})`} value={form.cashOnHand} onChangeText={set("cashOnHand")} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
              <FormInput label={`${t("fsBankLabel")} (${currency})`} value={form.bankBalance} onChangeText={set("bankBalance")} placeholder="0.00" keyboardType="decimal-pad" />
              <FormInput label={`${t("fsSavingsOptLabel")} (${currency})`} value={form.savingsBalance} onChangeText={set("savingsBalance")} placeholder="0.00" keyboardType="decimal-pad" />
            </View>
            {totalAvailable > 0 && (
              <View style={[sw.runningCard, { backgroundColor: colors.accentBg, borderColor: colors.accent + "30" }]}>
                <Text style={[sw.runningLabel, { color: colors.mutedForeground }]}>{t("fsTotalCash")}</Text>
                <Text style={[sw.runningValue, { color: colors.accent }]}>
                  {formatCurrency(totalAvailable, currency)}
                </Text>
              </View>
            )}
            <View style={[sw.hint, { backgroundColor: colors.muted }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[sw.hintText, { color: colors.mutedForeground }]}>
                {t("fsStep1Hint")}
              </Text>
            </View>
          </View>
        )}

        {/* Step 2 — Debts */}
        {step === 2 && (
          <View style={sw.stepContent}>
            <StepHeader icon="alert-circle" title={t("fsStep2Title")} subtitle={t("fsStep2Sub")} iconBg={colors.redBg} colors={colors} />
            <View style={sw.fields}>
              <FormInput label={`${t("fsDebtsLabel")} (${currency})`} value={form.totalDebts} onChangeText={set("totalDebts")} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
            </View>
            <View style={[sw.hint, { backgroundColor: colors.muted }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[sw.hintText, { color: colors.mutedForeground }]}>
                {t("fsStep2Hint")}
              </Text>
            </View>
            <View style={[sw.netCard, { backgroundColor: netWorth >= 0 ? colors.accentBg : colors.redBg, borderColor: (netWorth >= 0 ? colors.accent : colors.red) + "30" }]}>
              <Text style={[sw.runningLabel, { color: colors.mutedForeground }]}>{t("fsEstNetWorth")}</Text>
              <Text style={[sw.runningValue, { color: netWorth >= 0 ? colors.accent : colors.red }]}>
                {formatCurrency(netWorth, currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Step 3 — Monthly Income (Optional) + Summary */}
        {step === 3 && (
          <View style={sw.stepContent}>
            <StepHeader icon="calendar" title={t("fsStep3Title")} subtitle={t("fsStep3Sub")} iconBg={colors.accentBg} colors={colors} />
            <View style={sw.fields}>
              <FormInput label={`${t("fsIncomeOptLabel")} (${currency})`} value={form.monthlyIncome} onChangeText={set("monthlyIncome")} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
            </View>

            {/* Summary card */}
            <View style={[sw.summaryCard, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
              <Text style={[sw.summaryCardTitle, { color: colors.foreground }]}>{t("fsSummaryTitle")}</Text>
              <View style={{ gap: 8 }}>
                <SummaryRow label={t("fsCashLabel")} value={n(form.cashOnHand)} currency={currency} colors={colors} />
                <SummaryRow label={t("fsBankLabel")} value={n(form.bankBalance)} currency={currency} colors={colors} />
                {n(form.savingsBalance) > 0 && (
                  <SummaryRow label={t("fsSavingsLabel")} value={n(form.savingsBalance)} currency={currency} colors={colors} />
                )}
                <View style={[sw.summaryDivider, { backgroundColor: colors.borderSoft }]} />
                <SummaryRow label={t("fsTotalCash")} value={totalAvailable} currency={currency} colors={colors} accent />
                <View style={[sw.summaryDivider, { backgroundColor: colors.borderSoft }]} />
                <SummaryRow label={t("fsDebtsLabel")} value={n(form.totalDebts)} currency={currency} colors={colors} />
                <SummaryRow label={t("fsNetWorth")} value={netWorth} currency={currency} colors={colors} accent />
                {n(form.monthlyIncome) > 0 && (
                  <>
                    <View style={[sw.summaryDivider, { backgroundColor: colors.borderSoft }]} />
                    <SummaryRow label={t("fsStep3Title")} value={n(form.monthlyIncome)} currency={currency} colors={colors} />
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {error ? <FormError>{error}</FormError> : null}

        <View style={sw.navRow}>
          {step > 1 && (
            <Pressable onPress={back} style={[sw.backBtn, { borderColor: colors.borderSoft }]}>
              <Feather name="chevron-left" size={16} color={colors.foreground} />
              <Text style={{ fontSize: 14, fontFamily: F.medium, color: colors.foreground }}>{t("fsBack")}</Text>
            </Pressable>
          )}
          {step < STEPS ? (
            <PrimaryButton label={t("fsNext")} onPress={next} style={{ flex: 1 }} />
          ) : (
            <PrimaryButton
              label={t("fsSaveStart")}
              onPress={save}
              loading={upsert.isPending}
              style={{ flex: 1 }}
            />
          )}
        </View>

        {!isEditing && (
          <Pressable onPress={handleSkip} disabled={skipping} style={{ alignItems: "center", paddingVertical: 10 }}>
            <Text style={{ fontSize: 14, fontFamily: F.medium, color: colors.mutedForeground }}>
              {skipping ? t("fsSkipping") : t("fsSkipForNow")}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const sw = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontFamily: F.semibold },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },
  stepContent: { gap: 20 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  stepTitle: { fontSize: 20, fontFamily: F.bold, textAlign: "center" },
  stepSub: { fontSize: 14, fontFamily: F.regular, textAlign: "center", lineHeight: 20 },
  fields: { gap: 14 },
  hint: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 12, padding: 12,
  },
  hintText: { fontSize: 13, fontFamily: F.regular, lineHeight: 18, flex: 1 },
  runningCard: {
    borderRadius: 12, padding: 14, borderWidth: 1,
    alignItems: "center", gap: 4,
  },
  runningLabel: { fontSize: 11, fontFamily: F.medium, letterSpacing: 0.5 },
  runningValue: { fontSize: 22, fontFamily: F.bold },
  netCard: { borderRadius: 12, padding: 14, borderWidth: 1, alignItems: "center", gap: 4 },
  summaryCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  summaryCardTitle: { fontSize: 15, fontFamily: F.semibold },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 13.5, fontFamily: F.regular },
  summaryValue: { fontSize: 13.5, fontFamily: F.semibold },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  navRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1,
  },
});
