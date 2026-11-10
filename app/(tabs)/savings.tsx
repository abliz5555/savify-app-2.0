import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAddTransaction, useDeleteTransaction, useFinanceData, useUpdateTransaction,
} from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSubscription } from "@/lib/revenuecat";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { useT } from "@/lib/i18n";
import { formatCurrency, formatShortDate, INCOME_CATEGORIES, monthKey } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import {
  Card, CategoryPicker, F, FormError, FormInput, ListCard,
  PrimaryButton, SectionLabel,
} from "@/components/ui";
import { FloatingFab } from "@/components/fab-menu";
import type { FabAction } from "@/components/fab-menu";
import { ScanBillModal, AIAnalysisModal, PDFReportModal } from "@/components/premium-features";
import { ProUpgradeCard } from "@/components/ProUpgradeCard";
import { SvgBarChart } from "@/components/charts";

// ── Category icon + color maps ────────────────────────────────────────────────

const INCOME_CAT_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  Salary: "briefcase",
  Freelance: "monitor",
  Investment: "bar-chart-2",
  Gift: "gift",
  Other: "more-horizontal",
};

const INCOME_CAT_COLORS: Record<string, string> = {
  Salary: "#3b82f6",
  Freelance: "#8b5cf6",
  Investment: "#10b981",
  Gift: "#ec4899",
  Other: "#94a3b8",
};

// ── StyleSheets ────────────────────────────────────────────────────────────────

const qs = StyleSheet.create({
  kvOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 22, paddingBottom: Platform.OS === "ios" ? 38 : 24, maxHeight: "90%",
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  sheetTitle: { fontSize: 17, fontFamily: F.bold },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontFamily: F.bold, marginBottom: 16 },
});

// ── Monthly Trend Chart ────────────────────────────────────────────────────────

function MonthlyTrend({ transactions, type, currency, colors }: {
  transactions: Transaction[];
  type: "income" | "expense";
  currency: string;
  colors: ReturnType<typeof useColors>;
}) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const total = transactions
        .filter((tx) => tx.type === type && monthKey(tx.createdAt) === prefix)
        .reduce((s, tx) => s + tx.amount, 0);
      return { label: d.toLocaleDateString("en", { month: "short" }), total, prefix, isCurrent: i === 5 };
    });
  }, [transactions, type]);

  const { t } = useT();
  const barColor = type === "income" ? colors.green : colors.red;
  const currentMonth = months[5];
  const chartData = months.map((m) => ({ label: m.label, value: m.total, highlight: m.isCurrent }));

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 10, fontFamily: F.semibold, color: colors.mutedForeground, letterSpacing: 0.5 }}>
          {t("sixMonthTrend")}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: F.semibold, color: colors.green }}>
          {currentMonth && currentMonth.total > 0 ? formatCurrency(currentMonth.total, currency) : ""}
        </Text>
      </View>
      <SvgBarChart data={chartData} barColor={barColor} highlightColor={barColor} colors={colors} formatValue={(v) => formatCurrency(v, currency)} />
    </Card>
  );
}

// ── Insights Card ─────────────────────────────────────────────────────────────

