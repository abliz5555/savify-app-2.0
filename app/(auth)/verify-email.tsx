import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { AuthButton, AuthInput, AuthMessage, AuthShell } from "@/components/AuthShell";
import { friendlyError, supabase } from "@/lib/supabase";

const COOLDOWN_SECS = 60;

/** Step 2 of sign-up: type the 6-digit code that Supabase emailed. */
export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = String(params.email ?? "").toLowerCase();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    if (code.trim().length < 6) return setError("Please enter the code from the email.");
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "signup" });
      if (err) throw err;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Signed in → the app opens the home screen automatically.
    } catch (e) {
      setError(friendlyError(e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    try {
      const { error: err } = await supabase.auth.resend({ type: "signup", email });
      if (err) throw err;
      setCooldown(COOLDOWN_SECS);
      setCode("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  if (!email) {
    return (
      <AuthShell title="Check your email" subtitle="Please sign up again to get a new code.">
        <AuthButton label="Go to sign up" onPress={() => router.replace("/(auth)/sign-up")} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Check your email" subtitle={`We sent a 6-digit code to ${email}. It may take a minute — also check spam.`}>
      <AuthInput icon="hash" label="Verification code" value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 8))}
        keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
        autoFocus placeholder="123456" onSubmitEditing={handleVerify} returnKeyType="go" />
      <AuthMessage text={error} />
      <AuthButton label="Verify & continue" onPress={handleVerify} loading={loading} />
      <AuthButton
        variant="ghost"
        label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        onPress={handleResend}
        disabled={cooldown > 0}
      />
    </AuthShell>
  );
}
