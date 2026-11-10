import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLayout } from "@/hooks/useLayout";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const logoOpacity  = useSharedValue(0);
  const logoY        = useSharedValue(20);
  const tagOpacity   = useSharedValue(0);
  const tagY         = useSharedValue(12);
  const btnsOpacity  = useSharedValue(0);
  const btnsY        = useSharedValue(18);

  useEffect(() => {
    logoOpacity.value  = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    logoY.value        = withSpring(0, { damping: 18, stiffness: 160 });
    tagOpacity.value   = withDelay(160, withTiming(1, { duration: 480 }));
    tagY.value         = withDelay(160, withSpring(0, { damping: 20, stiffness: 180 }));
    btnsOpacity.value  = withDelay(340, withTiming(1, { duration: 480 }));
    btnsY.value        = withDelay(340, withSpring(0, { damping: 20, stiffness: 180 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoY.value }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
    transform: [{ translateY: tagY.value }],
  }));
  const btnsStyle = useAnimatedStyle(() => ({
    opacity: btnsOpacity.value,
    transform: [{ translateY: btnsY.value }],
  }));

  const { isTablet } = useLayout();
  const isDark = colors.isDark;
  const gradStart = isDark ? "#080808" : "#f9f8f6";
  const gradMid   = isDark ? "#111111" : "#f3f1ec";
  const gradEnd   = isDark ? "#0a0a0a" : "#ece9e2";

  return (
    <LinearGradient
      colors={[gradStart, gradMid, gradEnd]}
      style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={s.center}>
        <Animated.View style={[s.logoRow, logoStyle]}>
          <Image
            source={require("../../assets/images/logo.jpg")}
            style={s.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={tagStyle}>
          <Text style={[s.tagline, { color: colors.mutedForeground }]}>
            Track. Save. Grow.
          </Text>
          <Text style={[s.subTagline, { color: colors.mutedForeground }]}>
            Take control of your finances,{"\n"}one step at a time.
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[s.btns, btnsStyle, { paddingBottom: insets.bottom + 20 }, isTablet && { maxWidth: 480, alignSelf: "center", width: "100%" }]}>
        <Pressable
          style={({ pressed }) => [
            s.primaryBtn,
            { backgroundColor: "#1a1a1a", opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.push("/(auth)/sign-in")}
        >
          <Text style={[s.primaryBtnText]}>Sign In</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            s.secondaryBtn,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.push("/(auth)/sign-up")}
        >
          <Text style={[s.secondaryBtnText, { color: colors.foreground }]}>Create Account</Text>
        </Pressable>

        <Text style={[s.terms, { color: colors.mutedForeground }]}>
          By continuing, you agree to our{" "}
          <Text style={{ color: colors.accent }}>Terms of Service</Text>
          {" "}and{" "}
          <Text style={{ color: colors.accent }}>Privacy Policy</Text>
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 28,
  },
  logoRow: {
    alignItems: "center",
    marginBottom: 4,
  },
  logoImage: {
    width: 160,
    height: 160,
    borderRadius: 36,
  },
  tagline: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  subTagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    opacity: 0.8,
  },
  btns: {
    paddingHorizontal: 28,
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
  terms: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
    opacity: 0.7,
  },
});
