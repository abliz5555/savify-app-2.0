import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing, FadeInDown, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient, Stop, Circle } from "react-native-svg";
import { F } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { formatCompact, formatCurrency, localISODate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Slowly moving soft lights behind the header ─────────────────────────────

export function AnimatedGlow({ height }: { height: number }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const t = useSharedValue(0);
  const u = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
    u.value = withDelay(1500, withRepeat(withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t, u]);

  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-width * 0.25, width * 0.15]) },
      { translateY: interpolate(t.value, [0, 1], [-30, 30]) },
      { scale: interpolate(t.value, [0, 1], [1, 1.2]) },
    ],
  }));
  const b = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(u.value, [0, 1], [width * 0.35, -width * 0.05]) },
      { translateY: interpolate(u.value, [0, 1], [20, -20]) },
      { scale: interpolate(u.value, [0, 1], [1.1, 0.9]) },
    ],
  }));

  const blob = (color: string, id: string, size: number, opacity: number) => (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, overflow: "hidden", backgroundColor: colors.headerBg }]}>
      <Animated.View style={[{ position: "absolute", top: -60, left: 0 }, a]}>{blob(colors.glow[0], "g1", width * 1.1, 0.42)}</Animated.View>
      <Animated.View style={[{ position: "absolute", top: 40, left: 0 }, b]}>{blob(colors.glow[1], "g2", width * 0.95, 0.28)}</Animated.View>
      {/* fade into the page colour at the bottom */}
      <LinearGradient colors={["transparent", colors.background]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 90 }} />
    </View>
  );
}

// ─── Daily balance for the little chart ──────────────────────────────────────

export function balanceHistory(transactions: Transaction[], current: number, days = 30): number[] {
  const byDay: Record<string, number> = {};
  for (const tx of transactions) {
    const k = localISODate(new Date(tx.createdAt));
    const v = tx.type === "income" ? tx.amount : tx.type === "expense" ? -tx.amount : 0;
    byDay[k] = (byDay[k] ?? 0) + v;
  }
  const out: number[] = [];
  let bal = current;
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.unshift(bal);
    bal -= byDay[localISODate(d)] ?? 0; // balance at end of the previous day
  }
  return out;
}

function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const start = Date.now(); const from = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

// ─── The big balance card ────────────────────────────────────────────────────