function InsightsCard({ monthIncome, prevMonthIncome, transactions, currency, colors, tCat }: {
  monthIncome: number;
  prevMonthIncome: number;
  transactions: Transaction[];
  currency: string;
  colors: ReturnType<typeof useColors>;
  tCat: (k: string) => string;
}) {
  const { t } = useT();
  const insights = useMemo(() => {
    const items: { icon: React.ComponentProps<typeof Feather>["name"]; text: string; color: string }[] = [];

    if (prevMonthIncome > 0) {
      const diff = monthIncome - prevMonthIncome;
      const pct = Math.abs((diff / prevMonthIncome) * 100).toFixed(1);
      const up = diff >= 0;
      items.push({
        icon: up ? "trending-up" : "trending-down",
        text: up
          ? `${t("incomeUp")} ${pct}% ${t("comparedToLastMonth")}`
          : `${t("incomeDown")} ${pct}% ${t("comparedToLastMonth")}`,
        color: up ? colors.green : colors.red,
      });
    }

    const catMap: Record<string, number> = {};
    transactions.forEach((tx) => { catMap[tx.category] = (catMap[tx.category] ?? 0) + tx.amount; });
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      items.push({
        icon: INCOME_CAT_ICONS[topCat[0]] ?? "briefcase",
        text: `${t("mainSourceLabel")} ${tCat(topCat[0])} (${formatCurrency(topCat[1], currency)})`,
        color: INCOME_CAT_COLORS[topCat[0]] ?? colors.accent,
      });
    }

    if (monthIncome > 0) {
      const dayOfMonth = new Date().getDate();
      const dailyAvg = dayOfMonth > 0 ? monthIncome / dayOfMonth : 0;
      items.push({
        icon: "calendar",
        text: `${t("dailyAverage")} ${formatCurrency(dailyAvg, currency)}${t("perDayThisMonth")}`,
        color: colors.mutedForeground,
      });
    }

    if (transactions.length > 0) {
      items.push({
        icon: "layers",
        text: `${transactions.length} ${transactions.length !== 1 ? t("incomeTxPlural") : t("incomeTxSingular")}`,
        color: colors.mutedForeground,
      });
    }

    return items;
  }, [monthIncome, prevMonthIncome, transactions, currency, colors, tCat, t]);

  if (!insights.length) return null;

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 10, fontFamily: F.semibold, color: colors.mutedForeground, letterSpacing: 0.5 }}>
        {t("insightsLabel")}
      </Text>
      <View style={{ gap: 10 }}>
        {insights.map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{
              width: 28, height: 28, borderRadius: 9,
              backgroundColor: item.color + "18",
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather name={item.icon} size={13} color={item.color} />
            </View>
            <Text style={{
              flex: 1, fontSize: 13, fontFamily: F.regular,
              color: colors.foreground, lineHeight: 20, paddingTop: 4,
            }}>
              {item.text}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function IncomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const { isSubscribed } = useSubscription();
  const router = useRouter();
  const { t, tCat } = useT();
  const { data, isLoading, isError, refetch, isRefetching } = useFinanceData();
  const deleteTransaction = useDeleteTransaction();
  const updateTx = useUpdateTransaction();
  const addTx = useAddTransaction();
  const { isTablet, hz } = useLayout();
  const topInsets = Platform.OS === "web" ? 67 : insets.top;
  const bottomInsets = Platform.OS === "web" ? 0 : insets.bottom;
  const fabBottom = Platform.OS === "web" ? 84 : Math.max(bottomInsets, 10) + 74;

  const allTransactions = useMemo(() => {
    if (!data) return [];
    return [...data.transactions]
      .filter((tx) => tx.type === "income")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data]);

  const monthPrefix = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const monthTransactions = useMemo(
    () => allTransactions.filter((tx) => monthKey(tx.createdAt) === monthPrefix),
    [allTransactions, monthPrefix],
  );

  const monthIncome = useMemo(
    () => monthTransactions.reduce((s, tx) => s + tx.amount, 0),
    [monthTransactions],
  );

  const prevMonthIncome = useMemo(() => {
    if (!data) return 0;
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPrefix = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    return data.transactions
      .filter((tx) => tx.type === "income" && monthKey(tx.createdAt) === prevPrefix && new Date(tx.createdAt).getDate() <= now.getDate())
      .reduce((s, tx) => s + tx.amount, 0);
  }, [data]);

  const topSource = useMemo(() => {
    const catMap: Record<string, number> = {};
    monthTransactions.forEach((tx) => { catMap[tx.category] = (catMap[tx.category] ?? 0) + tx.amount; });
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    return sorted.length ? sorted[0] : null;
  }, [monthTransactions]);

  const avgIncome = monthTransactions.length > 0 ? monthIncome / monthTransactions.length : 0;
  const momDiff = monthIncome - prevMonthIncome;
  const momPct = prevMonthIncome > 0 ? (momDiff / prevMonthIncome) * 100 : 0;
  const momUp = momDiff >= 0;

  // ── Edit state ──
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCat, setEditCat] = useState("Salary");
  const [editError, setEditError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditAmount(String(tx.amount));
    setEditDesc(tx.description);
    setEditCat(tx.category);
    setEditError("");
    setEditSheetOpen(true);
  };

  const closeEdit = () => { setEditSheetOpen(false); setEditingTx(null); setEditError(""); };

  const submitEdit = async () => {
    const amt = parseFloat(editAmount);
    if (!editDesc.trim()) { setEditError(t("enterDescription")); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setEditError(t("enterValidAmount")); return; }
    setEditError("");
    try {
      if (editingTx) {
        // edit in place — keeps the original date and account, and fixes the balance correctly
        await updateTx.mutateAsync({ id: editingTx.id, type: "income", description: editDesc.trim(), amount: amt, category: editCat, account: editingTx.account });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEdit();
    } catch (e: unknown) { setEditError(e instanceof Error ? e.message : "Failed to update"); }
  };

  // ── Add sheet state ──
  const [fabOpen, setFabOpen] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txCat, setTxCat] = useState("Salary");
  const [txError, setTxError] = useState("");

  useFocusEffect(useCallback(() => { return () => setFabOpen(false); }, []));

  const openPremium = (open: () => void) => {
    setFabOpen(false);
    if (!isSubscribed) {
      setTimeout(() => Alert.alert(t("savifyPro"), "Unlock AI income analysis, document scanning, and PDF reports.\n\nUpgrade to Savify Pro in Settings.", [{ text: "OK" }]), 220);
      return;
    }
    setTimeout(open, 220);
  };

  const fabActions: FabAction[] = [
    {
      icon: "plus-circle", label: t("addIncome"), desc: t("addIncomeFabDesc"),
      iconBg: colors.greenBg, iconColor: colors.green, premium: false,
      onPress: () => { setFabOpen(false); setTimeout(() => setAddSheetOpen(true), 220); },
    },
    {
      icon: "file", label: t("scanIncomeDoc"), desc: t("scanPayslipDesc"),
      iconBg: colors.accentBg, iconColor: colors.accent, premium: !isSubscribed,
      onPress: () => openPremium(() => setScanVisible(true)),
    },
    {
      icon: "cpu", label: t("aiIncomeAnalysis"), desc: t("aiIncomeInsightsDesc"),
      iconBg: colors.blueBg, iconColor: colors.blue, premium: !isSubscribed,
      onPress: () => openPremium(() => setAnalysisVisible(true)),
    },
    {
      icon: "file-text", label: t("incomePdfReport"), desc: t("incomePdfFabDesc"),
      iconBg: colors.muted, iconColor: colors.mutedForeground, premium: !isSubscribed,
      onPress: () => openPremium(() => setReportVisible(true)),
    },
  ];

  const handleDeleteTx = (tx: Transaction) => {
    Alert.alert(t("delete"), `Delete "${tx.description}"?`, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"), style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteTransaction.mutate(tx.id);
        },
      },
    ]);
  };

  const submitIncome = async () => {
    const amt = parseFloat(txAmount);
    if (!txDesc.trim()) { setTxError(t("enterDescription")); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setTxError(t("enterValidAmount")); return; }
    setTxError("");
    try {
      await addTx.mutateAsync({ type: "income", description: txDesc.trim(), amount: amt, category: txCat });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddSheetOpen(false);
      setTxAmount(""); setTxDesc(""); setTxCat("Salary");
    } catch (e: unknown) { setTxError(e instanceof Error ? e.message : "Failed to save"); }
  };

  const filteredTransactions = useMemo(() => {
    let txs = allTransactions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter((tx) =>
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q)
      );
    }
    switch (sortOrder) {
      case "oldest": return [...txs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      case "highest": return [...txs].sort((a, b) => b.amount - a.amount);
      case "lowest": return [...txs].sort((a, b) => a.amount - b.amount);
      default: return txs;
    }
  }, [allTransactions, searchQuery, sortOrder]);

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

      {/* ── Sticky header ── */}
      <View style={[s.stickyHeader, { paddingTop: topInsets + 10, backgroundColor: colors.background, borderBottomColor: colors.borderSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>{t("income")}</Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground }]}>{t("incomeSubtitle")}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
      >

        {/* ── Summary Card ── */}
        <Card style={s.summaryCard}>
          <View style={s.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.summaryLabel}>{t("totalIncomeThisMonth")}</Text>
              <Text style={s.summaryAmount} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.45}>
                {formatCurrency(monthIncome, currency)}
              </Text>
            </View>
            <View style={[s.summaryIcon, { backgroundColor: colors.greenBg }]}>
              <Feather name="trending-up" size={20} color={colors.green} />
            </View>
          </View>

          {prevMonthIncome > 0 && (
            <View style={s.momRow}>
              <View style={[s.momBadge, { backgroundColor: momUp ? colors.greenBg : colors.redBg }]}>
                <Feather name={momUp ? "arrow-up" : "arrow-down"} size={10} color={momUp ? colors.green : colors.red} />
                <Text style={[s.momText, { color: momUp ? colors.green : colors.red }]}>
                  {Math.abs(momPct).toFixed(1)}% {t("vsLastMonth")}
                </Text>
              </View>
            </View>
          )}

          <View style={s.divider} />

          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={[s.statVal, { color: colors.foreground }]}>{monthTransactions.length}</Text>
              <Text style={[s.statLbl, { color: colors.mutedForeground }]}>{t("transactions").toUpperCase()}</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.borderSoft }]} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: colors.foreground }]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.5}>
                {monthTransactions.length > 0 ? formatCurrency(avgIncome, currency) : "—"}
              </Text>
              <Text style={[s.statLbl, { color: colors.mutedForeground }]}>{t("avgIncomeLabel")}</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.borderSoft }]} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: colors.foreground }]} numberOfLines={1}>
                {topSource ? tCat(topSource[0]).split(" ")[0] : "—"}
              </Text>
              <Text style={[s.statLbl, { color: colors.mutedForeground }]}>{t("mainSource")}</Text>
            </View>
          </View>
        </Card>

        {/* ── Pro: Insights + Monthly Trend ── */}
        {isSubscribed ? (
          <>
            {!isLoading && data && (
              <InsightsCard
                monthIncome={monthIncome}
                prevMonthIncome={prevMonthIncome}
                transactions={monthTransactions}
                currency={currency}
                colors={colors}
                tCat={tCat}
              />
            )}
            {!isLoading && data && (
              <MonthlyTrend transactions={data.transactions} type="income" currency={currency} colors={colors} />
            )}
          </>
        ) : (
          <ProUpgradeCard
            features={[t("proGateFeatureInsights"), t("proGateFeatureTrend")]}
            title={t("proGateTitle")}
            subtitle={t("proGateSub")}
            ctaLabel={t("proGateCta")}
            onUpgrade={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/pro"); }}
          />
        )}

        {/* ── Transaction List ── */}
        <SectionLabel>{t("transactions")}</SectionLabel>

        {/* Search + Sort */}
        <View style={s.searchRow}>
          <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[s.searchInput, { color: colors.foreground }]}
              placeholder="Search income…"
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <Pressable
            style={[s.sortBtn, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}
            onPress={() => {
              const orders: ("newest" | "oldest" | "highest" | "lowest")[] = ["newest", "oldest", "highest", "lowest"];
              setSortOrder(orders[(orders.indexOf(sortOrder) + 1) % orders.length]);
            }}
          >
            <Feather name="sliders" size={14} color={colors.accent} />
            <Text style={[s.sortBtnText, { color: colors.accent }]}>
              {sortOrder === "newest" ? "New" : sortOrder === "oldest" ? "Old" : sortOrder === "highest" ? "High" : "Low"}
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={s.loading}><ActivityIndicator color={colors.accent} size="large" /></View>
        ) : filteredTransactions.length ? (
          <ListCard>
            {filteredTransactions.map((tx, i) => {
              const iconName = INCOME_CAT_ICONS[tx.category] ?? "arrow-down-left";
              const iconColor = INCOME_CAT_COLORS[tx.category] ?? colors.green;
              return (
                <React.Fragment key={tx.id}>
                  {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft, marginHorizontal: 14 }} />}
                  <Pressable style={s.txRow} onPress={() => openEdit(tx)}>
                    <View style={[s.txIcon, { backgroundColor: iconColor + "18" }]}>
                      <Feather name={iconName} size={15} color={iconColor} />
                    </View>
                    <View style={s.txInfo}>
                      <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                      <Text style={s.txMeta}>{tCat(tx.category)} · {formatShortDate(tx.createdAt)}</Text>
                    </View>
                    <Text style={[s.txAmt, { color: colors.green }]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.65}>
                      +{formatCurrency(tx.amount, currency)}
                    </Text>
                    <Pressable onPress={() => handleDeleteTx(tx)} hitSlop={8} style={s.txDelete}>
                      <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                    </Pressable>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </ListCard>
        ) : (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: colors.greenBg }]}>
              <Feather name="trending-up" size={28} color={colors.green} />
            </View>
            <Text style={s.emptyTitle}>{t("noIncome")}</Text>
            <Text style={s.emptyText}>{t("noIncomeHint")}</Text>
          </View>
        )}

      </ScrollView>

      {/* ── FAB ── */}
      <FloatingFab actions={fabActions} fabBottom={fabBottom} isOpen={fabOpen} onToggle={() => setFabOpen(v => !v)} />

      {/* ── Add Income Sheet ── */}
      <Modal visible={addSheetOpen} transparent animationType="fade" onRequestClose={() => setAddSheetOpen(false)}>
        <KeyboardAvoidingView style={qs.kvOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAddSheetOpen(false)} />
          <View style={[qs.sheet, { backgroundColor: colors.card }]}>
            <View style={[qs.handle, { backgroundColor: colors.borderSoft }]} />
            <View style={qs.sheetHeader}>
              <Text style={[qs.sheetTitle, { color: colors.foreground }]}>{t("addIncome")}</Text>
              <Pressable onPress={() => setAddSheetOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[qs.closeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <View style={{ gap: 14 }}>
                <FormInput label={`${t("amountLabel")} (${currency})`} value={txAmount} onChangeText={setTxAmount} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
                <FormInput label={t("descriptionLabel")} value={txDesc} onChangeText={setTxDesc} placeholder={t("incomeFormPlaceholder")} />
                <View style={{ gap: 7 }}>
                  <SectionLabel>{t("categoryLabel")}</SectionLabel>
                  <CategoryPicker categories={INCOME_CATEGORIES} value={txCat} onChange={setTxCat} labelFn={tCat} />
                </View>
                <FormError>{txError}</FormError>
                <PrimaryButton label={t("saveIncome")} onPress={submitIncome} loading={addTx.isPending} color={colors.green} textColor="#fff" />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Income Sheet ── */}
      <Modal visible={editSheetOpen} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView style={qs.kvOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeEdit} />
          <View style={[qs.sheet, { backgroundColor: colors.card }]}>
            <View style={[qs.handle, { backgroundColor: colors.borderSoft }]} />
            <View style={qs.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[qs.sheetTitle, { color: colors.foreground }]}>{t("edit")} {t("income")}</Text>
                {editingTx && (
                  <Text style={{ fontSize: 12, fontFamily: F.regular, color: colors.mutedForeground, marginTop: 2 }}>
                    {formatShortDate(editingTx.createdAt)}
                  </Text>
                )}
              </View>
              <Pressable onPress={closeEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[qs.closeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <View style={{ gap: 14 }}>
                <FormInput label={`${t("amountLabel")} (${currency})`} value={editAmount} onChangeText={setEditAmount} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
                <FormInput label={t("descriptionLabel")} value={editDesc} onChangeText={setEditDesc} placeholder={t("incomeFormPlaceholder")} />
                <View style={{ gap: 7 }}>
                  <SectionLabel>{t("categoryLabel")}</SectionLabel>
                  <CategoryPicker categories={INCOME_CATEGORIES} value={editCat} onChange={setEditCat} labelFn={tCat} />
                </View>
                <FormError>{editError}</FormError>
                <PrimaryButton label={t("save")} onPress={submitEdit} loading={deleteTransaction.isPending || addTx.isPending} color={colors.green} textColor="#fff" />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Premium Modals ── */}
      <ScanBillModal visible={scanVisible} onClose={() => setScanVisible(false)} />
      <AIAnalysisModal visible={analysisVisible} onClose={() => setAnalysisVisible(false)} />
      <PDFReportModal visible={reportVisible} onClose={() => setReportVisible(false)} />

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>, topInsets: number, hz: number) {
  return StyleSheet.create({
    stickyHeader: {
      flexDirection: "row", alignItems: "flex-end",
      paddingHorizontal: hz, paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 10,
    },
    headerTitle: { fontSize: 22, fontFamily: F.extrabold, letterSpacing: -0.3 },
    headerSub: { fontSize: 12.5, fontFamily: F.regular, marginTop: 3 },
    scroll: { paddingHorizontal: hz, paddingTop: 18, gap: 14, paddingBottom: 110 },
    loading: { paddingVertical: 60, justifyContent: "center", alignItems: "center" },

    summaryCard: { padding: 18 },
    summaryTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 2 },
    summaryLabel: {
      fontSize: 10, fontFamily: F.semibold, color: colors.mutedForeground,
      letterSpacing: 0.5, marginBottom: 4,
    },
    summaryAmount: { fontSize: 34, fontFamily: F.black, color: colors.foreground, letterSpacing: -0.8 },
    summaryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    momRow: { marginTop: 8, marginBottom: 14 },
    momBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    momText: { fontSize: 11, fontFamily: F.semibold },
    divider: { height: 1, backgroundColor: colors.borderSoft, marginBottom: 14 },
    statsRow: { flexDirection: "row" },
    stat: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 4 },
    statDivider: { width: 1 },
    statVal: { fontSize: 17, fontFamily: F.bold },
    statLbl: { fontSize: 9, fontFamily: F.medium, letterSpacing: 0.4, textAlign: "center" },

    txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
    txIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    txInfo: { flex: 1 },
    txDesc: { fontSize: 13.5, fontFamily: F.semibold, color: colors.foreground },
    txMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: F.medium, marginTop: 2 },
    txAmt: { fontSize: 13.5, fontFamily: F.bold, maxWidth: 120 },
    txDelete: { padding: 4 },

    empty: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 48 },
    emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontSize: 16, fontFamily: F.semibold, color: colors.foreground },
    emptyText: { fontSize: 13.5, color: colors.mutedForeground, fontFamily: F.regular, textAlign: "center" },
    searchRow: { flexDirection: "row", gap: 8 },
    searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular },
    sortBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    sortBtnText: { fontSize: 11, fontFamily: F.semibold },
  });
}
