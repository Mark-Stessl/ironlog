import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  CalorieRing,
  DetailBars,
  EnergySplit,
  MacroBars,
  MicroBars,
  WeekBars,
} from '@/components/nutrition-charts';
import { Card, IconButton, ListCard, ListRow, Page, SectionTitle, text } from '@/components/ui';
import { WaterCard } from '@/components/water-card';
import { addDays, dayKey, dayStart, relativeDay } from '@/lib/calendar';
import {
  addWater,
  copyMeal,
  dailyTotals,
  dayLog,
  dayWater,
  getGoalSettings,
  goalsFrom,
  undoWater,
  type LogEntry,
} from '@/lib/food-db';
import { haptic } from '@/lib/haptics';
import { sum } from '@/lib/nutrition';
import { MEALS, type Meal } from '@/lib/recipes';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function FoodTab() {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const today = dayKey(Date.now());
  const [day, setDay] = useState(today);

  const [data, reload] = useFocusData(async (d) => {
    const from = addDays(day, -6);
    const [log, yesterday, water, settings, week] = await Promise.all([
      dayLog(d, day),
      dayLog(d, addDays(day, -1)),
      dayWater(d, day),
      getGoalSettings(d),
      dailyTotals(d, from, day),
    ]);
    return { log, yesterday, water, settings, goals: goalsFrom(settings), week };
  }, day);

  const log = data?.log ?? [];
  const goals = data?.goals;
  const total = sum(log.map((e) => e.n));
  const eaten = total.kcal ?? 0;

  const openAdd = (meal: Meal) => router.push({ pathname: '/food-add', params: { meal, day } });

  const drink = async (ml: number) => {
    const before = data?.water ?? 0;
    await addWater(db, day, ml);
    if (goals && before < goals.waterMl && before + ml >= goals.waterMl) haptic.success();
    else haptic.tap();
    reload();
  };

  const week = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(day, i - 6);
    return {
      day: k,
      label: new Date(dayStart(k)).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      kcal: data?.week.get(k)?.kcal ?? 0,
    };
  });

  const summary = goals ? (
    <Card style={styles.summary}>
      <View style={[styles.summaryTop, !desktop && { gap: S.lg }]}>
        <CalorieRing eaten={eaten} goal={goals.kcal} size={desktop ? 180 : 150} />
        <MacroBars n={total} goals={goals} />
      </View>
      <View style={styles.eatenRow}>
        <Stat label="Eaten" value={Math.round(eaten).toLocaleString('en-US')} />
        <Stat label="Goal" value={goals.kcal.toLocaleString('en-US')} />
        <Stat label="Protein" value={`${Math.round(total.protein ?? 0)} g`} />
      </View>
      <EnergySplit n={total} />
    </Card>
  ) : null;

  const meals = (
    <View>
      {MEALS.map((m, mi) => {
        const entries = log.filter((e) => e.meal === m.key);
        const kcal = sum(entries.map((e) => e.n)).kcal ?? 0;
        const before = (data?.yesterday ?? []).filter((e) => e.meal === m.key);
        return (
          <Animated.View key={m.key} entering={FadeInDown.delay(mi * 40).duration(260)}>
            <SectionTitle
              title={entries.length ? `${m.label} · ${Math.round(kcal)} kcal` : m.label}
              right={<IconButton icon="add" label={`Add to ${m.label}`} onPress={() => openAdd(m.key)} color={C.accent} />}
            />
            {entries.length ? (
              <ListCard>
                {entries.map((e, i) => (
                  <EntryRow key={e.id} entry={e} last={i === entries.length - 1} />
                ))}
              </ListCard>
            ) : (
              <View style={styles.emptyMeal}>
                <Pressable
                  onPress={() => openAdd(m.key)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.addMeal, pressed && { opacity: 0.7 }]}>
                  <Ionicons name={m.icon} size={16} color={C.textDim} />
                  <Text style={styles.addMealLabel}>Add {m.label.toLowerCase()}</Text>
                </Pressable>
                {before.length ? (
                  <Pressable
                    onPress={async () => {
                      await copyMeal(db, addDays(day, -1), day, m.key);
                      haptic.success();
                      reload();
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.copy, pressed && { opacity: 0.7 }]}>
                    <Ionicons name="copy-outline" size={14} color={C.accent} />
                    <Text style={styles.copyLabel}>Same as yesterday</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );

  const side = goals ? (
    <View style={{ gap: S.sm }}>
      <SectionTitle title="Water" />
      <WaterCard
        ml={data?.water ?? 0}
        goal={goals.waterMl}
        onAdd={drink}
        onUndo={async () => {
          await undoWater(db, day);
          reload();
        }}
      />
      <SectionTitle title="Fibre, sugar and salt" />
      <Card>
        <DetailBars n={total} goals={goals} />
      </Card>
      <SectionTitle title="Vitamins and minerals" />
      <Card style={{ gap: S.md }}>
        <MicroBars n={total} goals={goals} />
        <Text style={text.faint}>
          % of the EU daily reference. Packaged products often don't list vitamins, so these can read low.
        </Text>
      </Card>
      <SectionTitle title="Last 7 days" />
      <Card>
        <WeekBars days={week} goal={goals.kcal} selected={day} onSelect={setDay} />
      </Card>
    </View>
  ) : null;

  return (
    <Page topInset maxWidth={1100}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={text.title}>Food</Text>
          <Text style={text.dim}>{data?.settings.profile ? 'Goals from your body profile' : 'EU reference intakes'}</Text>
        </View>
        <IconButton icon="options-outline" label="Nutrition goals" onPress={() => router.push('/nutrition-goals')} />
      </View>

      <View style={styles.dayNav}>
        <IconButton icon="chevron-back" label="Previous day" onPress={() => setDay(addDays(day, -1))} />
        <Pressable onPress={() => setDay(today)} accessibilityRole="button" accessibilityLabel="Go to today">
          <Animated.Text key={day} entering={FadeIn.duration(200)} style={styles.day}>
            {relativeDay(day)}
          </Animated.Text>
        </Pressable>
        <IconButton
          icon="chevron-forward"
          label="Next day"
          onPress={() => day < today && setDay(addDays(day, 1))}
          color={day < today ? C.textDim : C.border}
        />
      </View>

      {desktop ? (
        <View style={styles.columns}>
          <View style={{ flex: 1.15, minWidth: 0 }}>
            {summary}
            {meals}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>{side}</View>
        </View>
      ) : (
        <>
          {summary}
          {meals}
          {side}
        </>
      )}
      <Text style={[text.faint, { marginTop: S.lg }]}>
        Food data: Max Rubner-Institut, Bundeslebensmittelschlüssel (BLS) 4.0, CC BY 4.0. Products: Open Food Facts
        (ODbL). Goals: EU reference intakes (Regulation 1169/2011) and EFSA.
      </Text>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={text.faint}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function EntryRow({ entry: e, last }: { entry: LogEntry; last: boolean }) {
  return (
    <ListRow
      last={last}
      onPress={() => router.push({ pathname: '/food/[ref]', params: { ref: e.ref, entry: String(e.id) } })}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={text.strong} numberOfLines={1}>
          {e.name}
        </Text>
        <Text style={text.faint} numberOfLines={1}>
          {[e.amount, e.brand].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.kcal}>{Math.round(e.n.kcal ?? 0)} kcal</Text>
        <Text style={text.faint}>{Math.round(e.n.protein ?? 0)} g protein</Text>
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: S.md },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xs },
  day: { color: C.text, fontFamily: F.displaySemi, fontSize: 16 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: S.xl },
  summary: { gap: S.lg, padding: S.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: S.xl },
  eatenRow: { flexDirection: 'row', gap: S.md },
  statValue: { color: C.text, fontFamily: F.displaySemi, fontSize: 16, fontVariant: ['tabular-nums'] },
  emptyMeal: { flexDirection: 'row', gap: S.sm },
  addMeal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 46,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.borderHi,
  },
  addMealLabel: { color: C.textDim, fontFamily: F.medium, fontSize: 13 },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentLine,
  },
  copyLabel: { color: C.text, fontFamily: F.semi, fontSize: 12 },
  kcal: { color: C.text, fontFamily: F.semi, fontSize: 13, fontVariant: ['tabular-nums'] },
});
