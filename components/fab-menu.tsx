/**
 * FloatingFab — animated floating action menu.
 *
 * Premium design:
 *  • Asymmetric glassmorphic capsule pills (left edge = 20px, icon-facing right = 30px)
 *  • BlurView glass layer inside each pill with tinted overlay
 *  • Glass shimmer edge (top+left highlight) for depth
 *  • Coloured icon glow shadow + outer ring
 *  • Spring-staggered entrance / reverse-stagger close
 */
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing, interpolate,
  useAnimatedStyle, useSharedValue,
  withDelay, withSpring, withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { F } from "@/components/ui";

export type FabAction = {
  icon: string;
  label: string;
  desc: string;
  iconBg: string;
  iconColor: string;
  premium: boolean;
  onPress: () => void;
};

// ─── Geometry ────────────────────────────────────────────────────────────────
const FAB_SIZE = 56;
const ICON_BTN_SIZE = 48;
const ITEM_GAP = 10;
const FAB_TO_ITEMS = 10;

// Uniform pill radius — same on all four corners
const PILL_R = 28;
// Fixed pill width so all cards are identical
const PILL_W = 222;

// ─── Spring physics ───────────────────────────────────────────────────────────
const SPRING_OPEN = { damping: 15, stiffness: 230, mass: 0.75 };
const SPRING_FAB  = { damping: 11, stiffness: 200, mass: 0.9 };
const STAGGER_MS  = 58;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function FloatingFab({
  actions,
  fabBottom,
  isOpen,
  onToggle,
}: {
  actions: FabAction[];
  fabBottom: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  const isDark = colors.isDark;

  // Glass overlay colours
  const glassOverlay = isDark
    ? "rgba(18, 18, 24, 0.72)"
    : "rgba(255, 255, 255, 0.78)";
  const glassEdge = isDark
    ? "rgba(255,255,255,0.10)"
    : "rgba(255,255,255,0.90)";
  const glassEdgeBottom = isDark
    ? "rgba(0,0,0,0.22)"
    : "rgba(200,200,210,0.40)";

  /* ── Shared values (fixed slots for hooks rules) ── */
  const backdrop  = useSharedValue(0);
  const fabRot    = useSharedValue(0);
  const fabScale  = useSharedValue(1);
  const iv0 = useSharedValue(0);
  const iv1 = useSharedValue(0);
  const iv2 = useSharedValue(0);
  const iv3 = useSharedValue(0);
  const iv4 = useSharedValue(0);
  const iv5 = useSharedValue(0);
  const itemVals = [iv0, iv1, iv2, iv3, iv4, iv5];

  /* ── Drive animations ── */
  useEffect(() => {
    if (isOpen) {
      backdrop.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
      fabRot.value   = withSpring(1, SPRING_FAB);
      fabScale.value = withSpring(0.9, { damping: 10, stiffness: 260 });
      actions.forEach((_, i) => {
        itemVals[i].value = withDelay(i * STAGGER_MS, withSpring(1, SPRING_OPEN));
      });
    } else {
      backdrop.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) });
      fabRot.value   = withSpring(0, { damping: 13, stiffness: 280 });
      fabScale.value = withSpring(1, { damping: 12, stiffness: 260 });
      for (let i = actions.length - 1; i >= 0; i--) {
        const d = (actions.length - 1 - i) * 38;
        itemVals[i].value = withDelay(d, withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) }));
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Animated styles ── */
  const backdropStyle    = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const fabIconStyle     = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(fabRot.value, [0, 1], [0, 135])}deg` }],
  }));
  const fabContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const as0 = useAnimatedStyle(() => itemAnimStyle(iv0.value));
  const as1 = useAnimatedStyle(() => itemAnimStyle(iv1.value));
  const as2 = useAnimatedStyle(() => itemAnimStyle(iv2.value));
  const as3 = useAnimatedStyle(() => itemAnimStyle(iv3.value));
  const as4 = useAnimatedStyle(() => itemAnimStyle(iv4.value));
  const as5 = useAnimatedStyle(() => itemAnimStyle(iv5.value));
  const animStyles = [as0, as1, as2, as3, as4, as5];

  // Render top → bottom (PDF at top, Expense at bottom)
  const renderedActions = [...actions].reverse();

  return (
    <>
      {/* ── Blurred backdrop ── */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { zIndex: 15 }, backdropStyle]}
        pointerEvents={isOpen ? "auto" : "none"}
      >
        {Platform.OS !== "web" && (
          <BlurView
            intensity={22}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.42)" }]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onToggle} />
      </Animated.View>

      {/* ── Floating capsule action items ── */}
      <View
        style={[s.itemsContainer, { bottom: fabBottom + FAB_SIZE + FAB_TO_ITEMS, right: 20 }]}
        pointerEvents={isOpen ? "box-none" : "none"}
      >
        {renderedActions.map((action, ri) => {
          const origIdx = actions.length - 1 - ri;
          return (
            <Animated.View key={action.label} style={[s.itemRow, animStyles[origIdx]]}>

              {/* ── Glassmorphic capsule pill ── */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  action.onPress();
                }}
                style={({ pressed }) => [s.pillOuter, { opacity: pressed ? 0.82 : 1 }]}
              >
                {/* Glass blur layer */}
                {Platform.OS !== "web" && (
                  <BlurView
                    intensity={20}
                    tint={isDark ? "dark" : "light"}
                    style={[StyleSheet.absoluteFillObject, s.pillBlur]}
                  />
                )}

                {/* Tinted glass overlay */}
                <View style={[StyleSheet.absoluteFillObject, s.pillBlur, { backgroundColor: glassOverlay }]} />

                {/* Top shimmer edge (glass highlight) */}
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    s.pillBlur,
                    s.glassEdge,
                    { borderColor: glassEdge, borderBottomColor: glassEdgeBottom, borderRightColor: glassEdgeBottom },
                  ]}
                />

                {/* Text content */}
                <View style={s.pillContent}>
                  <Text style={[s.labelText, { color: colors.foreground }]}>
                    {action.label}
                    {action.premium && (
                      <Text style={[s.proTag, { color: colors.accent }]}>  PRO</Text>
                    )}
                  </Text>
                  <Text style={[s.descText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {action.desc}
                  </Text>
                </View>
              </Pressable>

              {/* ── Icon circle with glow ring ── */}
              {/* Outer glow ring */}
              <View
                style={[
                  s.iconRing,
                  {
                    width: ICON_BTN_SIZE + 8,
                    height: ICON_BTN_SIZE + 8,
                    borderRadius: (ICON_BTN_SIZE + 8) / 2,
                    backgroundColor: action.iconColor + "18",
                    borderColor: action.iconColor + "30",
                  },
                ]}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    action.onPress();
                  }}
                  style={({ pressed }) => [
                    s.iconBtn,
                    {
                      backgroundColor: action.iconBg,
                      shadowColor: action.iconColor,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Feather name={action.icon as any} size={19} color={action.iconColor} />
                </Pressable>
              </View>

            </Animated.View>
          );
        })}
      </View>

      {/* ── FAB button ── */}
      <Animated.View
        style={[
          s.fab,
          fabContainerStyle,
          {
            bottom: fabBottom,
            right: 20,
            backgroundColor: isOpen ? colors.foreground : colors.primary,
            shadowColor: isOpen ? "#000" : colors.primary,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onToggle();
          }}
          style={s.fabInner}
          hitSlop={8}
        >
          <Animated.View style={fabIconStyle}>
            <Feather
              name="plus"
              size={24}
              color={isOpen ? colors.background : colors.primaryForeground}
            />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Worklet
// ─────────────────────────────────────────────────────────────────────────────

function itemAnimStyle(v: number) {
  "worklet";
  return {
    opacity: v,
    transform: [
      { translateY: interpolate(v, [0, 1], [26, 0]) },
      { scale: interpolate(v, [0, 1], [0.80, 1]) },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  itemsContainer: {
    position: "absolute",
    alignItems: "flex-end",
    gap: ITEM_GAP,
    zIndex: 20,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // ── Glassmorphic capsule ──────────────────────────────────────────────────

  pillOuter: {
    borderRadius: PILL_R,
    overflow: "hidden",
    width: PILL_W,
    // Depth shadow
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: -2, height: 6 },
    elevation: 10,
  },

  pillBlur: {
    borderRadius: PILL_R,
  },

  glassEdge: {
    borderWidth: 1,
    // top & left are bright (light catching), bottom & right are dimmer (shadow side)
    // borderColor etc are set inline per theme
  },

  pillContent: {
    paddingHorizontal: 18,
    paddingVertical: 13,
  },

  labelText: {
    fontSize: 14.5,
    fontFamily: F.bold,
    letterSpacing: -0.1,
    lineHeight: 19,
  },
  descText: {
    fontSize: 11,
    fontFamily: F.regular,
    marginTop: 1.5,
    lineHeight: 14,
  },
  proTag: {
    fontSize: 9.5,
    fontFamily: F.extrabold,
    letterSpacing: 0.7,
  },

  // ── Icon circle + glow ring ───────────────────────────────────────────────

  iconRing: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    // backgroundColor and borderColor set inline
  },

  iconBtn: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    borderRadius: ICON_BTN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    // Glow shadow
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  // ── FAB ──────────────────────────────────────────────────────────────────

  fab: {
    position: "absolute",
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    shadowOpacity: 0.40,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
    zIndex: 25,
  },
  fabInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: FAB_SIZE / 2,
  },
});
