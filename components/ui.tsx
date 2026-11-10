import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

type Colors = ReturnType<typeof useColors>;

export const F = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  black: "Inter_900Black",
} as const;

/** Tiny uppercase widely-tracked label — the web's signature label style. */
export function SectionLabel({
  children,
  style,
  size = 11,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  size?: number;
}) {
  const colors = useColors();
  return (
    <Text
      style={[
        {
          fontSize: Math.max(size, 11),
          fontFamily: F.semibold,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          color: colors.mutedForeground,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** A bordered surface card matching web `border-border/50 rounded-xl`. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius + 4,
          borderWidth: colors.isDark ? 1 : StyleSheet.hairlineWidth,
          borderColor: colors.isDark ? colors.borderSoft : colors.border,
          overflow: "hidden",
        },
        !colors.isDark && cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const cardShadow = Platform.select<ViewStyle>({
  ios: { shadowColor: "#0f1115", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  android: { elevation: 1 },
  default: {},
});

/** A card that renders a list of rows separated by thin dividers (web divide-y). */
export function ListCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Card style={style}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 && (
            <View style={{ height: 1, backgroundColor: colors.borderSoft }} />
          )}
          {child}
        </View>
      ))}
    </Card>
  );
}

/** Compact stat tile with colored rounded icon background (web 3-tile grid). */
export function StatTile({
  icon,
  iconBg,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  const colors = useColors();
  return (
    <Card style={{ flex: 1 }}>
      <View style={tile.body}>
        <View style={[tile.icon, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={{ fontSize: 12, fontFamily: F.medium, color: colors.mutedForeground }} numberOfLines={1}>
          {label}
        </Text>
        <Text
          style={[
            tile.value,
            { color: valueColor ?? colors.foreground },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
        >
          {value}
        </Text>
      </View>
    </Card>
  );
}

const tile = StyleSheet.create({
  body: { padding: 14, alignItems: "flex-start", gap: 8 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontFamily: F.bold, fontSize: 16, letterSpacing: -0.3 },
});

/** Thin progress bar with dynamic fill color (web h-2). */
export function ProgressBar({
  pct,
  color,
  track,
  height = 8,
}: {
  pct: number;
  color: string;
  track?: string;
  height?: number;
}) {
  const colors = useColors();
  const w = `${Math.max(0, Math.min(pct, 100))}%` as `${number}%`;
  return (
    <View
      style={{
        height,
        backgroundColor: track ?? colors.muted,
        borderRadius: height / 2,
        overflow: "hidden",
      }}
    >
      <View
        style={{ height, width: w, backgroundColor: color, borderRadius: height / 2 }}
      />
    </View>
  );
}

/** Tiny uppercase pill badge (web category badge). */
export function Badge({
  children,
  bg,
  color,
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: bg ?? colors.muted,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
      }}
    >
      <Text
        style={{
          fontSize: 10.5,
          fontFamily: F.semibold,
          letterSpacing: 0.2,
          color: color ?? colors.mutedForeground,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** Segmented pill tab switcher (web TabsList bg-muted/50 p-1 rounded-xl). */
export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.muted,
        borderRadius: colors.radius + 2,
        padding: 4,
        gap: 4,
      }}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: colors.radius - 2,
              backgroundColor: active ? colors.card : "transparent",
              alignItems: "center",
              ...(active
                ? Platform.select({
                    ios: {
                      shadowColor: "#000",
                      shadowOpacity: 0.06,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 1 },
                    },
                    android: { elevation: 1 },
                    default: {},
                  })
                : {}),
            }}
          >
            <Text
              style={{
                fontSize: 13.5,
                fontFamily: active ? F.semibold : F.medium,
                color: active ? colors.foreground : colors.mutedForeground,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Standard screen page title (web text-xl font-bold). */
export function PageTitle({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={{ fontSize: 22, fontFamily: F.extrabold, color: colors.foreground, letterSpacing: -0.5 }}>
      {children}
    </Text>
  );
}

/**
 * Unified sticky-style page header used on all secondary screens.
 * Respects the iOS safe area via topInsets, keeps titles tight to the top,
 * and supports an optional subtitle and right-side slot.
 */
export function ScreenHeader({
  title,
  subtitle,
  topInsets,
  right,
}: {
  title: string;
  subtitle?: string;
  topInsets: number;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        paddingTop: topInsets + 6,
        paddingBottom: 18,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{
            fontSize: 28,
            fontFamily: F.bold,
            color: colors.foreground,
            letterSpacing: -0.7,
            lineHeight: 34,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: 14,
              fontFamily: F.regular,
              color: colors.mutedForeground,
              lineHeight: 19,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={{ paddingBottom: 2 }}>{right}</View> : null}
    </View>
  );
}

/** Labeled text input with a soft bordered field — used by all inline forms. */
export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoFocus,
  prefix,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  autoFocus?: boolean;
  prefix?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 7 }}>
      {label ? <Text style={{ fontSize: 13, fontFamily: F.medium, color: colors.mutedForeground, marginLeft: 2 }}>{label}</Text> : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.input,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          minHeight: 50,
        }}
      >
        {prefix ? (
          <Text style={{ fontFamily: F.semibold, color: colors.mutedForeground, fontSize: 14, marginRight: 6 }}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          style={{ flex: 1, paddingVertical: 13, fontSize: 16, color: colors.foreground, fontFamily: F.medium }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
        />
      </View>
    </View>
  );
}

/** Segmented control. Pass `activeColor` to tint the selected segment (e.g. red/green). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  activeColor,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
  activeColor?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.muted,
        borderRadius: colors.radius + 2,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        const bg = active ? (activeColor ?? colors.card) : "transparent";
        const fg = active ? (activeColor ? "#fff" : colors.foreground) : colors.mutedForeground;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: colors.radius - 1,
              backgroundColor: bg,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontFamily: active ? F.semibold : F.medium, color: fg }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontally scrolling category chips. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  labelFn,
}: {
  categories: string[];
  value: string;
  onChange: (c: string) => void;
  labelFn?: (v: string) => string;
}) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}>
        {categories.map((c) => {
          const active = c === value;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: active ? colors.primary : colors.muted,
              }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontFamily: active ? F.semibold : F.medium,
                  color: active ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                {labelFn ? labelFn(c) : c}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** Full-width primary action button with loading state. */
export function PrimaryButton({
  label,
  onPress,
  loading,
  color,
  textColor,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  color?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        {
          backgroundColor: color ?? colors.primary,
          borderRadius: colors.radius + 2,
          paddingVertical: 16,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor ?? colors.primaryForeground} />
      ) : (
        <Text style={{ color: textColor ?? colors.primaryForeground, fontSize: 16, fontFamily: F.semibold }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Compact toggle button (Add / Close) used in screen headers. */
export function AddToggle({
  open,
  onPress,
  label = "Add",
}: {
  open: boolean;
  onPress: () => void;
  label?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: open ? colors.muted : colors.primary,
        borderRadius: 20,
        paddingHorizontal: 13,
        paddingVertical: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Feather
        name={open ? "x" : "plus"}
        size={15}
        color={open ? colors.foreground : colors.primaryForeground}
      />
      <Text
        style={{
          fontSize: 13,
          fontFamily: F.semibold,
          color: open ? colors.foreground : colors.primaryForeground,
        }}
      >
        {open ? "Close" : label}
      </Text>
    </Pressable>
  );
}

/** Inline form validation error text. */
export function FormError({ children }: { children?: string }) {
  const colors = useColors();
  if (!children) return null;
  return (
    <Text style={{ color: colors.destructive, fontSize: 12.5, fontFamily: F.medium }}>{children}</Text>
  );
}
