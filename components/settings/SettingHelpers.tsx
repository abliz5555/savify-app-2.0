import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { F } from "@/components/ui";

type Colors = ReturnType<typeof useColors>;

export function SectionHeader({ label, colors }: { label: string; colors: Colors }) {
  return <Text style={[sh.label, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>;
}
const sh = StyleSheet.create({
  label: { fontSize: 11, fontFamily: F.semibold, letterSpacing: 0.9, marginTop: 26, marginBottom: 8, marginLeft: 2 },
});

export function SettingCard({ colors, children }: { colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[sc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
  );
}
const sc = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
});

export function Divider({ colors }: { colors: Colors }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSoft, marginLeft: 52 }} />;
}

export function SettingRow({ label, value, icon, colors, onPress, labelColor, loading }: {
  label: string; value?: string; icon: string;
  colors: Colors; onPress?: () => void | Promise<void>; labelColor?: string; loading?: boolean;
}) {
  return (
    <Pressable style={sr.row} onPress={onPress} disabled={!onPress || loading}>
      <View style={sr.left}>
        <View style={[sr.icon, { backgroundColor: colors.muted }]}>
          <Feather name={icon as "home"} size={15} color={colors.mutedForeground} />
        </View>
        <Text style={[sr.label, { color: labelColor ?? colors.foreground }]}>{label}</Text>
      </View>
      <View style={sr.right}>
        {value !== undefined && (
          <Text style={[sr.value, { color: colors.mutedForeground }]} numberOfLines={1}>{value}</Text>
        )}
        {loading
          ? <ActivityIndicator size="small" color={colors.mutedForeground} />
          : onPress && <Feather name="chevron-right" size={16} color={labelColor ?? colors.mutedForeground} />
        }
      </View>
    </Pressable>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13 },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14.5, fontFamily: F.medium },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { fontSize: 13.5, fontFamily: F.regular, maxWidth: 160 },
});

export const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  centeredOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: Platform.OS === "ios" ? 38 : 24, gap: 14 },
  legalSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: Platform.OS === "ios" ? 38 : 24 },
  centeredSheet: { borderRadius: 18, padding: 22, gap: 12, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 14, elevation: 10 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontFamily: F.bold },
  hint: { fontSize: 13, fontFamily: F.regular, marginTop: -4 },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  optionLabel: { fontSize: 15, fontFamily: F.regular },
  textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: F.regular },
  errorText: { fontSize: 13, fontFamily: F.regular },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelText: { fontSize: 14, fontFamily: F.medium },
  saveBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 14, fontFamily: F.semibold },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(120,120,128,0.16)", alignItems: "center", justifyContent: "center" },
});

export const devs = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  bannerText: { fontSize: 12, fontFamily: F.medium, color: "#a5b4fc", flex: 1 },
  proRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  proLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14.5, fontFamily: F.medium },
  sub: { fontSize: 12, fontFamily: F.regular, marginTop: 1 },
  flagHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18, marginBottom: 8, marginLeft: 2, borderBottomWidth: 0 },
  flagLabel: { fontSize: 10.5, fontFamily: F.semibold, letterSpacing: 0.8 },
});
