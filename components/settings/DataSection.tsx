import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import { Alert } from "react-native";
import { useFinanceData, useImportData } from "@/contexts/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { localISODate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AggregateData } from "@/lib/types";
import { Divider, SectionHeader, SettingCard, SettingRow } from "./SettingHelpers";

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function DataSection() {
  const colors = useColors();
  const { t } = useT();
  const { data } = useFinanceData();
  const importData = useImportData();
  const [busy, setBusy] = useState(false);

  /** Spreadsheet file (opens in Excel / Google Sheets / Numbers). */
  const handleExportCsv = async () => {
    if (!data?.transactions.length) { Alert.alert("Nothing to export", "Add some transactions first."); return; }
    try {
      const rows = [
        ["Date", "Type", "Category", "Description", "Amount", "Account"].join(","),
        ...data.transactions.map((tx) => [
          localISODate(new Date(tx.createdAt)), tx.type, csvCell(tx.category), csvCell(tx.description),
          tx.type === "income" ? tx.amount : -tx.amount, tx.account ?? "",
        ].join(",")),
      ];
      // "﻿" makes Excel read Arabic and other languages correctly
      const csv = "﻿" + rows.join("\n");
      const uri = (FileSystem.cacheDirectory ?? "") + `savify_transactions_${localISODate()}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Transactions (CSV)", UTI: "public.comma-separated-values-text" });
    } catch {
      Alert.alert("Export failed", "Could not export your data. Please try again.");
    }
  };

  /** Full backup file you can restore later. */
  const handleBackup = async () => {
    if (!data) { Alert.alert("No data", "No data available to back up."); return; }
    try {
      const backup = { app: "savify", version: 2, exportedAt: new Date().toISOString(), ...data };
      const uri = (FileSystem.cacheDirectory ?? "") + `savify_backup_${localISODate()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Savify backup", UTI: "public.json" });
    } catch {
      Alert.alert("Backup failed", "Could not create the backup. Please try again.");
    }
  };

  /** Restore from a backup file. Replaces current data — all or nothing. */
  const handleRestore = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (pick.canceled || !pick.assets?.[0]) return;
      const text = await FileSystem.readAsStringAsync(pick.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      let parsed: Partial<AggregateData>;
      try { parsed = JSON.parse(text); } catch { Alert.alert("Wrong file", "This is not a Savify backup file."); return; }
      if (!Array.isArray(parsed.transactions)) { Alert.alert("Wrong file", "This is not a Savify backup file."); return; }

      const summary = `${parsed.transactions.length} transactions, ${(parsed.loans ?? []).length} loans, ${(parsed.recurring ?? []).length} bills, ${(parsed.budgetGoals ?? []).length} budgets`;
      Alert.alert(
        "Restore this backup?",
        `${summary}.\n\nYour CURRENT data will be replaced. Account balances are not changed.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore", style: "destructive", onPress: async () => {
              setBusy(true);
              try {
                await importData.mutateAsync({
                  transactions: parsed.transactions ?? [], loans: parsed.loans ?? [],
                  recurring: parsed.recurring ?? [], budgetGoals: parsed.budgetGoals ?? [],
                  savingsGoals: parsed.savingsGoals ?? [],
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Restored", "Your backup has been restored.");
              } catch (e) {
                Alert.alert("Restore failed", (e instanceof Error ? e.message : "") + "\n\nNothing was changed.");
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert("Restore failed", "Could not open that file.");
    }
  };

  return (
    <>
      <SectionHeader label={t("dataSection")} colors={colors} />
      <SettingCard colors={colors}>
        <SettingRow label="Export to spreadsheet (CSV)" icon="download" colors={colors} onPress={handleExportCsv} />
        <Divider colors={colors} />
        <SettingRow label="Save a backup" icon="upload-cloud" colors={colors} onPress={handleBackup} />
        <Divider colors={colors} />
        <SettingRow label="Restore from backup" icon="rotate-ccw" colors={colors} onPress={handleRestore} loading={busy} />
      </SettingCard>
    </>
  );
}
