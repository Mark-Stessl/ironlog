import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LineChart } from '@/components/line-chart';
import { Card, text } from '@/components/ui';
import { addMeasurement, type Measurement } from '@/lib/db';
import { notify } from '@/lib/dialog';
import { parseNum } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { fmtChange, fmtMeasure, validMeasure, WEIGHT, type MeasureKind } from '@/lib/measures';
import { trendRate, weightTrend } from '@/lib/weight-trend';
import { C, F, R, S } from '@/lib/theme';

/** Latest value, change, chart over time and a field to log a new value. */
export function MeasurePanel({
  kind,
  entries,
  onChange,
  chartHeight = 170,
}: {
  kind: MeasureKind;
  entries: Measurement[];
  onChange: () => void;
  chartHeight?: number;
}) {
  const db = useSQLiteContext();
  const [value, setValue] = useState('');
  const last = entries[entries.length - 1];
  const first = entries[0];
  const prev = entries[entries.length - 2];
  // Weight gets a smoothed trend: daily water swings hide the real direction.
  const trend = useMemo(
    () => (kind.key === WEIGHT.key && entries.length >= 3 ? weightTrend(entries) : null),
    [kind.key, entries],
  );
  const rate = trend ? trendRate(trend, 28, 7) : null;
  const trendNow = trend?.[trend.length - 1]?.trend;

  const save = async () => {
    const v = parseNum(value);
    if (v == null) return;
    if (!validMeasure(v, kind.unit)) {
      notify(
        'That looks off',
        `${fmtMeasure(v, kind.unit)} seems unlikely for ${kind.label.toLowerCase()}. Check for a typo.`,
        kind.icon,
      );
      return;
    }
    await addMeasurement(db, kind.key, v);
    haptic.success();
    setValue('');
    onChange();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={text.faint}>{kind.label}</Text>
          {last ? (
            <Animated.Text key={last.id} entering={FadeIn.duration(250)} style={styles.value}>
              {fmtMeasure(last.value, kind.unit)}
            </Animated.Text>
          ) : (
            <Text style={[styles.value, { color: C.textFaint }]}>—</Text>
          )}
          {last && prev ? (
            <Text style={styles.change}>
              {fmtChange(last.value - prev.value, kind.unit)} since last time
              {entries.length > 2 ? `  ·  ${fmtChange(last.value - first.value, kind.unit)} overall` : ''}
            </Text>
          ) : (
            <Text style={styles.change}>{kind.hint ?? 'Log a value to start your history.'}</Text>
          )}
          {trendNow != null ? (
            <Text style={[styles.change, { color: C.text }]}>
              Trend {fmtMeasure(Math.round(trendNow * 10) / 10, kind.unit)}
              {rate ? `  ·  ${fmtChange(Math.round(rate.kgPerWeek * 100) / 100, kind.unit)} per week` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.icon}>
          <Ionicons name={kind.icon} size={18} color={C.accent} />
        </View>
      </View>

      {entries.length > 1 ? (
        <View style={{ gap: S.sm }}>
          <LineChart
            points={
              trend ? trend.map((p) => ({ t: p.t, v: p.v })) : entries.map((e) => ({ t: e.measured_at, v: e.value }))
            }
            trend={trend?.map((p) => ({ t: p.t, v: p.trend }))}
            height={chartHeight}
            format={(v) => fmtMeasure(v, kind.unit)}
          />
          {trend ? (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={styles.dot} />
                <Text style={text.faint}>Scale</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={styles.trendSwatch} />
                <Text style={text.faint}>Trend (smoothed)</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.logRow}>
        <View style={styles.inputWrap}>
          <TextInput
            value={value}
            onChangeText={setValue}
            onSubmitEditing={save}
            placeholder={last ? String(last.value) : kind.unit === 'kg' ? '75' : kind.unit === '%' ? '18' : '40'}
            placeholderTextColor={C.textFaint}
            keyboardType="decimal-pad"
            returnKeyType="done"
            accessibilityLabel={`New ${kind.label.toLowerCase()} in ${kind.unit}`}
            style={styles.input}
          />
          <Text style={styles.unit}>{kind.unit}</Text>
        </View>
        <Pressable
          onPress={save}
          disabled={parseNum(value) == null}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.logButton,
            parseNum(value) == null && { opacity: 0.4 },
            pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
          ]}>
          <Ionicons name="add" size={16} color={C.onAccent} />
          <Text style={styles.logLabel}>Log today</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: S.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  value: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 28,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  change: { color: C.textDim, fontFamily: F.medium, fontSize: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logRow: { flexDirection: 'row', gap: S.sm },
  legend: { flexDirection: 'row', gap: S.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textFaint },
  trendSwatch: { width: 14, height: 3, borderRadius: 2, backgroundColor: C.accent },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.bg,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
    height: 40,
    outlineStyle: 'none',
  } as never,
  unit: { color: C.textFaint, fontFamily: F.medium, fontSize: 13 },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: R.md,
    backgroundColor: C.accent,
  },
  logLabel: { color: C.onAccent, fontFamily: F.semi, fontSize: 13 },
});
