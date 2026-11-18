import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { text } from '@/components/ui';
import { fmtDurationShort, fmtVolume } from '@/lib/format';
import type { WeekTotal } from '@/lib/stats';
import { C, F, R, S } from '@/lib/theme';

export type Metric = 'volume' | 'sets' | 'time';

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'volume', label: 'Volume', unit: 'lifted' },
  { key: 'sets', label: 'Sets', unit: 'sets' },
  { key: 'time', label: 'Time', unit: 'training' },
];

const value = (w: WeekTotal, m: Metric) => (m === 'volume' ? w.volume : m === 'sets' ? w.sets : w.time);
const fmt = (v: number, m: Metric) =>
  m === 'volume'
    ? fmtVolume(v)
    : m === 'sets'
      ? `${Math.round(v)} ${Math.round(v) === 1 ? 'set' : 'sets'}`
      : v
        ? fmtDurationShort(v)
        : '0 min';

const shortDate = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const weekName = (w: WeekTotal, last: boolean, prevOfLast: boolean) =>
  last ? 'This week' : prevOfLast ? 'Last week' : `Week of ${shortDate(w.start)}`;

/** Bar with a rounded top (4 px), flat on the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Weekly training as bars, switchable between volume, sets and time.
 * Tap a bar to see that week; the newest week is selected at first.
 */
export function ProgressChart({ weeks }: { weeks: WeekTotal[] }) {
  const [metric, setMetric] = useState<Metric>('volume');
  const [sel, setSel] = useState(weeks.length - 1);
  const [width, setWidth] = useState(0);
  const h = 150;
  const vals = weeks.map((w) => value(w, metric));
  const max = Math.max(...vals, 1) * 1.1;
  const slot = width / Math.max(1, weeks.length);
  const barW = Math.max(6, Math.min(28, slot - 6)); // leaves a gap of at least 6 px between bars
  const cur = weeks[sel];
  const prev = weeks[sel - 1];
  const diff = cur && prev ? value(cur, metric) - value(prev, metric) : 0;
  const total = vals.reduce((s, v) => s + v, 0);
  const avg = total / Math.max(1, weeks.length);

  return (
    <View style={{ gap: S.md }}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {METRICS.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMetric(m.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: metric === m.key }}
            style={(s: PressableStateCallbackType & { hovered?: boolean }) => [
              styles.tab,
              metric === m.key && styles.tabOn,
              s.hovered && metric !== m.key && { backgroundColor: C.cardHi },
            ]}>
            <Text style={[styles.tabText, metric === m.key && styles.tabTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {cur ? (
        <Animated.View key={`${metric}-${sel}`} entering={FadeIn.duration(180)}>
          <Text style={text.faint}>
            {weekName(cur, sel === weeks.length - 1, sel === weeks.length - 2)} · {cur.workouts}{' '}
            {cur.workouts === 1 ? 'workout' : 'workouts'}
          </Text>
          <Text style={styles.big}>{fmt(value(cur, metric), metric)}</Text>
          <Text style={[styles.delta, { color: diff > 0 ? C.good : C.textDim }]}>
            {!prev
              ? ' '
              : diff === 0
                ? 'Same as the week before'
                : `${diff > 0 ? '▲' : '▼'} ${fmt(Math.abs(diff), metric)} vs the week before`}
          </Text>
        </Animated.View>
      ) : null}

      <View style={{ height: h + 20 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={h}>
            {/* recessive guide at the 12-week average */}
            {total ? (
              <Line
                x1={0}
                x2={width}
                y1={h - (avg / max) * h}
                y2={h - (avg / max) * h}
                stroke={C.textFaint}
                strokeDasharray="3 4"
                strokeWidth={1}
              />
            ) : null}
            <Line x1={0} x2={width} y1={h - 0.5} y2={h - 0.5} stroke={C.border} strokeWidth={1} />
            {weeks.map((w, i) => {
              const v = vals[i];
              const bh = v > 0 ? Math.max(4, (v / max) * h) : 0;
              return bh ? (
                <Path
                  key={w.start}
                  d={barPath(i * slot + (slot - barW) / 2, h - bh, barW, bh)}
                  fill={C.accent}
                  opacity={i === sel ? 1 : 0.4}
                />
              ) : null;
            })}
          </Svg>
        ) : null}
        {/* Date labels for every third week, placed freely (wider than a bar's column). */}
        {width > 0
          ? weeks.map((w, i) =>
              i % 3 === (weeks.length - 1) % 3 ? (
                <Text
                  key={w.start}
                  pointerEvents="none"
                  style={[
                    styles.axis,
                    { left: Math.min(width - 52, Math.max(0, i * slot + slot / 2 - 26)) },
                    i === sel && { color: C.text },
                  ]}>
                  {i === weeks.length - 1 ? 'Now' : shortDate(w.start)}
                </Text>
              ) : null,
            )
          : null}
        {/* Tap targets: the whole column, bigger than the bar. */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {weeks.map((w, i) => (
            <Pressable
              key={w.start}
              onPress={() => setSel(i)}
              accessibilityRole="button"
              accessibilityLabel={`${weekName(w, i === weeks.length - 1, i === weeks.length - 2)}: ${fmt(vals[i], metric)}`}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>
      <View style={styles.foot}>
        <View style={styles.legendItem}>
          <View style={styles.avgSwatch} />
          <Text style={text.faint}>Average {fmt(avg, metric)} a week</Text>
        </View>
        <Text style={text.faint}>Last {weeks.length} weeks</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: { flex: 1, height: 34, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentLine },
  tabText: { color: C.textDim, fontFamily: F.semi, fontSize: 13 },
  tabTextOn: { color: C.text },
  big: { color: C.text, fontFamily: F.display, fontSize: 28, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  delta: { fontFamily: F.medium, fontSize: 12 },
  axis: {
    position: 'absolute',
    bottom: 0,
    width: 52,
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 10,
    textAlign: 'center',
  },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avgSwatch: { width: 14, height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.textFaint },
});
