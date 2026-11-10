import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

export const TABLET_BREAKPOINT = 768;
export const LARGE_TABLET_BREAKPOINT = 1024;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const isTablet = width >= TABLET_BREAKPOINT;
    const isLargeTablet = width >= LARGE_TABLET_BREAKPOINT;
    const hz = isLargeTablet ? 40 : isTablet ? 32 : 18;
    const numColumns = isLargeTablet ? 3 : isTablet ? 2 : 1;
    return { isTablet, isLargeTablet, hz, numColumns, screenWidth: width, screenHeight: height };
  }, [width, height]);
}
