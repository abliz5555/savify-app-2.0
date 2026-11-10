import { Feather } from "@expo/vector-icons";
import { APP_CONFIG } from "@/lib/config";
import { BudgetAlerts, MiniTiles } from "@/components/HomeWidgets";
import { ActionTiles, AnimatedGlow, BalanceCard, balanceHistory } from "@/components/HomeHero";
import { CATEGORY_ICON, CategoryDonut, MonthSummary } from "@/components/HomeCharts";
import { useQuickAdd } from "@/components/QuickAddSheet";
import Animated, { FadeInDown } from "react-native-reanimated";
import { setStatusBarStyle } from "expo-status-bar";
import { billDueDate, daysUntil } from "@/lib/bills";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { markSetupSeen, getSetupSeen } from "@/lib/setupSeen";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAddTransaction, useFinanceData, useFinancialProfile, useGenerateTestData } from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSubscription } from "@/lib/revenuecat";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { formatCurrency, formatShortDate, EXPENSE_CATEGORIES, INCOME_CATEGORIES, monthKey, formatCompact } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Transaction } from "@/lib/types";
import {
  Badge, Card, CategoryPicker, F, FormError, FormInput, ListCard,
  PrimaryButton, ProgressBar, SectionLabel, StatTile,
} from "@/components/ui";
import { SvgGroupedBarChart } from "@/components/charts";
import type { GroupedBarDataPoint } from "@/components/charts";
import { ScanBillModal, AIAnalysisModal, PDFReportModal } from "@/components/premium-features";
import { CoachCard } from "@/components/CoachCard";

type TxType = "expense" | "income";

const BAR_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

function getGreeting(name: string, morning: string, afternoon: string, evening: string): string {
  const h = new Date().getHours();
  const time = h < 12 ? morning : h < 17 ? afternoon : evening;
  return name ? `${time}, ${name} 👋` : `${time} 👋`;
}



function calcHealthScore(
  monthIncome: number, monthExpenses: number,
  totalLoans: number, budgetGoals: { spent: number; monthlyLimit: number }[],
  labels: { savingsRate: string; cashFlow: string; debtLevel: string; budgetGoals: string } = {
    savingsRate: "Savings Rate", cashFlow: "Cash Flow", debtLevel: "Debt Level", budgetGoals: "Budget Goals",
  },
): { score: number; breakdown: { label: string; score: number; max: number }[] } {
  let savings = monthIncome > 0
    ? (() => { const r = (monthIncome - monthExpenses) / monthIncome; return r >= 0.2 ? 25 : r >= 0.1 ? 18 : r >= 0.05 ? 12 : r > 0 ? 6 : 0; })()
    : 10;
  let cashFlow = monthIncome === 0 && monthExpenses === 0 ? 15
    : monthIncome > monthExpenses ? 25
    : monthIncome === 0 ? 5
    : Math.round(Math.max((monthIncome / Math.max(monthExpenses, 1)) * 25, 0));
  let debt = totalLoans === 0 ? 25
    : monthIncome > 0 ? (() => { const m = totalLoans / monthIncome; return m < 3 ? 22 : m < 6 ? 17 : m < 12 ? 12 : 5; })()
    : 10;
  let budget = budgetGoals.length === 0 ? 15
    : Math.round((budgetGoals.filter((g) => g.spent <= g.monthlyLimit).length / budgetGoals.length) * 25);
  return {
    score: Math.min(savings + cashFlow + debt + budget, 100),
    breakdown: [
      { label: labels.savingsRate, score: savings, max: 25 },
      { label: labels.cashFlow, score: cashFlow, max: 25 },
      { label: labels.debtLevel, score: debt, max: 25 },
      { label: labels.budgetGoals, score: budget, max: 25 },
    ],
  };
}

