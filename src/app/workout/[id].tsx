import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Elapsed } from '@/components/elapsed';
import { RestBar } from '@/components/rest-bar';
import { Button, Card, Empty, HeaderButton, text } from '@/components/ui';
import {
  addSet,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getSetting,
  getWorkoutDetail,
  removeWorkoutExercise,
  renameWorkout,
  saveWorkoutAsRoutine,
  setSetting,
  updateSet,
  type PrevSet,
  type SetRow,
  type WorkoutDetail,
  type WorkoutExercise,
} from '@/lib/db';
import { fmtDate, fmtDurationShort, fmtSet, fmtVolume, fmtWeight, parseNum } from '@/lib/format';
import { C, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

const REST_OPTIONS = [0, 60, 90, 120, 150, 180];

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const [detail, reload, setDetail] = useFocusData((db) => getWorkoutDetail(db, workoutId), workoutId);

  if (detail === undefined) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (detail === null) {
    return <Empty icon="alert-circle-outline" title="Workout not found" />;
  }
  return detail.workout.finished_at == null ? (
    <ActiveWorkout detail={detail} reload={reload} setDetail={setDetail} />
  ) : (
    <FinishedWorkout detail={detail} />
  );
}

// ── Active workout ──────────────────────────────────────────────────────

function ActiveWorkout({
  detail,
  reload,
  setDetail,
}: {
  detail: WorkoutDetail;
  reload: () => Promise<void>;
  setDetail: (d: WorkoutDetail) => void;
}) {
  useKeepAwake();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { workout, exercises } = detail;

  const [name, setName] = useState(workout.name);
  const [restSeconds, setRestSeconds] = useState(90);
  const [rest, setRest] = useState<{ endAt: number; total: number } | null>(null);

  useEffect(() => {
    getSetting(db, 'rest_seconds', '90').then((v) => setRestSeconds(Number(v)));
  }, [db]);

  const cycleRest = () => {
    const next = REST_OPTIONS[(REST_OPTIONS.indexOf(restSeconds) + 1) % REST_OPTIONS.length];
    setRestSeconds(next);
    setSetting(db, 'rest_seconds', String(next));
  };

  /** Saves a set and updates it on screen without reloading everything. */
  const patchSet = (set: SetRow, patch: { weight: number | null; reps: number | null; done: boolean }) => {
    updateSet(db, set.id, patch);
    setDetail({
      workout,
      exercises: exercises.map((ex) =>
        ex.id !== set.workout_exercise_id
          ? ex
          : { ...ex, sets: ex.sets.map((s) => (s.id === set.id ? { ...s, ...patch, done: patch.done ? 1 : 0 } : s)) },
      ),
    });
    if (patch.done && !set.done) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (restSeconds > 0) setRest({ endAt: Date.now() + restSeconds * 1000, total: restSeconds * 1000 });
    }
  };

  const doneSets = exercises.flatMap((e) => e.sets).filter((s) => s.done);
  const volume = doneSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);

  const finish = () => {
    if (doneSets.length === 0) {
      Alert.alert('Nothing logged yet', 'Tick off at least one set, or discard the workout.');
      return;
    }
    const open = exercises.flatMap((e) => e.sets).length - doneSets.length;
    Alert.alert(
      'Finish workout?',
      open > 0 ? `${open} unticked ${open === 1 ? 'set' : 'sets'} will be removed.` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            await renameWorkout(db, workout.id, name);
            await finishWorkout(db, workout.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await reload();
          },
        },
      ],
    );
  };

  const discard = () => {
    Alert.alert('Discard workout?', 'Everything logged in this workout will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, workout.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Workout',
          headerRight: () => <HeaderButton label="Finish" onPress={finish} color={C.good} />,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 140 }]}
        keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => renameWorkout(db, workout.id, name)}
          placeholder="Workout name"
          placeholderTextColor={C.textFaint}
          style={styles.nameInput}
        />
        <View style={styles.stats}>
          <StatBlock label="Duration">
            <Elapsed since={workout.started_at} style={styles.statValue} />
          </StatBlock>
          <StatBlock label="Volume">
            <Text style={styles.statValue}>{fmtVolume(volume)}</Text>
          </StatBlock>
          <StatBlock label="Sets">
            <Text style={styles.statValue}>{doneSets.length}</Text>
          </StatBlock>
          <Pressable onPress={cycleRest} accessibilityRole="button" accessibilityLabel="Change rest timer">
            <StatBlock label="Rest timer">
              <Text style={[styles.statValue, { color: C.accent }]}>{restSeconds ? `${restSeconds}s` : 'Off'}</Text>
            </StatBlock>
          </Pressable>
        </View>

        {exercises.length === 0 ? (
          <Empty icon="barbell-outline" title="Add your first exercise" hint="Search for a machine or exercise to get started." />
        ) : null}

        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            onPatchSet={patchSet}
            onAddSet={async () => {
              await addSet(db, ex.id);
              await reload();
            }}
            onDeleteSet={async (setId) => {
              await deleteSet(db, setId);
              await reload();
            }}
            onRemove={() =>
              Alert.alert(`Remove ${ex.name}?`, 'Its sets in this workout will be deleted.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: async () => {
                    await removeWorkoutExercise(db, ex.id);
                    await reload();
                  },
                },
              ])
            }
          />
        ))}

        <Button
          label="Add Exercise"
          icon="add"
          onPress={() => router.push({ pathname: '/exercise-picker', params: { workoutId: String(workout.id) } })}
        />
        {exercises.length > 0 ? <Text style={[text.faint, { textAlign: 'center' }]}>Long-press a set number to delete the set.</Text> : null}
        <Button label="Discard Workout" kind="danger" onPress={discard} />
      </ScrollView>

      {rest ? (
        <RestBar
          endAt={rest.endAt}
          total={rest.total}
          bottomInset={insets.bottom}
          onAdjust={(deltaMs) => setRest({ endAt: rest.endAt + deltaMs, total: Math.max(rest.total + deltaMs, 1000) })}
          onDone={() => setRest(null)}
        />
      ) : null}
    </View>
  );
}

function StatBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text style={text.faint}>{label}</Text>
      {children}
    </View>
  );
}

function ExerciseCard({
  ex,
  onPatchSet,
  onAddSet,
  onDeleteSet,
  onRemove,
}: {
  ex: WorkoutExercise;
  onPatchSet: (set: SetRow, patch: { weight: number | null; reps: number | null; done: boolean }) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: number) => void;
  onRemove: () => void;
}) {
  return (
    <Card style={{ paddingHorizontal: S.md, gap: S.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.xs }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(ex.exercise_id) } })}>
          <Text style={[text.h2, { color: C.accent }]}>{ex.name}</Text>
          <Text style={text.faint}>
            {ex.muscle} · {ex.equipment}
          </Text>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Remove ${ex.name}`}>
          <Ionicons name="trash-outline" size={20} color={C.textFaint} />
        </Pressable>
      </View>

      <View style={styles.setRow}>
        <Text style={[styles.colHead, styles.colNum]}>Set</Text>
        <Text style={[styles.colHead, styles.colPrev]}>Previous</Text>
        <Text style={[styles.colHead, styles.colInput]}>kg</Text>
        <Text style={[styles.colHead, styles.colInput]}>Reps</Text>
        <View style={styles.colCheck} />
      </View>

      {ex.sets.map((set, i) => (
        <SetLine
          key={set.id}
          set={set}
          index={i}
          prev={ex.previous[i]}
          bestWeight={ex.bestWeight}
          onPatch={(patch) => onPatchSet(set, patch)}
          onDelete={() => onDeleteSet(set.id)}
        />
      ))}

      <Button label="Add Set" icon="add" kind="secondary" small onPress={onAddSet} style={{ marginTop: S.sm }} />
    </Card>
  );
}

function SetLine({
  set,
  index,
  prev,
  bestWeight,
  onPatch,
  onDelete,
}: {
  set: SetRow;
  index: number;
  prev: PrevSet | undefined;
  bestWeight: number;
  onPatch: (patch: { weight: number | null; reps: number | null; done: boolean }) => void;
  onDelete: () => void;
}) {
  const [weightText, setWeightText] = useState(fmtWeight(set.weight));
  const [repsText, setRepsText] = useState(set.reps == null ? '' : String(set.reps));
  const done = set.done === 1;
  const isPR = done && bestWeight > 0 && (set.weight ?? 0) > bestWeight;

  const changeWeight = (t: string) => {
    setWeightText(t);
    onPatch({ weight: parseNum(t), reps: parseNum(repsText), done });
  };
  const changeReps = (t: string) => {
    setRepsText(t);
    onPatch({ weight: parseNum(weightText), reps: parseNum(t), done });
  };

  const toggle = () => {
    if (done) {
      onPatch({ weight: parseNum(weightText), reps: parseNum(repsText), done: false });
      return;
    }
    // Empty fields take over the values from last time, like Hevy.
    const weight = parseNum(weightText) ?? prev?.weight ?? null;
    const reps = parseNum(repsText) ?? prev?.reps ?? null;
    if (reps == null || reps === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setWeightText(fmtWeight(weight));
    setRepsText(String(reps));
    onPatch({ weight, reps, done: true });
  };

  return (
    <View style={[styles.setRow, done && styles.setRowDone]}>
      <Pressable style={styles.colNum} onLongPress={onDelete} accessibilityLabel={`Set ${index + 1}, long press to delete`}>
        {isPR ? (
          <Ionicons name="trophy" size={16} color={C.gold} />
        ) : (
          <Text style={styles.setNum}>{index + 1}</Text>
        )}
      </Pressable>
      <Pressable
        style={styles.colPrev}
        disabled={!prev || done}
        onPress={() => {
          if (!prev) return;
          setWeightText(fmtWeight(prev.weight));
          setRepsText(prev.reps == null ? '' : String(prev.reps));
          onPatch({ weight: prev.weight, reps: prev.reps, done });
        }}>
        <Text style={styles.prevText} numberOfLines={1}>
          {prev ? fmtSet(prev.weight, prev.reps) : '—'}
        </Text>
      </Pressable>
      <TextInput
        value={weightText}
        onChangeText={changeWeight}
        placeholder={prev ? fmtWeight(prev.weight) || '0' : '0'}
        placeholderTextColor={C.textFaint}
        keyboardType="decimal-pad"
        selectTextOnFocus
        accessibilityLabel={`Set ${index + 1} weight in kg`}
        style={[styles.colInput, styles.input, done && styles.inputDone]}
      />
      <TextInput
        value={repsText}
        onChangeText={changeReps}
        placeholder={prev?.reps != null ? String(prev.reps) : '0'}
        placeholderTextColor={C.textFaint}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={`Set ${index + 1} reps`}
        style={[styles.colInput, styles.input, done && styles.inputDone]}
      />
      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Set ${index + 1} done`}
        style={[styles.colCheck, styles.check, done && { backgroundColor: C.good, borderColor: C.good }]}>
        <Ionicons name="checkmark" size={18} color={done ? '#06210F' : C.textFaint} />
      </Pressable>
    </View>
  );
}

