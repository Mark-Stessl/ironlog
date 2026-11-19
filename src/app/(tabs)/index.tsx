import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { ProgressChart } from '@/components/progress-chart';
import { Card, Empty, ListCard, ListRow, Page, SectionTitle, text, type IconName } from '@/components/ui';
import { dayKey, dayStreak } from '@/lib/calendar';
import { getSetting, listFinishedWorkouts, listRestDays, recordRows } from '@/lib/db';
import { dailyTotals, dayWater, getGoals } from '@/lib/food-db';
import { fmtDate, fmtDurationShort, fmtVolume } from '@/lib/format';
import { greeting, motivation } from '@/lib/greeting';
import { latestRecords, recordBook, type RecordEvent } from '@/lib/records';
import { weeklyTotals, weekStart } from '@/lib/stats';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type PressState = PressableStateCallbackType & { hovered?: boolean };

/** The start page: a welcome, this week at a glance, training progress and the workout history. */
const AVATAR = 52;

export default function OverviewTab() {
  const desktop = useIsDesktop();
  const [data] = useFocusData(async (db) => {
    const today = dayKey(Date.now());
    const [name, photo, workouts, rest, food, water, goals] = await Promise.all([
      getSetting(db, 'profile_name', ''),
      getSetting(db, 'profile_photo', ''),
      listFinishedWorkouts(db),
      listRestDays(db),
      dailyTotals(db, today, today),
      dayWater(db, today),
      getGoals(db),
    ]);
    const fresh = latestRecords(recordBook(await recordRows(db)).events);
    return { name: name.trim(), photo, fresh, workouts, rest, kcal: food.get(today)?.kcal ?? 0, water, goals };
  });

  const workouts = data?.workouts ?? [];
  const thisWeek = workouts.filter((w) => w.started_at >= weekStart(Date.now())).length;
  const streak = dayStreak(new Set([...workouts.map((w) => dayKey(w.started_at)), ...(data?.rest ?? [])]));
  const weeks = weeklyTotals(workouts, 12);
  const first = (data?.name ?? '').split(' ')[0];

  // History grouped by month: "November 2026 · 8 workouts".
  const groups: { label: string; items: typeof workouts }[] = [];
  for (const w of workouts) {
    const label = new Date(w.started_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(w);
    else groups.push({ label, items: [w] });
  }

  const welcome = (
    <View style={styles.welcome}>
      <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Your profile">
        <Avatar photo={data?.photo ?? ''} name={first} size={AVATAR} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={text.title} numberOfLines={1}>
          {greeting()}
          {first ? `, ${first}` : ''}
        </Text>
        <Text style={text.dim}>{motivation(thisWeek)}</Text>
      </View>
    </View>
  );

  const glance = data ? (
    <View style={styles.glance}>
      <Glance
        icon="barbell"
        color={C.accent}
        value={String(thisWeek)}
        label={thisWeek === 1 ? 'workout this week' : 'workouts this week'}
        href="/workout"
      />
      <Glance
        icon="flame"
        color={C.gold}
        value={String(streak)}
        label={streak === 1 ? 'day streak' : 'day streak'}
        href="/calendar"
      />
      <Glance
        icon="nutrition"
        color={C.good}
        value={Math.round(data.kcal).toLocaleString('en-US')}
        label={`of ${data.goals.kcal.toLocaleString('en-US')} kcal today`}
        href="/food"
      />
      <Glance
        icon="water"
        color="#5EE3F7"
        value={`${(data.water / 1000).toFixed(1)} L`}
        label={`of ${(data.goals.waterMl / 1000).toFixed(1)} L water`}
        href="/food"
      />
    </View>
  ) : null;

  const progress = (
    <View>
      <SectionTitle title="Progress" />
      <Card>
        {workouts.length ? (
          <ProgressChart weeks={weeks} />
        ) : (
          <Text style={text.dim}>Finish a workout and your weekly volume, sets and time show up here.</Text>
        )}
      </Card>
    </View>
  );

  const history = (
    <View>
      <SectionTitle title="History" right={<Text style={text.faint}>{workouts.length} workouts</Text>} />
      {data && !workouts.length ? (
        <Empty icon="time-outline" title="No workouts yet" hint="Finished workouts show up here." />
      ) : (
        <Animated.View entering={FadeInDown.duration(300)} style={{ gap: S.sm }}>
          {groups.map((g) => (
            <Fragment key={g.label}>
              <Text style={[text.label, { marginTop: S.xs }]}>
                {g.label} · {g.items.length}
              </Text>
              <ListCard>
                {g.items.map((w, i) => {
                  const end = w.finished_at ?? w.started_at;
                  return (
                    <ListRow
                      key={w.id}
                      last={i === g.items.length - 1}
                      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(w.id) } })}
                      style={{ alignItems: 'flex-start', paddingVertical: S.md }}>
                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
                          <Text style={[text.strong, { flexShrink: 1 }]} numberOfLines={1}>
                            {w.name}
                          </Text>
                          <Text style={text.faint}>{fmtDate(end)}</Text>
                        </View>
                        {w.exercise_names ? (
                          <Text style={text.faint} numberOfLines={1}>
                            {w.exercise_names}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 3 }}>
                        <Text style={[text.dim, { color: C.text, fontVariant: ['tabular-nums'] }]}>
                          {fmtVolume(w.volume)}
                        </Text>
                        <Text style={text.faint}>
                          {fmtDurationShort(end - w.started_at)} · {w.set_count} sets
                        </Text>
                      </View>
                    </ListRow>
                  );
                })}
              </ListCard>
            </Fragment>
          ))}
        </Animated.View>
      )}
    </View>
  );

  return (
    <Page topInset maxWidth={1100}>
      {welcome}
      {data?.fresh && data.fresh.date >= Date.now() - 7 * 86_400_000 ? <NewRecords {...data.fresh} /> : null}
      {glance}
      {desktop ? (
        <View style={styles.columns}>
          <View style={{ flex: 1, minWidth: 0 }}>{progress}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{history}</View>
        </View>
      ) : (
        <>
          {progress}
          {history}
        </>
      )}
    </Page>
  );
}

