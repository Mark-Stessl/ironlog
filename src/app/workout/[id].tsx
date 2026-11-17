import Ionicons from '@expo/vector-icons/Ionicons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCelebrate } from '@/components/celebrate';
import { Confetti } from '@/components/confetti';
import { CountUp } from '@/components/count-up';
import { BodyMap } from '@/components/body-map';
import { Bump } from '@/components/bump';
import { MuscleBars } from '@/components/muscle-bars';
import { Elapsed } from '@/components/elapsed';
import { SoundToggle } from '@/components/sound-toggle';
import { ExerciseImage } from '@/components/exercise-image';
import { RestBar } from '@/components/rest-bar';
import { ExerciseSearch } from '@/components/exercise-search';
import {
  Button,
  Card,
  Empty,
  HeaderButton,
  IconButton,
  ListCard,
  ListRow,
  Page,
  PageHeader,
  SectionTitle,
  Stat,
  text,
  type IconName,
} from '@/components/ui';
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
  workoutNumber,
  workoutPlan,
  updateRoutineFromWorkout,
  freeRoutineName,
  getRoutine,
  type PrevSet,
  type SetRow,
  type WorkoutDetail,
  type WorkoutExercise,
} from '@/lib/db';
import { choose, confirm, info, notify } from '@/lib/dialog';
import { describeDiff, diffRoutine, hasChanges } from '@/lib/routine-diff';
import { fmtDate, fmtDurationShort, fmtSet, fmtVolume, fmtWeight, parseNum, plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { currentPRs, markPRs, PR_LABEL, type PR } from '@/lib/records';
import { sound } from '@/lib/sound';
import { heat, muscleStats } from '@/lib/stats';
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
  const celebrate = useCelebrate();
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
  const [rest, setRest] = useState<{ id: number; endAt: number; total: number; label?: string } | null>(null);

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
                : {
                    ...ex,
                    sets: ex.sets.map((s) => (s.id === set.id ? { ...s, ...patch, done: patch.done ? 1 : 0 } : s)),
                  },
            ),
          }
        : prev,
    );
    if (patch.done && !set.done) {
      const ex = exercises.find((e) => e.id === set.workout_exercise_id);
      const prs = ex
        ? markPRs(
            ex.sets.map((s) => (s.id === set.id ? { ...s, ...patch, done: 1 } : s)),
            ex.best,
          )[ex.sets.findIndex((s) => s.id === set.id)]
        : [];
      if (ex && prs.length) celebrate(ex.name, prs);
      else haptic.tap(); // no sound for a normal set, only a light tap
      if (restSeconds > 0)
        setRest({ id: Date.now(), endAt: Date.now() + restSeconds * 1000, total: restSeconds * 1000, label: ex?.name });
    }
  };

  const doneSets = exercises.flatMap((e) => e.sets).filter((s) => s.done);
  const volume = doneSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);

  const finish = async () => {
    if (doneSets.length === 0) {
      notify('Nothing logged yet', 'Tick off at least one set to finish, or discard the workout.', 'barbell-outline');
      return;
    }
    const open = exercises.flatMap((e) => e.sets).length - doneSets.length;
    const ok = await confirm({
      title: 'Finish workout?',
      message: 'Nice work. Your sets will be saved and your records updated.',
      icon: 'flag-outline',
      tone: 'success',
      details: [
        { label: 'Duration', value: fmtDurationShort(Date.now() - workout.started_at) },
        { label: 'Volume', value: fmtVolume(volume) },
        { label: 'Sets', value: String(doneSets.length) },
      ],
      note: open > 0 ? `${plural(open, 'unticked set')} will be removed.` : undefined,
      confirmLabel: 'Finish workout',
      cancelLabel: 'Keep going',
    });
    if (!ok) return;
    await writes.current;
    await renameWorkout(db, workout.id, name);
    await finishWorkout(db, workout.id);
    haptic.success();
    setRest(null);
    await offerRoutineUpdate();
    router.setParams({ fresh: '1' }); // show the celebration on the summary
    await sync();
  };

  /** Started from a routine and did something different? Ask what to do with the routine. */
  const offerRoutineUpdate = async () => {
    if (workout.routine_id == null) return;
    const routine = await getRoutine(db, workout.routine_id);
    if (!routine) return; // routine was deleted meanwhile
    const plan = routine.exercises.map((e) => ({ exercise_id: e.exercise_id, name: e.name, sets: e.target_sets }));
    const diff = diffRoutine(plan, await workoutPlan(db, workout.id));
    if (!hasChanges(diff)) return;
    const icons = {
      added: 'add-circle-outline',
      removed: 'remove-circle-outline',
      sets: 'layers-outline',
      order: 'swap-vertical-outline',
    } as const;
    const choice = await choose({
      title: 'Update your routine?',
      message: `This workout was different from "${routine.routine.name}".`,
      icon: 'git-compare-outline',
      items: describeDiff(diff).map((line) => ({ title: line.text, icon: icons[line.kind] })),
      choices: [
        { label: `Update "${routine.routine.name}"`, value: 'update', icon: 'refresh', primary: true },
        { label: 'Save as new routine', value: 'new', icon: 'add' },
      ],
      cancelLabel: 'Keep the old routine',
    });
    if (choice === 'update') {
      await updateRoutineFromWorkout(db, routine.routine.id, workout.id);
    } else if (choice === 'new') {
      await saveWorkoutAsRoutine(db, workout.id, await freeRoutineName(db, routine.routine.name));
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard this workout?',
      message:
        doneSets.length > 0
          ? `${plural(doneSets.length, 'logged set')} will be deleted. This can't be undone.`
          : "Nothing will be saved. This can't be undone.",
      icon: 'trash-outline',
      confirmLabel: 'Discard workout',
      cancelLabel: 'Keep workout',
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
        <View style={styles.topActions}>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => renameWorkout(db, workout.id, name)}
            onBlur={() => renameWorkout(db, workout.id, name)}
            placeholder="Workout name"
            placeholderTextColor={C.textFaint}
            style={[styles.nameInput, { flex: 1, minWidth: 0 }]}
          />
          {desktop ? (
            <>
              <Button label="Discard" kind="ghost" small onPress={discard} />
              <Button label="Finish workout" icon="flag-outline" kind="primary" small onPress={finish} />
            </>
          ) : null}
        </View>
        <View style={styles.stats}>
          <Stat label="Duration">
            <Elapsed since={workout.started_at} style={text.num} />
          </Stat>
          <Stat label="Volume">
            <Bump value={volume}>
              <Text style={text.num}>{fmtVolume(volume)}</Text>
            </Bump>
          </Stat>
          <Stat label="Sets">
            <Bump value={doneSets.length}>
              <Text style={text.num}>{doneSets.length}</Text>
            </Bump>
          </Stat>
          <Pressable
            onPress={cycleRest}
            accessibilityRole="button"
            accessibilityLabel="Change rest timer"
            style={{ marginLeft: 'auto' }}>
            <Stat label="Rest timer">
              <Text style={[text.num, { color: C.accent }]}>{restSeconds ? `${restSeconds}s` : 'Off'}</Text>
            </Stat>
          </Pressable>
        </View>

        {exercises.length === 0 ? (
          <Empty
            icon="barbell-outline"
            title="Add your first exercise"
            hint={
              desktop ? 'Pick one from the library on the right.' : 'Search for a machine or exercise to get started.'
            }
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
        {exercises.length > 0 ? (
          <Text style={[text.faint, { textAlign: 'center' }]}>Long-press a set number to delete it.</Text>
        ) : null}

        <View style={[styles.endCard, !desktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flex: desktop ? 1 : undefined, minWidth: 0 }}>
            <Text style={text.strong}>Done for today?</Text>
            <Text style={text.faint}>
              {doneSets.length
                ? `${plural(doneSets.length, 'set')} · ${fmtVolume(volume)}`
                : 'Tick off a set to finish.'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Button
              label="Discard"
              icon="trash-outline"
              kind="danger"
              small
              onPress={discard}
              style={!desktop && { flex: 1 }}
            />
            <Button
              label="Finish workout"
              icon="flag-outline"
              kind="primary"
              small
              onPress={finish}
              style={!desktop && { flex: 2 }}
            />
          </View>
        </View>
      </ScrollView>

      {rest ? (
        <RestBar
          key={rest.id}
          label={rest.label}
          endAt={rest.endAt}
          total={rest.total}
          bottomInset={insets.bottom}
          onAdjust={(deltaMs) =>
            setRest({ ...rest, endAt: rest.endAt + deltaMs, total: Math.max(rest.total + deltaMs, 1000) })
          }
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
          headerRight: desktop ? undefined : () => <HeaderButton label="Finish" onPress={finish} color={C.accent} />,
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
            onCreate={(query) =>
              router.push({ pathname: '/exercise-new', params: { name: query, workoutId: String(workout.id) } })
            }
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
  const prs = currentPRs(ex.sets, ex.best);
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
          prs={prs[i]}
          exercise={ex.name}
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
  prs,
  exercise,
  onPatch,
  onDelete,
}: {
  set: SetRow;
  index: number;
  prev: PrevSet | undefined;
  prs: PR[];
  exercise: string;
  onPatch: (patch: { weight: number | null; reps: number | null; done: boolean }) => void;
  onDelete: () => void;
}) {
  const [weightText, setWeightText] = useState(fmtWeight(set.weight));
  const [repsText, setRepsText] = useState(set.reps == null ? '' : String(set.reps));
  const done = set.done === 1;
  const pr = prs.length > 0;

  // 0 = open, 1 = done; drives the row colour. `pop` bounces the tick.
  const doneAnim = useSharedValue(done ? 1 : 0);
  const prAnim = useSharedValue(pr ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    doneAnim.value = withTiming(done ? 1 : 0, { duration: 220 });
    if (done)
      pop.value = withSequence(withTiming(0.7, { duration: 70 }), withSpring(1, { damping: 7, stiffness: 320 }));
  }, [done, doneAnim, pop]);
  useEffect(() => {
    prAnim.value = withTiming(pr ? 1 : 0, { duration: 300 });
  }, [pr, prAnim]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      doneAnim.value * (1 - prAnim.value),
      [0, 1],
      ['rgba(52,199,123,0)', 'rgba(52,199,123,0.10)'],
    ),
    borderColor: interpolateColor(prAnim.value, [0, 1], ['rgba(233,190,88,0)', 'rgba(233,190,88,0.45)']),
  }));
  const prGlow = useAnimatedStyle(() => ({ opacity: prAnim.value }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    backgroundColor: interpolateColor(doneAnim.value, [0, 1], [C.cardHi, C.good]),
  }));

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
    <Animated.View style={[styles.setRow, rowStyle]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, prGlow]}>
        <LinearGradient
          colors={['rgba(233,190,88,0.20)', 'rgba(233,190,88,0.03)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: R.sm }]}
        />
      </Animated.View>
      <Pressable
        style={styles.colNum}
        onPress={pr ? () => showRecords(exercise, index, prs) : undefined}
        onLongPress={onDelete}
        accessibilityLabel={
          pr
            ? `Set ${index + 1}: ${plural(prs.length, 'record')}, tap for details`
            : `Set ${index + 1}, long press to delete`
        }>
        {pr ? (
          <Animated.View entering={ZoomIn.springify().damping(8)}>
            <Ionicons name="trophy" size={13} color={C.gold} />
          </Animated.View>
        ) : (
          <Text style={[styles.setNum, done && { color: C.good }]}>{index + 1}</Text>
        )}
      </Pressable>
      <Pressable
        style={styles.colPrev}
        disabled={pr ? false : !prev || done}
        onPress={() => {
          if (pr) return showRecords(exercise, index, prs);
          if (!prev) return;
          setWeightText(fmtWeight(prev.weight));
          setRepsText(prev.reps == null ? '' : String(prev.reps));
          onPatch({ weight: prev.weight, reps: prev.reps, done });
        }}>
        {pr ? (
          <Text style={[styles.prevText, { color: C.gold, fontFamily: F.semi }]} numberOfLines={1}>
            {prs.map((p) => PR_LABEL[p.kind]).join(' + ')} PR
          </Text>
        ) : (
          <Text style={styles.prevText} numberOfLines={1}>
            {prev ? fmtSet(prev.weight, prev.reps) : '—'}
          </Text>
        )}
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
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Set ${index + 1} done`}
        style={styles.colCheck}>
        <Animated.View style={[styles.check, checkStyle]}>
          <Ionicons name="checkmark" size={13} color={done ? '#06210F' : C.textFaint} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Finished workout (read-only) ────────────────────────────────────────

function FinishedWorkout({ detail }: { detail: WorkoutDetail }) {
  const db = useSQLiteContext();
  const desktop = useIsDesktop();
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const justFinished = fresh === '1';
  const { workout, exercises } = detail;
  const sets = exercises.flatMap((e) => e.sets);
  const volume = sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const end = workout.finished_at ?? workout.started_at;
  const [number, setNumber] = useState<number | null>(null);

  useEffect(() => {
    workoutNumber(db, workout).then(setNumber);
  }, [db, workout]);

  // Every record set in this workout, in order.
  // Records still standing at the end of the workout (a set that was beaten
  // again later in the same workout doesn't count).
  const records = exercises.flatMap((ex) =>
    currentPRs(ex.sets, ex.best).flatMap((prs, i) => (prs.length ? [{ ex, prs, set: ex.sets[i], index: i }] : [])),
  );
  const recordCount = records.reduce((n, r) => n + r.prs.length, 0);

  // Everything this workout trained, for the body heatmap.
  const trained = muscleStats(
    exercises.flatMap((ex) =>
      ex.sets.map((s) => ({
        name: ex.name,
        muscle: ex.muscle,
        secondary: ex.secondary,
        weight: s.weight,
        reps: s.reps,
        workout_id: workout.id,
      })),
    ),
  );
  const prSetIds = new Set(records.map((r) => r.set.id));

  useEffect(() => {
    if (!justFinished) return;
    haptic.record();
    sound.play('complete');
  }, [justFinished]);

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
    <View style={{ flex: 1 }}>
      <Page>
        <Stack.Screen
          options={{
            title: justFinished ? '' : 'Summary',
            headerRight: () => (
              <HeaderButton icon="trash-outline" label="Delete workout" onPress={remove} color={C.danger} />
            ),
          }}
        />

        {justFinished ? (
          <View style={styles.hero}>
            <Animated.View entering={ZoomIn.springify().damping(9)} style={styles.heroBadge}>
              <LinearGradient colors={[C.accent, '#0E7490']} style={StyleSheet.absoluteFill} />
              <Ionicons name={recordCount ? 'trophy' : 'checkmark'} size={30} color={C.onAccent} />
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(150).duration(350)}
              style={[text.title, { fontSize: 26, textAlign: 'center' }]}>
              Workout complete
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(250).duration(350)} style={[text.dim, { textAlign: 'center' }]}>
              {number ? `${ordinal(number)} workout` : workout.name}
              {recordCount ? `  ·  ${plural(recordCount, 'new record')}` : ''}
            </Animated.Text>
          </View>
        ) : (
          <PageHeader title={workout.name} sub={fmtDate(end)} />
        )}

        <Animated.View
          entering={FadeInDown.delay(justFinished ? 350 : 0).duration(350)}
          style={[styles.statCards, desktop && { gap: S.md }]}>
          <StatCard icon="time-outline" label="Duration">
            <Text style={styles.statBig}>{fmtDurationShort(end - workout.started_at)}</Text>
          </StatCard>
          <StatCard icon="barbell-outline" label="Volume">
            <CountUp
              value={volume}
              format={(n) => fmtVolume(n)}
              delay={justFinished ? 450 : 0}
              style={styles.statBig}
            />
          </StatCard>
          <StatCard icon="layers-outline" label="Sets">
            <CountUp value={sets.length} delay={justFinished ? 450 : 0} style={styles.statBig} />
          </StatCard>
        </Animated.View>

        <SectionTitle title="Muscles trained" />
        <Animated.View entering={FadeInDown.delay(justFinished ? 450 : 0).duration(350)}>
          <Card style={[styles.musclesCard, desktop && { flexDirection: 'row', alignItems: 'center' }]}>
            <BodyMap heat={heat(trained.regions)} height={desktop ? 260 : 230} />
            <View style={{ flex: desktop ? 1 : undefined, gap: S.md }}>
              <MuscleBars regions={trained.regions} />
            </View>
          </Card>
        </Animated.View>

        {records.length ? (
          <>
            <SectionTitle title="New records" />
            <View style={{ gap: S.sm }}>
              {records.map((r, i) => (
                <Animated.View
                  key={r.set.id}
                  entering={FadeInDown.delay((justFinished ? 550 : 0) + i * 90).duration(350)}
                  style={styles.recordCard}>
                  <LinearGradient
                    colors={['rgba(233,190,88,0.16)', 'rgba(233,190,88,0.02)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.recordIcon}>
                    <Ionicons name="trophy" size={14} color="#2A1E05" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={text.strong} numberOfLines={1}>
                      {r.ex.name}
                      <Text style={text.faint}>{`  ·  set ${r.index + 1}`}</Text>
                    </Text>
                    {r.prs.map((pr) => (
                      <Text key={pr.kind} style={[text.faint, { color: C.gold }]} numberOfLines={1}>
                        {pr.title} · {pr.detail}
                      </Text>
                    ))}
                  </View>
                </Animated.View>
              ))}
            </View>
          </>
        ) : null}

        <SectionTitle
          title="Exercises"
          right={<Button label="Save as routine" icon="bookmark-outline" kind="ghost" small onPress={saveRoutine} />}
        />
        <Animated.View entering={FadeInDown.delay(justFinished ? 650 : 0).duration(350)}>
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
                      <Text style={[text.dim, prSetIds.has(s.id) && { color: C.gold }]}>
                        {fmtSet(s.weight, s.reps)}
                      </Text>
                      {prSetIds.has(s.id) ? <Ionicons name="trophy" size={11} color={C.gold} /> : null}
                    </View>
                  ))}
                </View>
              </ListRow>
            ))}
          </ListCard>
        </Animated.View>
      </Page>
      {justFinished ? <Confetti count={recordCount ? 70 : 40} originTop="18%" /> : null}
    </View>
  );
}

function StatCard({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <View style={styles.statCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon} size={12} color={C.textFaint} />
        <Text style={text.faint}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

/** Card listing the records a set beat (opened by tapping its trophy). */
function showRecords(exercise: string, index: number, prs: PR[]) {
  info({
    title: prs.length > 1 ? `${prs.length} records on set ${index + 1}` : `Record on set ${index + 1}`,
    message: exercise,
    tone: 'gold',
    icon: 'trophy',
    items: prs.map((p) => ({ title: p.title, detail: p.detail })),
    confirmLabel: 'Nice',
  });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingTop: S.md, paddingBottom: S.lg },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: S.sm,
  },
  statCards: { flexDirection: 'row', gap: S.sm },
  musclesCard: { gap: S.lg, paddingVertical: S.lg },
  statCard: {
    flex: 1,
    gap: 4,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  statBig: { color: C.text, fontFamily: F.display, fontSize: 18, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: 'rgba(233,190,88,0.35)',
    overflow: 'hidden',
  },
  recordIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: { padding: S.lg, gap: S.md },
  pageDesktop: { paddingHorizontal: 40, paddingTop: S.xl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  panel: { width: 360, borderLeftWidth: 1, borderLeftColor: C.border },
  nameInput: { color: C.text, fontSize: 22, fontFamily: F.display, letterSpacing: -0.5, paddingVertical: 2 },
  stats: { flexDirection: 'row', gap: 28, marginBottom: S.xs },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 6 },
  exName: { color: C.accent, fontSize: 14, fontFamily: F.semi },
  endCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginTop: S.sm,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  setRowDone: { backgroundColor: C.goodDim },
  colHead: {
    color: C.textFaint,
    fontSize: 10,
    fontFamily: F.semi,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  colNum: { width: 28, alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  colPrev: { flex: 1, justifyContent: 'center', minHeight: 32 },
  colInput: { width: 60 },
  colCheck: { width: 28, alignItems: 'center', justifyContent: 'center' },
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
  check: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
