import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { LANGUAGES, useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { F } from "@/components/ui";
import { Divider, ms, SectionHeader, SettingCard, SettingRow } from "./SettingHelpers";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { THEME_LIST } from "@/constants/colors";

const CURRENCIES = ["AED","USD","EUR","GBP","SAR","QAR","KWD","BHD","OMR","JPY","CNY","INR","CAD","AUD","CHF","SGD","MYR","THB","NGN","EGP"];

export function PreferencesSection() {
  const colors = useColors();
  const { t } = useT();
  const {
    currency, setCurrency,
    language, setLanguage,
    schemePreference, setSchemePreference,
    notificationsEnabled, setNotificationsEnabled,
    theme, setTheme,
  } = useSettings();

  const [currencyModal, setCurrencyModal] = useState(false);
  const [languageModal, setLanguageModal] = useState(false);

  const schemeOptions: { label: string; value: "system" | "light" | "dark" }[] = [
    { label: t("schemeSystem"), value: "system" },
    { label: t("schemeLight"), value: "light" },
    { label: t("schemeDark"), value: "dark" },
  ];

  return (
    <>
      <SectionHeader label="Theme" colors={colors} />
      <View style={ps.themeGrid}>
        {THEME_LIST.map((th) => {
          const on = theme === th.id;
          const g = colors.isDark ? th.hero.dark : th.hero.light;
          return (
            <Pressable
              key={th.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${th.name} theme`}
              onPress={() => { Haptics.selectionAsync(); setTheme(th.id); }}
              style={[ps.themeCard, { backgroundColor: colors.card, borderColor: on ? colors.accent : colors.border, borderWidth: on ? 2 : 1 }]}
            >
              <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ps.themePreview}>
                <View style={ps.prevLine} />
                <View style={[ps.prevLine, { width: "40%", opacity: 0.5 }]} />
                <View style={[ps.prevDot, { backgroundColor: th.swatch }]} />
              </LinearGradient>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[ps.themeName, { color: colors.foreground }]}>{th.name}</Text>
                {on && <Feather name="check-circle" size={16} color={colors.accent} />}
              </View>
              <Text style={[ps.themeDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{th.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader label={t("preferences")} colors={colors} />
      <SettingCard colors={colors}>
        <SettingRow label={t("currency")} value={currency} icon="dollar-sign" colors={colors} onPress={() => setCurrencyModal(true)} />
        <Divider colors={colors} />
        <SettingRow label={t("language")} value={language} icon="globe" colors={colors} onPress={() => setLanguageModal(true)} />
        <Divider colors={colors} />
        <View style={ps.row}>
          <View style={ps.left}>
            <View style={[ps.icon, { backgroundColor: colors.muted }]}>
              <Feather name="moon" size={15} color={colors.mutedForeground} />
            </View>
            <Text style={[ps.label, { color: colors.foreground }]}>{t("darkMode")}</Text>
          </View>
          <View style={ps.schemeRow}>
            {schemeOptions.map((o) => (
              <Pressable
                key={o.value}
                style={[ps.pill, { borderColor: colors.border }, schemePreference === o.value && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={() => setSchemePreference(o.value)}
              >
                <Text style={[ps.pillText, { color: schemePreference === o.value ? "#fff" : colors.mutedForeground }]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Divider colors={colors} />
        <View style={ps.row}>
          <View style={ps.left}>
            <View style={[ps.icon, { backgroundColor: colors.muted }]}>
              <Feather name="bell" size={15} color={colors.mutedForeground} />
            </View>
            <Text style={[ps.label, { color: colors.foreground }]}>{t("notifications")}</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: colors.muted, true: colors.accent }} thumbColor="#fff" />
        </View>
      </SettingCard>

      <Modal visible={currencyModal} transparent animationType="slide">
        <Pressable style={ms.overlay} onPress={() => setCurrencyModal(false)}>
          <Pressable style={[ms.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[ms.handle, { backgroundColor: colors.borderSoft }]} />
            <Text style={[ms.sheetTitle, { color: colors.foreground }]}>{t("currency")}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {CURRENCIES.map((c) => (
                <Pressable key={c} style={[ms.optionRow, { borderBottomColor: colors.borderSoft }]}
                  onPress={() => { setCurrency(c); setCurrencyModal(false); }}>
                  <Text style={[ms.optionLabel, { color: colors.foreground }]}>{c}</Text>
                  {currency === c && <Feather name="check" size={17} color={colors.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={languageModal} transparent animationType="slide">
        <Pressable style={ms.overlay} onPress={() => setLanguageModal(false)}>
          <Pressable style={[ms.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[ms.handle, { backgroundColor: colors.borderSoft }]} />
            <Text style={[ms.sheetTitle, { color: colors.foreground }]}>{t("language")}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {LANGUAGES.map((l) => (
                <Pressable key={l} style={[ms.optionRow, { borderBottomColor: colors.borderSoft }]}
                  onPress={() => { setLanguage(l); setLanguageModal(false); }}>
                  <Text style={[ms.optionLabel, { color: colors.foreground }]}>{l}</Text>
                  {language === l && <Feather name="check" size={17} color={colors.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const ps = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13 },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14.5, fontFamily: F.medium },
  schemeRow: { flexDirection: "row", gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontFamily: F.medium },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  themeCard: { width: "48%", flexGrow: 1, borderRadius: 16, padding: 10, gap: 6 },
  themePreview: { height: 64, borderRadius: 11, padding: 10, gap: 6, justifyContent: "flex-start" },
  prevLine: { height: 6, width: "65%", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.85)" },
  prevDot: { position: "absolute", right: 10, bottom: 10, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#fff" },
  themeName: { fontSize: 14, fontFamily: F.semibold },
  themeDesc: { fontSize: 12, fontFamily: F.regular, lineHeight: 16 },
});