// ── Finished workout (read-only) ────────────────────────────────────────

function FinishedWorkout({ detail }: { detail: WorkoutDetail }) {
  const db = useSQLiteContext();
  const { workout, exercises } = detail;
  const sets = exercises.flatMap((e) => e.sets);
  const volume = sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const end = workout.finished_at ?? workout.started_at;

  const remove = () => {
    Alert.alert('Delete workout?', 'This also removes it from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, workout.id);
          router.back();
        },
      },
    ]);
  };

  const saveRoutine = async () => {
    const routineId = await saveWorkoutAsRoutine(db, workout.id);
    router.push({ pathname: '/routine/[id]', params: { id: String(routineId) } });
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen
        options={{
          title: 'Summary',
          headerRight: () => <HeaderButton icon="trash-outline" label="Delete workout" onPress={remove} color={C.danger} />,
        }}
      />
      <Text style={text.h1}>{workout.name}</Text>
      <Text style={text.dim}>{fmtDate(end)}</Text>
      <View style={styles.stats}>
        <StatBlock label="Duration">
          <Text style={styles.statValue}>{fmtDurationShort(end - workout.started_at)}</Text>
        </StatBlock>
        <StatBlock label="Volume">
          <Text style={styles.statValue}>{fmtVolume(volume)}</Text>
        </StatBlock>
        <StatBlock label="Sets">
          <Text style={styles.statValue}>{sets.length}</Text>
        </StatBlock>
      </View>

      {exercises.map((ex) => (
        <Pressable
          key={ex.id}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(ex.exercise_id) } })}>
          <Card style={{ gap: S.xs }}>
            <Text style={[text.h2, { color: C.accent }]}>{ex.name}</Text>
            {ex.sets.map((s, i) => (
              <View key={s.id} style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}>
                <Text style={[styles.setNum, { width: 24 }]}>{i + 1}</Text>
                <Text style={text.body}>{fmtSet(s.weight, s.reps)}</Text>
                {ex.bestWeight > 0 && (s.weight ?? 0) > ex.bestWeight ? (
                  <Ionicons name="trophy" size={14} color={C.gold} />
                ) : null}
              </View>
            ))}
          </Card>
        </Pressable>
      ))}

      <Button label="Save as Routine" icon="bookmark-outline" kind="secondary" onPress={saveRoutine} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: S.lg, gap: S.md, paddingBottom: S.xxl },
  nameInput: { color: C.text, fontSize: 24, fontWeight: '800', paddingVertical: S.xs },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.xs },
  statValue: { color: C.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 4, paddingHorizontal: S.xs, borderRadius: R.sm },
  setRowDone: { backgroundColor: C.goodDim },
  colHead: { color: C.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center' },
  colNum: { width: 32, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  colPrev: { flex: 1, justifyContent: 'center', minHeight: 40 },
  colInput: { width: 68 },
  colCheck: { width: 40 },
  setNum: { color: C.textDim, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  prevText: { color: C.textDim, fontSize: 14, textAlign: 'center' },
  input: {
    height: 40,
    borderRadius: R.sm,
    backgroundColor: C.cardHi,
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
  },
  inputDone: { backgroundColor: 'transparent' },
  check: {
    height: 40,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
