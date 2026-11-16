import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Empty, HeaderButton, text } from '@/components/ui';
import {
  deleteRoutine,
  getActiveWorkout,
  getRoutine,
  removeRoutineExercise,
  renameRoutine,
  setRoutineExerciseSets,
  startWorkout,
  type Routine,
  type RoutineExercise,
} from '@/lib/db';
import { confirm, notify } from '@/lib/dialog';
import { C, R, S } from '@/lib/theme';
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

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          headerRight: () => <HeaderButton icon="trash-outline" label="Delete routine" onPress={remove} color={C.danger} />,
        }}
      />
      <Text style={text.label}>Routine name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        onEndEditing={() => renameRoutine(db, routine.id, name)}
        placeholder="e.g. Push Day"
        placeholderTextColor={C.textFaint}
        selectTextOnFocus
        style={styles.nameInput}
      />

      {exercises.length === 0 ? (
        <Empty icon="list-outline" title="No exercises yet" hint="Add the machines and exercises for this routine." />
      ) : null}

      {exercises.map((ex) => (
        <Card key={ex.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[text.body, { fontWeight: '700' }]}>{ex.name}</Text>
            <Text style={text.faint}>
              {ex.muscle} · {ex.equipment}
            </Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              hitSlop={8}
              accessibilityLabel={`One set less for ${ex.name}`}
              onPress={async () => {
                await setRoutineExerciseSets(db, ex.id, ex.target_sets - 1);
                await reload();
              }}>
              <Ionicons name="remove-circle-outline" size={26} color={C.textDim} />
            </Pressable>
            <Text style={styles.stepperValue}>{ex.target_sets} sets</Text>
            <Pressable
              hitSlop={8}
              accessibilityLabel={`One set more for ${ex.name}`}
              onPress={async () => {
                await setRoutineExerciseSets(db, ex.id, ex.target_sets + 1);
                await reload();
              }}>
              <Ionicons name="add-circle-outline" size={26} color={C.textDim} />
            </Pressable>
          </View>
          <Pressable
            hitSlop={8}
            accessibilityLabel={`Remove ${ex.name}`}
            onPress={async () => {
              await removeRoutineExercise(db, ex.id);
              await reload();
            }}>
            <Ionicons name="close" size={22} color={C.textFaint} />
          </Pressable>
        </Card>
      ))}

      <Button
        label="Add Exercise"
        icon="add"
        kind="secondary"
        onPress={() => router.push({ pathname: '/exercise-picker', params: { routineId: String(routine.id) } })}
      />
      {exercises.length > 0 ? <Button label="Start Routine" icon="play" onPress={start} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: S.lg, gap: S.md, paddingBottom: S.xxl },
  nameInput: {
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    color: C.text,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: S.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  stepperValue: { color: C.text, fontSize: 14, fontWeight: '700', minWidth: 48, textAlign: 'center' },
});
