import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExerciseImage } from '@/components/exercise-image';
import { ExerciseSearch } from '@/components/exercise-search';
import { Button, Empty, HeaderButton, IconButton, ListCard, ListRow, text } from '@/components/ui';
import {
  addExerciseToRoutine,
  deleteRoutine,
  getActiveWorkout,
  getRoutine,
  listExercises,
  removeRoutineExercise,
  renameRoutine,
  setRoutineExerciseSets,
  startWorkout,
  type Routine,
  type RoutineExercise,
} from '@/lib/db';
import { confirm, notify } from '@/lib/dialog';
import { plural } from '@/lib/format';
import { C, F, S, useIsDesktop } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routineId = Number(id);
  const [data, reload] = useFocusData((db) => getRoutine(db, routineId), routineId);

  if (data === undefined) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (data === null) return <Empty icon="alert-circle-outline" title="Routine not found" />;
  return <RoutineEditor routine={data.routine} exercises={data.exercises} reload={reload} />;
}

function RoutineEditor({
  routine,
  exercises,
  reload,
}: {
  routine: Routine;
  exercises: RoutineExercise[];
  reload: () => Promise<void>;
}) {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const [library] = useFocusData(listExercises);
  const [name, setName] = useState(routine.name);

  const remove = async () => {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: 'Workouts you already logged with it are kept.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteRoutine(db, routine.id);
    router.back();
  };

  const start = async () => {
    await renameRoutine(db, routine.id, name);
    const active = await getActiveWorkout(db);
    if (active) {
      notify('Workout in progress', `Finish or discard "${active.name}" first.`);
      return;
    }
    const workoutId = await startWorkout(db, routine.id);
    router.replace({ pathname: '/workout/[id]', params: { id: String(workoutId) } });
  };

  const content = (
    <ScrollView contentContainerStyle={[styles.page, desktop && styles.pageDesktop]} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          headerRight: () => <HeaderButton icon="trash-outline" label="Delete routine" onPress={remove} color={C.danger} />,
        }}
      />
      <TextInput
        value={name}
        onChangeText={setName}
        onEndEditing={() => renameRoutine(db, routine.id, name)}
        onBlur={() => renameRoutine(db, routine.id, name)}
        placeholder="Routine name, e.g. Push day"
        placeholderTextColor={C.textFaint}
        style={styles.nameInput}
      />
      <Text style={text.faint}>
        {plural(exercises.length, 'exercise')} ·{' '}
        {plural(exercises.reduce((n, e) => n + e.target_sets, 0), 'set')}
      </Text>

      {exercises.length === 0 ? (
        <Empty
          icon="list-outline"
          title="No exercises yet"
          hint={desktop ? 'Pick exercises from the library on the right.' : 'Add the machines and exercises for this routine.'}
        />
      ) : (
        <ListCard style={{ marginTop: S.sm }}>
          {exercises.map((ex, i) => (
            <ListRow key={ex.id} last={i === exercises.length - 1}>
              <ExerciseImage name={ex.name} equipment={ex.equipment} size={32} radius={7} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={text.strong} numberOfLines={1}>
                  {ex.name}
                </Text>
                <Text style={text.faint} numberOfLines={1}>
                  {ex.muscle} · {ex.equipment}
                </Text>
              </View>
              <View style={styles.stepper}>
                <IconButton
                  icon="remove"
                  label={`One set less for ${ex.name}`}
                  size={15}
                  onPress={async () => {
                    await setRoutineExerciseSets(db, ex.id, ex.target_sets - 1);
                    await reload();
                  }}
                />
                <Text style={styles.stepperValue}>{plural(ex.target_sets, 'set')}</Text>
                <IconButton
                  icon="add"
                  label={`One set more for ${ex.name}`}
                  size={15}
                  onPress={async () => {
                    await setRoutineExerciseSets(db, ex.id, ex.target_sets + 1);
                    await reload();
                  }}
                />
              </View>
              <IconButton
                icon="close"
                label={`Remove ${ex.name}`}
                color={C.textFaint}
                size={16}
                onPress={async () => {
                  await removeRoutineExercise(db, ex.id);
                  await reload();
                }}
              />
            </ListRow>
          ))}
        </ListCard>
      )}

      <View style={styles.actions}>
        {!desktop ? (
          <Button
            label="Add exercise"
            icon="add"
            onPress={() => router.push({ pathname: '/exercise-picker', params: { routineId: String(routine.id) } })}
            style={{ flex: 1 }}
          />
        ) : null}
        {exercises.length > 0 ? (
          <Button label="Start routine" icon="play" kind="primary" onPress={start} style={desktop ? undefined : { flex: 1 }} />
        ) : null}
      </View>
    </ScrollView>
  );

  if (!desktop) return content;
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1 }}>{content}</View>
      <View style={styles.panel}>
        <ExerciseSearch
          exercises={library ?? []}
          pickIcon="add"
          padding={20}
          header={<Text style={text.h2}>Add exercise</Text>}
          onPick={async (ex) => {
            await addExerciseToRoutine(db, routine.id, ex.id);
            await reload();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: S.lg, gap: 6, paddingBottom: S.xxl },
  pageDesktop: { paddingHorizontal: 40, paddingTop: S.xl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  panel: { width: 360, borderLeftWidth: 1, borderLeftColor: C.border },
  nameInput: { color: C.text, fontSize: 22, fontFamily: F.display, letterSpacing: -0.5, paddingVertical: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepperValue: { color: C.textDim, fontSize: 12, fontFamily: F.medium, minWidth: 44, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: S.md },
});
