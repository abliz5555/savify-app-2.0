import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuickAdd } from "@/components/QuickAddSheet";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

/** Big round "+" in the middle of the tab bar → opens "Tell Savify" (speak or type). */
function AddButton() {
  const colors = useColors();
  const { open } = useQuickAdd();
  return (
    <View style={s.addSlot} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a transaction"
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); open(); }}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); open({ listen: true }); }}
        style={({ pressed }) => [
          s.addBtn,
          { backgroundColor: colors.accent, borderColor: colors.isDark ? colors.background : colors.card, transform: [{ scale: pressed ? 0.94 : 1 }] },
        ]}
      >
        <Feather name="plus" size={28} color={colors.accentForeground} />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const bottom = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 10);

  const icon = (name: React.ComponentProps<typeof Feather>["name"]) =>
    ({ color }: { color: string }) => <Feather name={name} size={22} color={color} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
        tabBarStyle: {
          position: "absolute",
          height: 58 + bottom,
          paddingBottom: bottom,
          paddingTop: 6,
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint={colors.isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="expenses" options={{ title: t("expenses"), tabBarIcon: icon("pie-chart") }} />
      <Tabs.Screen
        name="add"
        options={{ title: "", tabBarButton: () => <AddButton /> }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tabs.Screen name="savings" options={{ title: t("income"), tabBarIcon: icon("trending-up") }} />
      <Tabs.Screen name="loans" options={{ title: t("loans"), tabBarIcon: icon("repeat") }} />
      <Tabs.Screen name="bills" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  addSlot: { flex: 1, alignItems: "center" },
  addBtn: {
    width: 62, height: 62, borderRadius: 31, marginTop: -22, borderWidth: 4,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
});