export default function OverviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currency, displayName } = useSettings();
  const { isSubscribed } = useSubscription();
  const { t, tCat } = useT();
  const router = useRouter();
  const { userId } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useFinanceData();
  const { data: profile } = useFinancialProfile();
  const sampleData = useGenerateTestData();
  const quickAdd = useQuickAdd();

  const [actionOpen, setActionOpen] = useState(false);
  const [txSheet, setTxSheet] = useState<TxType | null>(null);
  const [setupSeen, setSetupSeen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getSetupSeen(userId).then(seen => { if (seen) setSetupSeen(true); });
  }, [userId]);

  const showSetupCard = !isLoading && !isError && profile === null && !setupSeen;

  const dismissSetup = useCallback(async () => {
    setSetupSeen(true);
    if (userId) await markSetupSeen(userId);
  }, [userId]);

  // Home has a dark header → light status bar while Home is open
  useFocusEffect(useCallback(() => {
    setStatusBarStyle("light");
    return () => { setActionOpen(false); setStatusBarStyle(colors.isDark ? "light" : "dark"); };
  }, [colors.isDark]));
  const [scanVisible, setScanVisible] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const prefix = monthKey(new Date());

  const stats = useMemo(() => {
    if (!data) return { net: 0, monthIncome: 0, monthExpenses: 0, totalLoans: 0, totalDebts: 0, totalLent: 0, totalAssets: 0 };
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const monthTx = data.transactions.filter((tx) => monthKey(tx.createdAt) === prefix);
    const monthIncome = monthTx.filter((tx) => tx.type === "income").reduce((s, tx) => s + n(tx.amount), 0);
    const monthExpenses = monthTx.filter((tx) => tx.type === "expense").reduce((s, tx) => s + n(tx.amount), 0);
    const allIncome = data.transactions.filter((tx) => tx.type === "income").reduce((s, tx) => s + n(tx.amount), 0);
    const allExpenses = data.transactions.filter((tx) => tx.type === "expense").reduce((s, tx) => s + n(tx.amount), 0);
    const net = allIncome - allExpenses;
    const loanRemaining = (l: (typeof data.loans)[0]) => {
      const paid = (l.payments ?? []).reduce((a: number, p: { amount: unknown }) => a + n(p.amount), 0);
      return Math.max(n(l.totalAmount) - paid, 0);
    };
    const totalLoans = data.loans.reduce((s, l) => s + loanRemaining(l), 0);
    const totalDebts = data.loans.filter((l) => l.direction !== "lent").reduce((s, l) => s + loanRemaining(l), 0);
    const totalLent = data.loans.filter((l) => l.direction === "lent").reduce((s, l) => s + loanRemaining(l), 0);
    const totalAssets = Math.max(net, 0) + data.savingsGoals.reduce((s, g) => s + n(g.currentAmount), 0);
    return { net, monthIncome, monthExpenses, totalLoans, totalDebts, totalLent, totalAssets };
  }, [data, prefix]);

  const budgetGoals = useMemo(() => {
    if (!data) return [];
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    return data.budgetGoals.map((bg) => {
      const spent = data.transactions
        .filter((tx) => tx.type === "expense" && tx.category === bg.category && monthKey(tx.createdAt) === prefix)
        .reduce((s, tx) => s + n(tx.amount), 0);
      return { ...bg, spent };
    });
  }, [data, prefix]);

  const categorySpending = useMemo(() => {
    if (!data) return [];
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const map: Record<string, number> = {};
    data.transactions
      .filter((tx) => tx.type === "expense" && monthKey(tx.createdAt) === prefix)
      .forEach((tx) => { map[tx.category] = (map[tx.category] ?? 0) + n(tx.amount); });
    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [data, prefix]);

  const upcomingBills = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return data.recurring
      .filter((r) => r.active)
      .map((r) => ({ ...r, daysUntil: daysUntil(billDueDate(r)) }))
      .filter((r) => r.daysUntil >= -1 && r.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 4);
  }, [data]);

  const recentTx = useMemo(() => {
    if (!data) return [];
    return [...data.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  }, [data]);

  const sixMonthTrend = useMemo<GroupedBarDataPoint[]>(() => {
    if (!data) return [];
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en", { month: "short" });
      const income = data.transactions
        .filter((tx) => tx.type === "income" && monthKey(tx.createdAt) === prefix)
        .reduce((s, tx) => s + tx.amount, 0);
      const expense = data.transactions
        .filter((tx) => tx.type === "expense" && monthKey(tx.createdAt) === prefix)
        .reduce((s, tx) => s + tx.amount, 0);
      return { label, income, expense };
    });
  }, [data]);

  const { score, breakdown } = useMemo(
    () => calcHealthScore(stats.monthIncome, stats.monthExpenses, stats.totalDebts, budgetGoals, {
      savingsRate: t("savingsRate"), cashFlow: t("cashFlow"), debtLevel: t("debtLevel"), budgetGoals: t("budgetGoals"),
    }),
    [stats, budgetGoals, t],
  );

  // Header height = safe area top + inner content (greeting ~24 + badge/sub ~20 + padding 10+14)
  const { isTablet, hz } = useLayout();
  const topInsets = Platform.OS === "web" ? 0 : insets.top;
  const bottomInsets = Platform.OS === "web" ? 0 : insets.bottom;
  const fabBottom = Platform.OS === "web" ? 80 : bottomInsets + 68;

  // Net Balance = profile liquid cash (cash + bank + savings) when available,
  // otherwise fall back to transaction-based income - expenses
  const netBalance = profile
    ? (profile.cashOnHand + profile.bankBalance + profile.savingsBalance)
    : stats.net;
  const isPositive = netBalance >= 0;
  const scoreColor = score >= 80 ? colors.green : score >= 60 ? colors.blue : score >= 40 ? colors.amberFill : colors.red;
  const scoreLabel = score >= 80 ? t("scoreExcellent") : score >= 60 ? t("scoreGood") : score >= 40 ? t("scoreFair") : t("scoreNeedsWork");

  const openUpgradePrompt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionOpen(false);
    router.push("/pro");
  };

  const openPremium = (open: () => void) => {
    setActionOpen(false);
    if (!isSubscribed) { openUpgradePrompt(); return; }
    setTimeout(open, 220);
  };

  const actions = [
    {
      icon: "arrow-up-right" as const, label: t("addExpense"), desc: t("addExpenseDesc"),
      iconBg: colors.redBg, iconColor: colors.red, premium: false,
      onPress: () => { setActionOpen(false); setTimeout(() => setTxSheet("expense"), 220); },
    },
    {
      icon: "arrow-down-left" as const, label: t("addIncome"), desc: t("addIncomeDesc"),
      iconBg: colors.greenBg, iconColor: colors.green, premium: false,
      onPress: () => { setActionOpen(false); setTimeout(() => setTxSheet("income"), 220); },
    },
    {
      icon: "camera" as const, label: t("scanReceipt"), desc: t("scanReceiptDesc"),
      iconBg: colors.accentBg, iconColor: colors.accent, premium: !isSubscribed,
      onPress: () => openPremium(() => setScanVisible(true)),
    },
    {
      icon: "cpu" as const, label: t("aiExpenseAnalysis"), desc: t("aiAnalysisDesc"),
      iconBg: colors.blueBg, iconColor: colors.blue, premium: !isSubscribed,
      onPress: () => openPremium(() => setAnalysisVisible(true)),
    },
    {
      icon: "file-text" as const, label: t("expensePdfReport"), desc: t("pdfReportDesc"),
      iconBg: colors.muted, iconColor: colors.mutedForeground, premium: !isSubscribed,
      onPress: () => openPremium(() => setReportVisible(true)),
    },
  ];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, gap: 16 }}>
        <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: colors.redBg, alignItems: "center", justifyContent: "center" }}>
          <Feather name="wifi-off" size={26} color={colors.red} />
        </View>
        <Text style={{ fontSize: 18, fontFamily: F.bold, color: colors.foreground, textAlign: "center" }}>{t("loadError")}</Text>
        <Text style={{ fontSize: 13.5, fontFamily: F.regular, color: colors.mutedForeground, textAlign: "center", lineHeight: 20 }}>
          {t("loadErrorHint")}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={{ backgroundColor: "#1a1a1a", paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, marginTop: 4 }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 14, fontFamily: F.semibold, color: "#fff" }}>{t("retry")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const monthNet = stats.monthIncome - stats.monthExpenses;
  const history = data ? balanceHistory(data.transactions, netBalance, 30) : [];
  const dueSoon = upcomingBills.filter((b) => b.daysUntil <= 3).length;
  const avatarLetter = (displayName || "S").slice(0, 1).toUpperCase();
  const HEADER_H = topInsets + 330;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ffffff" />}
      >
        {/* ── Dark animated top area ── */}
        <View style={{ paddingTop: topInsets + 8, paddingHorizontal: hz }}>
          <AnimatedGlow height={HEADER_H} />

          <View style={styles.topBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Image source={require("../../assets/images/icon.png")} style={styles.logo} />
              <Text style={styles.brand}>Savify</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => router.push("/(tabs)/bills")} style={styles.roundBtn} accessibilityLabel={`Bills${dueSoon ? `, ${dueSoon} due soon` : ""}`}>
                <Feather name="bell" size={19} color="#fff" />
                {dueSoon > 0 && <View style={[styles.dot, { backgroundColor: colors.red }]} />}
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/settings")} style={[styles.roundBtn, { backgroundColor: "rgba(255,255,255,0.16)" }]} accessibilityLabel="Settings">
                <Text style={{ color: "#fff", fontFamily: F.bold, fontSize: 15 }}>{avatarLetter}</Text>
              </Pressable>
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(450)} style={{ marginTop: 18, marginBottom: 18 }}>
            <Text style={styles.hello} numberOfLines={1} adjustsFontSizeToFit>
              {getGreeting(displayName, t("greetingMorning"), t("greetingAfternoon"), t("greetingEvening"))}
            </Text>
            <Text style={styles.helloSub}>Here's your money today</Text>
          </Animated.View>

          <BalanceCard
            currency={currency}
            total={netBalance}
            history={history}
            monthNet={monthNet}
            cash={profile?.cashOnHand ?? 0}
            bank={profile?.bankBalance ?? 0}
            savings={profile?.savingsBalance ?? 0}
            onEdit={() => router.push("/financial-setup")}
          />

          <View style={{ marginTop: 16 }}>
            <ActionTiles tiles={[
              { key: "speak", icon: "mic", label: "Tell Savify", primary: true, onPress: () => quickAdd.open({ listen: true }) },
              { key: "scan", icon: "camera", label: "Scan", onPress: () => setScanVisible(true) },
              { key: "bills", icon: "calendar", label: "Bills", onPress: () => router.push("/(tabs)/bills") },
              { key: "report", icon: "bar-chart-2", label: "Reports", onPress: () => setReportVisible(true) },
            ]} />
          </View>
        </View>

        <View style={{ paddingHorizontal: hz, marginTop: 22, gap: 24 }}>
          {/* Setup prompt for new users */}
          {showSetupCard && (
            <Animated.View entering={FadeInDown.duration(400)} style={[styles.setupCard, { backgroundColor: colors.card, borderColor: colors.accent + "40" }]}>
              <View style={styles.setupCardRow}>
                <View style={[styles.setupIconWrap, { backgroundColor: colors.accentBg }]}>
                  <Feather name="sliders" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.setupTitle, { color: colors.foreground }]}>{t("setupCardTitle")}</Text>
                  <Text style={[styles.setupDesc, { color: colors.mutedForeground }]}>{t("setupCardDesc")}</Text>
                </View>
                <Pressable style={[styles.setupCloseBtn, { backgroundColor: colors.muted }]} onPress={dismissSetup} hitSlop={8}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={styles.setupCardActions}>
                <Pressable style={({ pressed }) => [styles.setupBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]} onPress={() => router.push("/financial-setup")}>
                  <Feather name="arrow-right" size={13} color={colors.accentForeground} />
                  <Text style={[styles.setupBtnText, { color: colors.accentForeground }]}>{t("setupCardCta")}</Text>
                </Pressable>
                <Pressable onPress={dismissSetup} hitSlop={8}>
                  <Text style={[styles.setupLater, { color: colors.mutedForeground }]}>{t("setupCardLater")}</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {!data?.transactions.length ? (
            <Animated.View entering={FadeInDown.delay(200).duration(450)} style={[styles.empty, { backgroundColor: colors.card, borderRadius: 24 }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accentBg }]}>
                <Feather name="mic" size={30} color={colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Add your first expense</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap “Tell Savify” and just say it — like “Lunch 35 cash”. Savify fills in the rest.
              </Text>
              <Pressable onPress={() => quickAdd.open()} style={({ pressed }) => ({ marginTop: 18, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, opacity: pressed ? 0.85 : 1 })}>
                <Text style={{ color: colors.primaryForeground, fontFamily: F.semibold, fontSize: 15 }}>Add a transaction</Text>
              </Pressable>
              <Pressable
                hitSlop={8}
                disabled={sampleData.isPending}
                onPress={() => Alert.alert(
                  "Try Savify with sample data?",
                  "We'll fill the app with example income, expenses, bills and a loan so you can see how everything works.\n\nRemove it any time: Settings → Reset data.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Load sample data", onPress: () => sampleData.mutateAsync().catch((e) => Alert.alert("Could not load", e instanceof Error ? e.message : "Please try again.")) },
                  ],
                )}
                style={{ marginTop: 14 }}
              >
                <Text style={{ color: colors.accent, fontFamily: F.semibold, fontSize: 14 }}>
                  {sampleData.isPending ? "Loading sample data…" : "Or explore with sample data"}
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              <BudgetAlerts budgets={budgetGoals} currency={currency} labelFn={tCat} onPress={() => router.push("/(tabs)/expenses")} />

              <MonthSummary currency={currency} income={stats.monthIncome} expenses={stats.monthExpenses} onPress={() => router.push("/(tabs)/expenses")} />

              <CategoryDonut
                currency={currency}
                items={categorySpending}
                total={stats.monthExpenses}
                labelFn={tCat}
                onPress={() => router.push("/(tabs)/expenses")}
              />

              <Animated.View entering={FadeInDown.delay(320).duration(450)}>
                <CoachCard data={data} currency={currency} isSubscribed={isSubscribed} onUpgrade={openUpgradePrompt} />
              </Animated.View>

              {upcomingBills.length > 0 && (
                <Animated.View entering={FadeInDown.delay(360).duration(450)}>
                  <View style={styles.secHead}>
                    <Text style={[styles.secTitle, { color: colors.foreground }]}>{t("upcomingBills")}</Text>
                    <Pressable onPress={() => router.push("/(tabs)/bills")} hitSlop={8}><Text style={{ color: colors.accent, fontFamily: F.semibold, fontSize: 13.5 }}>All bills</Text></Pressable>
                  </View>
                  <ListCard>
                    {upcomingBills.map((b) => (
                      <View key={b.id} style={styles.billRow}>
                        <View style={[styles.billIcon, { backgroundColor: b.daysUntil <= 1 ? colors.redBg : colors.muted }]}>
                          <Feather name={CATEGORY_ICON[b.category] ?? "calendar"} size={15} color={b.daysUntil <= 1 ? colors.red : colors.mutedForeground} />
                        </View>
                        <View style={styles.billInfo}>
                          <Text style={[styles.billName, { color: colors.foreground }]} numberOfLines={1}>{b.name}</Text>
                          <Text style={[styles.billMeta, { color: b.daysUntil <= 1 ? colors.red : colors.mutedForeground }]}>
                            {b.daysUntil < 0 ? "Overdue" : b.daysUntil === 0 ? t("dueTodayExclaim") : b.daysUntil === 1 ? "Due tomorrow" : `${t("dueIn")} ${b.daysUntil} ${t("dayPlural")}`}
                          </Text>
                        </View>
                        <Text style={[styles.billAmt, { color: colors.foreground }]}>{formatCurrency(b.amount, currency)}</Text>
                      </View>
                    ))}
                  </ListCard>
                </Animated.View>
              )}

              {sixMonthTrend.some((m) => m.income > 0 || m.expense > 0) && (
                <Animated.View entering={FadeInDown.delay(400).duration(450)}>
                  <View style={styles.secHead}>
                    <Text style={[styles.secTitle, { color: colors.foreground }]}>{t("sixMonthTrend")}</Text>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
                        <Text style={{ fontSize: 12, fontFamily: F.medium, color: colors.mutedForeground }}>{t("income")}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.isDark ? "#94a3b8" : "#cbd5e1" }} />
                        <Text style={{ fontSize: 12, fontFamily: F.medium, color: colors.mutedForeground }}>{t("expenses")}</Text>
                      </View>
                    </View>
                  </View>
                  <Card style={{ padding: 16 }}>
                    <SvgGroupedBarChart data={sixMonthTrend} incomeColor={colors.accent} expenseColor={colors.isDark ? "#94a3b8" : "#cbd5e1"} colors={colors} />
                  </Card>
                </Animated.View>
              )}

              {recentTx.length > 0 && (
                <Animated.View entering={FadeInDown.delay(440).duration(450)}>
                  <View style={styles.secHead}>
                    <Text style={[styles.secTitle, { color: colors.foreground }]}>{t("recentActivity")}</Text>
                    <Pressable onPress={() => router.push("/view-all")} hitSlop={8}><Text style={{ color: colors.accent, fontFamily: F.semibold, fontSize: 13.5 }}>See all</Text></Pressable>
                  </View>
                  <ListCard>
                    {recentTx.map((tx) => (
                      <TxRow key={tx.id} tx={tx} currency={currency} colors={colors} />
                    ))}
                  </ListCard>
                </Animated.View>
              )}

              <MiniTiles items={[
                { label: t("assets"), value: formatCompact(stats.totalAssets, currency), color: colors.green, icon: "briefcase" },
                { label: t("debts"), value: formatCompact(stats.totalDebts, currency), color: stats.totalDebts > 0 ? colors.red : colors.mutedForeground, icon: "credit-card" },
                { label: t("lent"), value: formatCompact(stats.totalLent, currency), color: colors.blue, icon: "send" },
              ]} />
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Old quick-add form (kept for "+ Expense / + Income" deep links) ── */}
      <Modal visible={txSheet !== null} transparent animationType="fade" onRequestClose={() => setTxSheet(null)}>
        <KeyboardAvoidingView style={ms.kvOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setTxSheet(null)} />
          <View style={[ms.sheet, { backgroundColor: colors.card }]}>
            <View style={[ms.handle, { backgroundColor: colors.borderSoft }]} />
            <View style={ms.sheetHeader}>
              <Text style={[ms.sheetTitle, { color: colors.foreground }]}>
                {txSheet === "expense" ? t("addExpense") : txSheet === "income" ? t("addIncome") : ""}
              </Text>
              <TouchableOpacity onPress={() => setTxSheet(null)} hitSlop={10} style={[ms.closeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {txSheet !== null && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 12 }}>
                <QuickTxForm type={txSheet} currency={currency} colors={colors} onDone={() => setTxSheet(null)} />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScanBillModal visible={scanVisible} onClose={() => setScanVisible(false)} />
      <AIAnalysisModal visible={analysisVisible} onClose={() => setAnalysisVisible(false)} />
      <PDFReportModal visible={reportVisible} onClose={() => setReportVisible(false)} />
    </View>
  );
}

