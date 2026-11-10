import { useUser } from "@/lib/auth";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Platform, Switch, Text, View } from "react-native";
import { useGenerateTestData, useResetData } from "@/contexts/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";
import { F } from "@/components/ui";
import { devs, Divider, SectionHeader, SettingCard, SettingRow } from "./SettingHelpers";

export function DevSection() {
  const colors = useColors();
  const { user } = useUser();
  const router = useRouter();
  const { devProEnabled, toggleDevPro } = useSubscription();
  const resetData = useResetData();
  const generateTestData = useGenerateTestData();

  const handleTogglePro = async () => {
    await toggleDevPro();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleGenerateTestData = async () => {
    Alert.alert(
      "Generate Test Data",
      "This will REPLACE all existing data with a realistic 3-month sample dataset. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await generateTestData.mutateAsync();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Done ✓", "Sample data loaded — 3 months of transactions, budgets, savings goals, recurring bills and a car loan.");
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not generate data.");
            }
          },
        },
      ],
    );
  };

  const handleResetTestData = async () => {
    Alert.alert("Reset Test Data", "This will permanently delete ALL data for this account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await resetData.mutateAsync();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Done ✓", "All test data cleared.");
          } catch {
            Alert.alert("Error", "Could not reset data. Please try again.");
          }
        },
      },
    ]);
  };

  const handleTestNotification = async () => {
    try {
      if (Platform.OS === "web") { Alert.alert("Web", "Push notifications are not supported on web."); return; }
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission denied", "Enable notifications in device Settings."); return; }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🔔 Savify Test Notification",
          body: "Notifications are working correctly. This is a dev test.",
          data: { type: "dev_test" },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, repeats: false },
      });
      Alert.alert("Scheduled ✓", "A test notification will fire in ~2 seconds.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to schedule notification.");
    }
  };

  return (
    <>
      <SectionHeader label="⚙️  Developer Tools" colors={colors} />
      <View style={[devs.banner, { backgroundColor: "#1e1b4b", borderColor: "#4f46e5" }]}>
        <Feather name="terminal" size={12} color="#a5b4fc" />
        <Text style={devs.bannerText}>Admin account · {user?.emailAddresses?.[0]?.emailAddress}</Text>
      </View>

      {/* Subscription toggle */}
      <View style={[devs.flagHeader, { borderColor: colors.borderSoft }]}>
        <Feather name="shield" size={11} color={colors.mutedForeground} />
        <Text style={[devs.flagLabel, { color: colors.mutedForeground }]}>SUBSCRIPTION</Text>
      </View>
      <SettingCard colors={colors}>
        <View style={devs.proRow}>
          <View style={devs.proLeft}>
            <View style={[devs.icon, { backgroundColor: devProEnabled ? "#dcfce7" : colors.muted }]}>
              <Feather name="zap" size={15} color={devProEnabled ? "#16a34a" : colors.mutedForeground} />
            </View>
            <View>
              <Text style={[devs.label, { color: colors.foreground }]}>Pro Access</Text>
              <Text style={[devs.sub, { color: colors.mutedForeground }]}>
                {devProEnabled ? "Enabled — all features unlocked" : "Disabled — testing free tier"}
              </Text>
            </View>
          </View>
          <Switch
            value={devProEnabled}
            onValueChange={handleTogglePro}
            trackColor={{ false: colors.muted, true: "#4f46e5" }}
            thumbColor="#fff"
          />
        </View>
      </SettingCard>

      {/* Test actions */}
      <View style={[devs.flagHeader, { borderColor: colors.borderSoft }]}>
        <Feather name="tool" size={11} color={colors.mutedForeground} />
        <Text style={[devs.flagLabel, { color: colors.mutedForeground }]}>TEST ACTIONS</Text>
      </View>
      <SettingCard colors={colors}>
        <SettingRow
          label="Generate Test Data"
          icon="database"
          colors={colors}
          onPress={handleGenerateTestData}
          loading={generateTestData.isPending}
        />
        <Divider colors={colors} />
        <SettingRow label="Reset Test Data" icon="trash-2" colors={colors} labelColor={colors.destructive} onPress={handleResetTestData} loading={resetData.isPending} />
        <Divider colors={colors} />
        <SettingRow label="Test Notification" icon="bell" colors={colors} onPress={handleTestNotification} />
        <Divider colors={colors} />
        <SettingRow label="Test Recurring Bills" icon="repeat" colors={colors} onPress={() => router.push("/(tabs)/expenses")} />
        <Divider colors={colors} />
        <SettingRow label="Test Subscription Flow" icon="credit-card" colors={colors} onPress={() => router.push("/pro")} />
      </SettingCard>
    </>
  );
}
