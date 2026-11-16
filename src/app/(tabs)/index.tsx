import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Elapsed } from '@/components/elapsed';
import { Button, Card, Empty, text } from '@/components/ui';
import { confirm } from '@/lib/dialog';
import { createRoutine, getActiveWorkout, listRoutines, startWorkout } from '@/lib/db';
import { C, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function WorkoutTab() {
  const db = useSQLiteContext();
  const [data] = useFocusData(async (d) => ({
    active: await getActiveWorkout(d),
    routines: await listRoutines(d),
  }));
  const active = data?.active ?? null;
  const routines = data?.routines ?? [];

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
    const id = await createRoutine(db, 'New Routine');
    router.push({ pathname: '/routine/[id]', params: { id: String(id) } });
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {active ? (
        <Pressable onPress={() => open(active.id)} accessibilityRole="button">
          <Card style={styles.activeCard}>
            <View style={{ flex: 1 }}>
              <Text style={[text.label, { color: C.good }]}>In progress</Text>
              <Text style={[text.h2, { marginTop: 2 }]}>{active.name}</Text>
              <Elapsed since={active.started_at} style={[text.dim, { marginTop: 2 }]} />
            </View>
            <Ionicons name="chevron-forward" size={22} color={C.good} />
          </Card>
        </Pressable>
      ) : (
        <Button label="Start Empty Workout" icon="add" onPress={() => start()} />
      )}

      <View style={styles.sectionHead}>
        <Text style={text.h2}>Routines</Text>
        <Button label="New" icon="add" kind="ghost" small onPress={newRoutine} />
      </View>

      {routines.length === 0 ? (
        <Empty
          icon="list-outline"
          title="No routines yet"
          hint='Create one like "Push Day", or finish a workout and save it as a routine.'
        />
      ) : (
        routines.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: '/routine/[id]', params: { id: String(r.id) } })}>
            <Card style={{ gap: S.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <Text style={[text.h2, { flex: 1 }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <Ionicons name="create-outline" size={18} color={C.textFaint} />
              </View>
              <Text style={text.dim} numberOfLines={2}>
                {r.exercise_names ?? 'No exercises yet – tap to add some'}
              </Text>
              {r.exercise_count > 0 ? (
                <Button label="Start Routine" icon="play" kind="secondary" small onPress={() => start(r.id)} style={{ marginTop: S.xs }} />
              ) : null}
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: S.lg, gap: S.md, paddingBottom: S.xxl },
  activeCard: { flexDirection: 'row', alignItems: 'center', borderColor: C.good, backgroundColor: C.goodDim },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.lg },
});