// ── Mini stat inside balance card ────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 9, fontFamily: F.semibold, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, fontFamily: F.bold, color }} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ── Quick Transaction Form ────────────────────────────────────────────────────

type AccountType = "cash" | "bank" | "savings";

function QuickTxForm({ type, currency, colors, onDone }: {
  type: TxType; currency: string; colors: ReturnType<typeof useColors>; onDone: () => void;
}) {
  const add = useAddTransaction();
  const { data: profile } = useFinancialProfile();
  const { t, tCat } = useT();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(type === "expense" ? "Other" : "Salary");
  const [account, setAccount] = useState<AccountType | null>(null);
  const [error, setError] = useState("");
  const isExpense = type === "expense";
  const accentColor = isExpense ? colors.red : colors.green;

  const accountOptions: { key: AccountType; label: string; icon: string; balance: number }[] = [
    { key: "cash",    label: t("cashLabel"),    icon: "dollar-sign", balance: profile?.cashOnHand ?? 0 },
    { key: "bank",    label: t("bankLabel"),    icon: "credit-card", balance: profile?.bankBalance ?? 0 },
    { key: "savings", label: t("savingsLabel"), icon: "archive",     balance: profile?.savingsBalance ?? 0 },
  ];

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!description.trim()) { setError("Enter a description"); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid amount"); return; }
    if (!account) { setError("Please select an account"); return; }
    setError("");
    try {
      await add.mutateAsync({ type, description: description.trim(), amount: amt, category, account });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to save"); }
  };

  return (
    <View style={{ gap: 14, paddingBottom: 4 }}>
      <FormInput label={`${t("amountLabel")} (${currency})`} value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
      <FormInput label={t("descriptionLabel")} value={description} onChangeText={setDescription} placeholder={isExpense ? t("descExpensePlaceholder") : t("descIncomePlaceholder")} />
      <View style={{ gap: 7 }}>
        <SectionLabel>{t("categoryLabel")}</SectionLabel>
        <CategoryPicker categories={isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES} value={category} onChange={setCategory} labelFn={tCat} />
      </View>
      {/* Account picker — required for every transaction */}
      <View style={{ gap: 7 }}>
        <SectionLabel>{t("account")}</SectionLabel>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {accountOptions.map((opt) => {
            const selected = account === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => { setAccount(opt.key); setError(""); }}
                style={{
                  flex: 1, borderRadius: 12, padding: 10, gap: 4,
                  borderWidth: 1.5,
                  borderColor: selected ? accentColor : colors.borderSoft,
                  backgroundColor: selected ? (isExpense ? colors.redBg : colors.greenBg) : colors.muted,
                  alignItems: "center",
                }}
              >
                <Feather name={opt.icon as "home"} size={14} color={selected ? accentColor : colors.mutedForeground} />
                <Text style={{ fontSize: 11, fontFamily: F.semibold, color: selected ? accentColor : colors.foreground }}>
                  {opt.label}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: F.regular, color: colors.mutedForeground }} adjustsFontSizeToFit numberOfLines={1}>
                  {formatCurrency(opt.balance, currency)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {account && (
          <Text style={{ fontSize: 11, fontFamily: F.regular, color: colors.mutedForeground, textAlign: "center" }}>
            {isExpense ? "Deducted from" : "Added to"} {accountOptions.find(o => o.key === account)?.label} balance
          </Text>
        )}
      </View>
      <FormError>{error}</FormError>
      <PrimaryButton label={isExpense ? t("saveExpense") : t("saveIncome")} onPress={submit} loading={add.isPending} color={accentColor} textColor="#fff" />
    </View>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({ tx, currency, colors }: { tx: Transaction; currency: string; colors: ReturnType<typeof useColors> }) {
  const { tCat } = useT();
  const isIncome = tx.type === "income";
  return (
    <View style={txS.row}>
      <View style={[txS.icon, { backgroundColor: isIncome ? colors.greenBg : colors.muted }]}>
        <Feather name={isIncome ? "arrow-down-left" : "arrow-up-right"} size={13} color={isIncome ? colors.green : colors.mutedForeground} />
      </View>
      <View style={txS.info}>
        <Text style={[txS.desc, { color: colors.foreground }]} numberOfLines={1}>{tx.description}</Text>
        <Text style={[txS.meta, { color: colors.mutedForeground }]}>{tCat(tx.category)} · {formatShortDate(tx.createdAt)}</Text>
      </View>
      <Text style={[txS.amount, { color: isIncome ? colors.green : colors.foreground }]} adjustsFontSizeToFit numberOfLines={1}>
        {isIncome ? "+" : "-"}{formatCurrency(tx.amount, currency)}
      </Text>
    </View>
  );
}
const txS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  desc: { fontSize: 13.5, fontFamily: F.semibold },
  meta: { fontSize: 11, fontFamily: F.medium, marginTop: 1 },
  amount: { fontSize: 13.5, fontFamily: F.bold, flexShrink: 0, maxWidth: 120 },
});

// ── Modals stylesheet ─────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  kvOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: Platform.OS === "ios" ? 38 : 24, maxHeight: "90%" },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  sheetTitle: { fontSize: 17, fontFamily: F.bold },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});

// ── Main stylesheet ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 34, height: 34, borderRadius: 10 },
  brand: { color: "#fff", fontSize: 21, fontFamily: F.bold, letterSpacing: -0.4 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  dot: { position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: "#111" },
  hello: { color: "#fff", fontSize: 25, fontFamily: F.bold, letterSpacing: -0.6 },
  helloSub: { color: "rgba(255,255,255,0.7)", fontSize: 14.5, fontFamily: F.regular, marginTop: 4 },
  secHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  secTitle: { fontSize: 18, fontFamily: F.bold, letterSpacing: -0.3 },
  // Sticky header — outside ScrollView, fixed at top
  stickyHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },

  greeting: { fontSize: 22, fontFamily: F.bold, letterSpacing: -0.4 },
  greetingSub: { fontSize: 12.5, fontFamily: F.regular, marginTop: 3 },
  proBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start", marginTop: 5 },
  proBadgeText: { fontSize: 11, fontFamily: F.bold, letterSpacing: 0.3 },
  datePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginBottom: 2 },
  datePillText: { fontSize: 11.5, fontFamily: F.medium },

  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110 },

  balanceCard: { padding: 18, marginBottom: 12 },
  balanceTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  balanceAmount: { fontSize: 38, fontFamily: F.black, letterSpacing: -1, marginTop: 4 },
  trendIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  balanceDivider: { flexDirection: "row", alignItems: "center", paddingTop: 14, borderTopWidth: 1 },
  miniDivider: { width: 1, height: 28, marginHorizontal: 4 },

  tilesRow: { flexDirection: "row", gap: 10, marginBottom: 22 },

  section: { marginBottom: 22 },
  sectionLabel: { marginBottom: 10 },

  scoreCard: { padding: 16 },
  scoreRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  scoreCircle: { alignItems: "center", minWidth: 72 },
  scoreNum: { fontSize: 44, fontFamily: F.black, letterSpacing: -2 },
  scoreDenom: { fontSize: 11, fontFamily: F.medium, marginTop: -4 },
  scoreLabel: { fontSize: 10, fontFamily: F.bold, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.8 },
  scoreBreakdown: { flex: 1, gap: 8 },
  breakdownRow: { gap: 3 },
  breakdownLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 10.5, fontFamily: F.medium },
  breakdownScore: { fontSize: 10.5, fontFamily: F.bold },
  breakdownBg: { height: 4, borderRadius: 2 },
  breakdownBar: { height: 4, borderRadius: 2 },

  catRow: { paddingHorizontal: 14, paddingVertical: 9, gap: 5 },
  catLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  catLabel: { flex: 1, fontSize: 13, fontFamily: F.medium },
  catAmt: { fontSize: 12, fontFamily: F.semibold, maxWidth: 100 },
  catTrack: { height: 5, borderRadius: 3 },
  catBar: { height: 5, borderRadius: 3 },

  billRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  billIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  billInfo: { flex: 1, minWidth: 0 },
  billName: { fontSize: 13.5, fontFamily: F.semibold },
  billMeta: { fontSize: 11, fontFamily: F.medium, marginTop: 1 },
  billAmt: { fontSize: 13.5, fontFamily: F.bold, flexShrink: 0 },

  budgetRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  budgetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetAmt: { fontSize: 12, fontFamily: F.semibold },


  empty: { alignItems: "center", paddingVertical: 52, gap: 12, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 19, fontFamily: F.bold },
  emptyText: { fontSize: 14, fontFamily: F.regular, textAlign: "center", lineHeight: 21 },

  // ── Setup prompt card (inline) ──
  setupCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  setupCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  setupCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 2,
  },
  setupCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  setupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  setupTitle: { fontSize: 14, fontFamily: F.semibold },
  setupDesc: { fontSize: 12, fontFamily: F.regular, lineHeight: 17, marginTop: 1 },
  setupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  setupBtnText: { fontSize: 13, fontFamily: F.semibold },
  setupLater: { fontSize: 12.5, fontFamily: F.medium },
});
