import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { C, F } from '@/lib/theme';

export type Point = { t: number; v: number };

/**
 * Simple line chart over time (e.g. body weight), with the area below filled softly.
 * With `trend`, the readings become faint dots and the trend is the line.
 */
export function LineChart({
  points,
  trend,
  height = 160,
  format,
}: {
  points: Point[];
  trend?: Point[];
  height?: number;
  format: (v: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const pad = { top: 14, bottom: 22, left: 4, right: 4 };

  const vs = [...points, ...(trend ?? [])].map((p) => p.v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < 1) {
    lo -= 0.5;
    hi += 0.5;
  }
  const span = hi - lo;
  lo -= span * 0.15;
  hi += span * 0.15;

  const t0 = points[0]?.t ?? 0;
  const t1 = points[points.length - 1]?.t ?? 1;
  const iw = Math.max(width - pad.left - pad.right, 1);
  const ih = height - pad.top - pad.bottom;
  const x = (t: number) => pad.left + (points.length < 2 || t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * ih;

  const main = trend && trend.length > 1 ? trend : points;
  const line = main.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area =
    main.length > 1 ? `${line} L${x(t1).toFixed(1)},${pad.top + ih} L${x(t0).toFixed(1)},${pad.top + ih} Z` : '';
  const last = main[main.length - 1];
  const withTrend = main !== points;
  const date = (t: number) => new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
      accessibilityLabel={`Chart with ${points.length} entries, latest ${last ? format(last.v) : 'none'}`}>
      {width > 0 && points.length ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.accent} stopOpacity={0.28} />
                <Stop offset="1" stopColor={C.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={pad.left}
                x2={width - pad.right}
                y1={pad.top + f * ih}
                y2={pad.top + f * ih}
                stroke={C.border}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ))}
            {area ? <Path d={area} fill="url(#fill)" /> : null}
            {withTrend
              ? points.map((p, i) => <Circle key={`r${i}`} cx={x(p.t)} cy={y(p.v)} r={2.5} fill={C.textFaint} />)
              : null}
            {main.length > 1 ? (
              <Path
                d={line}
                stroke={C.accent}
                strokeWidth={withTrend ? 2.5 : 2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {!withTrend && points.length <= 24
              ? points.map((p, i) => (
                  <Circle key={i} cx={x(p.t)} cy={y(p.v)} r={2.5} fill={C.bg} stroke={C.accent} strokeWidth={1.5} />
                ))
              : null}
            {last ? (
              <Circle cx={x(last.t)} cy={y(last.v)} r={4.5} fill={C.accent} stroke={C.bg} strokeWidth={2} />
            ) : null}
          </Svg>
          <Text style={[styles.axis, { top: pad.top - 12, right: pad.right }]}>{format(hi)}</Text>
          <Text style={[styles.axis, { top: pad.top + ih - 12, right: pad.right }]}>{format(lo)}</Text>
          <View style={styles.dates}>
            <Text style={styles.date}>{date(t0)}</Text>
            {date(t1) !== date(t0) ? <Text style={styles.date}>{date(t1)}</Text> : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    position: 'absolute',
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 10,
  },
  dates: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  date: { color: C.textFaint, fontFamily: F.medium, fontSize: 10 },
});
