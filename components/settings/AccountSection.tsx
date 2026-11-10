import { useAuth, useClerk, useUser } from "@/lib/auth";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSettings } from "@/contexts/SettingsContext";
import { useResetData } from "@/contexts/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { F } from "@/components/ui";
import { Divider, ms, SectionHeader, SettingCard, SettingRow } from "./SettingHelpers";

export function AccountSection() {
  const colors = useColors();
  const { t } = useT();
  const { signOut } = useClerk();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { displayName, setDisplayName } = useSettings();
  const resetData = useResetData();

  const [passwordModal, setPasswordModal] = useState(false);
  const [nameModal, setNameModal] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [dangerModal, setDangerModal] = useState<"reset" | "delete" | null>(null);
  const [dangerPw, setDangerPw] = useState("");
  const [dangerPwError, setDangerPwError] = useState("");
  const [dangerLoading, setDangerLoading] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");

  const handleChangePassword = async () => {
    if (!currentPw) { setPwError("Enter your current password"); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    setPwError("");
    try {
      await user?.updatePassword({ currentPassword: currentPw, newPassword: newPw });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPasswordModal(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : "Failed to change password");
    }
  };

  const handleResetData = () => {
    setDangerPw(""); setDangerPwError("");
    setDangerModal("reset");
  };

  const handleDeleteAccount = () => {
    setDangerPw(""); setDangerPwError("");
    setDangerModal("delete");
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              queryClient.clear();
              await signOut();
            } catch {
              Alert.alert("Error", "Could not sign out. Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDangerConfirm = async () => {
    const required = dangerModal === "delete" ? "DELETE" : "RESET";
    if (dangerPw.trim() !== required) {
      setDangerPwError(`Type ${required} exactly to confirm`);
      return;
    }
    setDangerLoading(true);
    setDangerPwError("");
    const action = dangerModal;
    setDangerModal(null);
    setDangerPw("");
    setDangerLoading(false);
    if (action === "reset") {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await resetData.mutateAsync();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Done", "All your data has been deleted successfully.");
      } catch {
        Alert.alert("Error", "Could not reset data. Please try again.");
      }
    } else if (action === "delete") {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await user?.delete();
        await signOut();
      } catch {
        Alert.alert("Error", "Could not delete account. Please try again.");
      }
    }
  };

  const saveName = () => {
    setDisplayName(nameInput.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNameModal(false);
  };

  return (
    <>
      <SectionHeader label={t("account")} colors={colors} />
      <SettingCard colors={colors}>
        {!!user?.emailAddresses?.[0]?.emailAddress && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.muted }}>
                  <Feather name="mail" size={15} color={colors.mutedForeground} />
                </View>
                <View>
                  <Text style={{ fontSize: 14.5, fontFamily: F.medium, color: colors.foreground }}>{t("emailLabel")}</Text>
                  <Text style={{ fontSize: 13, fontFamily: F.regular, color: colors.mutedForeground, marginTop: 1 }}>
                    {user.emailAddresses[0].emailAddress}
                  </Text>
                </View>
              </View>
            </View>
            <Divider colors={colors} />
          </>
        )}
        <SettingRow
          label={t("displayName")}
          value={displayName || t("notSet")}
          icon="user"
          colors={colors}
          onPress={() => { setNameInput(displayName); setNameModal(true); }}
        />
        <Divider colors={colors} />
        <SettingRow label={t("changePassword")} icon="lock" colors={colors} onPress={() => { setPwError(""); setPasswordModal(true); }} />
        <Divider colors={colors} />
        <SettingRow label={t("resetData")} icon="refresh-cw" colors={colors} labelColor={colors.destructive} onPress={handleResetData} />
        <Divider colors={colors} />
        <SettingRow label={t("deleteAccount")} icon="trash-2" colors={colors} labelColor={colors.destructive} onPress={handleDeleteAccount} />
        <Divider colors={colors} />
        <SettingRow label={t("signOut")} icon="log-out" colors={colors} labelColor={colors.destructive} onPress={handleSignOut} />
      </SettingCard>

      {/* Display Name Modal */}
      <Modal visible={nameModal} transparent animationType="fade">
        <Pressable style={ms.centeredOverlay} onPress={() => setNameModal(false)}>
          <Pressable style={[ms.centeredSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[ms.sheetTitle, { color: colors.foreground }]}>{t("displayName")}</Text>
            <Text style={[ms.hint, { color: colors.mutedForeground }]}>
              Shown as "{(nameInput || "Your Name")}'s Dashboard" on the overview
            </Text>
            <TextInput
              style={[ms.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Enter your name"
              placeholderTextColor={colors.mutedForeground}
              autoFocus maxLength={30}
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <View style={ms.modalActions}>
              <TouchableOpacity style={[ms.cancelBtn, { borderColor: colors.border }]} onPress={() => setNameModal(false)}>
                <Text style={[ms.cancelText, { color: colors.mutedForeground }]}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ms.saveBtn, { backgroundColor: colors.accent }]} onPress={saveName}>
                <Text style={ms.saveText}>{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passwordModal} transparent animationType="fade">
        <Pressable style={ms.centeredOverlay} onPress={() => setPasswordModal(false)}>
          <Pressable style={[ms.centeredSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[ms.sheetTitle, { color: colors.foreground }]}>{t("changePassword")}</Text>
            <TextInput style={[ms.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={currentPw} onChangeText={setCurrentPw} placeholder="Current password" placeholderTextColor={colors.mutedForeground} secureTextEntry autoFocus />
            <TextInput style={[ms.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={newPw} onChangeText={setNewPw} placeholder="New password (min 8 chars)" placeholderTextColor={colors.mutedForeground} secureTextEntry />
            <TextInput style={[ms.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={confirmPw} onChangeText={setConfirmPw} placeholder="Confirm new password" placeholderTextColor={colors.mutedForeground} secureTextEntry />
            {!!pwError && <Text style={[ms.errorText, { color: colors.destructive }]}>{pwError}</Text>}
            <View style={ms.modalActions}>
              <TouchableOpacity style={[ms.cancelBtn, { borderColor: colors.border }]} onPress={() => setPasswordModal(false)}>
                <Text style={[ms.cancelText, { color: colors.mutedForeground }]}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ms.saveBtn, { backgroundColor: colors.accent }]} onPress={handleChangePassword}>
                <Text style={ms.saveText}>{t("save")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Danger Confirm Modal (Reset / Delete) */}
      <Modal visible={dangerModal !== null} transparent animationType="fade">
        <Pressable style={ms.centeredOverlay} onPress={() => { if (!dangerLoading) { setDangerModal(null); setDangerPw(""); setDangerPwError(""); } }}>
          <Pressable style={[ms.centeredSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Feather name={dangerModal === "delete" ? "trash-2" : "refresh-cw"} size={22} color="#ef4444" />
              </View>
              <Text style={[ms.sheetTitle, { color: colors.foreground, textAlign: "center" }]}>
                {dangerModal === "delete" ? "Delete Account" : "Reset All Data"}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: F.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 4, lineHeight: 18 }}>
                {dangerModal === "delete"
                  ? "This will permanently delete your account and all data. This cannot be undone."
                  : "This will permanently erase all your transactions, loans, goals, and records."}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: F.medium, color: colors.foreground, marginBottom: 4 }}>
              Type{" "}
              <Text style={{ fontFamily: F.bold, color: "#ef4444" }}>
                {dangerModal === "delete" ? "DELETE" : "RESET"}
              </Text>
              {" "}to confirm
            </Text>
            <TextInput
              style={[ms.textInput, { color: colors.foreground, borderColor: dangerPwError ? "#ef4444" : colors.border, backgroundColor: colors.background }]}
              value={dangerPw}
              onChangeText={(v) => { setDangerPw(v); setDangerPwError(""); }}
              placeholder={dangerModal === "delete" ? "DELETE" : "RESET"}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleDangerConfirm}
              editable={!dangerLoading}
            />
            {dangerPwError ? (
              <Text style={{ fontSize: 12, fontFamily: F.regular, color: "#ef4444", marginTop: 4 }}>{dangerPwError}</Text>
            ) : null}
            <View style={[ms.modalActions, { marginTop: 14 }]}>
              <TouchableOpacity
                style={[ms.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { setDangerModal(null); setDangerPw(""); setDangerPwError(""); }}
                disabled={dangerLoading}
              >
                <Text style={[ms.cancelText, { color: colors.mutedForeground }]}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ms.saveBtn, { backgroundColor: "#ef4444", opacity: dangerLoading ? 0.6 : 1 }]}
                onPress={handleDangerConfirm}
                disabled={dangerLoading}
              >
                <Text style={ms.saveText}>{dangerLoading ? "Verifying…" : (dangerModal === "delete" ? "Delete Account" : "Reset Data")}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
