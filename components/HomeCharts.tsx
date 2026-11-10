import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";
import { Card, F } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { formatCompact, formatCurrency } from "@/lib/format";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const CATEGORY_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  "Food & Dining": "coffee", Transportation: "navigation", Housing: "home", Entertainment: "film",
  Healthcare: "heart", Shopping: "shopping-bag", Education: "book-open", Travel: "globe",
  Utilities: "zap", Other: "more-horizontal", Salary: "briefcase", Freelance: "pen-tool",
  Investment: "trending-up", Gift: "gift",
};

/** Calm, easy-to-tell-apart colours for chart slices (different lightness, not only hue). */
export function sliceColors(accent: string, dark: boolean): string[] {
  return dark
    ? [accent, "#60a5fa", "#fbbf24", "#c084fc", "#f87171", "#94a3b8"]
    : [accent, "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#94a3b8"];
}

// ─── This month: income / expenses / saved ───────────────────────────────────

export function MonthSummary({ currency, income, expenses, onPress }: { currency: string; income: number; expenses: number; onPress: () => void }) {
  const colors = useColors();
  const saved = income - expenses;
  const rate = income > 0 ? Math.round((saved / income) * 100) : 0;
  const good = saved >= 0;
  const month = new Date().toLocaleDateString("en", { month: "long" });
  return (
    <Animated.View entering={FadeInDown.delay(200).duration(450)}>
      <View style={m.head}>
        <Text style={[m.title, { color: colors.foreground }]}>This month</Text>
        <Text style={[m.sub, { color: colors.mutedForeground }]}>{month}</Text>
      </View>
      <Card>
        <View style={m.row}>
          <View style={m.col}>
            <View style={[m.icon, { backgroundColor: colors.greenBg }]}><Feather name="arrow-down-left" size={15} color={colors.green} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[m.lbl, { color: colors.mutedForeground }]}>Income</Text>
              <Text style={[m.val, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(income, currency)}</Text>
            </View>
          </View>
          <View style={[m.vline, { backgroundColor: colors.borderSoft }]} />
          <View style={m.col}>
            <View style={[m.icon, { backgroundColor: colors.redBg }]}><Feather name="arrow-up-right" size={15} color={colors.red} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[m.lbl, { color: colors.mutedForeground }]}>Expenses</Text>
              <Text style={[m.val, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(expenses, currency)}</Text>
            </View>
          </View>
        </View>
        <Pressable onPress={onPress} style={[m.saved, { backgroundColor: good ? colors.accentBg : colors.redBg }]}>
          <View style={[m.pig, { backgroundColor: colors.card }]}>
            <Feather name={good ? "shield" : "alert-triangle"} size={18} color={good ? colors.accent : colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[m.lbl, { color: colors.mutedForeground }]}>{good ? "You saved" : "You overspent"}</Text>
            <Text style={[m.savedVal, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(Math.abs(saved), currency)}</Text>
          </View>
          {income > 0 && (
            <View style={[m.badge, { backgroundColor: good ? colors.accent : colors.red }]}>
              <Text style={m.badgeText}>{good ? `${rate}%` : `${Math.abs(rate)}% over`}</Text>
            </View>
          )}
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Card>
    </Animated.View>
  );
}

const m = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 },
  title: { fontSize: 18, fontFamily: F.bold, letterSpacing: -0.3 },
  sub: { fontSize: 13, fontFamily: F.medium },
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  col: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  vline: { width: 1, height: 36, marginHorizontal: 12 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  lbl: { fontSize: 12.5, fontFamily: F.medium },
  val: { fontSize: 16, fontFamily: F.bold, letterSpacing: -0.3, marginTop: 1 },
  saved: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  pig: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  savedVal: { fontSize: 20, fontFamily: F.bold, letterSpacing: -0.4, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  badgeText: { color: "#fff", fontSize: 12.5, fontFamily: F.bold },
});

// ─── Donut: where the money went ─────────────────────────────────────────────

function Slice({ r, c, start, frac, color, i }: { r: number; c: number; start: number; frac: number; color: string; i: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = 0; p.value = withDelay(300 + i * 90, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })); }, [frac, i, p]);
  const gap = frac > 0.02 ? 3 : 0;
  const len = Math.max(0, frac * c - gap);
  const props = useAnimatedProps(() => ({ strokeDasharray: `${len * p.value} ${c}` }));
  return (
    <AnimatedCircle
      cx={0} cy={0} r={r} stroke={color} strokeWidth={16} fill="none" strokeLinecap="butt"
      rotation={start * 360} animatedProps={props}
    />
  );
}

export function CategoryDonut({
  currency, items, total, labelFn, onPress,
}: {
  currency: string; items: { category: string; amount: number }[]; total: number;
  labelFn: (c: string) => string; onPress: () => void;
}) {
  const colors = useColors();
  if (!items.length || total <= 0) return null;
  const pal = sliceColors(colors.accent, colors.isDark);
  const top = items.slice(0, 5);
  const otherAmt = Math.max(0, total - top.reduce((s, x) => s + x.amount, 0));
  const rows = otherAmt > 0.5 ? [...top, { category: "Other", amount: otherAmt }] : top;

  const size = 136, r = 54, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Animated.View entering={FadeInDown.delay(260).duration(450)}>
      <View style={m.head}>
        <Text style={[m.title, { color: colors.foreground }]}>Where it went</Text>
        <Pressable onPress={onPress} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={{ color: colors.accent, fontFamily: F.semibold, fontSize: 13.5 }}>View all</Text>
          <Feather name="chevron-right" size={16} color={colors.accent} />
        </Pressable>
      </View>
      <Card style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <G x={size / 2} y={size / 2} rotation={-90}>
              <Circle cx={0} cy={0} r={r} stroke={colors.muted} strokeWidth={16} fill="none" />
              {rows.map((row, i) => {
                const frac = row.amount / total;
                const start = acc; acc += frac;
                return <Slice key={row.category} r={r} c={c} start={start} frac={frac} color={pal[i % pal.length]!} i={i} />;
              })}
            </G>
          </Svg>
          <Text style={{ fontSize: 11.5, fontFamily: F.medium, color: colors.mutedForeground }}>Spent</Text>
          <Text style={{ fontSize: 17, fontFamily: F.bold, color: colors.foreground, letterSpacing: -0.3 }} numberOfLines={1}>{formatCompact(total, currency)}</Text>
        </View>
        <View style={{ flex: 1, gap: 9 }}>
          {rows.map((row, i) => (
            <View key={row.category} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: pal[i % pal.length] + "22", alignItems: "center", justifyContent: "center" }}>
                <Feather name={CATEGORY_ICON[row.category] ?? "circle"} size={13} color={pal[i % pal.length]} />
              </View>
              <Text style={{ flex: 1, fontSize: 13, fontFamily: F.medium, color: colors.foreground }} numberOfLines={1}>{labelFn(row.category)}</Text>
              <Text style={{ fontSize: 13, fontFamily: F.bold, color: colors.foreground }}>{Math.round((row.amount / total) * 100)}%</Text>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}
