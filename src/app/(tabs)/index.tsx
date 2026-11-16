import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import { Elapsed } from '@/components/elapsed';
import { Button, Empty, Page, PageHeader, SectionTitle, Stat, text } from '@/components/ui';
import { createRoutine, getActiveWorkout, listFinishedWorkouts, listRoutines, startWorkout } from '@/lib/db';
import { confirm } from '@/lib/dialog';
import { fmtVolume } from '@/lib/format';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type PressState = PressableStateCallbackType & { hovered?: boolean };

function startOfWeek(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

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
  const week = (data?.finished ?? []).filter((w) => (w.finished_at ?? 0) >= startOfWeek(new Date()));

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
      <PageHeader title="Workout" />

      <View style={styles.weekRow}>
        <Stat label="This week" value={`${week.length} ${week.length === 1 ? 'workout' : 'workouts'}`} />
        <Stat label="Volume" value={fmtVolume(week.reduce((s, w) => s + w.volume, 0))} />
        <Stat label="Sets" value={String(week.reduce((s, w) => s + w.set_count, 0))} />
      </View>

      {active ? (
        <Pressable onPress={() => open(active.id)} accessibilityRole="button" style={(s: PressState) => [styles.live, s.hovered && { borderColor: C.good }]}>
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

      <SectionTitle title={`Routines${routines.length ? ` · ${routines.length}` : ''}`} right={<Button label="New routine" icon="add" kind="ghost" small onPress={newRoutine} />} />

      {data && routines.length === 0 ? (
        <Empty icon="list-outline" title="No routines yet" hint='Create one like "Push day", or save a finished workout as a routine.' />
      ) : (
        <View style={styles.grid}>
          {routines.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: String(r.id) } })}
              style={(s: PressState) => [styles.routine, desktop && styles.routineDesktop, s.hovered && { borderColor: C.borderHi }]}>
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
            </Pressable>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', gap: 28, marginBottom: S.sm },
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