/** Records broken in your latest workout (shown for a week). */
function NewRecords({ workout, items }: { workout: string; items: RecordEvent[] }) {
  const names = [...new Set(items.map((e) => e.name))];
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Pressable
        onPress={() => router.push('/records')}
        accessibilityRole="button"
        accessibilityLabel={`${items.length} new records in ${workout}`}
        style={({ pressed }) => [styles.newRecords, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
        <View style={styles.newRecordsIcon}>
          <Ionicons name="trophy" size={18} color={C.gold} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[text.strong, { color: C.gold }]} numberOfLines={1}>
            {items.length === 1 ? 'New record' : `${items.length} new records`} in {workout}
          </Text>
          <Text style={text.faint} numberOfLines={1}>
            {items.length === 1 ? `${items[0].name} · ${items[0].title}` : names.join(', ')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={C.gold} />
      </Pressable>
    </Animated.View>
  );
}

function Glance({
  icon,
  color,
  value,
  label,
  href,
}: {
  icon: IconName;
  color: string;
  value: string;
  label: string;
  href: Href;
}) {
  return (
    <Pressable
      onPress={() => router.navigate(href)}
      accessibilityRole="link"
      accessibilityLabel={`${value} ${label}`}
      style={(s: PressState) => [
        styles.glanceCard,
        s.hovered && { borderColor: C.accentLine },
        s.pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
      ]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={styles.glanceValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={text.faint} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  welcome: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginTop: S.xs },
  glance: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  newRecords: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    marginBottom: S.sm,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: 'rgba(233,190,88,0.45)',
    backgroundColor: 'rgba(233,190,88,0.08)',
  },
  newRecordsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(233,190,88,0.16)',
  },
  glanceCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 140,
    gap: 2,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  glanceValue: { color: C.text, fontFamily: F.display, fontSize: 22, letterSpacing: -0.4, marginTop: 4 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: S.xl },
});
