import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LineChart } from '@/components/line-chart';
import { text } from '@/components/ui';
import { fmtDate, fmtWeight } from '@/lib/format';
import { strengthChange, strengthSeries, type StrengthMetric } from '@/lib/stats';
import { C, F, R, S } from '@/lib/theme';

const DAY = 86_400_000;
const RANGES = [
  { key: '3m', label: '3 months', days: 91 },
  { key: '1y', label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: Infinity },
] as const;

/**
 * Strength over time for one exercise: estimated 1RM (comparable across rep
 * ranges) or heaviest weight, per session.
 */
export function StrengthChart({
  sessions,
}: {
  sessions: { date: number; sets: { weight: number | null; reps: number | null }[] }[];
}) {
  const [metric, setMetric] = useState<StrengthMetric>('e1rm');
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('3m');
  const all = strengthSeries(sessions, metric);
  const days = RANGES.find((r) => r.key === range)!.days;
  const from = days === Infinity ? 0 : Date.now() - days * DAY;
  const points = all.filter((p) => p.t >= from);
  const change = strengthChange(all, from);
  const best = all.reduce((b, p) => (p.v > (b?.v ?? 0) ? p : b), null as { t: number; v: number } | null);
  const label = RANGES.find((r) => r.key === range)!.label.toLowerCase();

  if (all.length < 2) {
    return (
      <Text style={text.dim}>After two workouts with this exercise you'll see here how your strength develops.</Text>
    );
  }

  return (
    <View style={{ gap: S.md }}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            ['e1rm', 'Est. 1RM'],
            ['weight', 'Heaviest'],
          ] as const
        ).map(([k, l]) => (
          <Pressable
            key={k}
            onPress={() => setMetric(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: metric === k }}
            style={[styles.tab, metric === k && styles.tabOn]}>
            <Text style={[styles.tabText, metric === k && { color: C.text }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <Animated.View key={`${metric}-${range}`} entering={FadeIn.duration(180)} style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={text.faint}>{range === 'all' ? 'Since your first workout' : `Last ${label}`}</Text>
          <Text style={[styles.change, { color: change && change > 0 ? C.good : C.text }]}>
            {change == null ? '—' : `${change > 0 ? '+' : change < 0 ? '−' : '±'}${fmtWeight(Math.abs(change))} kg`}
          </Text>
        </View>
        {best ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={text.faint}>Best</Text>
            <Text style={styles.best}>{fmtWeight(best.v)} kg</Text>
            <Text style={text.faint}>{fmtDate(best.t)}</Text>
          </View>
        ) : null}
      </Animated.View>

      {points.length ? (
        <LineChart points={points} height={170} format={(v) => `${fmtWeight(Math.round(v * 10) / 10)} kg`} />
      ) : (
        <Text style={text.dim}>No sessions in this time. Pick a longer range.</Text>
      )}

      <View style={styles.ranges}>
        {RANGES.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => setRange(r.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: range === r.key }}
            style={[styles.range, range === r.key && styles.rangeOn]}>
            <Text style={[styles.rangeText, range === r.key && { color: C.text }]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
      {metric === 'e1rm' ? (
        <Text style={text.faint}>
          Est. 1RM is the weight you could probably lift once, worked out from your best set (weight × reps), so sets
          with different reps can be compared.
        </Text>
      ) : null}
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
  tab: { flex: 1, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentLine },
  tabText: { color: C.textDim, fontFamily: F.semi, fontSize: 13 },
  summary: { flexDirection: 'row', alignItems: 'flex-end' },
  change: { fontFamily: F.display, fontSize: 26, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  best: { color: C.text, fontFamily: F.displaySemi, fontSize: 16, fontVariant: ['tabular-nums'] },
  ranges: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  range: { height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center' },
  rangeOn: { backgroundColor: C.cardHi },
  rangeText: { color: C.textFaint, fontFamily: F.semi, fontSize: 12 },
});
