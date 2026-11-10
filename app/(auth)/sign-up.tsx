import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { AuthButton, AuthInput, AuthLink, AuthMessage, AuthShell, isEmail } from "@/components/AuthShell";
import { F } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { friendlyError, supabase } from "@/lib/supabase";

function passwordProblem(p: string): string {
  if (p.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Use at least one letter and one number.";
  return "";
}

export default function SignUpScreen() {
  const colors = useColors();
  const { t } = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    const mail = email.trim().toLowerCase();
    if (!isEmail(mail)) return setError("Please enter a valid email address.");
    const pp = passwordProblem(password);
    if (pp) return setError(pp);
    if (password !== confirm) return setError("The two passwords don't match.");

    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.auth.signUp({ email: mail, password });
      if (err) throw err;
      // Supabase returns a user with no identities when the email is already registered
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new Error("User already registered");
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!data.session) {
        router.push({ pathname: "/(auth)/verify-email", params: { email: mail } });
      }
      // If email confirmation is turned off in Supabase, a session exists and the app opens directly.
    } catch (e) {
      setError(friendlyError(e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) s++;
    return s;
  })();
  const strengthColor = [colors.border, colors.red, colors.amber, colors.green, colors.green][strength];
  const strengthLabel = ["", "Weak", "Okay", "Good", "Strong"][strength];

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever. Your data stays private to you."
      footer={<AuthLink text={t("alreadyHaveAccount")} link={t("signInBtn")} onPress={() => router.replace("/(auth)/sign-in")} />}
    >
      <AuthInput icon="mail" label={t("emailLabel")} value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        textContentType="emailAddress" autoComplete="email" placeholder="you@example.com" />
      <AuthInput icon="lock" label="Password" value={password} onChangeText={setPassword}
        secure textContentType="newPassword" autoComplete="new-password" placeholder="At least 8 characters" />

      {password.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: -4 }}>
          <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= strength ? strengthColor : colors.muted }} />
            ))}
          </View>
          <Text style={{ fontSize: 12, fontFamily: F.medium, color: colors.mutedForeground, width: 48, textAlign: "right" }}>{strengthLabel}</Text>
        </View>
      )}

      <AuthInput icon="check-circle" label="Confirm password" value={confirm} onChangeText={setConfirm}
        secure textContentType="newPassword" placeholder="Type it again"
        onSubmitEditing={handleSignUp} returnKeyType="go" />

      <AuthMessage text={error} />
      <AuthButton label={t("signUpBtn")} onPress={handleSignUp} loading={loading} />

      <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: F.regular, textAlign: "center", lineHeight: 17 }}>
        By creating an account you agree to the Terms of Service and Privacy Policy (Settings → Legal).
      </Text>
    </AuthShell>
  );
}
