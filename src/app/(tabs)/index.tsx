import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import Animated, { FadeInDown } from 'react-native-reanimated';

import { Elapsed } from '@/components/elapsed';
import { WeekStrip, startOfWeek } from '@/components/week-strip';
import { Button, Empty, Page, PageHeader, SectionTitle, Stat, text } from '@/components/ui';
import { createRoutine, getActiveWorkout, listFinishedWorkouts, listRoutines, startWorkout } from '@/lib/db';
import { confirm } from '@/lib/dialog';
import { fmtVolume } from '@/lib/format';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type PressState = PressableStateCallbackType & { hovered?: boolean };

export default function WorkoutTab() {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const [data] = useFocusData(async (d) => ({
    active: await getActiveWorkout(d),
    routines: await listRoutines(d),
    finished: await listFinishedWorkouts(d),
  }));
  const active = data?.active ?? null;
  const routines = data?.routines ?? [];
  const finishedAt = (data?.finished ?? []).map((w) => w.finished_at ?? w.started_at);
  const week = (data?.finished ?? []).filter((w) => (w.finished_at ?? 0) >= startOfWeek(Date.now()));

  const open = (id: number) => router.push({ pathname: '/workout/[id]', params: { id: String(id) } });

  const start = async (routineId?: number) => {
    if (active) {
      const resume = await confirm({
        title: 'Workout in progress',
        message: `Finish or discard "${active.name}" before starting a new one. Resume it now?`,
        confirmLabel: 'Resume',
      });
      if (resume) open(active.id);
      return;
    }
    open(await startWorkout(db, routineId));
  };

  const newRoutine = async () => {
    const id = await createRoutine(db, 'New routine');
    router.push({ pathname: '/routine/[id]', params: { id: String(id) } });
  };

  return (
    <Page maxWidth={960} topInset>
      <PageHeader title={greeting()} sub={week.length ? motivation(week.length) : 'Ready when you are.'} />

      <WeekStrip finishedAt={finishedAt} />

      <View style={styles.weekRow}>
        <Stat label="This week" value={`${week.length} ${week.length === 1 ? 'workout' : 'workouts'}`} />
        <Stat label="Volume" value={fmtVolume(week.reduce((s, w) => s + w.volume, 0))} />
        <Stat label="Sets" value={String(week.reduce((s, w) => s + w.set_count, 0))} />
      </View>

      {active ? (
        <Pressable
          onPress={() => open(active.id)}
          accessibilityRole="button"
          style={(s: PressState) => [styles.live, s.hovered && { borderColor: C.good }]}>
          <View style={styles.liveDot} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={text.strong} numberOfLines={1}>
              {active.name}
            </Text>
            <Text style={text.faint}>In progress</Text>
          </View>
          <Elapsed since={active.started_at} style={[text.num, { fontSize: 14 }]} />
          <Ionicons name="chevron-forward" size={16} color={C.textDim} />
        </Pressable>
      ) : (
        <Button
          label="Start empty workout"
          icon="add"
          kind="primary"
          onPress={() => start()}
          style={desktop ? { alignSelf: 'flex-start' } : undefined}
        />
      )}

      <SectionTitle
        title={`Routines${routines.length ? ` · ${routines.length}` : ''}`}
        right={<Button label="New routine" icon="add" kind="ghost" small onPress={newRoutine} />}
      />

      {data && routines.length === 0 ? (
        <Empty
          icon="list-outline"
          title="No routines yet"
          hint='Create one like "Push day", or save a finished workout as a routine.'
        />
      ) : (
        <View style={styles.grid}>
          {routines.map((r, i) => (
            <AnimatedPressable
              key={r.id}
              entering={FadeInDown.delay(i * 60).duration(300)}
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: String(r.id) } })}
              style={(s: PressState) => [
                styles.routine,
                desktop && styles.routineDesktop,
                s.hovered && { borderColor: C.borderHi },
              ]}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={text.h2} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={text.faint} numberOfLines={2}>
                  {r.exercise_names ?? 'No exercises yet'}
                </Text>
              </View>
              {r.exercise_count > 0 ? (
                <Button label="Start" icon="play" kind="secondary" small onPress={() => start(r.id)} />
              ) : null}
            </AnimatedPressable>
          ))}
        </View>
      )}
    </Page>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late session?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function motivation(workoutsThisWeek: number): string {
  if (workoutsThisWeek === 1) return 'One workout this week. Keep it rolling.';
  if (workoutsThisWeek < 4) return `${workoutsThisWeek} workouts this week. Nice momentum.`;
  return `${workoutsThisWeek} workouts this week. You're on fire.`;
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', gap: 28, marginTop: S.sm, marginBottom: S.sm },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 10,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 123, 0.35)',
    backgroundColor: C.goodDim,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.good },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  routine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: 14,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  routineDesktop: { width: undefined, flexBasis: '45%', flexGrow: 1 },
});
