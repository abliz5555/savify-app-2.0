/**
 * Savify colour system.
 *
 * There are 4 THEMES (Emerald, Indigo, Sand, Graphite). Each one works in light and dark mode.
 * The user picks one in Settings → Appearance. Emerald is the default.
 */

export type ThemeId = "emerald" | "indigo" | "sand" | "graphite";

const base = {
  light: {
    text: "#0f1115",
    tint: "#15803d",
    background: "#f3f5f4",
    foreground: "#0f1115",
    card: "#ffffff",
    cardForeground: "#0f1115",
    primary: "#0f1115",
    primaryForeground: "#ffffff",
    secondary: "#eef0f2",
    secondaryForeground: "#2b2f36",
    muted: "#eef0f2",
    mutedSoft: "#f6f7f8",
    mutedForeground: "#5f6672",
    accent: "#15803d",
    accentForeground: "#ffffff",
    accentBg: "#e8f6ec",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    border: "#e3e6e9",
    borderSoft: "#eceef1",
    input: "#f6f7f8",
    green: "#15803d",
    greenBg: "#e8f6ec",
    amber: "#b45309",
    amberFill: "#f59e0b",
    red: "#dc2626",
    redBg: "#fdeeee",
    blue: "#2563eb",
    blueBg: "#ebf2ff",
    gold: "#b7791f",
    goldBg: "#fbf3e2",
    /** dark area behind the top of Home */
    headerBg: "#0c0f0d",
  },
  dark: {
    text: "#f2f4f3",
    tint: "#34d399",
    background: "#0a0c0b",
    foreground: "#f2f4f3",
    card: "#141816",
    cardForeground: "#f2f4f3",
    primary: "#f2f4f3",
    primaryForeground: "#0a0c0b",
    secondary: "#1d2220",
    secondaryForeground: "#d6dbd8",
    muted: "#1d2220",
    mutedSoft: "#181c1a",
    mutedForeground: "#9aa39e",
    accent: "#22a35a",
    accentForeground: "#ffffff",
    accentBg: "#11291b",
    destructive: "#f87171",
    destructiveForeground: "#0a0c0b",
    border: "#262c29",
    borderSoft: "#1f2422",
    input: "#181c1a",
    green: "#34d399",
    greenBg: "#0f2a1d",
    amber: "#fbbf24",
    amberFill: "#fbbf24",
    red: "#f87171",
    redBg: "#2d1517",
    blue: "#60a5fa",
    blueBg: "#13213a",
    gold: "#e1a847",
    goldBg: "#2e2616",
    headerBg: "#050706",
  },
};

type Palette = typeof base.light;

export type ThemeDef = {
  id: ThemeId;
  name: string;
  description: string;
  /** small colour dot shown in the picker */
  swatch: string;
  light: Partial<Palette>;
  dark: Partial<Palette>;
  /** the big balance card gradient */
  hero: { light: [string, string, string]; dark: [string, string, string] };
  /** soft glowing shapes that move slowly behind the header */
  glow: { light: [string, string]; dark: [string, string] };
};

export const THEMES: Record<ThemeId, ThemeDef> = {
  emerald: {
    id: "emerald",
    name: "Emerald",
    description: "Fresh green — growth and money",
    swatch: "#16a34a",
    light: {},
    dark: {},
    hero: { light: ["#0b1a12", "#12452a", "#1e7a46"], dark: ["#0b1a12", "#10391f", "#196b3c"] },
    glow: { light: ["#22c55e", "#0ea5e9"], dark: ["#16a34a", "#0d9488"] },
  },
  indigo: {
    id: "indigo",
    name: "Indigo",
    description: "Calm blue-violet, modern and clean",
    swatch: "#4f46e5",
    light: { accent: "#4f46e5", accentBg: "#eef0ff", tint: "#4f46e5", background: "#f4f5f8", headerBg: "#0d0e16" },
    dark: { accent: "#6d6ff0", accentBg: "#1d1e38", tint: "#8b8cf8", background: "#0a0b10", card: "#15161d", muted: "#1f2029", mutedSoft: "#191a22", border: "#272935", borderSoft: "#20212b", input: "#191a22", headerBg: "#06070b" },
    hero: { light: ["#12132a", "#272a6b", "#4b47c9"], dark: ["#12132a", "#24265e", "#4340b0"] },
    glow: { light: ["#6366f1", "#06b6d4"], dark: ["#4f46e5", "#0891b2"] },
  },
  sand: {
    id: "sand",
    name: "Sand",
    description: "Warm paper tones, soft and friendly",
    swatch: "#a86240",
    light: {
      accent: "#9a5534", accentBg: "#f6ebe3", tint: "#9a5534",
      background: "#f6f2ec", card: "#fffdf9", muted: "#eee7dd", mutedSoft: "#f4efe7", input: "#f4efe7",
      border: "#e6ddd1", borderSoft: "#eee6db", mutedForeground: "#6a6058", foreground: "#2a2420", text: "#2a2420", headerBg: "#1a1410",
    },
    dark: {
      accent: "#c27a54", accentBg: "#2e2018", tint: "#d08a63",
      background: "#0f0c0a", card: "#1a1613", muted: "#252019", mutedSoft: "#1f1a16", input: "#1f1a16", border: "#2e2721", borderSoft: "#26201b", headerBg: "#080605",
    },
    hero: { light: ["#1e1612", "#4a3226", "#8a5638"], dark: ["#1e1612", "#3d291f", "#76492f"] },
    glow: { light: ["#d97706", "#a86240"], dark: ["#b45309", "#9a5534"] },
  },
  graphite: {
    id: "graphite",
    name: "Graphite",
    description: "Black and white, no colour — pure focus",
    swatch: "#3f4652",
    light: { accent: "#2f3540", accentBg: "#eceef1", tint: "#2f3540", background: "#f3f4f6", headerBg: "#0b0c0e" },
    dark: { accent: "#7c8696", accentBg: "#22252b", tint: "#cbd2dc", background: "#09090b", card: "#141518", muted: "#1e2024", mutedSoft: "#18191c", border: "#27292e", borderSoft: "#202226", input: "#18191c", headerBg: "#040405" },
    hero: { light: ["#0e0f12", "#22252c", "#3b414c"], dark: ["#0e0f12", "#1c1f25", "#323741"] },
    glow: { light: ["#64748b", "#94a3b8"], dark: ["#475569", "#334155"] },
  },
};

export const THEME_LIST: ThemeDef[] = [THEMES.emerald, THEMES.indigo, THEMES.sand, THEMES.graphite];

const colors = { light: base.light, dark: base.dark, radius: 12 };
export default colors;
