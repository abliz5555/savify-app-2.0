import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { F } from "@/components/ui";
import { SectionHeader, SettingCard } from "./SettingHelpers";

export function SecuritySection() {
  const colors = useColors();
  const { t } = useT();
  const { biometricsEnabled, setBiometricsEnabled } = useSettings();
  const [biometricsLoading, setBiometricsLoading] = useState(false);

  const handleBiometricsToggle = async (value: boolean) => {
    setBiometricsLoading(true);
    try {
      if (value) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) {
          Alert.alert(
            "Biometrics Unavailable",
            "No biometric hardware or enrolled credentials found on this device. Set up Face ID or Touch ID in your device Settings first.",
          );
          return;
        }
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to enable biometric lock",
          fallbackLabel: "Use Passcode",
          disableDeviceFallback: false,
        });
        if (!result.success) return;
      }
      setBiometricsEnabled(value);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Biometrics Unavailable", "Could not access biometric authentication on this device.");
    } finally {
      setBiometricsLoading(false);
    }
  };

  return (
    <>
      <SectionHeader label={t("securitySection")} colors={colors} />
      <SettingCard colors={colors}>
        <View style={[sec.row, { alignItems: "center" }]}>
          <View style={[sec.left, { flex: 1 }]}>
            <View style={[sec.icon, { backgroundColor: colors.muted }]}>
              <Feather name="shield" size={15} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[sec.label, { color: colors.foreground }]}>{t("biometrics")}</Text>
              <Text style={[sec.value, { color: colors.mutedForeground }]}>{t("biometricsDesc")}</Text>
            </View>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={biometricsLoading ? undefined : handleBiometricsToggle}
            disabled={biometricsLoading}
            trackColor={{ false: colors.muted, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </SettingCard>
    </>
  );
}

const sec = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13 },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14.5, fontFamily: F.medium },
  value: { fontSize: 13, fontFamily: F.regular, marginTop: 1 },
});
