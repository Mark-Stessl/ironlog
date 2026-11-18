import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ProgressChart } from '@/components/progress-chart';
import { Card, Empty, ListCard, ListRow, Page, SectionTitle, text, type IconName } from '@/components/ui';
import { dayKey, dayStreak } from '@/lib/calendar';
import { getSetting, listFinishedWorkouts, listRestDays } from '@/lib/db';
import { dailyTotals, dayWater, getGoals } from '@/lib/food-db';
import { fmtDate, fmtDurationShort, fmtVolume } from '@/lib/format';
import { greeting, motivation } from '@/lib/greeting';
import { weeklyTotals, weekStart } from '@/lib/stats';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type PressState = PressableStateCallbackType & { hovered?: boolean };

/** The start page: a welcome, this week at a glance, training progress and the workout history. */
export default function OverviewTab() {
  const desktop = useIsDesktop();
  const [data] = useFocusData(async (db) => {
    const today = dayKey(Date.now());
    const [name, workouts, rest, food, water, goals] = await Promise.all([
      getSetting(db, 'profile_name', ''),
      listFinishedWorkouts(db),
      listRestDays(db),
      dailyTotals(db, today, today),
      dayWater(db, today),
      getGoals(db),
    ]);
    return { name: name.trim(), workouts, rest, kcal: food.get(today)?.kcal ?? 0, water, goals };
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
      <LinearGradient colors={['#22D3EE', '#0E7490']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
        {first ? (
          <Text style={styles.avatarText}>{first[0].toUpperCase()}</Text>
        ) : (
          <Ionicons name="person" size={22} color={C.onAccent} />
        )}
      </LinearGradient>
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
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.onAccent, fontFamily: F.display, fontSize: 22 },
  glance: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
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
