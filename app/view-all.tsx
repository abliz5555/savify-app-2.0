import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Loan, RecurringExpense, Transaction } from "@/lib/types";
import { useFinanceData } from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { useT } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { F } from "@/components/ui";

type ViewType = "transactions" | "income" | "expenses" | "loans" | "recurring";

function getTitle(type: ViewType): string {
  switch (type) {
    case "transactions": return "All Transactions";
    case "income": return "All Income";
    case "expenses": return "All Expenses";
    case "loans": return "All Loans";
    case "recurring": return "All Recurring Bills";
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

// ── Transaction row ────────────────────────────────────────────────────────────

function TxRow({
  description, amount, type, category, date, currency, colors,
}: {
  description: string; amount: number; type: string; category: string;
  date: string; currency: string; colors: ReturnType<typeof useColors>;
}) {
  const isIncome = type === "income";
  const amtColor = isIncome ? colors.green : colors.red;
  return (
    <View style={[row.container, { borderBottomColor: colors.borderSoft }]}>
      <View style={[row.icon, { backgroundColor: isIncome ? colors.green + "18" : colors.red + "18" }]}>
        <Feather name={isIncome ? "arrow-down-left" : "arrow-up-right"} size={14} color={amtColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[row.name, { color: colors.foreground }]} numberOfLines={1}>{description}</Text>
        <Text style={[row.sub, { color: colors.mutedForeground }]}>{category} · {formatDate(date)}</Text>
      </View>
      <Text style={[row.amount, { color: amtColor }]}>
        {isIncome ? "+" : "-"}{formatCurrency(amount, currency)}
      </Text>
    </View>
  );
}

// ── Loan row ───────────────────────────────────────────────────────────────────

function LoanRow({ name, amount, balance, currency, colors }: {
  name: string; amount: number; balance: number;
  currency: string; colors: ReturnType<typeof useColors>;
}) {
  const pct = amount > 0 ? Math.min(100, Math.round(((amount - balance) / amount) * 100)) : 0;
  return (
    <View style={[row.container, { borderBottomColor: colors.borderSoft }]}>
      <View style={[row.icon, { backgroundColor: colors.accentBg }]}>
        <Feather name="credit-card" size={14} color={colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[row.name, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
        <View style={{ height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: "hidden" }}>
          <View style={{ height: 4, width: `${pct}%` as `${number}%`, backgroundColor: colors.accent, borderRadius: 2 }} />
        </View>
        <Text style={[row.sub, { color: colors.mutedForeground }]}>{pct}% paid</Text>
      </View>
      <Text style={[row.amount, { color: colors.foreground }]}>{formatCurrency(balance, currency)}</Text>
    </View>
  );
}

// ── Recurring row ─────────────────────────────────────────────────────────────

function RecurringRow({ name, amount, category, frequency, currency, colors }: {
  name: string; amount: number; category: string; frequency: string;
  currency: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[row.container, { borderBottomColor: colors.borderSoft }]}>
      <View style={[row.icon, { backgroundColor: colors.accentBg }]}>
        <Feather name="repeat" size={14} color={colors.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[row.name, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
        <Text style={[row.sub, { color: colors.mutedForeground }]}>{category} · {frequency}</Text>
      </View>
      <Text style={[row.amount, { color: colors.foreground }]}>{formatCurrency(amount, currency)}</Text>
    </View>
  );
}

const row = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  name: { fontSize: 14, fontFamily: F.medium },
  sub: { fontSize: 12, fontFamily: F.regular, marginTop: 1 },
  amount: { fontSize: 14, fontFamily: F.semibold, flexShrink: 0 },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ViewAllScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: ViewType }>();
  const { currency } = useSettings();
  const { t } = useT();
  const { data, isLoading } = useFinanceData();
  const [search, setSearch] = useState("");

  const viewType = (type ?? "transactions") as ViewType;
  const { isTablet, hz } = useLayout();
  const topInsets = Platform.OS === "web" ? 67 : insets.top;

  const items = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();

    switch (viewType) {
      case "transactions":
        return data.transactions.filter(
          (tx) =>
            !q ||
            tx.description.toLowerCase().includes(q) ||
            tx.category.toLowerCase().includes(q) ||
            tx.createdAt.includes(q),
        );
      case "income":
        return data.transactions.filter(
          (tx) =>
            tx.type === "income" &&
            (!q || tx.description.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q)),
        );
      case "expenses":
        return data.transactions.filter(
          (tx) =>
            tx.type === "expense" &&
            (!q || tx.description.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q)),
        );
      case "loans":
        return data.loans.filter(
          (l) => !q || l.lenderName.toLowerCase().includes(q) || (l.description ?? "").toLowerCase().includes(q),
        );
      case "recurring":
        return data.recurring.filter(
          (r) => !q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q),
        );
    }
  }, [data, viewType, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[va.header, { paddingTop: topInsets + 8, paddingHorizontal: hz, backgroundColor: colors.background, borderBottomColor: colors.borderSoft }]}>
        <Pressable onPress={() => router.back()} style={va.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[va.title, { color: colors.foreground }]}>{getTitle(viewType)}</Text>
          {!isLoading && (
            <Text style={[va.count, { color: colors.mutedForeground }]}>
              {items.length} {items.length === 1 ? "record" : "records"}
              {search ? ` found for "${search}"` : ""}
            </Text>
          )}
        </View>
      </View>

      {/* Search bar */}
      <View style={[va.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.borderSoft }]}>
        <View style={[va.searchInner, { backgroundColor: colors.input, borderColor: colors.borderSoft }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[va.searchInput, { color: colors.foreground }]}
            placeholder={`Search ${getTitle(viewType).toLowerCase()}…`}
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x-circle" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={va.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ paddingBottom: insets.bottom + 32 }]}
        >
          {items.length === 0 ? (
            <View style={va.empty}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[va.emptyTitle, { color: colors.foreground }]}>
                {search ? "No results found" : "Nothing here yet"}
              </Text>
              <Text style={[va.emptySub, { color: colors.mutedForeground }]}>
                {search ? `No ${viewType} match "${search}". Try a different search.` : `Add some ${viewType} to see them here.`}
              </Text>
            </View>
          ) : (
            <View style={[va.listCard, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
              {viewType === "transactions" || viewType === "income" || viewType === "expenses"
                ? (items as Transaction[]).map((tx) => (
                    <TxRow
                      key={tx.id}
                      description={tx.description}
                      amount={tx.amount}
                      type={tx.type}
                      category={tx.category}
                      date={tx.createdAt}
                      currency={currency}
                      colors={colors}
                    />
                  ))
                : viewType === "loans"
                ? (items as Loan[]).map((l) => {
                    const paid = (l.payments ?? []).reduce((s, p) => s + p.amount, 0);
                    return (
                      <LoanRow
                        key={l.id}
                        name={l.lenderName}
                        amount={l.totalAmount}
                        balance={Math.max(l.totalAmount - paid, 0)}
                        currency={currency}
                        colors={colors}
                      />
                    );
                  })
                : (items as RecurringExpense[]).map((r) => (
                    <RecurringRow
                      key={r.id}
                      name={r.name}
                      amount={r.amount}
                      category={r.category}
                      frequency={r.frequency ?? "monthly"}
                      currency={currency}
                      colors={colors}
                    />
                  ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const va = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "flex-end", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  title: { fontSize: 22, fontFamily: F.bold, letterSpacing: -0.5 },
  count: { fontSize: 12, fontFamily: F.regular, marginTop: 1 },
  searchBar: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular, padding: 0 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  empty: { paddingTop: 60, paddingHorizontal: 32, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: F.semibold, textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: F.regular, textAlign: "center", lineHeight: 18 },
  listCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
});
