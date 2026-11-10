import { Feather } from "@expo/vector-icons";
import { billDueDate } from "@/lib/bills";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAddRecurring, useDeleteRecurring, useFinanceData, usePayRecurring,
} from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { EXPENSE_CATEGORIES, formatCurrency, localISODate } from "@/lib/format";
import type { RecurringExpense } from "@/lib/types";
import {
  Card, CategoryPicker, F, FormError, FormInput,
  ListCard, PrimaryButton, SectionLabel,
} from "@/components/ui";
import { FloatingFab } from "@/components/fab-menu";
import type { FabAction } from "@/components/fab-menu";
import {
  scheduleBillNotifications,
  cancelBillNotifications,
} from "@/lib/notifications";

// ── Date helpers ──────────────────────────────────────────────────────────────

function getEffectiveDueDate(bill: RecurringExpense): Date {
  return billDueDate(bill);
}

function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function formatDueLabel(daysUntil: number): string {
  if (daysUntil < -1) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil === -1) return "1d overdue";
  if (daysUntil === 0) return "Due today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil < 7) return `In ${daysUntil} days`;
  const d = new Date();
  d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function formatFrequency(freq: string | null | undefined): string {
  const map: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };
  return map[(freq ?? "monthly").toLowerCase()] ?? "Monthly";
}

const FREQUENCIES = ["Daily", "Weekly", "Monthly", "Yearly"];
const DUE_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

type BillWithMeta = RecurringExpense & { nextDue: Date; daysUntil: number };

// ── Grouping ──────────────────────────────────────────────────────────────────

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

// ── Calendar strip ────────────────────────────────────────────────────────────

