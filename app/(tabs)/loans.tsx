import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAddLoan, useAddLoanPayment, useDeleteLoan, useFinanceData, useFinancialProfile,
} from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSubscription } from "@/lib/revenuecat";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { formatCurrency, formatDate, todayISO, monthKey } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Loan } from "@/lib/types";
import {
  Card, F, FormError, FormInput, PillTabs,
  PrimaryButton, ProgressBar, SectionLabel, Segmented,
} from "@/components/ui";
import { FloatingFab, type FabAction } from "@/components/fab-menu";

type LoanDir = "borrowed" | "lent";

function getLoanDir(loan: Loan): LoanDir {
  return loan.direction ?? (loan.lenderName.startsWith("[Lent]") ? "lent" : "borrowed");
}

function getDisplayName(loan: Loan): string {
  return loan.lenderName.replace(/^\[Borrowed\]\s*|\[Lent\]\s*/i, "");
}

export default function LoansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const { isSubscribed } = useSubscription();
  const router = useRouter();
  const { t } = useT();
  const { data, isLoading, isError, refetch, isRefetching } = useFinanceData();
  const addPayment = useAddLoanPayment();
  const [tab, setTab] = useState<LoanDir>("borrowed");
  const { isTablet, hz } = useLayout();
  const topInsets = Platform.OS === "web" ? 67 : insets.top;
  const bottomInsets = Platform.OS === "web" ? 0 : insets.bottom;
  const fabBottom = Platform.OS === "web" ? 84 : Math.max(bottomInsets, 10) + 74;

  // FAB
  const [fabOpen, setFabOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setFabOpen(false), []));

  // Modals
  const [addLoanDir, setAddLoanDir] = useState<LoanDir>("borrowed");
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [quickPayLoanId, setQuickPayLoanId] = useState<string | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState("");
  const [quickPayError, setQuickPayError] = useState("");

  const loans = useMemo(
    () => (data?.loans ?? []).filter((l) => getLoanDir(l) === tab),
    [data, tab],
  );

  const dueSoonLoans = useMemo(() => {
    if (!data?.loans) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return data.loans
      .filter((l) => {
        if (!l.dueDate) return false;
        const due = new Date(l.dueDate);
        due.setHours(0, 0, 0, 0);
        const d = Math.floor((due.getTime() - now.getTime()) / 86400000);
        return d >= -7 && d <= 7;
      })
      .map((l) => {
        const due = new Date(l.dueDate!);
        due.setHours(0, 0, 0, 0);
        return { loan: l, days: Math.floor((due.getTime() - now.getTime()) / 86400000) };
      })
      .sort((a, b) => a.days - b.days);
  }, [data]);

  const debtSummary = useMemo(() => {
    if (!data) return { loans: [], totalDebt: 0, totalPaid: 0 };
    const borrowed = data.loans.filter((l) => getLoanDir(l) === "borrowed");
    const withRemaining = borrowed.map((l) => {
      const paid = (l.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const total = Number(l.totalAmount) || 0;
      const remaining = Math.max(total - paid, 0);
      return { ...l, totalAmount: total, paid, remaining, displayName: getDisplayName(l) };
    }).filter((l) => l.remaining > 0);
    const totalDebt = withRemaining.reduce((s, l) => s + l.remaining, 0);
    const totalPaid = withRemaining.reduce((s, l) => s + l.paid, 0);
    return { loans: withRemaining, totalDebt, totalPaid };
  }, [data]);

  // Loan Health Summary
  const healthSummary = useMemo(() => {
    if (!data) return null;
    const borrowed = data.loans.filter((l) => getLoanDir(l) === "borrowed");
    const totalOriginal = borrowed.reduce((s, l) => s + (Number(l.totalAmount) || 0), 0);
    const totalPaid = borrowed.reduce((s, l) =>
      s + (l.payments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0), 0);
    const totalRemaining = Math.max(totalOriginal - totalPaid, 0);
    const activeLoans = borrowed.filter((l) => {
      const paid = (l.payments ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
      return Math.max((Number(l.totalAmount) || 0) - paid, 0) > 0;
    }).length;
    let monthlyEst = 0;
    for (const l of borrowed) {
      const payments = l.payments ?? [];
      if (payments.length > 0) {
        const map = new Map<string, number>();
        for (const p of payments) {
          const k = monthKey(p.paidAt);
          map.set(k, (map.get(k) ?? 0) + (Number(p.amount) || 0));
        }
        const vals = Array.from(map.values());
        monthlyEst += vals.reduce((a, v) => a + v, 0) / vals.length;
      }
    }
    return { totalOriginal, totalPaid, totalRemaining, activeLoans, monthlyEst };
  }, [data]);

  // Active borrowed loans for the quick-pay picker
  const activeLoansForPay = useMemo(() => {
    if (!data) return [];
    return data.loans
      .filter((l) => {
        if (getLoanDir(l) !== "borrowed") return false;
        const paid = (l.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        return Math.max((Number(l.totalAmount) || 0) - paid, 0) > 0;
      })
      .map((l) => ({ ...l, displayName: getDisplayName(l) }));
  }, [data]);

  const fabActions: FabAction[] = [
    {
      icon: "download" as const, label: t("addBorrowedLoan"), desc: t("moneyIOwe"),
      iconBg: colors.redBg, iconColor: colors.red, premium: false,
      onPress: () => { setFabOpen(false); setAddLoanDir("borrowed"); setTimeout(() => setAddLoanOpen(true), 220); },
    },
    {
      icon: "upload" as const, label: t("addLentMoney"), desc: t("moneyOwedMe"),
      iconBg: colors.greenBg, iconColor: colors.green, premium: false,
      onPress: () => { setFabOpen(false); setAddLoanDir("lent"); setTimeout(() => setAddLoanOpen(true), 220); },
    },
    {
      icon: "credit-card" as const, label: t("recordPaymentBtn"), desc: t("logPaymentMade"),
      iconBg: colors.accentBg, iconColor: colors.accent, premium: false,
      onPress: () => {
        setFabOpen(false);
        setQuickPayLoanId(activeLoansForPay[0]?.id ?? null);
        setQuickPayAmount(""); setQuickPayError("");
        setTimeout(() => setQuickPayOpen(true), 220);
      },
    },
    {
      icon: "bar-chart-2" as const, label: t("debtPayoffPlanner"), desc: t("snowballOrAvalanche"),
      iconBg: colors.muted, iconColor: colors.mutedForeground, premium: !isSubscribed,
      onPress: () => {
        if (!isSubscribed) {
          setFabOpen(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/pro");
          return;
        }
        setFabOpen(false); setTimeout(() => setPlannerOpen(true), 220);
      },
    },
  ];

  const submitQuickPay = async () => {
    const amt = parseFloat(quickPayAmount);
    if (!quickPayLoanId) { setQuickPayError(t("selectLoanFirst")); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setQuickPayError(t("enterValidAmount")); return; }
    setQuickPayError("");
    try {
      await addPayment.mutateAsync({ loanId: quickPayLoanId, amount: amt, note: null });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQuickPayOpen(false); setQuickPayAmount(""); setQuickPayLoanId(null);
    } catch (e: unknown) { setQuickPayError(e instanceof Error ? e.message : "Failed to record payment"); }
  };

  const s = makeStyles(colors, topInsets, hz);

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 16 }}>
        <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: colors.redBg, alignItems: "center", justifyContent: "center" }}>
          <Feather name="wifi-off" size={26} color={colors.red} />
        </View>
        <Text style={{ fontSize: 18, fontFamily: F.bold, color: colors.foreground, textAlign: "center" }}>{t("loadError")}</Text>
        <Text style={{ fontSize: 13.5, fontFamily: F.regular, color: colors.mutedForeground, textAlign: "center", lineHeight: 20 }}>{t("loadErrorHint")}</Text>
        <TouchableOpacity onPress={() => refetch()} style={{ backgroundColor: "#1a1a1a", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, marginTop: 4 }} activeOpacity={0.8}>
          <Text style={{ fontSize: 14, fontFamily: F.semibold, color: "#fff" }}>{t("retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.stickyHeader, {
        paddingTop: topInsets + 10,
        backgroundColor: colors.background,
        borderBottomColor: colors.borderSoft,
      }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>{t("loansTitle")}</Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground }]}>{t("loansSubtitle")}</Text>
        </View>
      </View>

      {/* ── Add Loan Modal ── */}
      <Modal visible={addLoanOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddLoanOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontFamily: F.bold, color: colors.foreground }}>
                {addLoanDir === "borrowed" ? t("addBorrowedLoan") : t("addLentMoney")}
              </Text>
              <Pressable onPress={() => setAddLoanOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <LoanForm initialDir={addLoanDir} onClose={() => setAddLoanOpen(false)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Debt Payoff Planner Modal ── */}
      <Modal visible={plannerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPlannerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontFamily: F.bold, color: colors.foreground }}>{t("debtPayoffPlanner")}</Text>
              <Pressable onPress={() => setPlannerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {debtSummary.loans.length > 0 ? (
              <DebtPayoffPlanner summary={debtSummary} currency={currency} colors={colors} />
            ) : (
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="trending-down" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={s.emptyTitle}>{t("noActiveDebts")}</Text>
                <Text style={s.emptyText}>{t("addLoanToStart")}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Quick Pay Modal ── */}
      <Modal visible={quickPayOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setQuickPayOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontFamily: F.bold, color: colors.foreground }}>{t("recordPaymentBtn")}</Text>
              <Pressable onPress={() => setQuickPayOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {activeLoansForPay.length === 0 ? (
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: colors.greenBg }]}>
                  <Feather name="check-circle" size={28} color={colors.green} />
                </View>
                <Text style={s.emptyTitle}>{t("allPaidOff")}</Text>
                <Text style={s.emptyText}>{t("noActiveLoansBalance")}</Text>
              </View>
            ) : (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 11, fontFamily: F.semibold, color: colors.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    {t("selectLoan")}
                  </Text>
                  {activeLoansForPay.map((l) => {
                    const paid = (l.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    const remaining = Math.max((Number(l.totalAmount) || 0) - paid, 0);
                    const isSelected = l.id === quickPayLoanId;
                    return (
                      <Pressable
                        key={l.id}
                        onPress={() => setQuickPayLoanId(l.id)}
                        style={[{
                          padding: 14, borderRadius: 12, borderWidth: 1.5,
                          borderColor: isSelected ? colors.accent : colors.borderSoft,
                          backgroundColor: isSelected ? colors.accentBg : colors.card,
                        }]}
                      >
                        <Text style={{ fontSize: 14, fontFamily: F.semibold, color: colors.foreground }}>{l.displayName}</Text>
                        <Text style={{ fontSize: 12, fontFamily: F.regular, color: colors.mutedForeground, marginTop: 2 }}>
                          {formatCurrency(remaining, currency)} {t("remainingSuffix")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <FormInput label={`${t("paymentAmountLabel")} (${currency})`} value={quickPayAmount} onChangeText={(v) => setQuickPayAmount(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0.00" keyboardType="decimal-pad" />
                <FormError>{quickPayError}</FormError>
                <PrimaryButton label={t("recordPaymentBtn")} onPress={submitQuickPay} loading={addPayment.isPending} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
      >
        {/* ── Loan Health Summary ── */}
        {!isLoading && healthSummary && (healthSummary.totalOriginal > 0 || healthSummary.activeLoans > 0) && (
          <Card style={{ padding: 0, marginBottom: 18, overflow: "hidden" }}>
            <View style={{ padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft }}>
              <Text style={{ fontSize: 13, fontFamily: F.bold, color: colors.foreground }}>{t("loanHealthSummary")}</Text>
              <Text style={{ fontSize: 11.5, fontFamily: F.regular, color: colors.mutedForeground, marginTop: 2 }}>
                {t("debtOverviewSubtitle")}
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              {[
                { label: t("totalDebtLabel"), value: formatCurrency(healthSummary.totalOriginal, currency), color: colors.red },
                { label: t("totalPaidLabel"), value: formatCurrency(healthSummary.totalPaid, currency), color: colors.green },
                { label: t("remainingLabel"), value: formatCurrency(healthSummary.totalRemaining, currency), color: colors.foreground },
              ].map((item, i, arr) => (
                <View
                  key={item.label}
                  style={[hs.cell, i < arr.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.borderSoft }]}
                >
                  <Text style={[hs.label, { color: colors.mutedForeground }]}>{item.label}</Text>
                  <Text style={[hs.value, { color: item.color }]}>{item.value}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft }}>
              {[
                {
                  label: t("estMonthlyLabel"),
                  value: healthSummary.monthlyEst > 0 ? formatCurrency(healthSummary.monthlyEst, currency) : "—",
                  color: colors.foreground,
                },
                { label: t("activeLoansLabel"), value: String(healthSummary.activeLoans), color: colors.foreground },
                {
                  label: t("progressLabel"),
                  value: healthSummary.totalOriginal > 0
                    ? `${((healthSummary.totalPaid / healthSummary.totalOriginal) * 100).toFixed(0)}%`
                    : "—",
                  color: colors.accent,
                },
              ].map((item, i, arr) => (
                <View
                  key={item.label}
                  style={[hs.cell, i < arr.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.borderSoft }]}
                >
                  <Text style={[hs.label, { color: colors.mutedForeground }]}>{item.label}</Text>
                  <Text style={[hs.value, { color: item.color }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <DueSoonSection items={dueSoonLoans} currency={currency} colors={colors} />

        <View style={s.tabsWrap}>
          <PillTabs<LoanDir>
            tabs={[
              { key: "borrowed", label: t("borrowed") },
              { key: "lent", label: t("lent") },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {isLoading ? (
          <View style={s.loading}><ActivityIndicator color={colors.accent} size="large" /></View>
        ) : loans.length ? (
          loans.map((loan) => <LoanCard key={loan.id} loan={loan} currency={currency} colors={colors} />)
        ) : (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name={tab === "borrowed" ? "credit-card" : "send"} size={28} color={colors.mutedForeground} />
            </View>
            <Text style={s.emptyTitle}>
              {tab === "borrowed" ? t("noDebtsYet") : t("noLentLoans")}
            </Text>
            <Text style={s.emptyText}>
              {tab === "borrowed"
                ? t("tapPlusToAddLoan")
                : t("tapPlusToRecordLent")}
            </Text>
          </View>
        )}

        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>

      <FloatingFab
        actions={fabActions}
        fabBottom={fabBottom}
        isOpen={fabOpen}
        onToggle={() => setFabOpen((v) => !v)}
      />
    </View>
  );
}

// ── Debt Payoff Planner ───────────────────────────────────────────────────────

type DebtLoan = {
  id: string; displayName: string; remaining: number; paid: number; totalAmount: number;
};

function DebtPayoffPlanner({
  summary, currency, colors,
}: {
  summary: { loans: DebtLoan[]; totalDebt: number; totalPaid: number };
  currency: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useT();
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [method, setMethod] = useState<"snowball" | "avalanche">("snowball");
  const [aprInput, setAprInput] = useState("18");

  const budget = parseFloat(monthlyBudget);
  const apr = parseFloat(aprInput);

  const orderedLoans = useMemo(() => {
    const sorted = [...summary.loans];
    if (method === "snowball") {
      sorted.sort((a, b) => a.remaining - b.remaining);
    } else {
      sorted.sort((a, b) => b.remaining - a.remaining);
    }
    return sorted;
  }, [summary.loans, method]);

  const payoffMonths = useMemo(() => {
    if (!Number.isFinite(budget) || budget <= 0) return null;
    if (budget >= summary.totalDebt) return 1;
    return Math.ceil(summary.totalDebt / budget);
  }, [budget, summary.totalDebt]);

  const payoffDate = useMemo(() => {
    if (!payoffMonths) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + payoffMonths);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [payoffMonths]);

  const interestSaved = useMemo(() => {
    if (!Number.isFinite(budget) || budget <= 0) return null;
    if (!Number.isFinite(apr) || apr <= 0) return null;
    const D = summary.totalDebt;
    if (D <= 0) return null;
    const rate = apr / 12 / 100;
    const minPay = Math.max(D * 0.02, 50);
    const amort = (p: number, r: number, pmt: number): number => {
      if (p <= 0) return 0;
      if (r <= 0) return pmt > 0 ? Math.ceil(p / pmt) : Infinity;
      if (pmt <= p * r) return Infinity;
      return Math.ceil(-Math.log(1 - (r * p) / pmt) / Math.log(1 + r));
    };
    const minMonths = amort(D, rate, minPay);
    const budgetMonths = amort(D, rate, budget);
    if (!Number.isFinite(minMonths) || !Number.isFinite(budgetMonths)) return null;
    const intMin = Math.max(0, minMonths * minPay - D);
    const intBudget = Math.max(0, budgetMonths * budget - D);
    return Math.max(0, intMin - intBudget);
  }, [budget, apr, summary.totalDebt]);

  const totalProgress = summary.totalDebt + summary.totalPaid > 0
    ? (summary.totalPaid / (summary.totalDebt + summary.totalPaid)) * 100
    : 0;

  return (
    <View style={pp.wrap}>
      <SectionLabel style={{ marginBottom: 10 }}>{t("debtPayoffPlanner")}</SectionLabel>

      <Card style={pp.summaryCard}>
        <View style={pp.summaryRow}>
          <View style={pp.summaryItem}>
            <SectionLabel size={9}>{t("totalDebtLabel")}</SectionLabel>
            <Text style={[pp.summaryValue, { color: colors.red }]}>{formatCurrency(summary.totalDebt, currency)}</Text>
          </View>
          <View style={[pp.summaryItem, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.borderSoft }]}>
            <SectionLabel size={9}>{t("totalPaidLabel")}</SectionLabel>
            <Text style={[pp.summaryValue, { color: colors.green }]}>{formatCurrency(summary.totalPaid, currency)}</Text>
          </View>
          <View style={pp.summaryItem}>
            <SectionLabel size={9}>{t("loansCountLabel")}</SectionLabel>
            <Text style={[pp.summaryValue, { color: colors.foreground }]}>{summary.loans.length}</Text>
          </View>
        </View>
        {totalProgress > 0 && (
          <View style={{ paddingTop: 12, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[pp.progressLabel, { color: colors.mutedForeground }]}>{t("overallProgress")}</Text>
              <Text style={[pp.progressLabel, { color: colors.foreground }]}>{totalProgress.toFixed(0)}% {t("paidOff")}</Text>
            </View>
            <ProgressBar pct={totalProgress} color={colors.green} />
          </View>
        )}
        {interestSaved !== null && (
          <View style={[pp.interestRow, { borderTopColor: colors.borderSoft }]}>
            <View style={{ flex: 1 }}>
              <SectionLabel size={9}>{t("interestSaved")}</SectionLabel>
              <Text style={[pp.summaryValue, { color: colors.green }]}>{formatCurrency(interestSaved, currency)}</Text>
            </View>
            <Text style={[pp.progressLabel, { color: colors.mutedForeground, alignSelf: "flex-end" }]}>{t("vsMinPayments")}</Text>
          </View>
        )}
      </Card>

      <Card style={pp.calcCard}>
        <Text style={[pp.calcTitle, { color: colors.foreground }]}>{t("calculatePayoff")}</Text>

        <View style={pp.methodRow}>
          {(["snowball", "avalanche"] as const).map((m) => (
            <Pressable
              key={m}
              style={[pp.methodBtn, { borderColor: colors.border }, method === m && { backgroundColor: colors.accent, borderColor: colors.accent }]}
              onPress={() => setMethod(m)}
            >
              <Text style={[pp.methodLabel, { color: method === m ? "#fff" : colors.mutedForeground }]}>
                {m === "snowball" ? t("snowballMethod") : t("avalancheMethod")}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[pp.methodHint, { color: colors.mutedForeground }]}>
          {method === "snowball" ? t("snowballHint") : t("avalancheHint")}
        </Text>

        <View style={pp.budgetRow}>
          <Text style={[pp.budgetLabel, { color: colors.foreground }]}>{t("monthlyBudgetLabel")}</Text>
          <View style={[pp.budgetInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[pp.budgetCurrency, { color: colors.mutedForeground }]}>{currency}</Text>
            <TextInput
              style={[pp.budgetField, { color: colors.foreground }]}
              value={monthlyBudget}
              onChangeText={(v) => setMonthlyBudget(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
              placeholder="e.g. 1000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
        </View>

        <View style={pp.budgetRow}>
          <Text style={[pp.budgetLabel, { color: colors.foreground }]}>{t("aprLabel")}</Text>
          <View style={[pp.budgetInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[pp.budgetField, { color: colors.foreground }]}
              value={aprInput}
              onChangeText={(v) => setAprInput(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
              placeholder="e.g. 18"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Text style={[pp.budgetCurrency, { color: colors.mutedForeground }]}>%</Text>
          </View>
        </View>

        {payoffMonths && payoffDate ? (
          <View style={[pp.result, { backgroundColor: colors.greenBg, borderColor: colors.green }]}>
            <Feather name="check-circle" size={18} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={[pp.resultTitle, { color: colors.green }]}>{t("debtFreeBy")} {payoffDate}</Text>
              <Text style={[pp.resultSub, { color: colors.foreground }]}>
                {payoffMonths === 1 ? t("inOnePayment") : `${payoffMonths} mo (${(payoffMonths / 12).toFixed(1)} yr)`}
                {" · "}{formatCurrency(budget, currency)}/mo
              </Text>
            </View>
          </View>
        ) : (Number.isFinite(budget) && budget > 0) ? null : (
          <View style={[pp.result, { backgroundColor: colors.muted, borderColor: colors.borderSoft }]}>
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text style={[pp.resultSub, { color: colors.mutedForeground }]}>{t("enterBudgetHint")}</Text>
          </View>
        )}
      </Card>

      {orderedLoans.length > 0 && (
        <Card style={{ padding: 14, gap: 2 }}>
          <Text style={[pp.orderTitle, { color: colors.foreground }]}>{t("recommendedPayoffOrder")}</Text>
          <Text style={[pp.orderHint, { color: colors.mutedForeground }]}>
            {method === "snowball" ? t("smallestFirst") : t("largestFirst")}
          </Text>
          {orderedLoans.map((loan, i) => (
            <View key={loan.id} style={[pp.orderRow, { borderTopColor: colors.borderSoft }]}>
              <View style={[pp.orderNum, { backgroundColor: i === 0 ? colors.accent : colors.muted }]}>
                <Text style={[pp.orderNumText, { color: i === 0 ? "#fff" : colors.mutedForeground }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[pp.orderName, { color: colors.foreground }]} numberOfLines={1}>{loan.displayName}</Text>
                <ProgressBar pct={loan.totalAmount > 0 ? (loan.paid / loan.totalAmount) * 100 : 0} color={colors.green} />
              </View>
              <Text style={[pp.orderAmt, { color: colors.red }]}>{formatCurrency(loan.remaining, currency)}</Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const pp = StyleSheet.create({
  wrap: { marginBottom: 24 },
  summaryCard: { padding: 16, gap: 0 },
  summaryRow: { flexDirection: "row" },
  summaryItem: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 6 },
  summaryValue: { fontSize: 16, fontFamily: F.black },
  progressLabel: { fontSize: 11, fontFamily: F.medium },
  calcCard: { padding: 16, gap: 14, marginTop: 10 },
  calcTitle: { fontSize: 14, fontFamily: F.bold },
  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  methodLabel: { fontSize: 13, fontFamily: F.semibold },
  methodHint: { fontSize: 12, fontFamily: F.regular, marginTop: -6 },
  budgetRow: { gap: 8 },
  budgetLabel: { fontSize: 13, fontFamily: F.medium },
  budgetInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  budgetCurrency: { fontSize: 14, fontFamily: F.semibold, marginRight: 6 },
  budgetField: { flex: 1, fontSize: 15, fontFamily: F.regular },
  result: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  resultTitle: { fontSize: 13.5, fontFamily: F.bold },
  resultSub: { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  orderTitle: { fontSize: 13.5, fontFamily: F.bold, marginBottom: 2 },
  orderHint: { fontSize: 11.5, fontFamily: F.regular, marginBottom: 8 },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  orderNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  orderNumText: { fontSize: 11, fontFamily: F.bold },
  orderName: { fontSize: 13, fontFamily: F.medium, marginBottom: 5 },
  orderAmt: { fontSize: 12, fontFamily: F.bold },
  interestRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 12, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
});

// ── Loan Form ────────────────────────────────────────────────────────────────

function LoanForm({ initialDir = "borrowed" as LoanDir, onClose }: { initialDir?: LoanDir; onClose?: () => void }) {
  const colors = useColors();
  const { currency } = useSettings();
  const { t } = useT();
  const add = useAddLoan();
  const { data: profile } = useFinancialProfile();
  const [dir, setDir] = useState<LoanDir>(initialDir);
  const [lenderName, setLenderName] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [account, setAccount] = useState<"cash" | "bank" | "savings" | null>(null);
  const [error, setError] = useState("");

  const accentColor = dir === "lent" ? colors.green : colors.red;
  const accentBg = dir === "lent" ? colors.greenBg : colors.redBg;

  const submit = async () => {
    const amt = parseFloat(totalAmount);
    if (!lenderName.trim() || !Number.isFinite(amt) || amt <= 0) {
      setError(t("personLenderLabel") + " & " + t("amountLabel"));
      return;
    }
    if (!account) { setError(t("selectAccountError")); return; }
    setError("");
    try {
      const created = await add.mutateAsync({
        lenderName: lenderName.trim(),
        description: description.trim() || lenderName.trim(),
        totalAmount: amt,
        dueDate: dueDate.trim() || null,
        account: account ?? undefined,
        direction: dir,
      });
      if (created?.id && monthlyPayment.trim()) {
        const target = parseFloat(monthlyPayment);
        if (Number.isFinite(target) && target > 0) {
          await AsyncStorage.setItem(`loan_monthly_${created.id}`, monthlyPayment.trim());
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLenderName(""); setDescription(""); setTotalAmount(""); setDueDate(""); setMonthlyPayment(""); setAccount(null);
      onClose?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save loan");
    }
  };

  const accountOptions = [
    { key: "cash" as const, label: t("cashLabel"), icon: "dollar-sign", balance: profile?.cashOnHand ?? 0 },
    { key: "bank" as const, label: t("bankLabel"), icon: "credit-card", balance: profile?.bankBalance ?? 0 },
    { key: "savings" as const, label: t("savingsLabel"), icon: "archive", balance: profile?.savingsBalance ?? 0 },
  ];

  return (
    <Card style={fs.card}>
      <Segmented<LoanDir>
        options={[{ key: "borrowed", label: t("borrowed") }, { key: "lent", label: t("lent") }]}
        value={dir}
        onChange={(d) => { setDir(d); setAccount(null); }}
        activeColor={dir === "borrowed" ? colors.red : colors.green}
      />
      <FormInput label={t("personLenderLabel")} value={lenderName} onChangeText={setLenderName} placeholder={t("personLenderPlaceholder")} />
      <FormInput label={t("descriptionOptionalLabel")} value={description} onChangeText={setDescription} placeholder={t("descLoanPlaceholder")} />
      <FormInput label={`${t("amountLabel")} (${currency})`} value={totalAmount} onChangeText={(v) => setTotalAmount(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0.00" keyboardType="decimal-pad" />
      <FormInput label={t("descriptionOptionalLabel").replace("Description", "Due Date")} value={dueDate} onChangeText={setDueDate} placeholder={todayISO()} />
      <FormInput label={`${t("monthlyTargetLabel")} (${currency}, ${t("descriptionOptionalLabel").toLowerCase()})`} value={monthlyPayment} onChangeText={(v) => setMonthlyPayment(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0.00" keyboardType="decimal-pad" />
      <View style={{ gap: 7 }}>
          <SectionLabel>{dir === "lent" ? t("givenFromAccount") : t("receivedIntoAccount")}</SectionLabel>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {accountOptions.map((opt) => {
              const selected = account === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setAccount(opt.key)}
                  style={{ flex: 1, borderRadius: 10, borderWidth: 1.5, padding: 10, gap: 4, alignItems: "center",
                    borderColor: selected ? accentColor : colors.borderSoft,
                    backgroundColor: selected ? accentBg : colors.background,
                  }}
                >
                  <Feather name={opt.icon as "home"} size={15} color={selected ? accentColor : colors.mutedForeground} />
                  <Text style={{ fontSize: 11.5, fontFamily: F.semibold, color: selected ? accentColor : colors.foreground }}>{opt.label}</Text>
                  <Text style={{ fontSize: 10, fontFamily: F.regular, color: colors.mutedForeground }}>{formatCurrency(opt.balance, currency)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      <FormError>{error}</FormError>
      <PrimaryButton label={t("saveLoanBtn")} onPress={submit} loading={add.isPending} />
    </Card>
  );
}

// ── Loan Card ─────────────────────────────────────────────────────────────────

function LoanCard({
  loan, currency, colors,
}: { loan: Loan; currency: string; colors: ReturnType<typeof useColors> }) {
  const { t } = useT();
  const del = useDeleteLoan();
  const addPayment = useAddLoanPayment();
  const { data: profile } = useFinancialProfile();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [payAccount, setPayAccount] = useState<"cash" | "bank" | "savings" | null>(null);
  const [error, setError] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(`loan_monthly_${loan.id}`).then((v) => {
      if (v) setMonthlyTarget(v);
    });
  }, [loan.id]);

  const saveMonthlyTarget = (val: string) => {
    const filtered = val.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setMonthlyTarget(filtered);
    if (filtered.trim()) {
      AsyncStorage.setItem(`loan_monthly_${loan.id}`, filtered.trim());
    } else {
      AsyncStorage.removeItem(`loan_monthly_${loan.id}`);
    }
  };

  const dir = getLoanDir(loan);
  const name = getDisplayName(loan);
  const accent = dir === "borrowed" ? colors.red : colors.green;
  const accentBg = dir === "borrowed" ? colors.redBg : colors.greenBg;

  const loanTotal = Number(loan.totalAmount) || 0;
  const paid = useMemo(
    () => (loan.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [loan.payments],
  );
  const remaining = Math.max(loanTotal - paid, 0);
  const pct = loanTotal > 0 ? Math.min((paid / loanTotal) * 100, 100) : 0;

  const avgMonthlyPayment = useMemo(() => {
    const payments = loan.payments ?? [];
    if (payments.length === 0) return 0;
    const monthlyMap = new Map<string, number>();
    for (const p of payments) {
      const key = monthKey(p.paidAt);
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + (Number(p.amount) || 0));
    }
    const vals = Array.from(monthlyMap.values());
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }, [loan.payments]);

  const thisMonthPaid = useMemo(() => {
    const ym = monthKey(new Date());
    return (loan.payments ?? [])
      .filter((p) => monthKey(p.paidAt) === ym)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [loan.payments]);

  const effectiveMonthly = useMemo(
    () => (avgMonthlyPayment > 0 ? avgMonthlyPayment : (parseFloat(monthlyTarget) || 0)),
    [avgMonthlyPayment, monthlyTarget],
  );

  const monthlyPct = effectiveMonthly > 0
    ? Math.min((thisMonthPaid / effectiveMonthly) * 100, 100)
    : 0;

  const debtFreeDate = useMemo(() => {
    if (remaining <= 0 || effectiveMonthly <= 0) return null;
    const months = Math.ceil(remaining / effectiveMonthly);
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }, [remaining, effectiveMonthly]);

  const confirmDelete = () => {
    Alert.alert(t("deleteLoanTitle"), `${t("delete")} "${name}"?`, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"), style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          del.mutate(loan.id);
        },
      },
    ]);
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid amount"); return; }
    if (!payAccount) { setError(t("selectAccountError")); return; }
    setError("");
    try {
      await addPayment.mutateAsync({ loanId: loan.id, amount: amt, note: null, account: payAccount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount(""); setPayAccount(null); setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to record payment");
    }
  };

  return (
    <Card style={cs.card}>
      <View style={[cs.accentBar, { backgroundColor: accent }]} />
      <View style={cs.cardInner}>
        <View style={cs.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[cs.loanName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
            {loan.description && loan.description !== name && (
              <Text style={[cs.loanDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{loan.description}</Text>
            )}
          </View>
          <Pressable onPress={confirmDelete} hitSlop={10} style={cs.deleteBtn}>
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={[cs.statGrid, { backgroundColor: colors.mutedSoft, borderColor: colors.borderSoft }]}>
          <View style={cs.statCell}>
            <SectionLabel size={9}>{t("totalLoanLabel")}</SectionLabel>
            <Text style={[cs.statValue, { color: colors.foreground }]}>{formatCurrency(loanTotal, currency)}</Text>
          </View>
          <View style={[cs.statCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.borderSoft }]}>
            <SectionLabel size={9}>{t("paidLoanLabel")}</SectionLabel>
            <Text style={[cs.statValue, { color: colors.green }]}>{formatCurrency(paid, currency)}</Text>
          </View>
          <View style={cs.statCell}>
            <SectionLabel size={9}>{t("leftLabel")}</SectionLabel>
            <Text style={[cs.statValue, { color: accent }]}>{formatCurrency(remaining, currency)}</Text>
          </View>
        </View>

        <ProgressBar pct={pct} color={accent} />

        {effectiveMonthly > 0 ? (
          <View style={cs.monthRow}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
              <Text style={[cs.monthLabel, { color: colors.mutedForeground }]}>
                {t("monthProgressLabel")}: {monthlyPct.toFixed(0)}% {t("ofTarget")}
              </Text>
              <Text style={[cs.monthLabel, { color: colors.mutedForeground }]}>
                {formatCurrency(thisMonthPaid, currency)} / {formatCurrency(effectiveMonthly, currency)}
              </Text>
            </View>
            <ProgressBar pct={monthlyPct} color={colors.accent} />
          </View>
        ) : remaining > 0 ? (
          <View style={cs.monthRow}>
            <Text style={[cs.monthLabel, { color: colors.mutedForeground, marginBottom: 5 }]}>
              {t("monthlyTargetLabel")} ({t("noPaymentEst")})
            </Text>
            <View style={[cs.targetInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[cs.targetField, { color: colors.foreground }]}
                value={monthlyTarget}
                onChangeText={saveMonthlyTarget}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
          </View>
        ) : null}

        <View style={cs.cardFooter}>
          <View style={[cs.pctBadge, { backgroundColor: accentBg }]}>
            <Text style={[cs.pctText, { color: accent }]}>{pct.toFixed(0)}{t("percentPaidSuffix")}</Text>
          </View>
          {loan.dueDate && <Text style={[cs.due, { color: colors.mutedForeground }]}>{t("dueLabel")} {formatDate(loan.dueDate)}</Text>}
          {debtFreeDate && (
            <Text style={[cs.due, { color: colors.mutedForeground }]}>🎯 {t("debtFreeEst")} {debtFreeDate}</Text>
          )}
          <View style={{ flex: 1 }} />
          <Pressable
            style={[cs.payBtn, { backgroundColor: colors.secondary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpen((v) => !v); }}
          >
            <Text style={[cs.payBtnText, { color: colors.foreground }]}>{open ? t("cancel") : t("recordPaymentBtn")}</Text>
          </Pressable>
        </View>

        {open && (
          <View style={[cs.payForm, { borderTopColor: colors.borderSoft }]}>
            <FormInput label={`${t("paymentAmountLabel")} (${currency})`} value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
            <View style={{ gap: 7 }}>
              <SectionLabel>{t("paidFromAccount")}</SectionLabel>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([
                  { key: "cash" as const, label: t("cashLabel"), icon: "dollar-sign", balance: profile?.cashOnHand ?? 0 },
                  { key: "bank" as const, label: t("bankLabel"), icon: "credit-card", balance: profile?.bankBalance ?? 0 },
                  { key: "savings" as const, label: t("savingsLabel"), icon: "archive", balance: profile?.savingsBalance ?? 0 },
                ]).map((opt) => {
                  const selected = payAccount === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setPayAccount(opt.key)}
                      style={{ flex: 1, borderRadius: 10, borderWidth: 1.5, padding: 10, gap: 4, alignItems: "center",
                        borderColor: selected ? accent : colors.borderSoft,
                        backgroundColor: selected ? accentBg : colors.background,
                      }}
                    >
                      <Feather name={opt.icon as "home"} size={15} color={selected ? accent : colors.mutedForeground} />
                      <Text style={{ fontSize: 11.5, fontFamily: F.semibold, color: selected ? accent : colors.foreground }}>{opt.label}</Text>
                      <Text style={{ fontSize: 10, fontFamily: F.regular, color: colors.mutedForeground }}>{formatCurrency(opt.balance, currency)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <FormError>{error}</FormError>
            <PrimaryButton label={t("recordPaymentBtn")} onPress={submit} loading={addPayment.isPending} />
          </View>
        )}
      </View>
    </Card>
  );
}

// ── Due Soon Section ──────────────────────────────────────────────────────────

type DueSoonItem = { loan: Loan; days: number };

function DueSoonSection({
  items, currency, colors,
}: { items: DueSoonItem[]; currency: string; colors: ReturnType<typeof useColors> }) {
  const { t } = useT();
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  return (
    <View style={[ds.wrap, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
      <Pressable
        style={ds.header}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCollapsed((v) => !v); }}
      >
        <View style={ds.headerLeft}>
          <View style={[ds.dot, { backgroundColor: colors.red }]} />
          <Text style={[ds.headerTitle, { color: colors.foreground }]}>Upcoming Payments</Text>
          <View style={[ds.badge, { backgroundColor: colors.red }]}>
            <Text style={ds.badgeText}>{items.length}</Text>
          </View>
        </View>
        <Feather name={collapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.mutedForeground} />
      </Pressable>

      {!collapsed && items.map(({ loan, days }) => {
        const name = getDisplayName(loan);
        const dir = getLoanDir(loan);
        const loanPaid = (loan.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const loanRemaining = Math.max((Number(loan.totalAmount) || 0) - loanPaid, 0);
        const isOverdue = days < 0;
        const isToday = days === 0;
        const urgencyColor = isOverdue ? colors.red : colors.amber;
        const urgencyBg = isOverdue ? colors.redBg : colors.accentBg;
        const urgencyText = isOverdue
          ? `${t("overdue")} ${Math.abs(days)}d`
          : isToday
          ? t("todayLabel")
          : `${days}d ${t("daysLeft")}`;

        return (
          <View key={loan.id} style={[ds.item, { borderTopColor: colors.borderSoft }]}>
            <View style={[ds.itemAccent, { backgroundColor: isOverdue ? colors.red : colors.amber }]} />
            <View style={ds.itemBody}>
              <Text style={[ds.itemName, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
              <Text style={[ds.itemMeta, { color: colors.mutedForeground }]}>
                {dir === "borrowed" ? t("borrowed") : t("lent")} · {formatCurrency(loanRemaining, currency)} {t("leftLabel")}
              </Text>
            </View>
            <View style={[ds.urgencyBadge, { backgroundColor: urgencyBg }]}>
              <Text style={[ds.urgencyText, { color: urgencyColor }]}>{urgencyText}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const ds = StyleSheet.create({
  wrap: { borderRadius: 14, borderWidth: 1, marginBottom: 16, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 13.5, fontFamily: F.bold },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: F.bold, color: "#fff" },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  itemAccent: { width: 3, alignSelf: "stretch" },
  itemBody: { flex: 1, paddingLeft: 8 },
  itemName: { fontSize: 13.5, fontFamily: F.semibold },
  itemMeta: { fontSize: 11.5, fontFamily: F.regular, marginTop: 2 },
  urgencyBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  urgencyText: { fontSize: 11.5, fontFamily: F.bold },
});

const fs = StyleSheet.create({
  card: { padding: 16, marginBottom: 16, gap: 14 },
});

const hs = StyleSheet.create({
  cell: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 3 },
  label: { fontSize: 9.5, fontFamily: F.semibold, textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 14, fontFamily: F.black, letterSpacing: -0.2 },
});

const cs = StyleSheet.create({
  card: { marginBottom: 12 },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, zIndex: 1 },
  cardInner: { padding: 16, paddingLeft: 18 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 },
  loanName: { fontSize: 15, fontFamily: F.bold },
  loanDesc: { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  deleteBtn: { padding: 4 },
  statGrid: { flexDirection: "row", borderRadius: 10, borderWidth: 1, paddingVertical: 11, marginBottom: 12 },
  statCell: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 13, fontFamily: F.black, letterSpacing: -0.3 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
  pctBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pctText: { fontSize: 11, fontFamily: F.bold },
  due: { fontSize: 11, fontFamily: F.medium },
  payBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  payBtnText: { fontSize: 12, fontFamily: F.semibold },
  payForm: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, gap: 12 },
  monthRow: { marginTop: 10 },
  monthLabel: { fontSize: 10.5, fontFamily: F.medium },
  targetInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  targetField: { flex: 1, fontSize: 13, fontFamily: F.regular },
});

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
    scroll: { paddingHorizontal: hz, paddingTop: 18, paddingBottom: 110 },
    tabsWrap: { paddingBottom: 16 },
    loading: { paddingVertical: 52, justifyContent: "center", alignItems: "center" },
    empty: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 50, paddingHorizontal: 20 },
    emptyIcon: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    emptyTitle: { fontSize: 17, fontFamily: F.semibold, color: colors.foreground },
    emptyText: { fontSize: 13.5, color: colors.mutedForeground, fontFamily: F.regular, textAlign: "center", lineHeight: 20 },
  });
}
