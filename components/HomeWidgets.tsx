import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, F } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { formatCompact, formatCurrency } from "@/lib/format";

type Colors = ReturnType<typeof useColors>;

// ─── Big balance card at the top of Home ─────────────────────────────────────

export function HeroBalance({
  currency, total, cash, bank, savings, income, spent, hasProfile, onEdit,
}: {
  currency: string;
  total: number;
  cash: number;
  bank: number;
  savings: number;
  income: number;
  spent: number;
  hasProfile: boolean;
  onEdit: () => void;
}) {
  const colors = useColors();
  const rate = income > 0 ? Math.round(((income - spent) / income) * 100) : null;
  const spentPct = income > 0 ? Math.min(100, (spent / income) * 100) : spent > 0 ? 100 : 0;
  const barColor = spentPct >= 100 ? "#f87171" : spentPct >= 80 ? "#fbbf24" : "#34d399";
  const month = new Date().toLocaleDateString("en", { month: "long" });

  return (
    <LinearGradient
      colors={colors.isDark ? ["#1d1e38", "#15171c"] : ["#15161c", "#2a2b52"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={h.card}
    >
      <View style={h.topRow}>
        <Text style={h.label}>Total balance</Text>
        <Pressable onPress={onEdit} hitSlop={10} style={h.editBtn}>
          <Feather name={hasProfile ? "edit-2" : "plus"} size={12} color="#fff" />
          <Text style={h.editText}>{hasProfile ? "Edit" : "Set up"}</Text>
        </Pressable>
      </View>
      <Text style={[h.amount, total < 0 && { color: "#fca5a5" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {formatCurrency(total, currency)}
      </Text>

      <View style={h.accounts}>
        <Account icon="dollar-sign" label="Cash" value={formatCompact(cash, currency)} />
        <View style={h.vDivider} />
        <Account icon="credit-card" label="Bank" value={formatCompact(bank, currency)} />
        <View style={h.vDivider} />
        <Account icon="archive" label="Savings" value={formatCompact(savings, currency)} />
      </View>

      <View style={h.monthBox}>
        <View style={h.monthRow}>
          <Text style={h.monthTitle}>{month}</Text>
          {rate !== null && (
            <Text style={[h.rate, { color: rate >= 0 ? "#6ee7b7" : "#fca5a5" }]}>
              {rate >= 0 ? `Saving ${rate}%` : `Over by ${Math.abs(rate)}%`}
            </Text>
          )}
        </View>
        <View style={h.track}>
          <View style={[h.fill, { width: `${spentPct}%`, backgroundColor: barColor }]} />
        </View>
        <View style={h.monthRow}>
          <View style={h.flow}>
            <Feather name="arrow-down-left" size={13} color="#6ee7b7" />
            <Text style={h.flowText}>In {formatCompact(income, currency)}</Text>
          </View>
          <View style={h.flow}>
            <Feather name="arrow-up-right" size={13} color="#fca5a5" />
            <Text style={h.flowText}>Out {formatCompact(spent, currency)}</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function Account({ icon, label, value }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Feather name={icon} size={11} color="rgba(255,255,255,0.6)" />
        <Text style={h.accLabel}>{label}</Text>
      </View>
      <Text style={h.accValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

const h = StyleSheet.create({
  card: { borderRadius: 22, padding: 20, gap: 4, overflow: "hidden" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: "rgba(255,255,255,0.7)", fontSize: 13.5, fontFamily: F.medium },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  editText: { color: "#fff", fontSize: 12, fontFamily: F.semibold },
  amount: { color: "#fff", fontSize: 34, fontFamily: F.bold, letterSpacing: -1, marginTop: 2 },
  accounts: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 12 },
  vDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.12)" },
  accLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontFamily: F.medium },
  accValue: { color: "#fff", fontSize: 15, fontFamily: F.semibold },
  monthBox: { marginTop: 18, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, gap: 9 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthTitle: { color: "#fff", fontSize: 13, fontFamily: F.semibold },
  rate: { fontSize: 12.5, fontFamily: F.semibold },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.14)", overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  flow: { flexDirection: "row", alignItems: "center", gap: 5 },
  flowText: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontFamily: F.medium },
});

// ─── Row of big, easy buttons ────────────────────────────────────────────────

export type QuickAction = {
  key: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  color: string;
  bg: string;
  locked?: boolean;
  onPress: () => void;
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const colors = useColors();
  return (
    <View style={q.row}>
      {actions.map((a) => (
        <Pressable key={a.key} onPress={a.onPress} style={({ pressed }) => [q.item, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={[q.icon, { backgroundColor: a.bg }]}>
            <Feather name={a.icon} size={20} color={a.color} />
            {a.locked && (
              <View style={[q.lock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="lock" size={8} color={colors.mutedForeground} />
              </View>
            )}
          </View>
          <Text style={[q.label, { color: colors.foreground }]} numberOfLines={1}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const q = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  item: { alignItems: "center", gap: 7, flex: 1 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  lock: { position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  label: { fontSize: 12, fontFamily: F.medium },
});

// ─── Budget alerts (only shows when something needs attention) ───────────────

export type BudgetStatus = { id: string; category: string; monthlyLimit: number; spent: number };

export function BudgetAlerts({
  budgets, currency, onPress, labelFn,
}: {
  budgets: BudgetStatus[];
  currency: string;
  onPress: () => void;
  labelFn?: (c: string) => string;
}) {
  const colors = useColors();
  const now = new Date();
  const day = now.getDate();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const alerts = budgets
    .filter((b) => b.monthlyLimit > 0)
    .map((b) => {
      const used = (b.spent / b.monthlyLimit) * 100;
      const projected = day >= 3 ? (b.spent / day) * dim : b.spent;
      const level: "over" | "near" | "pace" | null =
        used >= 100 ? "over" : used >= 80 ? "near" : projected > b.monthlyLimit * 1.05 && used >= 40 ? "pace" : null;
      return { ...b, used, level };
    })
    .filter((b) => b.level)
    .sort((a, b) => b.used - a.used)
    .slice(0, 3);

  if (!alerts.length) return null;

  return (
    <Pressable onPress={onPress}>
      <Card style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="bell" size={15} color={colors.amber} />
          <Text style={{ flex: 1, fontSize: 14, fontFamily: F.semibold, color: colors.foreground }}>Budget alerts</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
        {alerts.map((a) => {
          const c = a.level === "over" ? colors.red : colors.amber;
          const text = a.level === "over"
            ? `Over by ${formatCompact(a.spent - a.monthlyLimit, currency)}`
            : a.level === "near"
            ? `${Math.round(a.used)}% used · ${formatCompact(a.monthlyLimit - a.spent, currency)} left`
            : "Spending fast — may run out";
          return (
            <View key={a.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ fontSize: 13.5, fontFamily: F.medium, color: colors.foreground }}>{labelFn ? labelFn(a.category) : a.category}</Text>
                <Text style={{ fontSize: 12.5, fontFamily: F.semibold, color: c, flexShrink: 1, textAlign: "right" }}>{text}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: "hidden" }}>
                <View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, a.used)}%`, backgroundColor: c }} />
              </View>
            </View>
          );
        })}
      </Card>
    </Pressable>
  );
}

// ─── Small stat chips (assets / debts / lent) ────────────────────────────────

export function MiniTiles({ items }: { items: { label: string; value: string; color: string; icon: React.ComponentProps<typeof Feather>["name"] }[] }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {items.map((i) => (
        <Card key={i.label} style={{ flex: 1, padding: 12, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name={i.icon} size={13} color={i.color} />
            <Text style={{ fontSize: 12, fontFamily: F.medium, color: colors.mutedForeground }} numberOfLines={1}>{i.label}</Text>
          </View>
          <Text style={{ fontSize: 16, fontFamily: F.bold, color: colors.foreground, letterSpacing: -0.3 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {i.value}
          </Text>
        </Card>
      ))}
    </View>
  );
}

export type { Colors };
