import Ionicons from '@expo/vector-icons/Ionicons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Elapsed } from '@/components/elapsed';
import { ExerciseImage } from '@/components/exercise-image';
import { RestBar } from '@/components/rest-bar';
import { ExerciseSearch } from '@/components/exercise-search';
import { Button, Card, Empty, HeaderButton, IconButton, ListCard, ListRow, Page, PageHeader, Stat, text } from '@/components/ui';
import {
  addExerciseToWorkout,
  addSet,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getSetting,
  getWorkoutDetail,
  listExercises,
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
import { confirm, notify } from '@/lib/dialog';
import { fmtDate, fmtDurationShort, fmtSet, fmtVolume, fmtWeight, parseNum } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
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
  setDetail: Dispatch<SetStateAction<WorkoutDetail | null | undefined>>;
}) {
  useKeepAwake();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const [library] = useFocusData(listExercises);
  const { workout, exercises } = detail;

  const [name, setName] = useState(workout.name);

  // Set edits are shown at once and saved in the background. A reload waits for
  // those saves, and is thrown away (and redone) if you edited a set while it was
  // loading, so it can never bring back old values (e.g. un-tick a set).
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const edits = useRef(0);
  const save = (fn: () => Promise<unknown>) => {
    writes.current = writes.current.then(fn, fn);
  };
  const sync = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const seen = edits.current;
      await writes.current;
      const fresh = await getWorkoutDetail(db, workout.id);
      if (seen === edits.current) {
        setDetail(fresh);
        return;
      }
    }
    await reload();
  };
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
    save(() => updateSet(db, set.id, patch));
    edits.current += 1;
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex) =>
              ex.id !== set.workout_exercise_id
                ? ex
                : { ...ex, sets: ex.sets.map((s) => (s.id === set.id ? { ...s, ...patch, done: patch.done ? 1 : 0 } : s)) },
            ),
          }
        : prev,
    );
    if (patch.done && !set.done) {
      haptic.tap();
      if (restSeconds > 0) setRest({ endAt: Date.now() + restSeconds * 1000, total: restSeconds * 1000 });
    }
  };

  const doneSets = exercises.flatMap((e) => e.sets).filter((s) => s.done);
  const volume = doneSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);

  const finish = async () => {
    if (doneSets.length === 0) {
      notify('Nothing logged yet', 'Tick off at least one set, or discard the workout.');
      return;
    }
    const open = exercises.flatMap((e) => e.sets).length - doneSets.length;
    const ok = await confirm({
      title: 'Finish workout?',
      message: open > 0 ? `${open} unticked ${open === 1 ? 'set' : 'sets'} will be removed.` : undefined,
      confirmLabel: 'Finish',
    });
    if (!ok) return;
    await writes.current;
    await renameWorkout(db, workout.id, name);
    await finishWorkout(db, workout.id);
    haptic.success();
    setRest(null);
    await sync();
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard workout?',
      message: 'Everything logged in this workout will be deleted.',
      confirmLabel: 'Discard',
      destructive: true,
    });
    if (!ok) return;
    await deleteWorkout(db, workout.id);
    router.back();
  };

  const addFromPanel = async (exerciseId: number) => {
    await addExerciseToWorkout(db, workout.id, exerciseId);
    await sync();
  };

  const log = (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.page, desktop && styles.pageDesktop, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => renameWorkout(db, workout.id, name)}
          onBlur={() => renameWorkout(db, workout.id, name)}
          placeholder="Workout name"
          placeholderTextColor={C.textFaint}
          style={styles.nameInput}
        />
        <View style={styles.stats}>
          <Stat label="Duration">
            <Elapsed since={workout.started_at} style={text.num} />
          </Stat>
          <Stat label="Volume" value={fmtVolume(volume)} />
          <Stat label="Sets" value={String(doneSets.length)} />
          <Pressable onPress={cycleRest} accessibilityRole="button" accessibilityLabel="Change rest timer" style={{ marginLeft: 'auto' }}>
            <Stat label="Rest timer">
              <Text style={[text.num, { color: C.accent }]}>{restSeconds ? `${restSeconds}s` : 'Off'}</Text>
            </Stat>
          </Pressable>
        </View>

        {exercises.length === 0 ? (
          <Empty
            icon="barbell-outline"
            title="Add your first exercise"
            hint={desktop ? 'Pick one from the library on the right.' : 'Search for a machine or exercise to get started.'}
          />
        ) : null}

        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            onPatchSet={patchSet}
            onAddSet={async () => {
              await addSet(db, ex.id);
              await sync();
            }}
            onDeleteSet={async (setId) => {
              await deleteSet(db, setId);
              await sync();
            }}
            onRemove={async () => {
              const ok = await confirm({
                title: `Remove ${ex.name}?`,
                message: 'Its sets in this workout will be deleted.',
                confirmLabel: 'Remove',
                destructive: true,
              });
              if (!ok) return;
              await removeWorkoutExercise(db, ex.id);
              await sync();
            }}
          />
        ))}

        {!desktop ? (
          <Button
            label="Add exercise"
            icon="add"
            kind="primary"
            onPress={() => router.push({ pathname: '/exercise-picker', params: { workoutId: String(workout.id) } })}
          />
        ) : null}
        <View style={styles.footer}>
          {exercises.length > 0 ? <Text style={text.faint}>Long-press a set number to delete it.</Text> : <View />}
          <Button label="Discard workout" kind="danger" small onPress={discard} />
        </View>
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

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Stack.Screen
        options={{
          title: 'Workout',
          headerRight: () => <HeaderButton label="Finish" onPress={finish} color={C.good} />,
        }}
      />
      {log}
      {desktop ? (
        // Desktop: exercise library next to the log, like Hevy's web app.
        <View style={styles.panel}>
          <ExerciseSearch
            exercises={library ?? []}
            pickIcon="add"
            padding={20}
            header={<Text style={text.h2}>Add exercise</Text>}
            onPick={(ex) => addFromPanel(ex.id)}
          />
        </View>
      ) : null}
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
    <Card style={{ padding: S.md, gap: 2 }}>
      <View style={styles.exHead}>
        <Pressable
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(ex.exercise_id) } })}>
          <ExerciseImage name={ex.name} equipment={ex.equipment} size={32} radius={7} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.exName} numberOfLines={1}>
              {ex.name}
            </Text>
            <Text style={text.faint} numberOfLines={1}>
              {ex.muscle} · {ex.equipment}
            </Text>
          </View>
        </Pressable>
        <IconButton icon="trash-outline" label={`Remove ${ex.name}`} onPress={onRemove} color={C.textFaint} size={16} />
      </View>

      <View style={styles.setRow}>
        <Text style={[styles.colHead, styles.colNum]}>Set</Text>
        <Text style={[styles.colHead, { flex: 1 }]}>Previous</Text>
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

      <Button label="Add set" icon="add" kind="ghost" small onPress={onAddSet} style={{ marginTop: 4 }} />
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
      haptic.warning();
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
          <Ionicons name="trophy" size={13} color={C.gold} />
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
        style={[styles.colCheck, styles.check, done && { backgroundColor: C.good }]}>
        <Ionicons name="checkmark" size={16} color={done ? '#06210F' : C.textFaint} />
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

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete workout?',
      message: 'This also removes it from your records.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteWorkout(db, workout.id);
    router.back();
  };

  const saveRoutine = async () => {
    const routineId = await saveWorkoutAsRoutine(db, workout.id);
    router.push({ pathname: '/routine/[id]', params: { id: String(routineId) } });
  };

  return (
    <Page>
      <Stack.Screen
        options={{
          title: 'Summary',
          headerRight: () => <HeaderButton icon="trash-outline" label="Delete workout" onPress={remove} color={C.danger} />,
        }}
      />
      <PageHeader
        title={workout.name}
        sub={fmtDate(end)}
        right={<Button label="Save as routine" icon="bookmark-outline" small onPress={saveRoutine} />}
      />
      <View style={styles.stats}>
        <Stat label="Duration" value={fmtDurationShort(end - workout.started_at)} />
        <Stat label="Volume" value={fmtVolume(volume)} />
        <Stat label="Sets" value={String(sets.length)} />
      </View>

      <ListCard>
        {exercises.map((ex, i) => (
          <ListRow
            key={ex.id}
            last={i === exercises.length - 1}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(ex.exercise_id) } })}
            style={{ alignItems: 'flex-start' }}>
            <ExerciseImage name={ex.name} equipment={ex.equipment} size={32} radius={7} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={styles.exName}>{ex.name}</Text>
              {ex.sets.map((s, n) => (
                <View key={s.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Text style={[text.faint, { width: 14 }]}>{n + 1}</Text>
                  <Text style={text.dim}>{fmtSet(s.weight, s.reps)}</Text>
                  {ex.bestWeight > 0 && (s.weight ?? 0) > ex.bestWeight ? (
                    <Ionicons name="trophy" size={12} color={C.gold} />
                  ) : null}
                </View>
              ))}
            </View>
          </ListRow>
        ))}
      </ListCard>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { padding: S.lg, gap: S.md },
  pageDesktop: { paddingHorizontal: 40, paddingTop: S.xl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  panel: { width: 360, borderLeftWidth: 1, borderLeftColor: C.border },
  nameInput: { color: C.text, fontSize: 22, fontFamily: F.display, letterSpacing: -0.5, paddingVertical: 2 },
  stats: { flexDirection: 'row', gap: 28, marginBottom: S.xs },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 6 },
  exName: { color: C.accent, fontSize: 14, fontFamily: F.semi },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, paddingHorizontal: 2, borderRadius: R.sm },
  setRowDone: { backgroundColor: C.goodDim },
  colHead: { color: C.textFaint, fontSize: 10, fontFamily: F.semi, letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
  colNum: { width: 28, alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  colPrev: { flex: 1, justifyContent: 'center', minHeight: 32 },
  colInput: { width: 60 },
  colCheck: { width: 32 },
  setNum: { color: C.textDim, fontSize: 13, fontFamily: F.semi, textAlign: 'center' },
  prevText: { color: C.textFaint, fontSize: 12, fontFamily: F.regular, textAlign: 'center' },
  input: {
    height: 30,
    borderRadius: 7,
    backgroundColor: C.cardHi,
    color: C.text,
    fontSize: 14,
    fontFamily: F.semi,
    textAlign: 'center',
    paddingVertical: 0,
  },
  inputDone: { backgroundColor: 'transparent' },
  check: {
    height: 30,
    borderRadius: 7,
    backgroundColor: C.cardHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
