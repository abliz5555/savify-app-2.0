import { Feather } from "@expo/vector-icons";
import { billDueDate } from "@/lib/bills";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAddBudgetGoal, useAddRecurring, useAddTransaction, useDeleteBudgetGoal, useDeleteRecurring, useDeleteTransaction, useFinanceData, useFinancialProfile, usePayRecurring, useUpdateBudgetGoal, useUpdateTransaction,
} from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSubscription } from "@/lib/revenuecat";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { useT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n";
import { EXPENSE_CATEGORIES, formatCurrency, formatShortDate, monthKey, localISODate } from "@/lib/format";
import type { BudgetGoal, RecurringExpense, Transaction } from "@/lib/types";
import {
  Badge, Card, CategoryPicker, F, FormError, FormInput,
  ListCard, PrimaryButton, ProgressBar, SectionLabel,
} from "@/components/ui";
import { FloatingFab } from "@/components/fab-menu";
import type { FabAction } from "@/components/fab-menu";
import { ScanBillModal, AIAnalysisModal, PDFReportModal } from "@/components/premium-features";
import { ProUpgradeCard } from "@/components/ProUpgradeCard";
import { BlurView } from "expo-blur";
import { cancelBillNotifications, scheduleBillNotifications } from "@/lib/notifications";
import { SvgBarChart } from "@/components/charts";

// ── Category icon + color maps ────────────────────────────────────────────────

const EXPENSE_CAT_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  "Food & Dining": "coffee",
  "Transportation": "navigation",
  "Housing": "home",
  "Entertainment": "film",
  "Healthcare": "heart",
  "Shopping": "shopping-bag",
  "Education": "book-open",
  "Travel": "map",
  "Utilities": "zap",
  "Other": "more-horizontal",
};

const EXPENSE_CAT_COLORS: Record<string, string> = {
  "Food & Dining": "#f97316",
  "Transportation": "#3b82f6",
  "Housing": "#8b5cf6",
  "Entertainment": "#ec4899",
  "Healthcare": "#ef4444",
  "Shopping": "#f59e0b",
  "Education": "#10b981",
  "Travel": "#06b6d4",
  "Utilities": "#64748b",
  "Other": "#94a3b8",
};

// ── Bill helpers ──────────────────────────────────────────────────────────────

function getEffectiveDueDate(bill: RecurringExpense): Date {
  return billDueDate(bill);
}

function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function formatDueLabel(daysUntil: number, t: (k: TKey) => string): string {
  if (daysUntil < -1) return `${Math.abs(daysUntil)}${t("dOverdueSuffix")}`;
  if (daysUntil === -1) return `1${t("dOverdueSuffix")}`;
  if (daysUntil === 0) return t("dueToday");
  if (daysUntil === 1) return t("tomorrow");
  if (daysUntil < 7) return `${t("inDaysPrefix")} ${daysUntil} ${t("dayPlural")}`;
  const d = new Date();
  d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function formatFrequency(freq: string | null | undefined, t: (k: TKey) => string): string {
  const map: Record<string, TKey> = {
    daily: "freqDaily", weekly: "freqWeekly", monthly: "freqMonthly", yearly: "freqYearly",
  };
  const key = map[(freq ?? "monthly").toLowerCase()];
  return key ? t(key) : t("freqMonthly");
}

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Yearly"];
const DUE_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

type BillWithMeta = RecurringExpense & { nextDue: Date; daysUntil: number };

function groupBills(bills: BillWithMeta[]) {
  const overdue: BillWithMeta[] = [];
  const dueToday: BillWithMeta[] = [];
  const thisWeek: BillWithMeta[] = [];
  const thisMonth: BillWithMeta[] = [];
  const later: BillWithMeta[] = [];
  for (const b of bills) {
    if (b.daysUntil < 0) overdue.push(b);
    else if (b.daysUntil === 0) dueToday.push(b);
    else if (b.daysUntil <= 7) thisWeek.push(b);
    else if (b.daysUntil <= 30) thisMonth.push(b);
    else later.push(b);
  }
  return { overdue, dueToday, thisWeek, thisMonth, later };
}

// ── StyleSheets (defined before components that use them) ─────────────────────

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

const cs = StyleSheet.create({
  stripRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  dayCell: { width: 46, borderRadius: 12, paddingVertical: 8, alignItems: "center", gap: 2 },
  dayLetter: { fontSize: 10, fontFamily: F.medium },
  dayNum: { fontSize: 15, fontFamily: F.bold },
  dotRow: { height: 6, justifyContent: "center", alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  popup: { marginHorizontal: 16, marginTop: 6, borderRadius: 12, padding: 12, borderWidth: 1, gap: 8 },
  popupRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  popupName: { fontSize: 13, fontFamily: F.semibold, flex: 1 },
  popupDue: { fontSize: 12, fontFamily: F.medium },
});

const fc = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontFamily: F.semibold },
  sub: { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  total: { fontSize: 21, fontFamily: F.bold },
  subAmt: { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  divider: { height: 1 },
  stats: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1 },
  statVal: { fontSize: 18, fontFamily: F.bold },
  statLbl: { fontSize: 9, fontFamily: F.medium, letterSpacing: 0.5 },
});

const bk = StyleSheet.create({
  card: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 0, borderLeftWidth: 3, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingBottom: 10 },
  iconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: 1 },
  name: { fontSize: 14, fontFamily: F.semibold },
  sub: { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  notes: { fontSize: 11, fontFamily: F.regular, marginTop: 3, fontStyle: "italic" },
  amount: { fontSize: 15, fontFamily: F.bold },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontFamily: F.semibold },
  actions: { flexDirection: "row", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 9 },
  payBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 8, paddingVertical: 7, minHeight: 34 },
  payText: { color: "#fff", fontSize: 12, fontFamily: F.semibold },
  delBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
});

const am = StyleSheet.create({
  root: { flex: 1 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.42)" },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 40 : 28,
    maxHeight: "92%",
    shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 28,
    shadowOffset: { width: 0, height: -6 }, elevation: 24,
  },
  handle: { width: 40, height: 4.5, borderRadius: 2.5 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: F.bold, marginBottom: 16 },
});

