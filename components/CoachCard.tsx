import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { F, Card } from "@/components/ui";
import { useFinancialProfile } from "@/contexts/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { generateTips, type Tip } from "@/lib/coach";
import type { AggregateData } from "@/lib/types";

/**
 * Smart Coach on the home screen.
 * Free users see the most important tip; Pro users see all of them.
 * Tips are calculated on the phone — instant, private and free.
 */
export function CoachCard({
  data,
  currency,
  isSubscribed,
  onUpgrade,
}: {
  data: AggregateData | undefined;
  currency: string;
  isSubscribed: boolean;
  onUpgrade: () => void;
}) {
  const colors = useColors();
  const { data: profile } = useFinancialProfile();
  const [expanded, setExpanded] = useState(false);

  const tips = useMemo(() => generateTips(data, currency, profile, 6), [data, currency, profile]);
  if (!data || tips.length === 0) return null;

  const visible = isSubscribed ? (expanded ? tips : tips.slice(0, 3)) : tips.slice(0, 1);
  const hidden = tips.length - visible.length;

  const tone = (tr: Tip["trend"]) =>
    tr === "up" ? { bg: colors.greenBg, fg: colors.green }
    : tr === "down" ? { bg: colors.redBg, fg: colors.red }
    : { bg: colors.accentBg, fg: colors.accent };

  return (
    <Card>
      <View style={cc.header}>
        <View style={[cc.badge, { backgroundColor: colors.accentBg }]}>
          <Feather name="zap" size={14} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cc.title, { color: colors.foreground }]}>Smart Coach</Text>
          <Text style={[cc.subtitle, { color: colors.mutedForeground }]}>Tips based on your real numbers</Text>
        </View>
      </View>

      {visible.map((tip) => {
        const c = tone(tip.trend);
        return (
          <View key={tip.id} style={[cc.row, { borderTopColor: colors.borderSoft }]}>
            <View style={[cc.icon, { backgroundColor: c.bg }]}>
              <Text style={{ fontSize: 16 }}>{tip.icon}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[cc.headline, { color: colors.foreground }]}>{tip.title}</Text>
              <Text style={[cc.detail, { color: colors.mutedForeground }]}>{tip.message}</Text>
              {!!tip.saving && (
                <View style={[cc.chip, { backgroundColor: colors.greenBg }]}>
                  <Feather name="trending-up" size={11} color={colors.green} />
                  <Text style={[cc.chipText, { color: colors.green }]}>{tip.saving}</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {isSubscribed ? (
        tips.length > 3 && (
          <Pressable onPress={() => setExpanded((v) => !v)} style={[cc.more, { borderTopColor: colors.borderSoft }]}>
            <Text style={[cc.moreText, { color: colors.accent }]}>{expanded ? "Show less" : `Show ${hidden} more tips`}</Text>
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.accent} />
          </Pressable>
        )
      ) : (
        <Pressable onPress={onUpgrade} style={[cc.more, { borderTopColor: colors.borderSoft }]}>
          <Feather name="lock" size={13} color={colors.accent} />
          <Text style={[cc.moreText, { color: colors.accent }]}>
            {hidden > 0 ? `Unlock ${hidden} more tips with Pro` : "Get all tips with Pro"}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const cc = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 12 },
  badge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: F.semibold },
  subtitle: { fontSize: 12, fontFamily: F.regular, marginTop: 1 },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  headline: { fontSize: 14, fontFamily: F.semibold, lineHeight: 19 },
  detail: { fontSize: 13, fontFamily: F.regular, lineHeight: 18 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 3 },
  chipText: { fontSize: 11.5, fontFamily: F.semibold },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth },
  moreText: { fontSize: 13.5, fontFamily: F.semibold },
});