export function BalanceCard({
  currency, total, history, monthNet, cash, bank, savings, onEdit,
}: {
  currency: string; total: number; history: number[]; monthNet: number;
  cash: number; bank: number; savings: number; onEdit: () => void;
}) {
  const colors = useColors();
  const [hidden, setHidden] = useState(false);
  useEffect(() => { AsyncStorage.getItem("@savify_hide_balance").then((v) => setHidden(v === "1")).catch(() => {}); }, []);
  const toggle = () => {
    Haptics.selectionAsync();
    setHidden((h) => { AsyncStorage.setItem("@savify_hide_balance", h ? "0" : "1").catch(() => {}); return !h; });
  };

  const shown = useCountUp(total);
  const start = total - monthNet;
  const pct = start !== 0 ? (monthNet / Math.abs(start)) * 100 : 0;
  const up = monthNet >= 0;

  // sparkline
  const W = 140, H = 52;
  const { line, area, length } = useMemo(() => {
    const pts = history.length > 1 ? history : [total, total];
    const min = Math.min(...pts), max = Math.max(...pts);
    const span = max - min || 1;
    const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - 6 - ((v - min) / span) * (H - 14)] as const);
    let d = `M ${xy[0]![0]} ${xy[0]![1]}`;
    let len = 0;
    for (let i = 1; i < xy.length; i++) {
      const [x0, y0] = xy[i - 1]!; const [x1, y1] = xy[i]!;
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
      len += Math.hypot(x1 - x0, y1 - y0) * 1.08;
    }
    return { line: d, area: `${d} L ${W} ${H} L 0 ${H} Z`, length: len };
  }, [history, total]);

  const draw = useSharedValue(0);
  useEffect(() => { draw.value = 0; draw.value = withDelay(250, withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) })); }, [line, draw]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: draw.value }));

  const mask = "••••••";
  return (
    <Animated.View entering={FadeInDown.duration(500).springify().damping(18)}>
      <LinearGradient colors={colors.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={b.card}>
        <View style={b.shine} pointerEvents="none" />
        <View style={b.row}>
          <Pressable onPress={toggle} hitSlop={10} style={b.labelRow} accessibilityLabel={hidden ? "Show balance" : "Hide balance"}>
            <Text style={b.label}>Total balance</Text>
            <Feather name={hidden ? "eye-off" : "eye"} size={15} color="rgba(255,255,255,0.75)" />
          </Pressable>
          <Pressable onPress={onEdit} hitSlop={10} style={b.edit}>
            <Feather name="sliders" size={13} color="#fff" />
            <Text style={b.editText}>Accounts</Text>
          </Pressable>
        </View>

        <Text style={b.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
          {hidden ? `${currency} ${mask}` : formatCurrency(shown, currency)}
        </Text>

        <View style={b.mid}>
          <View style={b.trendRow}>
            <View style={[b.trendPill, { backgroundColor: up ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.2)" }]}>
              <Feather name={up ? "arrow-up-right" : "arrow-down-right"} size={13} color={up ? "#6ee7b7" : "#fca5a5"} />
              <Text style={[b.trendText, { color: up ? "#6ee7b7" : "#fca5a5" }]}>{Math.abs(pct).toFixed(1)}%</Text>
            </View>
            <Text style={b.trendSub}>this month</Text>
          </View>
          <Svg width={W} height={H}>
            <Defs>
              <SvgLinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={0.28} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </SvgLinearGradient>
            </Defs>
            <AnimatedPath d={area} fill="url(#fill)" animatedProps={areaProps} />
            <AnimatedPath d={line} stroke="#ffffff" strokeOpacity={0.9} strokeWidth={2.5} fill="none" strokeLinecap="round"
              strokeDasharray={`${length} ${length}`} animatedProps={lineProps} />
          </Svg>
        </View>

        <View style={b.accounts}>
          {[["Cash", cash, "dollar-sign"], ["Bank", bank, "credit-card"], ["Savings", savings, "archive"]].map(([label, val, icon], i) => (
            <React.Fragment key={label as string}>
              {i > 0 && <View style={b.divider} />}
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Feather name={icon as "home"} size={11} color="rgba(255,255,255,0.65)" />
                  <Text style={b.accLabel}>{label as string}</Text>
                </View>
                <Text style={b.accVal} numberOfLines={1}>{hidden ? mask : formatCompact(val as number, currency)}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const b = StyleSheet.create({
  card: { borderRadius: 26, padding: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  shine: { position: "absolute", top: -80, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.06)" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: F.medium },
  edit: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20 },
  editText: { color: "#fff", fontSize: 12, fontFamily: F.semibold },
  mid: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4, gap: 8 },
  amount: { color: "#fff", fontSize: 36, fontFamily: F.bold, letterSpacing: -1, marginTop: 10 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  trendPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  trendText: { fontSize: 13, fontFamily: F.bold },
  trendSub: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: F.medium },
  accounts: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)" },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.12)" },
  accLabel: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: F.medium },
  accVal: { color: "#fff", fontSize: 15.5, fontFamily: F.semibold },
});

// ─── Four big shortcut tiles ─────────────────────────────────────────────────

export type Tile = { key: string; icon: React.ComponentProps<typeof Feather>["name"]; label: string; onPress: () => void; primary?: boolean };

export function ActionTiles({ tiles }: { tiles: Tile[] }) {
  const colors = useColors();
  return (
    <View style={tl.row}>
      {tiles.map((t, i) => (
        <Animated.View key={t.key} entering={FadeInDown.delay(120 + i * 70).duration(420)} style={{ flex: 1 }}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); t.onPress(); }}
            style={({ pressed }) => [tl.tile, { backgroundColor: colors.card, borderColor: colors.isDark ? colors.borderSoft : "transparent", transform: [{ scale: pressed ? 0.96 : 1 }] }]}
          >
            <View style={[tl.icon, { backgroundColor: t.primary ? colors.accent : colors.accentBg }]}>
              <Feather name={t.icon} size={20} color={t.primary ? colors.accentForeground : colors.accent} />
            </View>
            <Text style={[tl.label, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{t.label}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const tl = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  tile: {
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 6, alignItems: "center", gap: 8, borderWidth: 1, minHeight: 96,
    shadowColor: "#0f1115", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12.5, fontFamily: F.semibold, textAlign: "center", lineHeight: 16 },
});
