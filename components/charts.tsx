import React, { useState } from "react";
import { I18nManager, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { F } from "@/components/ui";

type ChartColors = {
  mutedForeground: string;
  foreground: string;
  borderSoft: string;
};

export type BarDataPoint = {
  label: string;
  value: number;
  highlight?: boolean;
};

export type GroupedBarDataPoint = {
  label: string;
  income: number;
  expense: number;
};

const CHART_H = 96;
const LABEL_H = 18;
const TOTAL_H = CHART_H + LABEL_H;
const PAD = 4;
const VALUE_LABEL_H = 14;

export function SvgBarChart({
  data,
  barColor,
  highlightColor,
  colors,
  formatValue,
}: {
  data: BarDataPoint[];
  barColor: string;
  highlightColor: string;
  colors: ChartColors;
  formatValue?: (v: number) => string;
}) {
  const [width, setWidth] = useState(0);

  const isRTL = I18nManager.isRTL;
  const ordered = isRTL ? [...data].reverse() : data;

  const n = ordered.length;
  const maxVal = Math.max(...ordered.map((d) => d.value), 1);
  const maxIdx = ordered.reduce(
    (best, d, i) => (d.value > ordered[best].value ? i : best),
    0,
  );
  const BAR_GAP = 5;
  const barW = n > 0 ? (width - PAD * 2 - BAR_GAP * (n - 1)) / n : 0;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={TOTAL_H + (formatValue ? VALUE_LABEL_H : 0)}>
          {/* Dashed grid lines */}
          {[0.25, 0.5, 0.75].map((p) => (
            <Line
              key={p}
              x1={PAD}
              y1={CHART_H - p * CHART_H + (formatValue ? VALUE_LABEL_H : 0)}
              x2={width - PAD}
              y2={CHART_H - p * CHART_H + (formatValue ? VALUE_LABEL_H : 0)}
              stroke={colors.borderSoft}
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
          ))}
          {/* Baseline */}
          <Line
            x1={PAD}
            y1={CHART_H + (formatValue ? VALUE_LABEL_H : 0)}
            x2={width - PAD}
            y2={CHART_H + (formatValue ? VALUE_LABEL_H : 0)}
            stroke={colors.borderSoft}
            strokeWidth={1}
          />

          {ordered.map((d, i) => {
            const barH = Math.max((d.value / maxVal) * CHART_H * 0.9, d.value > 0 ? 3 : 0);
            const x = PAD + i * (barW + BAR_GAP);
            const yOffset = formatValue ? VALUE_LABEL_H : 0;
            const fill = d.highlight ? highlightColor : barColor;

            return (
              <React.Fragment key={`bar-${i}`}>
                <Rect
                  x={x}
                  y={CHART_H - barH + yOffset}
                  width={Math.max(barW, 1)}
                  height={barH}
                  rx={Math.min(4, barW / 2)}
                  fill={fill}
                  opacity={d.highlight ? 1 : 0.38}
                />
                {/* Value label above the tallest bar */}
                {formatValue && i === maxIdx && d.value > 0 && (
                  <SvgText
                    x={x + barW / 2}
                    y={CHART_H - barH + yOffset - 4}
                    textAnchor="middle"
                    fontSize={8}
                    fill={colors.mutedForeground}
                    fontFamily={F.medium}
                  >
                    {formatValue(d.value)}
                  </SvgText>
                )}
                {/* Month label */}
                <SvgText
                  x={x + barW / 2}
                  y={TOTAL_H + (formatValue ? VALUE_LABEL_H : 0) - 2}
                  textAnchor="middle"
                  fontSize={9}
                  fill={d.highlight ? colors.foreground : colors.mutedForeground}
                  fontFamily={d.highlight ? F.semibold : F.medium}
                >
                  {d.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

export function SvgGroupedBarChart({
  data,
  incomeColor,
  expenseColor,
  colors,
}: {
  data: GroupedBarDataPoint[];
  incomeColor: string;
  expenseColor: string;
  colors: ChartColors;
}) {
  const [width, setWidth] = useState(0);

  const isRTL = I18nManager.isRTL;
  const ordered = isRTL ? [...data].reverse() : data;

  const n = ordered.length;
  const maxVal = Math.max(...ordered.flatMap((d) => [d.income, d.expense]), 1);
  const GROUP_GAP = 7;
  const BAR_GAP = 2;
  const groupW = n > 0 ? (width - PAD * 2 - GROUP_GAP * (n - 1)) / n : 0;
  const barW = Math.max((groupW - BAR_GAP) / 2, 1);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={TOTAL_H}>
          {[0.25, 0.5, 0.75].map((p) => (
            <Line
              key={p}
              x1={PAD}
              y1={CHART_H - p * CHART_H}
              x2={width - PAD}
              y2={CHART_H - p * CHART_H}
              stroke={colors.borderSoft}
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
          ))}
          <Line
            x1={PAD}
            y1={CHART_H}
            x2={width - PAD}
            y2={CHART_H}
            stroke={colors.borderSoft}
            strokeWidth={1}
          />
          {ordered.map((d, i) => {
            const isCurrent = isRTL ? i === 0 : i === n - 1;
            const incH = Math.max((d.income / maxVal) * CHART_H * 0.9, d.income > 0 ? 3 : 0);
            const expH = Math.max((d.expense / maxVal) * CHART_H * 0.9, d.expense > 0 ? 3 : 0);
            const gx = PAD + i * (groupW + GROUP_GAP);

            return (
              <React.Fragment key={`grp-${i}`}>
                <Rect
                  x={gx}
                  y={CHART_H - incH}
                  width={barW}
                  height={incH}
                  rx={Math.min(4, barW / 2)}
                  fill={incomeColor}
                  opacity={isCurrent ? 1 : 0.38}
                />
                <Rect
                  x={gx + barW + BAR_GAP}
                  y={CHART_H - expH}
                  width={barW}
                  height={expH}
                  rx={Math.min(4, barW / 2)}
                  fill={expenseColor}
                  opacity={isCurrent ? 1 : 0.38}
                />
                <SvgText
                  x={gx + groupW / 2}
                  y={TOTAL_H - 2}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isCurrent ? colors.foreground : colors.mutedForeground}
                  fontFamily={isCurrent ? F.semibold : F.medium}
                >
                  {d.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
