import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BodyMap } from '@/components/body-map';
import { CountUp } from '@/components/count-up';
import { MuscleBars } from '@/components/muscle-bars';
import { RadarChart } from '@/components/radar-chart';
import { Card, Chip, Empty, Page, PageHeader, SectionTitle, text } from '@/components/ui';
import { statSets, trainingTime } from '@/lib/db';
import { fmtDurationShort, fmtVolume } from '@/lib/format';
import { GROUPS, heat, muscleStats, periodRange, type Period } from '@/lib/stats';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

export default function StatsTab() {
  const desktop = useIsDesktop();
  const [period, setPeriod] = useState<Period>('month');
  const range = periodRange(period);

  const [data] = useFocusData(async (db) => {
    const [cur, prev, time, prevTime] = await Promise.all([
      statSets(db, range.from, range.to + 1),
      statSets(db, range.prevFrom, range.from),
      trainingTime(db, range.from, range.to + 1),
      trainingTime(db, range.prevFrom, range.from),
    ]);
    return { now: muscleStats(cur), before: muscleStats(prev), time, prevTime };
  }, period);

  const now = data?.now;
  const before = data?.before;
  const empty = data && now?.sets === 0;

  return (
    <Page maxWidth={1000} topInset>
      <PageHeader title="Stats" sub={`${range.label} compared with ${range.prevLabel}`} />
      <View style={styles.periods}>
        {PERIODS.map((p) => (
          <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />
        ))}
      </View>

      {now && before ? (
        <Animated.View key={period} entering={FadeInDown.duration(300)} style={styles.summary}>
          <Summary label="Workouts" value={now.workouts} prev={before.workouts} />
          <Summary label="Time" value={data.time} prev={data.prevTime} format={(n) => fmtDurationShort(n)} />
          <Summary label="Volume" value={now.volume} prev={before.volume} format={(n) => fmtVolume(n)} />
          <Summary label="Sets" value={now.sets} prev={before.sets} />
        </Animated.View>
      ) : null}

      {empty ? (
        <Empty
          icon="stats-chart-outline"
          title={`No workouts in ${range.label.toLowerCase().startsWith('this') ? range.label.toLowerCase() : range.label} yet`}
          hint="Finish a workout and your muscle distribution shows up here."
        />
      ) : now && before ? (
        <View style={[{ gap: S.md }, desktop && styles.columns]}>
          <View style={desktop ? styles.column : undefined}>
            <SectionTitle title="Muscle distribution" />
            <Card style={styles.chartCard}>
              <RadarChart axes={GROUPS} values={now.groups} compare={before.groups} size={desktop ? 340 : 300} />
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: C.accent }]} />
                  <Text style={text.faint}>{range.label}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.swatch, styles.swatchDashed]} />
                  <Text style={text.faint}>{range.prevLabel}</Text>
                </View>
              </View>
            </Card>
          </View>
          <View style={desktop ? styles.column : undefined}>
            <SectionTitle title="Body heatmap" />
            <Card style={[styles.chartCard, { gap: S.lg }]}>
              <BodyMap heat={heat(now.regions)} height={desktop ? 300 : 260} />
              <MuscleBars regions={now.regions} count={8} />
            </Card>
          </View>
        </View>
      ) : null}
    </Page>
  );
}

function Summary({
  label,
  value,
  prev,
  format = (n) => String(Math.round(n)),
}: {
  label: string;
  value: number;
  prev: number;
  format?: (n: number) => string;
}) {
  const diff = format(value) === format(prev) ? 0 : value - prev;
  const up = diff > 0;
  return (
    <View style={styles.summaryCard}>
      <Text style={text.faint}>{label}</Text>
      <CountUp value={value} format={format} style={styles.summaryValue} />
      <Text style={[styles.delta, { color: diff === 0 ? C.textFaint : up ? C.good : C.textDim }]} numberOfLines={1}>
        {diff === 0 ? 'Same as before' : `${up ? '▲' : '▼'} ${format(Math.abs(diff))}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  periods: { flexDirection: 'row', gap: 6, marginBottom: S.xs },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 140,
    gap: 3,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  summaryValue: { color: C.text, fontFamily: F.display, fontSize: 20, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  delta: { fontFamily: F.medium, fontSize: 11 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: S.lg },
  column: { flex: 1, minWidth: 0 },
  chartCard: { paddingVertical: S.lg, alignItems: 'stretch' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: S.lg, marginTop: S.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  swatchDashed: { backgroundColor: 'transparent', borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.textFaint, height: 0 },
});