function CalendarStrip({
  bills, colors,
}: { bills: BillWithMeta[]; colors: ReturnType<typeof useColors> }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 31 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = localISODate(d);
      const dayBills = bills.filter(
        (b) => localISODate(b.nextDue) === dateStr,
      );
      return { date: d, dateStr, dayBills, isToday: i === 0 };
    });
  }, [bills]);

  const selectedBills = useMemo(
    () => days.find((d) => d.dateStr === selectedDate)?.dayBills ?? [],
    [days, selectedDate],
  );

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cs.stripRow}
      >
        {days.map(({ date, dateStr, dayBills, isToday }) => {
          const isSelected = selectedDate === dateStr;
          const hasOverdue = dayBills.some((b) => b.daysUntil < 0);
          const dotColor = hasOverdue ? colors.red : colors.accent;

          return (
            <Pressable
              key={dateStr}
              onPress={() => setSelectedDate(isSelected ? null : dateStr)}
              style={[
                cs.dayCell,
                {
                  backgroundColor: isSelected ? colors.accent : colors.card,
                  borderColor: isToday && !isSelected ? colors.accent : colors.borderSoft,
                  borderWidth: isToday && !isSelected ? 1.5 : 1,
                },
              ]}
            >
              <Text style={[cs.dayLetter, { color: isSelected ? "#fff" : colors.mutedForeground }]}>
                {date.toLocaleDateString("en", { weekday: "short" }).slice(0, 1)}
              </Text>
              <Text style={[cs.dayNum, { color: isSelected ? "#fff" : isToday ? colors.accent : colors.foreground }]}>
                {date.getDate()}
              </Text>
              <View style={cs.dotRow}>
                {dayBills.length > 0 && (
                  <View style={[cs.dot, { backgroundColor: isSelected ? "rgba(255,255,255,0.85)" : dotColor }]} />
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedBills.length > 0 && (
        <View style={[cs.popup, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          {selectedBills.map((b) => (
            <View key={b.id} style={cs.popupRow}>
              <Text style={[cs.popupName, { color: colors.foreground }]} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={[cs.popupDue, { color: colors.mutedForeground }]}>
                {formatDueLabel(b.daysUntil)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const cs = StyleSheet.create({
  stripRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  dayCell: {
    width: 46, borderRadius: 12, paddingVertical: 8,
    alignItems: "center", gap: 2,
  },
  dayLetter: { fontSize: 10, fontFamily: F.medium },
  dayNum: { fontSize: 15, fontFamily: F.bold },
  dotRow: { height: 6, justifyContent: "center", alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  popup: {
    marginHorizontal: 16, marginTop: 6, borderRadius: 12, padding: 12,
    borderWidth: 1, gap: 8,
  },
  popupRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  popupName: { fontSize: 13, fontFamily: F.semibold, flex: 1 },
  popupDue: { fontSize: 12, fontFamily: F.medium },
});

// ── Forecast card ─────────────────────────────────────────────────────────────

function ForecastCard({
  bills, currency, colors,
}: { bills: BillWithMeta[]; currency: string; colors: ReturnType<typeof useColors> }) {
  const { t } = useT();
  const overdue = bills.filter((b) => b.daysUntil < 0).length;
  const upcoming = bills.filter((b) => b.daysUntil >= 0 && b.daysUntil <= 30).length;
  const monthTotal = bills
    .filter((b) => b.daysUntil >= 0 && b.daysUntil <= 30)
    .reduce((s, b) => s + b.amount, 0);

  return (
    <Card style={[fc.card, { backgroundColor: colors.accentBg, borderColor: colors.accent + "30", borderWidth: 1 }]}>
      <View style={fc.top}>
        <View style={[fc.iconWrap, { backgroundColor: colors.accent + "20" }]}>
          <Feather name="calendar" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[fc.label, { color: colors.accent }]}>{t("billForecastLabel")}</Text>
          <Text style={[fc.sub, { color: colors.mutedForeground }]}>{t("next30Days")}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[fc.total, { color: colors.foreground }]}>{formatCurrency(monthTotal, currency)}</Text>
          <Text style={[fc.subAmt, { color: colors.mutedForeground }]}>
            {bills.length} {bills.length !== 1 ? t("billsTotal") : t("billTotal")}
          </Text>
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

const fc = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
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

// ── Bill card ─────────────────────────────────────────────────────────────────

function BillCard({
  bill, currency, colors, paying, onPay, onDelete,
}: {
  bill: BillWithMeta; currency: string;
  colors: ReturnType<typeof useColors>;
  paying: boolean; onPay: () => void; onDelete: () => void;
}) {
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
          <Text style={[bk.name, { color: colors.foreground }]} numberOfLines={1}>
            {bill.name}
          </Text>
          <Text style={[bk.sub, { color: colors.mutedForeground }]}>
            {bill.category} · {formatFrequency(bill.frequency)}
          </Text>
          {!!bill.notes && (
            <Text style={[bk.notes, { color: colors.mutedForeground }]} numberOfLines={2}>
              {bill.notes}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <Text style={[bk.amount, { color: colors.foreground }]}>
            {formatCurrency(bill.amount, currency)}
          </Text>
          <View style={[bk.badge, { backgroundColor: accentBg }]}>
            <Text style={[bk.badgeText, { color: accentCol }]}>
              {formatDueLabel(bill.daysUntil)}
            </Text>
          </View>
        </View>
      </View>
      <View style={[bk.actions, { borderTopColor: colors.borderSoft }]}>
        <Pressable
          onPress={onPay}
          disabled={paying}
          style={[bk.payBtn, { backgroundColor: accentCol + "1f" }]}
        >
          {paying ? (
            <ActivityIndicator size="small" color={accentCol} />
          ) : (
            <>
              <Feather name="check" size={13} color={accentCol} />
              <Text style={[bk.payText, { color: accentCol }]}>Mark Paid</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={[bk.delBtn, { borderColor: colors.borderSoft }]}
        >
          <Feather name="trash-2" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const bk = StyleSheet.create({
  card: {
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 0,
    borderLeftWidth: 3, overflow: "hidden",
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingBottom: 10 },
  iconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  name: { fontSize: 14, fontFamily: F.semibold },
  sub: { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  notes: { fontSize: 11, fontFamily: F.regular, marginTop: 3, fontStyle: "italic" },
  amount: { fontSize: 15, fontFamily: F.bold },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontFamily: F.semibold },
  actions: {
    flexDirection: "row", gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 9,
  },
  payBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, borderRadius: 8, paddingVertical: 7, minHeight: 34,
  },
  payText: { color: "#fff", fontSize: 13, fontFamily: F.semibold },
  delBtn: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
    alignItems: "center", justifyContent: "center",
  },
});

// ── Bill section ──────────────────────────────────────────────────────────────

function BillSection({
  label, bills, currency, colors, payingId, onPay, onDelete,
}: {
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
            {i > 0 && (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft, marginHorizontal: 14 }} />
            )}
            <BillCard
              bill={b}
              currency={currency}
              colors={colors}
              paying={payingId === b.id}
              onPay={() => onPay(b.id)}
              onDelete={() => onDelete(b)}
            />
          </React.Fragment>
        ))}
      </ListCard>
    </View>
  );
}

// ── Add Bill modal ─────────────────────────────────────────────────────────────

function AddBillModal({
  visible, onClose, currency, colors,
}: {
  visible: boolean; onClose: () => void;
  currency: string; colors: ReturnType<typeof useColors>;
}) {
  const add = useAddRecurring();
  const { t, tCat } = useT();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [frequency, setFrequency] = useState("Monthly");
  const [dueDay, setDueDay] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setName(""); setAmount(""); setCategory("Utilities");
    setFrequency("Monthly"); setDueDay("1"); setNotes(""); setError("");
  };

  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!name.trim()) { setError("Enter a bill name"); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid amount"); return; }
    setError("");
    const freq = frequency.toLowerCase() as "daily" | "weekly" | "monthly" | "yearly";
    const day = parseInt(dueDay, 10) || 1;
    try {
      const result = await add.mutateAsync({
        name: name.trim(), amount: amt, category,
        dueDay: day, active: true,
        frequency: freq,
        notes: notes.trim() || null,
        nextDueDate: null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const r = result as RecurringExpense | undefined;
      if (r?.id && r?.nextDueDate) {
        scheduleBillNotifications(r.id, name.trim(), amt, currency, r.nextDueDate).catch(() => {});
      }
      reset();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add bill");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={am.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        <View style={[am.sheet, { backgroundColor: colors.card }]}>
          <View style={[am.handle, { backgroundColor: colors.borderSoft }]} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text style={[am.title, { color: colors.foreground }]}>{t("addRecurringBillTitle")}</Text>
            <View style={{ gap: 14 }}>
              <FormInput
                label={t("billNameLabel")}
                value={name}
                onChangeText={setName}
                placeholder={t("billNamePlaceholder")}
                autoFocus
              />
              <FormInput
                label={`${t("amountLabel")} (${currency})`}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
              <View style={{ gap: 7 }}>
                <SectionLabel>{t("frequencyLabel")}</SectionLabel>
                <CategoryPicker
                  categories={FREQUENCIES}
                  value={frequency}
                  onChange={setFrequency}
                  labelFn={(f) => {
                    if (f === "Daily")   return t("freqDaily");
                    if (f === "Weekly")  return t("freqWeekly");
                    if (f === "Monthly") return t("freqMonthly");
                    if (f === "Yearly")  return t("freqYearly");
                    return f;
                  }}
                />
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
              <FormInput
                label={t("notesOptionalLabel")}
                value={notes}
                onChangeText={setNotes}
                placeholder={t("notesPlaceholder")}
              />
              <FormError>{error}</FormError>
              <PrimaryButton label={t("addBill")} onPress={submit} loading={add.isPending} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
    maxHeight: "90%",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 16,
  },
  title: { fontSize: 18, fontFamily: F.bold, marginBottom: 16 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BillsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currency } = useSettings();
  const { t } = useT();
  const { data, isLoading, isRefetching, refetch } = useFinanceData();
  const del = useDeleteRecurring();
  const pay = usePayRecurring();
  const topInsets = Platform.OS === "web" ? 67 : insets.top;
  const bottomInsets = Platform.OS === "web" ? 0 : insets.bottom;
  const fabBottom = Platform.OS === "web" ? 84 : Math.max(bottomInsets, 10) + 74;

  const [fabOpen, setFabOpen] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    return () => setFabOpen(false);
  }, []));

  const billsWithMeta = useMemo<BillWithMeta[]>(() => {
    if (!data) return [];
    return data.recurring
      .filter((r) => r.active)
      .map((r) => {
        const nextDue = getEffectiveDueDate(r);
        const daysUntil = getDaysUntil(nextDue);
        return { ...r, nextDue, daysUntil };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [data]);

  const groups = useMemo(() => groupBills(billsWithMeta), [billsWithMeta]);

  const handlePay = (id: string) => {
    const bill = billsWithMeta.find((b) => b.id === id);
    if (!bill) return;
    const doPay = async (account?: "cash" | "bank") => {
      setPayingId(id);
      try {
        const result = await pay.mutateAsync({ id, account });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result?.nextDueDate) {
          scheduleBillNotifications(id, bill.name, bill.amount, currency, result.nextDueDate).catch(() => {});
        }
      } catch (e) {
        Alert.alert("Could not record payment", e instanceof Error ? e.message : "Please try again.");
      } finally {
        setPayingId(null);
      }
    };
    Alert.alert(
      `Pay ${bill.name}`,
      `${formatCurrency(bill.amount, currency)} will be recorded as an expense and the next due date will be set.\n\nWhere did the money come from?`,
      [
        { text: "Bank", onPress: () => doPay("bank") },
        { text: "Cash", onPress: () => doPay("cash") },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const handleDelete = (bill: BillWithMeta) => {
    Alert.alert(t("deleteBillTitle"), `Delete "${bill.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          cancelBillNotifications(bill.id).catch(() => {});
          del.mutate(bill.id);
        },
      },
    ]);
  };

  const fabActions: FabAction[] = [
    {
      icon: "plus-circle",
      label: t("addBill"),
      desc: t("trackRecurringPayment"),
      iconBg: colors.accentBg,
      iconColor: colors.accent,
      premium: false,
      onPress: () => {
        setFabOpen(false);
        setTimeout(() => setAddVisible(true), 220);
      },
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ── Sticky header ── */}
      <View style={[sc.header, {
        paddingTop: topInsets + 10,
        backgroundColor: colors.background,
        borderBottomColor: colors.borderSoft,
      }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)"))} hitSlop={10} accessibilityLabel="Back"
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted, marginRight: 12, alignSelf: "center" }}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[sc.title, { color: colors.foreground }]}>{t("bills")}</Text>
          <Text style={[sc.sub, { color: colors.mutedForeground }]}>
            {t("billsSubtitle")}
          </Text>
        </View>
        {groups.overdue.length > 0 && (
          <View style={[sc.chip, { backgroundColor: colors.redBg }]}>
            <Feather name="alert-circle" size={11} color={colors.red} />
            <Text style={[sc.chipText, { color: colors.red }]}>
              {groups.overdue.length} overdue
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={sc.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
      >
        {isLoading ? (
          <View style={sc.loading}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : billsWithMeta.length > 0 ? (
          <>
            <BillSection
              label={t("overdue")}
              bills={groups.overdue}
              currency={currency}
              colors={colors}
              payingId={payingId}
              onPay={handlePay}
              onDelete={handleDelete}
            />
            <BillSection
              label={t("dueToday")}
              bills={groups.dueToday}
              currency={currency}
              colors={colors}
              payingId={payingId}
              onPay={handlePay}
              onDelete={handleDelete}
            />
            <BillSection
              label={t("thisWeek")}
              bills={groups.thisWeek}
              currency={currency}
              colors={colors}
              payingId={payingId}
              onPay={handlePay}
              onDelete={handleDelete}
            />
            <BillSection
              label={t("billsThisMonth")}
              bills={groups.thisMonth}
              currency={currency}
              colors={colors}
              payingId={payingId}
              onPay={handlePay}
              onDelete={handleDelete}
            />
            <BillSection
              label={t("later")}
              bills={groups.later}
              currency={currency}
              colors={colors}
              payingId={payingId}
              onPay={handlePay}
              onDelete={handleDelete}
            />
            <CalendarStrip bills={billsWithMeta} colors={colors} />
            <ForecastCard bills={billsWithMeta} currency={currency} colors={colors} />
          </>
        ) : (
          <View style={sc.empty}>
            <View style={[sc.emptyIcon, { backgroundColor: colors.accentBg }]}>
              <Feather name="calendar" size={32} color={colors.accent} />
            </View>
            <Text style={[sc.emptyTitle, { color: colors.foreground }]}>No recurring bills</Text>
            <Text style={[sc.emptyText, { color: colors.mutedForeground }]}>
              Tap the + button to add your first recurring bill. Savify will track due dates and send you reminders automatically.
            </Text>
          </View>
        )}

      </ScrollView>

      <FloatingFab
        actions={fabActions}
        fabBottom={fabBottom}
        isOpen={fabOpen}
        onToggle={() => setFabOpen((v) => !v)}
      />

      <AddBillModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        currency={currency}
        colors={colors}
      />
    </View>
  );
}

const sc = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 26, fontFamily: F.bold },
  sub: { fontSize: 13, fontFamily: F.regular, marginTop: 2 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontFamily: F.semibold },
  scroll: { padding: 16, gap: 16, paddingBottom: 110 },
  loading: { paddingTop: 60, alignItems: "center" },
  empty: { paddingTop: 60, paddingHorizontal: 32, alignItems: "center", gap: 14 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontFamily: F.bold, textAlign: "center" },
  emptyText: { fontSize: 13.5, fontFamily: F.regular, textAlign: "center", lineHeight: 20 },
});
