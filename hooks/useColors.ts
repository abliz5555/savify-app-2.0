import { useSettings } from "@/contexts/SettingsContext";
import colors, { THEMES } from "@/constants/colors";

export function useColors() {
  const { isDark, theme } = useSettings();
  const t = THEMES[theme] ?? THEMES.emerald;
  const mode = isDark ? "dark" : "light";
  return {
    ...colors[mode],
    ...t[mode],
    heroGradient: t.hero[mode],
    glow: t.glow[mode],
    themeId: t.id,
    radius: colors.radius,
    isDark,
  };
}
