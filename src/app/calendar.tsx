import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Card, IconButton, ListCard, ListRow, Page, PageHeader, text } from '@/components/ui';
import { listRestDays, setRestDay, workoutsBetween, type CalendarWorkout } from '@/lib/db';
import { dayKey, dayLabel, dayStreak, monthGrid, monthLabel, monthStart } from '@/lib/calendar';
import { fmtDurationShort } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const today = dayKey(Date.now());
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(today);

  const [data, reload] = useFocusData(async (d) => {
    // Everything, so the streak can look back across months.
    const workouts = await workoutsBetween(d, 0, Date.now() + 1);
    const rest = await listRestDays(d);
    return { workouts, rest: new Set(rest) };
  });

  const byDay = new Map<string, CalendarWorkout[]>();
  for (const w of data?.workouts ?? []) {
    const k = dayKey(w.started_at);
    byDay.set(k, [...(byDay.get(k) ?? []), w]);
  }
  const rest = data?.rest ?? new Set<string>();
  const covered = new Set([...byDay.keys(), ...rest]);
  const streak = dayStreak(covered);

  const grid = monthGrid(ym.y, ym.m);
  const monthDays = grid.flat().filter((d): d is string => d != null);
  const trainedInMonth = monthDays.filter((d) => byDay.has(d)).length;
  const restInMonth = monthDays.filter((d) => rest.has(d) && !byDay.has(d)).length;
  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();

  const shift = (delta: number) => {
    const d = new Date(monthStart(ym.y, ym.m));
    d.setMonth(d.getMonth() + delta);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  const toggleRest = async (day: string) => {
    const on = !rest.has(day);
    await setRestDay(db, day, on);
    haptic.tap();
    reload();
  };

  const sel = byDay.get(selected) ?? [];
  const selRest = rest.has(selected);
  const selFuture = selected > today;

  return (
    <Page maxWidth={620}>
      <PageHeader title="Calendar" sub="Tap a day you didn't train to mark it as a rest day" />

      <View style={styles.summary}>
        <Summary
          icon="barbell"
          color={C.accent}
          value={trainedInMonth}
          label={trainedInMonth === 1 ? 'Training day' : 'Training days'}
        />
        <Summary
          icon="moon"
          color={C.textDim}
          value={restInMonth}
          label={restInMonth === 1 ? 'Rest day' : 'Rest days'}
        />
        <Summary icon="flame" color={C.gold} value={streak} label="Day streak" />
      </View>

      <Card style={styles.calendar}>
        <View style={styles.monthRow}>
          <IconButton icon="chevron-back" label="Previous month" onPress={() => shift(-1)} />
          <Text style={styles.month}>{monthLabel(ym.y, ym.m)}</Text>
          <IconButton
            icon="chevron-forward"
            label="Next month"
            onPress={() => !isCurrentMonth && shift(1)}
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
        <Animated.View key={`${ym.y}-${ym.m}`} entering={FadeIn.duration(220)} style={{ gap: 4 }}>
          {grid.map((week, wi) => (
            <View key={wi} style={styles.week}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={styles.cell} />;
                const trained = byDay.has(day);
                const isRest = rest.has(day) && !trained;
                const future = day > today;
                const on = day === selected;
                return (
                  <Pressable
                    key={day}
                    onPress={() => setSelected(day)}
                    onLongPress={() => !trained && !future && toggleRest(day)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${dayLabel(day)}${trained ? ', trained' : isRest ? ', rest day' : ''}`}
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
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Animated.View>
        <View style={styles.legend}>
          <Legend swatch={<View style={[styles.swatch, { backgroundColor: C.accent }]} />} label="Trained" />
          <Legend
            swatch={
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: C.cardHi,
                    borderWidth: 1,
                    borderColor: C.borderHi,
                  },
                ]}
              />
            }
            label="Rest day"
          />
          <Legend
            swatch={<View style={[styles.swatch, { borderWidth: 1, borderColor: C.accentLine }]} />}
            label="Today"
          />
        </View>
      </Card>

      <Animated.View key={selected} entering={FadeIn.duration(200)} style={{ gap: S.sm, marginTop: S.sm }}>
        <Text style={text.label}>{selected === today ? 'Today' : dayLabel(selected)}</Text>
        {sel.length ? (
          <ListCard>
            {sel.map((w, i) => (
              <ListRow
                key={w.id}
                last={i === sel.length - 1}
                onPress={() =>
                  router.push({
                    pathname: '/workout/[id]',
                    params: { id: String(w.id) },
                  })
                }>
                <View style={styles.rowIcon}>
                  <Ionicons name="barbell" size={14} color={C.onAccent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>{w.name}</Text>
                  <Text style={text.faint}>
                    {new Date(w.started_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    · {fmtDurationShort(w.finished_at - w.started_at)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
              </ListRow>
            ))}
          </ListCard>
        ) : selFuture ? (
          <Card>
            <Text style={text.dim}>This day is still ahead.</Text>
          </Card>
        ) : (
          <Pressable
            onPress={() => toggleRest(selected)}
            accessibilityRole="switch"
            accessibilityState={{ checked: selRest }}
            style={({ pressed }) => [styles.restCard, selRest && styles.restCardOn, pressed && { opacity: 0.8 }]}>
            <View
              style={[
                styles.restIcon,
                selRest && {
                  backgroundColor: C.accentDim,
                  borderColor: C.accentLine,
                },
              ]}>
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
      </Animated.View>
    </Page>
  );
}

function Summary({
  icon,
  color,
  value,
  label,
}: {
  icon: 'barbell' | 'moon' | 'flame';
  color: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={text.faint} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {swatch}
      <Text style={text.faint}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: S.sm },
  summaryCard: {
    flex: 1,
    gap: 2,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  summaryValue: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 22,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  calendar: { gap: S.sm, paddingHorizontal: S.sm },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
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
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
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
  dayNum: {
    color: C.text,
    fontFamily: F.medium,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: S.lg,
    marginTop: S.xs,
    marginBottom: 2,
  },
  swatch: { width: 12, height: 12, borderRadius: 6 },
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
});
