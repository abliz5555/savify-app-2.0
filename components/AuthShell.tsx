import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TextInputProps, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { F } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";

/** Shared, clean layout for Sign in / Sign up / Verify screens. */
export function AuthShell({
  title, subtitle, children, footer, onBack,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { hz, isTablet } = useLayout();

  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome")));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[
          { paddingHorizontal: hz + 6, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, flexGrow: 1 },
          isTablet && { maxWidth: 480, alignSelf: "center", width: "100%" },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={back} hitSlop={12} style={[s.back, { backgroundColor: colors.muted }]}>
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>

        <Image source={require("../assets/images/logo.jpg")} style={s.logo} resizeMode="cover" />
        <Text style={[s.title, { color: colors.foreground }]}>{title}</Text>
        {!!subtitle && <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>}

        <View style={{ gap: 14, marginTop: 28 }}>{children}</View>

        {footer ? <View style={s.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Text field with an icon, label and (for passwords) a show/hide eye. */
export function AuthInput({
  icon, label, secure, ...rest
}: TextInputProps & { icon: React.ComponentProps<typeof Feather>["name"]; label: string; secure?: boolean }) {
  const colors = useColors();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[
        s.field,
        { backgroundColor: colors.card, borderColor: focused ? colors.accent : colors.border },
      ]}>
        <Feather name={icon} size={18} color={focused ? colors.accent : colors.mutedForeground} />
        <TextInput
          {...rest}
          secureTextEntry={secure ? hidden : false}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          placeholderTextColor={colors.mutedForeground}
          style={[s.input, { color: colors.foreground }]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Feather name={hidden ? "eye" : "eye-off"} size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function AuthButton({ label, onPress, loading, disabled, variant = "primary" }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: "primary" | "ghost";
}) {
  const colors = useColors();
  const primary = variant === "primary";
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        primary ? { backgroundColor: colors.primary } : { backgroundColor: "transparent" },
        { opacity: off ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading
        ? <ActivityIndicator color={primary ? colors.primaryForeground : colors.foreground} />
        : <Text style={[s.btnText, { color: primary ? colors.primaryForeground : colors.accent }]}>{label}</Text>}
    </Pressable>
  );
}

export function AuthMessage({ text, kind = "error" }: { text?: string; kind?: "error" | "info" }) {
  const colors = useColors();
  if (!text) return null;
  const err = kind === "error";
  return (
    <View style={[s.msg, { backgroundColor: err ? colors.redBg : colors.accentBg }]}>
      <Feather name={err ? "alert-circle" : "info"} size={16} color={err ? colors.destructive : colors.accent} />
      <Text style={[s.msgText, { color: err ? colors.destructive : colors.foreground }]}>{text}</Text>
    </View>
  );
}

export function AuthLink({ text, link, onPress }: { text: string; link: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "center" }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 14 }}>{text} </Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={{ color: colors.accent, fontFamily: F.semibold, fontSize: 14 }}>{link}</Text>
      </Pressable>
    </View>
  );
}

/** Simple email check. */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

const s = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  logo: { width: 56, height: 56, borderRadius: 14, marginBottom: 20 },
  title: { fontSize: 28, fontFamily: F.bold, letterSpacing: -0.6 },
  subtitle: { fontSize: 15, fontFamily: F.regular, marginTop: 6, lineHeight: 21 },
  label: { fontSize: 13, fontFamily: F.medium, marginLeft: 2 },
  field: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, height: 52 },
  input: { flex: 1, fontSize: 16, fontFamily: F.regular, height: "100%" },
  btn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnText: { fontSize: 16, fontFamily: F.semibold },
  msg: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 12 },
  msgText: { flex: 1, fontSize: 13.5, fontFamily: F.medium, lineHeight: 19 },
  footer: { marginTop: "auto", paddingTop: 28 },
});
