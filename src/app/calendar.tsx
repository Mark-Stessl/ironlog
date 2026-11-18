import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Card, Chip, IconButton, ListCard, ListRow, Page, PageHeader, text, type IconName } from '@/components/ui';
import { bestStreak, dayKey, dayLabel, dayStreak, monthGrid, monthLabel, monthStart } from '@/lib/calendar';
import { listMeasurements, listRestDays, setRestDay, workoutsBetween, type CalendarWorkout } from '@/lib/db';
import { dailyTotals, getGoals, waterBetween } from '@/lib/food-db';
import { fmtDurationShort, fmtVolume } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { fmtMeasure, WEIGHT } from '@/lib/measures';
import type { Nutrients } from '@/lib/nutrition';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type FoodDay = 'on' | 'over' | 'under';
/** Calories within ±10 % of the goal count as on target. Few calories usually means a forgotten meal. */
function foodState(n: Nutrients | undefined, goal: number): FoodDay | null {
  const k = n?.kcal ?? 0;
  if (k <= 0) return null;
  if (Math.abs(k - goal) <= goal * 0.1) return 'on';
  return k > goal ? 'over' : 'under';
}
const FOOD_COLOR: Record<FoodDay, string> = { on: C.good, over: C.gold, under: C.textFaint };

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const today = dayKey(Date.now());
  const now = new Date();
  const [view, setView] = useState<'month' | 'year'>('month');
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(today);
  const [yearWidth, setYearWidth] = useState(0);

  const [data, reload] = useFocusData(async (d) => {
    // Everything, so streaks can look back across months.
    const [workouts, rest, food, water, goals, weights] = await Promise.all([
      workoutsBetween(d, 0, Date.now() + 1),
      listRestDays(d),
      dailyTotals(d, '0000-01-01', today),
      waterBetween(d, '0000-01-01', today),
      getGoals(d),
      listMeasurements(d, WEIGHT.key),
    ]);
    const weightByDay = new Map<string, number>();
    for (const m of weights) weightByDay.set(dayKey(m.measured_at), m.value); // last weigh-in of the day
    return { workouts, rest: new Set(rest), food, water, goals, weightByDay };
  });

  const byDay = new Map<string, CalendarWorkout[]>();
  for (const w of data?.workouts ?? []) {
    const k = dayKey(w.started_at);
    byDay.set(k, [...(byDay.get(k) ?? []), w]);
  }
  const rest = data?.rest ?? new Set<string>();
  const covered = new Set([...byDay.keys(), ...rest]);
  const streak = dayStreak(covered);
  const best = Math.max(streak, bestStreak(covered));
  const goalKcal = data?.goals.kcal ?? 2000;

  const grid = monthGrid(ym.y, ym.m);
  const monthDays = grid.flat().filter((d): d is string => d != null);
  const trainedInMonth = monthDays.filter((d) => byDay.has(d)).length;
  const restInMonth = monthDays.filter((d) => rest.has(d) && !byDay.has(d)).length;
  const timeInMonth = monthDays
    .flatMap((d) => byDay.get(d) ?? [])
    .reduce((s, w) => s + (w.finished_at - w.started_at), 0);
  const foodDays = monthDays.filter((d) => foodState(data?.food.get(d), goalKcal));
  const onGoal = foodDays.filter((d) => foodState(data?.food.get(d), goalKcal) === 'on').length;
  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();

  const shift = (delta: number) => {
    const d = new Date(monthStart(ym.y, ym.m));
    d.setMonth(d.getMonth() + delta);
    if (d.getTime() > Date.now()) return;
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    setYm({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(today);
    setView('month');
  };

  const toggleRest = async (day: string) => {
    await setRestDay(db, day, !rest.has(day));
    haptic.tap();
    reload();
  };

  // ── Year view: twelve small months ──
  const yearTrained = [...byDay.keys()].filter((d) => d.startsWith(String(ym.y))).length;
  const yearRest = [...rest].filter((d) => d.startsWith(String(ym.y)) && !byDay.has(d)).length;
  const yearCols = yearWidth >= 640 ? 4 : 3;
  const miniW = yearWidth ? Math.floor((yearWidth - S.md * (yearCols - 1)) / yearCols) : 0;
  const year = (
    <Card style={{ gap: S.md }}>
      <View style={styles.monthRow}>
        <IconButton icon="chevron-back" label="Previous year" onPress={() => setYm({ y: ym.y - 1, m: 11 })} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.month}>{ym.y}</Text>
          <Text style={text.faint}>
            {yearTrained} training · {yearRest} rest days
          </Text>
        </View>
        <IconButton
          icon="chevron-forward"
          label="Next year"
          onPress={() => ym.y < now.getFullYear() && setYm({ y: ym.y + 1, m: 0 })}
          color={ym.y < now.getFullYear() ? C.textDim : C.border}
        />
      </View>
      <View style={styles.yearGrid} onLayout={(e) => setYearWidth(e.nativeEvent.layout.width)}>
        {miniW
          ? MONTHS_SHORT.map((label, m) => {
              const g = monthGrid(ym.y, m);
              const days = g.flat().filter((d): d is string => d != null);
              const n = days.filter((d) => byDay.has(d)).length;
              const future = monthStart(ym.y, m) > Date.now();
              const cell = Math.floor((miniW - 6 * 2) / 7);
              return (
                <Pressable
                  key={m}
                  disabled={future}
                  onPress={() => {
                    setYm({ y: ym.y, m });
                    setView('month');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} ${ym.y}, ${n} training days`}
                  style={({ pressed }) => [
                    { width: miniW, gap: 4 },
                    future && { opacity: 0.35 },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <View style={styles.miniHead}>
                    <Text style={styles.miniLabel}>{label}</Text>
                    {n ? <Text style={styles.miniCount}>{n}</Text> : null}
                  </View>
                  <View style={{ gap: 2 }}>
                    {g.map((week, wi) => (
                      <View key={wi} style={{ flexDirection: 'row', gap: 2 }}>
                        {week.map((day, di) => (
                          <View
                            key={di}
                            style={[
                              { width: cell, height: cell, borderRadius: Math.max(2, cell / 4) },
                              day == null
                                ? null
                                : byDay.has(day)
                                  ? { backgroundColor: C.accent }
                                  : rest.has(day)
                                    ? { backgroundColor: C.borderHi }
                                    : { backgroundColor: C.cardHi },
                              day === today && { borderWidth: 1, borderColor: C.text },
                            ]}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })
          : null}
      </View>
      <View style={styles.legend}>
        <Legend color={C.accent} label="Trained" />
        <Legend color={C.borderHi} label="Rest day" />
      </View>
    </Card>
  );

  // ── Month view ──
  const month = (
    <Card style={styles.calendar}>
      <View style={styles.monthRow}>
        <IconButton icon="chevron-back" label="Previous month" onPress={() => shift(-1)} />
        <Text style={styles.month}>{monthLabel(ym.y, ym.m)}</Text>
        <IconButton
          icon="chevron-forward"
          label="Next month"
          onPress={() => shift(1)}
          color={isCurrentMonth ? C.border : C.textDim}
        />
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      <Animated.View key={`${ym.y}-${ym.m}`} entering={FadeIn.duration(220)} style={{ gap: 2 }}>
        {grid.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={styles.cell} />;
              const trained = byDay.has(day);
              const isRest = rest.has(day) && !trained;
              const future = day > today;
              const on = day === selected;
              const food = foodState(data?.food.get(day), goalKcal);
              return (
                <Pressable
                  key={day}
                  onPress={() => setSelected(day)}
                  onLongPress={() => !trained && !future && toggleRest(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${dayLabel(day)}${trained ? ', trained' : isRest ? ', rest day' : ''}${
                    food ? `, food ${food === 'on' ? 'on goal' : food}` : ''
                  }`}
                  style={styles.cell}>
                  <View
                    style={[
                      styles.day,
                      day === today && styles.today,
                      on && styles.selected,
                      future && { opacity: 0.35 },
                    ]}>
                    {trained ? (
                      <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.trained} />
                    ) : null}
                    {isRest ? <View style={styles.rest} /> : null}
                    <Text
                      style={[
                        styles.dayNum,
                        trained && { color: C.onAccent, fontFamily: F.semi },
                        isRest && { color: C.textDim },
                      ]}>
                      {Number(day.slice(8))}
                    </Text>
                    {isRest ? <Ionicons name="moon" size={8} color={C.textDim} style={styles.moon} /> : null}
                    {(byDay.get(day)?.length ?? 0) > 1 ? (
                      <View style={styles.twice}>
                        <Text style={styles.twiceText}>{byDay.get(day)!.length}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.foodDot, food ? { backgroundColor: FOOD_COLOR[food] } : null]} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </Animated.View>
      <View style={styles.legend}>
        <Legend color={C.accent} label="Trained" />
        <Legend color={C.cardHi} border label="Rest" />
        <Legend color={C.good} small label="Food on goal" />
        <Legend color={C.gold} small label="Over" />
        <Legend color={C.textFaint} small label="Under" />
      </View>
    </Card>
  );

  // ── The selected day ──
  const sel = byDay.get(selected) ?? [];
  const selRest = rest.has(selected);
  const selFuture = selected > today;
  const selFood = data?.food.get(selected);
  const selWater = data?.water.get(selected) ?? 0;
  const selWeight = data?.weightByDay.get(selected);
  const selState = foodState(selFood, goalKcal);
  const openFood = () => router.navigate({ pathname: '/food', params: { day: selected } });

  const dayPanel = (
    <Animated.View key={selected} entering={FadeIn.duration(200)} style={{ gap: S.sm }}>
      <Text style={text.label}>{selected === today ? 'Today' : dayLabel(selected)}</Text>
      {selFuture ? (
        <Card>
          <Text style={text.dim}>This day is still ahead.</Text>
        </Card>
      ) : (
        <>
          {sel.length ? (
            <ListCard>
              {sel.map((w, i) => (
                <ListRow
                  key={w.id}
                  last={i === sel.length - 1}
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(w.id) } })}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="barbell" size={14} color={C.onAccent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={text.strong} numberOfLines={1}>
                      {w.name}
                    </Text>
                    <Text style={text.faint} numberOfLines={1}>
                      {new Date(w.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ·{' '}
                      {fmtDurationShort(w.finished_at - w.started_at)} · {w.sets} {w.sets === 1 ? 'set' : 'sets'}
                      {w.volume ? ` · ${fmtVolume(w.volume)}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
                </ListRow>
              ))}
            </ListCard>
          ) : (
            <Pressable
              onPress={() => toggleRest(selected)}
              accessibilityRole="switch"
              accessibilityState={{ checked: selRest }}
              style={({ pressed }) => [styles.restCard, selRest && styles.restCardOn, pressed && { opacity: 0.8 }]}>
              <View style={[styles.restIcon, selRest && { backgroundColor: C.accentDim, borderColor: C.accentLine }]}>
                <Ionicons name={selRest ? 'moon' : 'moon-outline'} size={16} color={selRest ? C.accent : C.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>{selRest ? 'Rest day' : 'No workout'}</Text>
                <Text style={text.faint}>
                  {selRest ? 'Recovery counts too. Tap to remove.' : 'Took it easy on purpose? Mark it as a rest day.'}
                </Text>
              </View>
              <View style={[styles.toggle, selRest && styles.toggleOn]}>
                <Text style={styles.toggleLabel}>{selRest ? 'Remove' : 'Mark rest'}</Text>
              </View>
            </Pressable>
          )}

          <Pressable
            onPress={openFood}
            accessibilityRole="link"
            accessibilityLabel={`Open food for ${dayLabel(selected)}`}
            style={({ pressed }) => [styles.foodCard, pressed && { opacity: 0.8 }]}>
            <View style={[styles.foodIcon, selState && { borderColor: FOOD_COLOR[selState] }]}>
              <Ionicons name="nutrition-outline" size={16} color={selState ? FOOD_COLOR[selState] : C.textDim} />
            </View>
            <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
              {selState ? (
                <>
                  <View style={styles.foodTop}>
                    <Text style={text.strong}>
                      {Math.round(selFood?.kcal ?? 0).toLocaleString('en-US')}{' '}
                      <Text style={text.faint}>of {goalKcal.toLocaleString('en-US')} kcal</Text>
                    </Text>
                    <Text style={[styles.foodTag, { color: FOOD_COLOR[selState] }]}>
                      {selState === 'on' ? 'On goal' : selState === 'over' ? 'Over' : 'Under'}
                    </Text>
                  </View>
                  <View style={styles.bar}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(100, ((selFood?.kcal ?? 0) / goalKcal) * 100)}%`,
                          backgroundColor: FOOD_COLOR[selState],
                        },
                      ]}
                    />
                  </View>
                  <Text style={text.faint} numberOfLines={1}>
                    {Math.round(selFood?.protein ?? 0)} g protein
                    {selWater ? ` · ${(selWater / 1000).toFixed(1)} L water` : ''}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={text.strong}>No food logged</Text>
                  <Text style={text.faint}>
                    {selWater ? `${(selWater / 1000).toFixed(1)} L water · ` : ''}Open this day to add meals
                  </Text>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
          </Pressable>

          {selWeight != null ? (
            <Pressable
              onPress={() => router.push('/measures')}
              accessibilityRole="link"
              style={({ pressed }) => [styles.foodCard, pressed && { opacity: 0.8 }]}>
              <View style={styles.foodIcon}>
                <Ionicons name={WEIGHT.icon} size={16} color={C.textDim} />
              </View>
              <Text style={[text.strong, { flex: 1 }]}>
                {fmtMeasure(selWeight, 'kg')} <Text style={text.faint}>body weight</Text>
              </Text>
              <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
            </Pressable>
          ) : null}
        </>
      )}
    </Animated.View>
  );

  return (
    <Page maxWidth={desktop ? 1000 : 620}>
      <PageHeader
        title="Calendar"
        sub="Workouts, rest days and food. Tap a day for details"
        right={
          !isCurrentMonth || selected !== today || view === 'year' ? (
            <Pressable onPress={goToday} accessibilityRole="button" style={styles.todayButton}>
              <Text style={styles.todayText}>Today</Text>
            </Pressable>
          ) : null
        }
      />

      <View style={styles.summary}>
        <Summary
          icon="barbell"
          color={C.accent}
          value={trainedInMonth}
          label={trainedInMonth === 1 ? 'Training day' : 'Training days'}
          sub={timeInMonth ? fmtDurationShort(timeInMonth) : 'this month'}
        />
        <Summary
          icon="moon"
          color={C.textDim}
          value={restInMonth}
          label={restInMonth === 1 ? 'Rest day' : 'Rest days'}
          sub="this month"
        />
        <Summary icon="flame" color={C.gold} value={streak} label="Day streak" sub={`best ${best}`} />
        <Summary
          icon="nutrition"
          color={C.good}
          value={onGoal}
          label="Days on goal"
          sub={foodDays.length ? `of ${foodDays.length} logged` : 'no food logged'}
        />
      </View>

      <View style={styles.views}>
        <Chip label="Month" active={view === 'month'} onPress={() => setView('month')} />
        <Chip label="Year" active={view === 'year'} onPress={() => setView('year')} />
      </View>

      {view === 'year' ? (
        year
      ) : desktop ? (
        <View style={styles.columns}>
          <View style={{ flex: 1.2, minWidth: 0 }}>{month}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{dayPanel}</View>
        </View>
      ) : (
        <>
          {month}
          {dayPanel}
        </>
      )}
    </Page>
  );
}

function Summary({
  icon,
  color,
  value,
  label,
  sub,
}: {
  icon: IconName;
  color: string;
  value: number;
  label: string;
  sub: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={text.faint} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.summarySub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

function Legend({ color, label, border, small }: { color: string; label: string; border?: boolean; small?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View
        style={[
          small ? { width: 6, height: 6, borderRadius: 3 } : { width: 11, height: 11, borderRadius: 6 },
          { backgroundColor: color },
          border && { borderWidth: 1, borderColor: C.borderHi },
        ]}
      />
      <Text style={text.faint}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 130,
    gap: 1,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  summaryValue: { color: C.text, fontFamily: F.display, fontSize: 22, letterSpacing: -0.4, marginTop: 2 },
  summarySub: { color: C.textDim, fontFamily: F.medium, fontSize: 11 },
  views: { flexDirection: 'row', gap: 6 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: S.lg },
  todayButton: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
    justifyContent: 'center',
  },
  todayText: { color: C.accent, fontFamily: F.semi, fontSize: 13 },
  calendar: { gap: S.sm, paddingHorizontal: S.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  month: { color: C.text, fontFamily: F.displaySemi, fontSize: 16 },
  week: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 11,
    paddingVertical: 4,
  },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2, gap: 3 },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  today: { borderColor: C.accentLine },
  selected: { borderColor: C.text },
  trained: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 16,
    backgroundColor: C.accent,
  },
  rest: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 16,
    backgroundColor: C.cardHi,
    borderWidth: 1,
    borderColor: C.borderHi,
  },
  moon: { position: 'absolute', top: 5, right: 6 },
  twice: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twiceText: { color: C.accent, fontFamily: F.semi, fontSize: 9 },
  dayNum: { color: C.text, fontFamily: F.medium, fontSize: 13, fontVariant: ['tabular-nums'] },
  foodDot: { width: 5, height: 5, borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: S.md,
    rowGap: 6,
    marginTop: S.xs,
    marginBottom: 2,
  },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  miniHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  miniLabel: { color: C.text, fontFamily: F.semi, fontSize: 12 },
  miniCount: { color: C.accent, fontFamily: F.semi, fontSize: 11 },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  restCardOn: { borderColor: C.accentLine },
  restIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.borderHi,
    justifyContent: 'center',
  },
  toggleOn: { borderColor: C.accentLine },
  toggleLabel: { color: C.text, fontFamily: F.semi, fontSize: 12 },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  foodIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.borderHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: S.sm },
  foodTag: { fontFamily: F.semi, fontSize: 12 },
  bar: { height: 5, borderRadius: 3, backgroundColor: C.cardHi, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