const gs = StyleSheet.create({
  budgetRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 9 },
  budgetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetAmt: { fontSize: 12, fontFamily: F.semibold },
  iconBtn: { padding: 2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  editSheet: {
    width: "82%", borderRadius: 16, padding: 22, gap: 12,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  editTitle: { fontSize: 16, fontFamily: F.bold },
  editCategory: { fontSize: 13, fontFamily: F.regular, marginTop: -4 },
  editInput: { fontSize: 15, fontFamily: F.regular, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  editErr: { fontSize: 12, fontFamily: F.regular },
  editActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  editCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  editCancelText: { fontSize: 14, fontFamily: F.medium },
  editSaveBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  editSaveText: { color: "#fff", fontSize: 14, fontFamily: F.semibold },
  budgetStats: { flexDirection: "row", alignItems: "center", paddingTop: 8 },
  budgetStat: { flex: 1, alignItems: "center", gap: 3 },
  budgetStatDivider: { width: 1, height: 30 },
  budgetStatLabel: { fontSize: 8, fontFamily: F.bold, letterSpacing: 0.6 },
  budgetStatValue: { fontSize: 12, fontFamily: F.bold },
});

const fs = StyleSheet.create({
  card: { gap: 14, padding: 16 },
});

// ── Calendar Strip ────────────────────────────────────────────────────────────

function CalendarStrip({ bills, colors }: { bills: BillWithMeta[]; colors: ReturnType<typeof useColors> }) {
  const { t } = useT();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 31 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = localISODate(d);
      const dayBills = bills.filter((b) => localISODate(b.nextDue) === dateStr);
      return { date: d, dateStr, dayBills, isToday: i === 0 };
    });
  }, [bills]);
  const selectedBills = useMemo(() => days.find((d) => d.dateStr === selectedDate)?.dayBills ?? [], [days, selectedDate]);
  return (
    <View>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cs.stripRow}>
        {days.map(({ date, dateStr, dayBills, isToday }) => {
          const isSelected = selectedDate === dateStr;
          const hasOverdue = dayBills.some((b) => b.daysUntil < 0);
          const dotColor = hasOverdue ? colors.red : colors.accent;
          return (
            <Pressable
              key={dateStr}
              onPress={() => setSelectedDate(isSelected ? null : dateStr)}
              style={[cs.dayCell, {
                backgroundColor: isSelected ? colors.accent : colors.card,
                borderColor: isToday && !isSelected ? colors.accent : colors.borderSoft,
                borderWidth: isToday && !isSelected ? 1.5 : 1,
              }]}
            >
              <Text style={[cs.dayLetter, { color: isSelected ? "#fff" : colors.mutedForeground }]}>
                {date.toLocaleDateString("en", { weekday: "short" }).slice(0, 1)}
              </Text>
              <Text style={[cs.dayNum, { color: isSelected ? "#fff" : isToday ? colors.accent : colors.foreground }]}>
                {date.getDate()}
              </Text>
              <View style={cs.dotRow}>
                {dayBills.length > 0 && <View style={[cs.dot, { backgroundColor: isSelected ? "rgba(255,255,255,0.85)" : dotColor }]} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {selectedBills.length > 0 && (
        <View style={[cs.popup, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          {selectedBills.map((b) => (
            <View key={b.id} style={cs.popupRow}>
              <Text style={[cs.popupName, { color: colors.foreground }]} numberOfLines={1}>{b.name}</Text>
              <Text style={[cs.popupDue, { color: colors.mutedForeground }]}>{formatDueLabel(b.daysUntil, t)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Forecast Card ─────────────────────────────────────────────────────────────

function ForecastCard({ bills, currency, colors }: { bills: BillWithMeta[]; currency: string; colors: ReturnType<typeof useColors> }) {
  const { t } = useT();
  const overdue = bills.filter((b) => b.daysUntil < 0).length;
  const upcoming = bills.filter((b) => b.daysUntil >= 0 && b.daysUntil <= 30).length;
  const monthTotal = bills.filter((b) => b.daysUntil >= 0 && b.daysUntil <= 30).reduce((s, b) => s + b.amount, 0);
  return (
    <Card style={[fc.card, { backgroundColor: colors.accentBg, borderColor: colors.accent + "30", borderWidth: 1 }]}>
      <View style={fc.top}>
        <View style={[fc.iconWrap, { backgroundColor: colors.accent + "20" }]}>
          <Feather name="calendar" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[fc.label, { color: colors.accent }]}>{t("billForecastLabel")}</Text>
          <Text style={[fc.sub, { color: colors.mutedForeground }]}>{t("next30Days").toLowerCase()}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[fc.total, { color: colors.foreground }]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.6}>{formatCurrency(monthTotal, currency)}</Text>
          <Text style={[fc.subAmt, { color: colors.mutedForeground }]}>{bills.length} {bills.length !== 1 ? t("billsTotal") : t("billTotal")}</Text>
        </View>
      </View>
      <View style={[fc.divider, { backgroundColor: colors.accent + "20" }]} />
      <View style={fc.stats}>
        <View style={fc.stat}>
          <Text style={[fc.statVal, { color: overdue > 0 ? colors.red : colors.foreground }]}>{overdue}</Text>
          <Text style={[fc.statLbl, { color: colors.mutedForeground }]}>{t("overdueStat")}</Text>
        </View>
        <View style={[fc.statDivider, { backgroundColor: colors.accent + "20" }]} />
        <View style={fc.stat}>
          <Text style={[fc.statVal, { color: colors.accent }]}>{upcoming}</Text>
          <Text style={[fc.statLbl, { color: colors.mutedForeground }]}>{t("upcomingStat")}</Text>
        </View>
        <View style={[fc.statDivider, { backgroundColor: colors.accent + "20" }]} />
        <View style={fc.stat}>
          <Text style={[fc.statVal, { color: colors.foreground }]}>{bills.length}</Text>
          <Text style={[fc.statLbl, { color: colors.mutedForeground }]}>{t("activeStat")}</Text>
        </View>
      </View>
    </Card>
  );
}

// ── Bill Card ─────────────────────────────────────────────────────────────────

function BillCard({ bill, currency, colors, paying, onPay, onDelete }: {
  bill: BillWithMeta; currency: string; colors: ReturnType<typeof useColors>;
  paying: boolean; onPay: () => void; onDelete: () => void;
}) {
  const { t, tCat } = useT();
  const isOverdue = bill.daysUntil < 0;
  const isDueSoon = bill.daysUntil >= 0 && bill.daysUntil <= 3;
  const accentCol = isOverdue ? colors.red : isDueSoon ? "#f59e0b" : colors.accent;
  const accentBg = isOverdue ? colors.redBg : isDueSoon ? "#f59e0b18" : colors.accentBg;
  return (
    <View style={[bk.card, { borderLeftColor: accentCol }]}>
      <View style={bk.top}>
        <View style={[bk.iconWrap, { backgroundColor: accentBg }]}>
          <Feather name="repeat" size={14} color={accentCol} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[bk.name, { color: colors.foreground }]} numberOfLines={1}>{bill.name}</Text>
          <Text style={[bk.sub, { color: colors.mutedForeground }]}>{tCat(bill.category)} · {formatFrequency(bill.frequency, t)}</Text>
          {!!bill.notes && <Text style={[bk.notes, { color: colors.mutedForeground }]} numberOfLines={2}>{bill.notes}</Text>}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <Text style={[bk.amount, { color: colors.foreground }]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.65}>{formatCurrency(bill.amount, currency)}</Text>
          <View style={[bk.badge, { backgroundColor: accentBg }]}>
            <Text style={[bk.badgeText, { color: accentCol }]}>{formatDueLabel(bill.daysUntil, t)}</Text>
          </View>
        </View>
      </View>
      <View style={[bk.actions, { borderTopColor: colors.borderSoft }]}>
        <Pressable onPress={onPay} disabled={paying} style={[bk.payBtn, { backgroundColor: accentCol }]}>
          {paying ? <ActivityIndicator size="small" color="#fff" /> : (
            <><Feather name="check" size={12} color="#fff" /><Text style={bk.payText}>{t("markPaid")}</Text></>
          )}
        </Pressable>
        <Pressable onPress={onDelete} style={[bk.delBtn, { borderColor: colors.borderSoft }]}>
          <Feather name="trash-2" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

// ── Bill Section ──────────────────────────────────────────────────────────────

function BillSection({ label, bills, currency, colors, payingId, onPay, onDelete }: {
  label: string; bills: BillWithMeta[]; currency: string;
  colors: ReturnType<typeof useColors>; payingId: string | null;
  onPay: (id: string) => void; onDelete: (b: BillWithMeta) => void;
}) {
  if (!bills.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <SectionLabel>{label}</SectionLabel>
      <ListCard>
        {bills.map((b, i) => (
          <React.Fragment key={b.id}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft, marginHorizontal: 14 }} />}
            <BillCard bill={b} currency={currency} colors={colors} paying={payingId === b.id} onPay={() => onPay(b.id)} onDelete={() => onDelete(b)} />
          </React.Fragment>
        ))}
      </ListCard>
    </View>
  );
}

// ── Add Bill Modal ────────────────────────────────────────────────────────────

function AddBillModal({ visible, onClose, currency, colors }: {
  visible: boolean; onClose: () => void; currency: string; colors: ReturnType<typeof useColors>;
}) {
  const { t, tCat } = useT();
  const add = useAddRecurring();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [frequency, setFrequency] = useState("Monthly");
  const [dueDay, setDueDay] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const reset = () => { setName(""); setAmount(""); setCategory("Utilities"); setFrequency("Monthly"); setDueDay("1"); setNotes(""); setError(""); };
  const handleClose = () => { reset(); onClose(); };
  const submit = async () => {
    const amt = parseFloat(amount);
    if (!name.trim()) { setError(t("enterBillName")); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError(t("enterValidAmount")); return; }
    setError("");
    const freq = frequency.toLowerCase() as "daily" | "weekly" | "monthly" | "yearly";
    const day = parseInt(dueDay, 10) || 1;
    try {
      const result = await add.mutateAsync({ name: name.trim(), amount: amt, category, dueDay: day, active: true, frequency: freq, notes: notes.trim() || null, nextDueDate: null });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const r = result as RecurringExpense | undefined;
      if (r?.id && r?.nextDueDate) scheduleBillNotifications(r.id, name.trim(), amt, currency, r.nextDueDate).catch(() => {});
      reset(); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add bill");
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
      <View style={am.root}>
        <BlurView
          intensity={Platform.OS === "ios" ? 22 : 0}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        <KeyboardAvoidingView style={am.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
          <View style={[am.sheet, { backgroundColor: colors.card }]}>
            <View style={[am.handle, { backgroundColor: colors.borderSoft, alignSelf: "center", marginBottom: 12 }]} />
            <View style={am.sheetHeader}>
              <Text style={[am.title, { color: colors.foreground, marginBottom: 0 }]}>{t("addRecurringBillTitle")}</Text>
              <Pressable onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[am.closeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={{ gap: 14 }}>
              <FormInput label={t("billNameLabel")} value={name} onChangeText={setName} placeholder={t("billNamePlaceholder")} autoFocus />
              <FormInput label={`${t("amountLabel")} (${currency})`} value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
              <View style={{ gap: 7 }}>
                <SectionLabel>{t("frequencyLabel")}</SectionLabel>
                <CategoryPicker categories={FREQUENCIES} value={frequency} onChange={setFrequency} labelFn={(f) => formatFrequency(f, t)} />
              </View>
              {frequency === "Monthly" && (
                <View style={{ gap: 7 }}>
                  <SectionLabel>{t("dueDayOfMonth")}</SectionLabel>
                  <CategoryPicker categories={DUE_DAYS} value={dueDay} onChange={setDueDay} />
                </View>
              )}
              <View style={{ gap: 7 }}>
                <SectionLabel>{t("categoryLabel")}</SectionLabel>
                <CategoryPicker categories={EXPENSE_CATEGORIES} value={category} onChange={setCategory} labelFn={tCat} />
              </View>
              <FormInput label={t("notesOptionalLabel")} value={notes} onChangeText={setNotes} placeholder={t("notesPlaceholder")} />
              <FormError>{error}</FormError>
              <PrimaryButton label={t("addBill")} onPress={submit} loading={add.isPending} />
            </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Budget Row ────────────────────────────────────────────────────────────────

function BudgetRow({ bg, currency, colors }: { bg: BudgetGoal & { spent: number }; currency: string; colors: ReturnType<typeof useColors> }) {
  const del = useDeleteBudgetGoal();
  const update = useUpdateBudgetGoal();
  const { t, tCat } = useT();
  const [editVisible, setEditVisible] = useState(false);
  const [newLimit, setNewLimit] = useState(String(bg.monthlyLimit));
  const [editErr, setEditErr] = useState("");

  const pct = bg.monthlyLimit > 0 ? (bg.spent / bg.monthlyLimit) * 100 : 0;
  const over = bg.spent > bg.monthlyLimit;
  const warning = pct >= 80 && !over;
  const fill = over ? colors.red : warning ? colors.amberFill : colors.green;

  const confirmDelete = () => {
    Alert.alert(t("delete"), `Delete the ${tCat(bg.category)} budget?`, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); del.mutate(bg.id); } },
    ]);
  };

  const openEdit = () => { setNewLimit(String(bg.monthlyLimit)); setEditErr(""); setEditVisible(true); };

  const saveEdit = async () => {
    const lmt = parseFloat(newLimit);
    if (!Number.isFinite(lmt) || lmt <= 0) { setEditErr(t("enterValidAmount")); return; }
    setEditErr("");
    try {
      await update.mutateAsync({ id: bg.id, monthlyLimit: lmt });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditVisible(false);
    } catch { setEditErr(t("enterValidAmount")); }
  };

  return (
    <>
      <View style={gs.budgetRow}>
        <View style={gs.budgetHead}>
          <Badge>{tCat(bg.category)}</Badge>
          <View style={gs.budgetActions}>
            <Pressable onPress={openEdit} hitSlop={8} style={gs.iconBtn}><Feather name="edit-2" size={14} color={colors.accent} /></Pressable>
            <Pressable onPress={confirmDelete} hitSlop={8} style={gs.iconBtn}><Feather name="trash-2" size={14} color={colors.mutedForeground} /></Pressable>
          </View>
        </View>
        <ProgressBar pct={pct} color={fill} />
        <View style={gs.budgetStats}>
          <View style={gs.budgetStat}>
            <Text style={[gs.budgetStatLabel, { color: colors.mutedForeground }]}>BUDGET</Text>
            <Text style={[gs.budgetStatValue, { color: colors.foreground }]}>{formatCurrency(bg.monthlyLimit, currency)}</Text>
          </View>
          <View style={[gs.budgetStatDivider, { backgroundColor: colors.borderSoft }]} />
          <View style={gs.budgetStat}>
            <Text style={[gs.budgetStatLabel, { color: colors.mutedForeground }]}>SPENT</Text>
            <Text style={[gs.budgetStatValue, { color: fill }]}>{formatCurrency(bg.spent, currency)}</Text>
          </View>
          <View style={[gs.budgetStatDivider, { backgroundColor: colors.borderSoft }]} />
          <View style={gs.budgetStat}>
            <Text style={[gs.budgetStatLabel, { color: colors.mutedForeground }]}>{t("leftLabel").toUpperCase()}</Text>
            <Text style={[gs.budgetStatValue, { color: over ? colors.red : colors.green }]}>
              {over ? "−" : ""}{formatCurrency(Math.abs(bg.monthlyLimit - bg.spent), currency)}
            </Text>
          </View>
        </View>
      </View>
      <Modal visible={editVisible} transparent animationType="fade">
        <Pressable style={gs.overlay} onPress={() => setEditVisible(false)}>
          <Pressable style={[gs.editSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[gs.editTitle, { color: colors.foreground }]}>{t("editBudgetLimitTitle")}</Text>
            <Text style={[gs.editCategory, { color: colors.mutedForeground }]}>{tCat(bg.category)}</Text>
            <TextInput
              style={[gs.editInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={newLimit} onChangeText={setNewLimit} keyboardType="decimal-pad" placeholder={t("monthlyLimitPlaceholder")}
              placeholderTextColor={colors.mutedForeground} autoFocus
            />
            {!!editErr && <Text style={[gs.editErr, { color: colors.red }]}>{editErr}</Text>}
            <View style={gs.editActions}>
              <TouchableOpacity style={[gs.editCancelBtn, { borderColor: colors.border }]} onPress={() => setEditVisible(false)}>
                <Text style={[gs.editCancelText, { color: colors.mutedForeground }]}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[gs.editSaveBtn, { backgroundColor: "#1a1a1a" }]} onPress={saveEdit} disabled={update.isPending}>
                <Text style={gs.editSaveText}>{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Budget Form ───────────────────────────────────────────────────────────────

function BudgetForm({ onSaved }: { onSaved?: () => void }) {
  const { currency } = useSettings();
  const { t, tCat } = useT();
  const add = useAddBudgetGoal();
  const [category, setCategory] = useState("Food & Dining");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    const lmt = parseFloat(monthlyLimit);
    if (!Number.isFinite(lmt) || lmt <= 0) { setError(t("enterValidMonthlyLimit")); return; }
    setError("");
    try {
      await add.mutateAsync({ name: category, category, monthlyLimit: lmt });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMonthlyLimit("");
      onSaved?.();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("enterValidMonthlyLimit")); }
  };

  return (
    <Card style={fs.card}>
      <View style={{ gap: 7 }}>
        <SectionLabel>{t("categoryLabel")}</SectionLabel>
        <CategoryPicker categories={EXPENSE_CATEGORIES} value={category} onChange={setCategory} labelFn={tCat} />
      </View>
      <FormInput label={`${t("monthlyLimitLabel")} (${currency})`} value={monthlyLimit} onChangeText={setMonthlyLimit} placeholder="0.00" keyboardType="decimal-pad" />
      <FormError>{error}</FormError>
      <PrimaryButton label={t("addBudgetGoal")} onPress={submit} loading={add.isPending} />
    </Card>
  );
}

// ── Monthly Trend Chart ───────────────────────────────────────────────────────

function MonthlyTrend({ transactions, currency, colors }: {
  transactions: Transaction[];
  currency: string;
  colors: ReturnType<typeof useColors>;
}) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const total = transactions
        .filter((tx) => tx.type === "expense" && monthKey(tx.createdAt) === prefix)
        .reduce((s, tx) => s + tx.amount, 0);
      return { label: d.toLocaleDateString("en", { month: "short" }), total, prefix, isCurrent: i === 5 };
    });
  }, [transactions]);

  const { t } = useT();
  const currentMonth = months[5];
  const chartData = months.map((m) => ({ label: m.label, value: m.total, highlight: m.isCurrent }));

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 10, fontFamily: F.semibold, color: colors.mutedForeground, letterSpacing: 0.5 }}>
          {t("sixMonthTrend")}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: F.semibold, color: colors.red }}>
          {currentMonth && currentMonth.total > 0 ? formatCurrency(currentMonth.total, currency) : ""}
        </Text>
      </View>
      <SvgBarChart data={chartData} barColor={colors.red} highlightColor={colors.red} colors={colors} formatValue={(v) => formatCurrency(v, currency)} />
    </Card>
  );
}

// ── Overall Budget Progress ───────────────────────────────────────────────────

function OverallBudgetProgress({ budgetGoals, currency, colors }: {
  budgetGoals: (BudgetGoal & { spent: number })[];
  currency: string;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useT();
  const totalLimit = budgetGoals.reduce((s, bg) => s + bg.monthlyLimit, 0);
  const totalSpent = budgetGoals.reduce((s, bg) => s + bg.spent, 0);
  const pct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const over = totalSpent > totalLimit;
  const warning = pct >= 80 && !over;
  const remaining = totalLimit - totalSpent;

  if (!budgetGoals.length || totalLimit === 0) return null;

  const barColor = over ? colors.red : warning ? colors.amberFill : colors.green;

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 10, fontFamily: F.semibold, color: colors.mutedForeground, letterSpacing: 0.5 }}>
          {t("monthlyBudgetStat")}
        </Text>
        <View style={[{
          flexDirection: "row", alignItems: "center", gap: 4,
          borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3,
          backgroundColor: over ? colors.redBg : warning ? "#f59e0b18" : colors.greenBg,
        }]}>
          <Feather name={over ? "alert-circle" : "check-circle"} size={11} color={over ? colors.red : warning ? "#f59e0b" : colors.green} />
          <Text style={{ fontSize: 11, fontFamily: F.semibold, color: over ? colors.red : warning ? "#f59e0b" : colors.green }}>
            {over ? t("overBudget") : `${pct.toFixed(0)}${t("pctUsedSuffix")}`}
          </Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <ProgressBar pct={pct} color={barColor} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, fontFamily: F.medium, color: colors.mutedForeground }}>
            {formatCurrency(totalSpent, currency)} {t("spentLower")}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: F.medium, color: over ? colors.red : colors.foreground }}>
            {over ? `${formatCurrency(Math.abs(remaining), currency)} ${t("overSuffix")}` : `${formatCurrency(remaining, currency)} ${t("leftLabel").toLowerCase()}`}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 4 }}>
        {budgetGoals.slice(0, 4).map((bg) => {
          const bgPct = bg.monthlyLimit > 0 ? (bg.spent / bg.monthlyLimit) * 100 : 0;
          const bgOver = bg.spent > bg.monthlyLimit;
          const catColor = EXPENSE_CAT_COLORS[bg.category] ?? colors.accent;
          return (
            <View key={bg.id} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 3, backgroundColor: colors.borderSoft, borderRadius: 2, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${Math.min(bgPct, 100)}%`, backgroundColor: bgOver ? colors.red : catColor, borderRadius: 2 }} />
              </View>
              <Text style={{ fontSize: 8, fontFamily: F.medium, color: colors.mutedForeground }} numberOfLines={1}>
                {bg.category.split(" ")[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ── Expense Insights ──────────────────────────────────────────────────────────

function ExpenseInsightsCard({ monthExpenses, prevMonthExpenses, monthTransactions, budgetGoals, currency, colors, tCat }: {
  monthExpenses: number;
  prevMonthExpenses: number;
  monthTransactions: Transaction[];
  budgetGoals: (BudgetGoal & { spent: number })[];
  currency: string;
  colors: ReturnType<typeof useColors>;
  tCat: (k: string) => string;
}) {
  const { t } = useT();
  const insights = useMemo(() => {
    const items: { icon: React.ComponentProps<typeof Feather>["name"]; text: string; color: string }[] = [];

    if (prevMonthExpenses > 0) {
      const diff = monthExpenses - prevMonthExpenses;
      const pct = Math.abs((diff / prevMonthExpenses) * 100).toFixed(1);
      const up = diff > 0;
      items.push({
        icon: up ? "trending-up" : "trending-down",
        text: up
          ? `${t("spendingUp")} ${pct}% ${t("comparedToLastMonth")}`
          : `${t("spendingDown")} ${pct}% ${t("greatJob")}`,
        color: up ? colors.red : colors.green,
      });
    }

    const catMap: Record<string, number> = {};
    monthTransactions.forEach((tx) => { catMap[tx.category] = (catMap[tx.category] ?? 0) + tx.amount; });
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      items.push({
        icon: EXPENSE_CAT_ICONS[topCat[0]] ?? "tag",
        text: `${t("largestCategory")} ${tCat(topCat[0])} (${formatCurrency(topCat[1], currency)})`,
        color: EXPENSE_CAT_COLORS[topCat[0]] ?? colors.accent,
      });
    }

    const totalLimit = budgetGoals.reduce((s, bg) => s + bg.monthlyLimit, 0);
    const totalSpent = budgetGoals.reduce((s, bg) => s + bg.spent, 0);
    if (totalLimit > 0) {
      const remaining = totalLimit - totalSpent;
      const over = remaining < 0;
      items.push({
        icon: over ? "alert-circle" : "shield",
        text: over
          ? `${t("overBudgetBy")} ${formatCurrency(Math.abs(remaining), currency)} ${t("thisMonthSuffix")}`
          : `${formatCurrency(remaining, currency)} ${t("remainingInBudgets")}`,
        color: over ? colors.red : colors.green,
      });
    }

    if (monthExpenses > 0) {
      const dayOfMonth = new Date().getDate();
      const dailyAvg = dayOfMonth > 0 ? monthExpenses / dayOfMonth : 0;
      items.push({
        icon: "calendar",
        text: `${t("dailyAverage")} ${formatCurrency(dailyAvg, currency)}${t("perDayThisMonth")}`,
        color: colors.mutedForeground,
      });
    }

    return items;
  }, [monthExpenses, prevMonthExpenses, monthTransactions, budgetGoals, currency, colors, tCat, t]);

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

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const { isSubscribed } = useSubscription();
  const router = useRouter();
  const { t, tCat } = useT();
  const { data, isLoading, isError, refetch, isRefetching } = useFinanceData();
  const deleteTransaction = useDeleteTransaction();
  const updateTx = useUpdateTransaction();
  const del = useDeleteRecurring();
  const pay = usePayRecurring();
  const addTx = useAddTransaction();
  const { data: profile } = useFinancialProfile();
  const { isTablet, hz } = useLayout();
  const topInsets = Platform.OS === "web" ? 67 : insets.top;
  const bottomInsets = Platform.OS === "web" ? 0 : insets.bottom;
  const fabBottom = Platform.OS === "web" ? 84 : Math.max(bottomInsets, 10) + 74;

  const monthPrefix = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const prevMonthPrefix = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const allTransactions = useMemo(() => {
    if (!data) return [];
    return [...data.transactions].filter((tx) => tx.type === "expense").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data]);

  const monthTransactions = useMemo(
    () => allTransactions.filter((tx) => monthKey(tx.createdAt) === monthPrefix),
    [allTransactions, monthPrefix],
  );

  const monthExpenses = useMemo(
    () => monthTransactions.reduce((s, tx) => s + tx.amount, 0),
    [monthTransactions],
  );

  const prevMonthExpenses = useMemo(() => {
    if (!data) return 0;
    return data.transactions
      // same days of last month (1st → today's date) so the comparison is fair mid-month
      .filter((tx) => tx.type === "expense" && monthKey(tx.createdAt) === prevMonthPrefix && new Date(tx.createdAt).getDate() <= new Date().getDate())
      .reduce((s, tx) => s + tx.amount, 0);
  }, [data, prevMonthPrefix]);

  const topCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions.forEach((tx) => { map[tx.category] = (map[tx.category] ?? 0) + tx.amount; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted.length ? sorted[0] : null;
  }, [monthTransactions]);

  const avgExpense = monthTransactions.length > 0 ? monthExpenses / monthTransactions.length : 0;

  const momDiff = monthExpenses - prevMonthExpenses;
  const momPct = prevMonthExpenses > 0 ? (momDiff / prevMonthExpenses) * 100 : 0;
  const momUp = momDiff > 0;

  const budgetGoals = useMemo(() => {
    if (!data) return [];
    return data.budgetGoals.map((bg) => {
      const spent = data.transactions
        .filter((tx) => tx.type === "expense" && tx.category === bg.category && monthKey(tx.createdAt) === monthPrefix)
        .reduce((s, tx) => s + tx.amount, 0);
      return { ...bg, spent };
    });
  }, [data, monthPrefix]);

  const billsWithMeta = useMemo<BillWithMeta[]>(() => {
    if (!data) return [];
    return data.recurring
      .filter((r) => r.active)
      .map((r) => {
        const nextDue = getEffectiveDueDate(r);
        const daysUntil = getDaysUntil(nextDue);
        return { ...r, nextDue, daysUntil };
      })
      // Only surface bills that are overdue or within the 7-day reminder window.
      // After marking paid the nextDueDate advances by one cycle (≥30 days),
      // pushing daysUntil well above 7 so the bill disappears automatically.
      .filter((r) => r.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [data]);

  const groups = useMemo(() => groupBills(billsWithMeta), [billsWithMeta]);

  // ── Edit state ──
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCat, setEditCat] = useState("Other");
  const [editError, setEditError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [visibleCount, setVisibleCount] = useState(10);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);

  // Reset pagination whenever the search query changes
  useEffect(() => { setVisibleCount(10); }, [searchQuery]);

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
        await updateTx.mutateAsync({ id: editingTx.id, type: "expense", description: editDesc.trim(), amount: amt, category: editCat, account: editingTx.account });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeEdit();
    } catch (e: unknown) { setEditError(e instanceof Error ? e.message : "Failed to update"); }
  };

  // ── FAB + modals state ──
  const [fabOpen, setFabOpen] = useState(false);
  const [scanVisible, setScanVisible] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addBillVisible, setAddBillVisible] = useState(false);
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txCat, setTxCat] = useState("Other");
  const [txAccount, setTxAccount] = useState<"cash" | "bank" | "savings" | null>(null);
  const [txError, setTxError] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { return () => setFabOpen(false); }, []));

  const openPremium = (open: () => void) => {
    setFabOpen(false);
    if (!isSubscribed) {
      setTimeout(() => Alert.alert(t("savifyPro"), "Unlock AI receipt scanning, spending analysis, and PDF reports.\n\nUpgrade to Savify Pro in Settings.", [{ text: "OK" }]), 220);
      return;
    }
    setTimeout(open, 220);
  };

  const fabActions: FabAction[] = [
    {
      icon: "plus-circle", label: t("addExpense"), desc: t("addExpenseFabDesc"),
      iconBg: colors.redBg, iconColor: colors.red, premium: false,
      onPress: () => { setFabOpen(false); setTimeout(() => setAddSheetOpen(true), 220); },
    },
    {
      icon: "calendar", label: t("addBill"), desc: t("addBillFabDesc"),
      iconBg: colors.accentBg, iconColor: colors.accent, premium: false,
      onPress: () => { setFabOpen(false); setTimeout(() => setAddBillVisible(true), 220); },
    },
    {
      icon: "target", label: t("addBudgetGoal"), desc: "Set a monthly spending limit",
      iconBg: colors.blueBg, iconColor: colors.blue, premium: !isSubscribed,
      onPress: () => openPremium(() => setBudgetModalOpen(true)),
    },
    {
      icon: "camera", label: t("scanReceipt"), desc: t("scanReceiptDesc"),
      iconBg: colors.accentBg, iconColor: colors.accent, premium: !isSubscribed,
      onPress: () => openPremium(() => setScanVisible(true)),
    },
    {
      icon: "cpu", label: t("aiExpenseAnalysis"), desc: t("aiAnalysisDesc"),
      iconBg: colors.blueBg, iconColor: colors.blue, premium: !isSubscribed,
      onPress: () => openPremium(() => setAnalysisVisible(true)),
    },
    {
      icon: "file-text", label: t("expensePdfReport"), desc: t("expensePdfFabDesc"),
      iconBg: colors.muted, iconColor: colors.mutedForeground, premium: !isSubscribed,
      onPress: () => openPremium(() => setReportVisible(true)),
    },
  ];

  const handleDeleteTx = (tx: Transaction) => {
    Alert.alert(t("delete"), `Delete "${tx.description}"?`, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); deleteTransaction.mutate(tx.id); } },
    ]);
  };

  const handlePay = (id: string) => {
    const bill = billsWithMeta.find((b) => b.id === id);
    if (!bill) return;
    const doPay = async (account?: "cash" | "bank") => {
      setPayingId(id);
      try {
        const result = await pay.mutateAsync({ id, account });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result?.nextDueDate) scheduleBillNotifications(id, bill.name, bill.amount, currency, result.nextDueDate).catch(() => {});
      } catch (e) {
        Alert.alert("Could not record payment", e instanceof Error ? e.message : "Please try again.");
      } finally { setPayingId(null); }
    };
    Alert.alert(
      `${t("markAsPaid")}: ${bill.name}`,
      `${formatCurrency(bill.amount, currency)} will be recorded as an expense.\n\nWhere did the money come from?`,
      [
        { text: "Bank", onPress: () => doPay("bank") },
        { text: "Cash", onPress: () => doPay("cash") },
        { text: t("cancel"), style: "cancel" },
      ],
    );
  };

  const handleDeleteBill = (bill: BillWithMeta) => {
    Alert.alert(t("delete"), `Delete "${bill.name}"? This cannot be undone.`, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); cancelBillNotifications(bill.id).catch(() => {}); del.mutate(bill.id); } },
    ]);
  };

  const submitExpense = async () => {
    const amt = parseFloat(txAmount);
    if (!txDesc.trim()) { setTxError(t("enterDescription")); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setTxError(t("enterValidAmount")); return; }
    if (!txAccount) { setTxError(t("selectAccountError")); return; }
    setTxError("");
    try {
      await addTx.mutateAsync({ type: "expense", description: txDesc.trim(), amount: amt, category: txCat, account: txAccount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddSheetOpen(false);
      setTxAmount(""); setTxDesc(""); setTxCat("Other"); setTxAccount(null);
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

  // When searching, show all matching results so search always scans the full list.
  // When not searching, paginate at visibleCount for performance.
  const displayedTransactions = useMemo(
    () => (searchQuery.trim() ? filteredTransactions : filteredTransactions.slice(0, visibleCount)),
    [filteredTransactions, searchQuery, visibleCount],
  );
  const hasMore = !searchQuery.trim() && filteredTransactions.length > visibleCount;

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
          <Text style={[s.headerTitle, { color: colors.foreground }]}>{t("expenses")}</Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground }]}>{t("expensesSubtitle")}</Text>
        </View>
        {groups.overdue.length > 0 && (
          <View style={[s.overdueChip, { backgroundColor: colors.redBg }]}>
            <Feather name="alert-circle" size={11} color={colors.red} />
            <Text style={[s.overdueChipText, { color: colors.red }]}>{groups.overdue.length} {t("overdue")}</Text>
          </View>
        )}
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
              <Text style={s.summaryLabel}>{t("totalExpensesThisMonth")}</Text>
              <Text style={s.summaryAmount} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.45}>
                {formatCurrency(monthExpenses, currency)}
              </Text>
            </View>
            <View style={[s.summaryIcon, { backgroundColor: colors.redBg }]}>
              <Feather name="trending-up" size={20} color={colors.red} />
            </View>
          </View>

          {prevMonthExpenses > 0 && (
            <View style={s.momRow}>
              <View style={[s.momBadge, { backgroundColor: momUp ? colors.redBg : colors.greenBg }]}>
                <Feather name={momUp ? "arrow-up" : "arrow-down"} size={10} color={momUp ? colors.red : colors.green} />
                <Text style={[s.momText, { color: momUp ? colors.red : colors.green }]}>
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
                {monthTransactions.length > 0 ? formatCurrency(avgExpense, currency) : "—"}
              </Text>
              <Text style={[s.statLbl, { color: colors.mutedForeground }]}>{t("avgExpense")}</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.borderSoft }]} />
            <View style={s.stat}>
              <Text style={[s.statVal, { color: colors.foreground }]} numberOfLines={1}>
                {topCategory ? tCat(topCategory[0]).split(" ")[0] : "—"}
              </Text>
              <Text style={[s.statLbl, { color: colors.mutedForeground }]}>{t("topCategory")}</Text>
            </View>
          </View>
        </Card>

        {/* ── Insights ── */}
        {!isLoading && data && (
          <ExpenseInsightsCard
            monthExpenses={monthExpenses}
            prevMonthExpenses={prevMonthExpenses}
            monthTransactions={monthTransactions}
            budgetGoals={budgetGoals}
            currency={currency}
            colors={colors}
            tCat={tCat}
          />
        )}

        {/* ── Pro: Monthly Trend + Budget Goals ── */}
        {isSubscribed ? (
          <>
            {!isLoading && data && (
              <MonthlyTrend transactions={data.transactions} currency={currency} colors={colors} />
            )}
            {!isLoading && <OverallBudgetProgress budgetGoals={budgetGoals} currency={currency} colors={colors} />}
            <SectionLabel style={{ marginTop: 6 }}>{t("budgetGoals")}</SectionLabel>
            {budgetGoals.length ? (
              <ListCard>{budgetGoals.map((bg) => <BudgetRow key={bg.id} bg={bg} currency={currency} colors={colors} />)}</ListCard>
            ) : (
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: colors.accentBg }]}>
                  <Feather name="target" size={28} color={colors.accent} />
                </View>
                <Text style={s.emptyTitle}>{t("noBudgetGoals")}</Text>
                <Text style={s.emptyText}>Set monthly limits per category to stay on track.</Text>
              </View>
            )}
          </>
        ) : (
          <ProUpgradeCard
            features={[t("proGateFeatureTrend"), t("proGateFeatureBudgets")]}
            title={t("proGateTitle")}
            subtitle={t("proGateSub")}
            ctaLabel={t("proGateCta")}
            onUpgrade={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/pro"); }}
          />
        )}

        {/* ── Recurring Bills ── */}
        <SectionLabel style={{ marginTop: 6 }}>{t("recurringBills")}</SectionLabel>
        {isLoading ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}><ActivityIndicator color={colors.accent} /></View>
        ) : billsWithMeta.length > 0 ? (
          <View style={{ gap: 16 }}>
            <ForecastCard bills={billsWithMeta} currency={currency} colors={colors} />
            <CalendarStrip bills={billsWithMeta} colors={colors} />
            <BillSection label={t("overdue")} bills={groups.overdue} currency={currency} colors={colors} payingId={payingId} onPay={handlePay} onDelete={handleDeleteBill} />
            <BillSection label={t("dueToday")} bills={groups.dueToday} currency={currency} colors={colors} payingId={payingId} onPay={handlePay} onDelete={handleDeleteBill} />
            <BillSection label={t("thisWeek")} bills={groups.thisWeek} currency={currency} colors={colors} payingId={payingId} onPay={handlePay} onDelete={handleDeleteBill} />
            <BillSection label={t("billsThisMonth")} bills={groups.thisMonth} currency={currency} colors={colors} payingId={payingId} onPay={handlePay} onDelete={handleDeleteBill} />
            <BillSection label={t("later")} bills={groups.later} currency={currency} colors={colors} payingId={payingId} onPay={handlePay} onDelete={handleDeleteBill} />
          </View>
        ) : (
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: colors.accentBg }]}>
              <Feather name="calendar" size={28} color={colors.accent} />
            </View>
            <Text style={s.emptyTitle}>{t("noRecurringBills")}</Text>
            <Text style={s.emptyText}>{t("noRecurringBillsHint")}</Text>
          </View>
        )}

        {/* ── Transactions ── */}
        <SectionLabel style={{ marginTop: 6 }}>{t("transactions")}</SectionLabel>

        {/* Search + Sort */}
        <View style={s.searchRow}>
          <View style={[s.searchBar, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              style={[s.searchInput, { color: colors.foreground }]}
              placeholder="Search expenses…"
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

        {!isLoading && (filteredTransactions.length ? (
          <ListCard>
            {displayedTransactions.map((tx, i) => {
              const iconName = EXPENSE_CAT_ICONS[tx.category] ?? "tag";
              const iconColor = EXPENSE_CAT_COLORS[tx.category] ?? colors.red;
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
                    <Text style={[s.txAmt, { color: colors.foreground }]} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.65}>
                      -{formatCurrency(tx.amount, currency)}
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
            <View style={[s.emptyIcon, { backgroundColor: colors.redBg }]}>
              <Feather name="credit-card" size={28} color={colors.red} />
            </View>
            <Text style={s.emptyTitle}>{t("noExpenses")}</Text>
            <Text style={s.emptyText}>{t("noExpensesHint")}</Text>
          </View>
        ))}

        {/* Show more transactions */}
        {!isLoading && hasMore && (
          <Pressable
            onPress={() => setVisibleCount((v) => v + 10)}
            style={[s.showMoreBtn, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}
          >
            <Text style={[s.showMoreText, { color: colors.accent }]}>
              Show More ({filteredTransactions.length - visibleCount} remaining)
            </Text>
            <Feather name="chevron-down" size={14} color={colors.accent} />
          </Pressable>
        )}

      </ScrollView>

      {/* ── FAB ── */}
      <FloatingFab actions={fabActions} fabBottom={fabBottom} isOpen={fabOpen} onToggle={() => setFabOpen(v => !v)} />

      {/* ── Add Expense Sheet ── */}
      <Modal visible={addSheetOpen} transparent animationType="fade" onRequestClose={() => setAddSheetOpen(false)}>
        <KeyboardAvoidingView style={qs.kvOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAddSheetOpen(false)} />
          <View style={[qs.sheet, { backgroundColor: colors.card }]}>
            <View style={[qs.handle, { backgroundColor: colors.borderSoft }]} />
            <View style={qs.sheetHeader}>
              <Text style={[qs.sheetTitle, { color: colors.foreground }]}>{t("addExpense")}</Text>
              <Pressable onPress={() => setAddSheetOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[qs.closeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <View style={{ gap: 14 }}>
                <FormInput label={`${t("amountLabel")} (${currency})`} value={txAmount} onChangeText={(v) => setTxAmount(v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
                <FormInput label={t("descriptionLabel")} value={txDesc} onChangeText={setTxDesc} placeholder={t("descExpensePlaceholder")} />
                <View style={{ gap: 7 }}>
                  <SectionLabel>{t("categoryLabel")}</SectionLabel>
                  <CategoryPicker categories={EXPENSE_CATEGORIES} value={txCat} onChange={setTxCat} labelFn={tCat} />
                </View>
                <View style={{ gap: 7 }}>
                  <SectionLabel>{t("account")}</SectionLabel>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {([
                      { key: "cash" as const, label: t("cashLabel"), icon: "dollar-sign", balance: profile?.cashOnHand ?? 0 },
                      { key: "bank" as const, label: t("bankLabel"), icon: "credit-card", balance: profile?.bankBalance ?? 0 },
                      { key: "savings" as const, label: t("savingsLabel"), icon: "archive", balance: profile?.savingsBalance ?? 0 },
                    ]).map((opt) => {
                      const selected = txAccount === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => setTxAccount(opt.key)}
                          style={{ flex: 1, borderRadius: 10, borderWidth: 1.5, padding: 10, gap: 4, alignItems: "center",
                            borderColor: selected ? colors.red : colors.borderSoft,
                            backgroundColor: selected ? colors.redBg : colors.background,
                          }}
                        >
                          <Feather name={opt.icon as "home"} size={15} color={selected ? colors.red : colors.mutedForeground} />
                          <Text style={{ fontSize: 11.5, fontFamily: F.semibold, color: selected ? colors.red : colors.foreground }}>{opt.label}</Text>
                          <Text style={{ fontSize: 10, fontFamily: F.regular, color: colors.mutedForeground }}>{formatCurrency(opt.balance, currency)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <FormError>{txError}</FormError>
                <PrimaryButton label={t("saveExpense")} onPress={submitExpense} loading={addTx.isPending} color={colors.red} textColor="#fff" />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Expense Sheet ── */}
      <Modal visible={editSheetOpen} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView style={qs.kvOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeEdit} />
          <View style={[qs.sheet, { backgroundColor: colors.card }]}>
            <View style={[qs.handle, { backgroundColor: colors.borderSoft }]} />
            <View style={qs.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[qs.sheetTitle, { color: colors.foreground }]}>{t("edit")} {t("expenses")}</Text>
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
                <FormInput label={t("descriptionLabel")} value={editDesc} onChangeText={setEditDesc} placeholder={t("descExpensePlaceholder")} />
                <View style={{ gap: 7 }}>
                  <SectionLabel>{t("categoryLabel")}</SectionLabel>
                  <CategoryPicker categories={EXPENSE_CATEGORIES} value={editCat} onChange={setEditCat} labelFn={tCat} />
                </View>
                <FormError>{editError}</FormError>
                <PrimaryButton label={t("save")} onPress={submitEdit} loading={deleteTransaction.isPending || addTx.isPending} color={colors.red} textColor="#fff" />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Budget Goal Modal ── */}
      <Modal visible={budgetModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBudgetModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontFamily: F.bold, color: colors.foreground }}>{t("addBudgetGoal")}</Text>
              <Pressable onPress={() => setBudgetModalOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <BudgetForm onSaved={() => setBudgetModalOpen(false)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Bill Modal ── */}
      <AddBillModal visible={addBillVisible} onClose={() => setAddBillVisible(false)} currency={currency} colors={colors} />

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
      paddingHorizontal: hz, paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 26, fontFamily: F.bold },
    headerSub: { fontSize: 13, fontFamily: F.regular, marginTop: 2 },
    overdueChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    overdueChipText: { fontSize: 11, fontFamily: F.semibold },
    scroll: { paddingHorizontal: hz, paddingTop: 16, gap: 14, paddingBottom: 110 },

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
    txMeta: { fontSize: 11, fontFamily: F.medium, color: colors.mutedForeground, marginTop: 2 },
    txAmt: { fontSize: 13, fontFamily: F.bold, maxWidth: 110 },
    txDelete: { padding: 4 },

    empty: { alignItems: "center", paddingVertical: 36, gap: 10 },
    emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontSize: 16, fontFamily: F.semibold, color: colors.foreground },
    emptyText: { fontSize: 13, fontFamily: F.regular, color: colors.mutedForeground, textAlign: "center" },
    hint: { fontSize: 13, fontFamily: F.regular, color: colors.mutedForeground, paddingHorizontal: 4 },
    searchRow: { flexDirection: "row", gap: 8 },
    searchBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular },
    sortBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
    sortBtnText: { fontSize: 11, fontFamily: F.semibold },
    showMoreBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 13,
    },
    showMoreText: { fontSize: 13, fontFamily: F.semibold },
  });
}
