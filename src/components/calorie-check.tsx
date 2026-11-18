import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, text } from '@/components/ui';
import { addDays, dayKey } from '@/lib/calendar';
import { listMeasurements } from '@/lib/db';
import { confirm } from '@/lib/dialog';
import { dailyTotals, getGoalSettings, goalsFrom, setGoalSettings, withKcalGoal } from '@/lib/food-db';
import { haptic } from '@/lib/haptics';
import { WEIGHT } from '@/lib/measures';
import { AIM_OPTIONS } from '@/lib/nutrition';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { energyCheck } from '@/lib/weight-trend';

const fmtK = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Compares the weight trend of the last 4 weeks with the food log of the same days:
 * what you really burn, and whether your calorie goal fits what you want.
 */
export function CalorieCheck({ refresh = 0 }: { refresh?: number }) {
  const db = useSQLiteContext();
  const [data, reload] = useFocusData(async (d) => {
    const today = dayKey(Date.now());
    const [entries, intake, settings] = await Promise.all([
      listMeasurements(d, WEIGHT.key),
      dailyTotals(d, addDays(today, -40), today),
      getGoalSettings(d),
    ]);
    const aim = AIM_OPTIONS.find((a) => a.value === settings.profile?.aim);
    const goal = goalsFrom(settings).kcal;
    const check = energyCheck({
      entries,
      intake: new Map([...intake].map(([k, n]) => [k, n.kcal ?? 0])),
      dayKeyOf: dayKey,
      goal,
      aimKcal: aim?.kcal ?? 0,
    });
    return { check, settings, aim, goal };
  }, refresh);

  if (!data) return null;
  const { check, aim } = data;
  const aimText = aim ? aim.label.toLowerCase() : 'keep your weight';

  const apply = async (kcal: number) => {
    const ok = await confirm({
      title: `Set your goal to ${fmtK(kcal)} kcal?`,
      message: `Fat stays at 30 % of your calories, protein stays the same and carbs make up the rest. You can change it any time in Nutrition goals.`,
      confirmLabel: 'Use it',
      icon: 'flame-outline',
    });
    if (!ok) return;
    await setGoalSettings(db, withKcalGoal(data.settings, kcal));
    haptic.success();
    reload();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="flame-outline" size={16} color={C.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={text.strong}>Calorie check</Text>
          <Text style={text.faint}>Your weight trend against what you logged</Text>
        </View>
      </View>

      {check.kind === 'need-weight' ? (
        <Text style={text.dim}>
          Weigh yourself a few times a week for at least 2 weeks (mornings, before breakfast, are most comparable). Then
          this shows how many calories you really burn and whether your goal fits.
          {check.weighIns ? ` ${check.weighIns} ${check.weighIns === 1 ? 'day' : 'days'} with a weigh-in so far.` : ''}
        </Text>
      ) : check.kind === 'need-food' ? (
        <Text style={text.dim}>
          Your weight trend is ready. Log your food on most days to compare: {check.loggedDays} of the last {check.days}{' '}
          days have a full day logged (at least 10 are needed).
        </Text>
      ) : (
        <>
          <View style={styles.stats}>
            <Stat
              label="Weight trend"
              value={`${check.kgPerWeek > 0 ? '+' : check.kgPerWeek < 0 ? '−' : ''}${Math.abs(check.kgPerWeek).toFixed(1)} kg`}
              sub="per week"
            />
            <Stat label="You ate" value={fmtK(check.avgIntake)} sub="kcal per day" />
            <Stat label="You burn" value={`≈ ${fmtK(check.maintenance)}`} sub="kcal per day" highlight />
          </View>
          {Math.abs(check.off) <= 150 ? (
            <View style={[styles.verdict, styles.verdictGood]}>
              <Ionicons name="checkmark-circle" size={16} color={C.good} />
              <Text style={styles.verdictText}>
                Your goal of {fmtK(check.goal)} kcal fits: it's what your numbers say you need to {aimText}.
              </Text>
            </View>
          ) : (
            <View style={{ gap: S.sm }}>
              <View style={styles.verdict}>
                <Ionicons name="information-circle" size={16} color={C.gold} />
                <Text style={styles.verdictText}>
                  Your goal is {fmtK(check.goal)} kcal. To {aimText}
                  {aim && aim.kcal ? ` (${aim.kcal > 0 ? '+' : '−'}${Math.abs(aim.kcal)} kcal a day)` : ''}, about{' '}
                  {fmtK(check.suggested)} kcal fits your numbers better.
                </Text>
              </View>
              <Button
                small
                icon="swap-horizontal"
                label={`Use ${fmtK(check.suggested)} kcal`}
                onPress={() => apply(check.suggested)}
              />
            </View>
          )}
          <Text style={text.faint}>
            Last {check.days} days. Estimate: 1 kg of body weight ≈ 7,700 kcal. It gets more accurate the more days you
            log and weigh in; foods you forget to log make "You burn" look lower.
          </Text>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <View style={[styles.stat, highlight && styles.statHi]}>
      <Text style={text.faint}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={text.faint}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: S.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: S.sm },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 1,
    padding: S.md,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  statHi: { borderColor: C.accentLine, backgroundColor: C.accentDim },
  statValue: { color: C.text, fontFamily: F.displaySemi, fontSize: 18, fontVariant: ['tabular-nums'] },
  verdict: {
    flexDirection: 'row',
    gap: S.sm,
    padding: S.md,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  verdictGood: { borderColor: C.border },
  verdictText: { flex: 1, color: C.text, fontFamily: F.regular, fontSize: 13, lineHeight: 19 },
});
