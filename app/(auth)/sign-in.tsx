import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { AuthButton, AuthInput, AuthLink, AuthMessage, AuthShell, isEmail } from "@/components/AuthShell";
import { F } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { friendlyError, supabase } from "@/lib/supabase";

type Screen = "sign-in" | "forgot-email" | "forgot-code";

export default function SignInScreen() {
  const colors = useColors();
  const { t } = useT();

  const [screen, setScreen] = useState<Screen>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("@savify_remember_me"),
      AsyncStorage.getItem("@savify_last_email"),
    ]).then(([rm, em]) => {
      if (rm !== null) setRememberMe(rm !== "false");
      if (em) setEmail(em);
    }).catch(() => {});
  }, []);

  const go = (next: Screen) => { setError(""); setInfo(""); setScreen(next); };
  const fail = (e: unknown) => {
    setError(friendlyError(e));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const saveRememberMe = async () => {
    try {
      await AsyncStorage.setItem("@savify_remember_me", String(rememberMe));
      if (rememberMe) await AsyncStorage.setItem("@savify_last_email", email.trim().toLowerCase());
      else await AsyncStorage.removeItem("@savify_last_email");
    } catch {}
  };

  // ── Sign in ────────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    if (!isEmail(email)) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (err) {
        if (/email not confirmed/i.test(err.message)) {
          await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() }).catch(() => {});
          router.push({ pathname: "/(auth)/verify-email", params: { email: email.trim().toLowerCase() } });
          return;
        }
        throw err;
      }
      await saveRememberMe();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The app moves to the home screen automatically once signed in.
    } catch (e) { fail(e); } finally { setLoading(false); }
  };

  // ── Forgot password: 1) send code ─────────────────────────────────────────
  const handleSendCode = async () => {
    if (!isEmail(email)) return setError("Please enter a valid email address.");
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (err) throw err;
      go("forgot-code");
      setInfo(`We sent a 6-digit code to ${email.trim()}. Check your inbox (and spam).`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) { fail(e); } finally { setLoading(false); }
  };

  // ── Forgot password: 2) code + new password ───────────────────────────────
  const handleReset = async () => {
    if (code.trim().length < 6) return setError("Please enter the code from the email.");
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    setLoading(true); setError("");
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(), token: code.trim(), type: "recovery",
      });
      if (vErr) throw vErr;
      const { error: uErr } = await supabase.auth.updateUser({ password: newPassword });
      if (uErr) throw uErr;
      await saveRememberMe();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { fail(e); } finally { setLoading(false); }
  };

  if (screen === "forgot-email") {
    return (
      <AuthShell title={t("resetPasswordTitle")} subtitle="Enter your email and we'll send you a code." onBack={() => go("sign-in")}>
        <AuthInput icon="mail" label={t("emailLabel")} value={email} onChangeText={setEmail}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          textContentType="emailAddress" autoComplete="email" autoFocus placeholder="you@example.com" />
        <AuthMessage text={error} />
        <AuthButton label={t("sendResetCode")} onPress={handleSendCode} loading={loading} />
      </AuthShell>
    );
  }

  if (screen === "forgot-code") {
    return (
      <AuthShell title={t("enterResetCodeTitle")} onBack={() => go("forgot-email")}>
        <AuthMessage kind="info" text={info} />
        <AuthInput icon="hash" label="Code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 8))}
          keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" autoFocus placeholder="123456" />
        <AuthInput icon="lock" label="New password" value={newPassword} onChangeText={setNewPassword}
          secure textContentType="newPassword" autoComplete="new-password" placeholder="At least 8 characters" />
        <AuthMessage text={error} />
        <AuthButton label={t("setNewPassword")} onPress={handleReset} loading={loading} />
        <AuthButton variant="ghost" label={t("resendCode")} onPress={handleSendCode} disabled={loading} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("welcomeBack")}
      subtitle={t("signInSubtitle")}
      footer={<AuthLink text={t("dontHaveAccount")} link={t("signUpBtn")} onPress={() => router.replace("/(auth)/sign-up")} />}
    >
      <AuthInput icon="mail" label={t("emailLabel")} value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        textContentType="emailAddress" autoComplete="email" placeholder="you@example.com" returnKeyType="next" />
      <AuthInput icon="lock" label="Password" value={password} onChangeText={setPassword}
        secure textContentType="password" autoComplete="password" placeholder="Your password"
        onSubmitEditing={handleSignIn} returnKeyType="go" />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Switch
            value={rememberMe}
            onValueChange={setRememberMe}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
            ios_backgroundColor={colors.border}
            style={{ transform: [{ scale: 0.85 }] }}
          />
          <Text style={{ color: colors.foreground, fontFamily: F.medium, fontSize: 14 }}>{t("rememberMe")}</Text>
        </View>
        <Pressable onPress={() => go("forgot-email")} hitSlop={8}>
          <Text style={{ color: colors.accent, fontFamily: F.semibold, fontSize: 14 }}>{t("forgotPassword")}</Text>
        </Pressable>
      </View>

      <AuthMessage text={error} />
      <AuthButton label={t("signInBtn")} onPress={handleSignIn} loading={loading} />
    </AuthShell>
  );
}
