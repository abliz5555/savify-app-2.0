import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Card, F } from "@/components/ui";

export function ProUpgradeCard({
  features,
  onUpgrade,
  title,
  subtitle,
  ctaLabel,
}: {
  features: string[];
  onUpgrade: () => void;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
}) {
  const colors = useColors();

  return (
    <Card style={[pg.card, { borderColor: colors.accent + "55", borderWidth: 1 }]}>
      <View style={pg.header}>
        <View style={[pg.iconBg, { backgroundColor: colors.accentBg }]}>
          <Feather name="star" size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[pg.title, { color: colors.foreground }]}>
            {title ?? "Savify Pro"}
          </Text>
          <Text style={[pg.subtitle, { color: colors.mutedForeground }]}>
            {subtitle ?? "Powerful analytics for serious savers"}
          </Text>
        </View>
        <View style={[pg.proBadge, { backgroundColor: colors.accent + "20" }]}>
          <Feather name="lock" size={13} color={colors.accent} />
        </View>
      </View>

      <View style={[pg.divider, { backgroundColor: colors.borderSoft }]} />

      <View style={pg.features}>
        {features.map((f, i) => (
          <View key={i} style={pg.featureRow}>
            <View style={[pg.checkBox, { backgroundColor: colors.accentBg }]}>
              <Feather name="check" size={11} color={colors.accent} />
            </View>
            <Text style={[pg.featureText, { color: colors.foreground }]}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[pg.btn, { backgroundColor: colors.accent }]}
        onPress={onUpgrade}
        activeOpacity={0.84}
      >
        <Feather name="zap" size={15} color="#fff" />
        <Text style={pg.btnText}>{ctaLabel ?? "Upgrade to Pro"}</Text>
      </TouchableOpacity>

      <Text style={[pg.disclaimer, { color: colors.mutedForeground }]}>
        From $4.99/mo · Cancel anytime
      </Text>
    </Card>
  );
}

const pg = StyleSheet.create({
  card: { padding: 18, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBg: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 17, fontFamily: F.extrabold, letterSpacing: -0.2 },
  subtitle: { fontSize: 12.5, fontFamily: F.regular, marginTop: 2 },
  proBadge: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  divider: { height: StyleSheet.hairlineWidth },
  features: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkBox: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  featureText: { flex: 1, fontSize: 13.5, fontFamily: F.medium },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 14, borderRadius: 14, marginTop: 2,
  },
  btnText: { fontSize: 15, fontFamily: F.bold, color: "#fff" },
  disclaimer: { fontSize: 11, fontFamily: F.regular, textAlign: "center", marginTop: -6 },
});
