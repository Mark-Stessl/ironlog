import Ionicons from '@expo/vector-icons/Ionicons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Modal, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
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
import { NumberPadProvider, PAD_HEIGHT, cleanNumber, useNumberPad } from '@/components/number-pad';
import { PlateButton, usesBarbell } from '@/components/plate-calculator';
import { DragSortProvider, useDragItem } from '@/components/drag-sort';
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
  setExerciseOrder,
  removeWorkoutExercise,
  renameWorkout,
  saveWorkoutAsRoutine,
  setWorkoutExerciseNotes,
  swapWorkoutExercise,
  undoSwap,
  lastTimeFor,
  type Exercise,
  type SwapResult,
  setSetKind,
  setSetting,
  updateSet,
  workoutNumber,
  workoutPlan,
  updateRoutineFromWorkout,
  freeRoutineName,
  getRoutine,
  type PrevSet,
  type SetKind,
  type SetPatch,
  type SetRow,
  type Track,
  type WorkoutDetail,
  type WorkoutExercise,
} from '@/lib/db';
import { choose, confirm, info, notify } from '@/lib/dialog';
import { describeDiff, diffRoutine, hasChanges } from '@/lib/routine-diff';
import {
  fmtCardio,
  fmtDate,
  fmtDurationShort,
  fmtSet,
  fmtVolume,
  fmtWeight,
  minutesText,
  parseNum,
  plural,
} from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { currentPRs, markPRs, PR_LABEL, type PR } from '@/lib/records';
import { sound } from '@/lib/sound';
import { heat, muscleStats } from '@/lib/stats';
import { C, F, R, S, useIsDesktop } from '@/lib/theme';
import { primeKeyboard } from '@/lib/keyboard';
import { searchExercises } from '@/lib/search';
import { useFocusData } from '@/lib/use-focus-data';
import { adjustRest, takeFinishRequest, useRest } from '@/lib/workout-session';

/** How far a set row slides open to show its bin. */
const BIN_WIDTH = 64;

/** Height of an exercise card while you drag the exercises around. */
const FOLDED = 60;

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
  const [rest, setRest] = useRest();

  useEffect(() => {
    getSetting(db, 'rest_seconds', '90').then((v) => setRestSeconds(Number(v)));
  }, [db]);

  const cycleRest = () => {
    const next = REST_OPTIONS[(REST_OPTIONS.indexOf(restSeconds) + 1) % REST_OPTIONS.length];
    setRestSeconds(next);
    setSetting(db, 'rest_seconds', String(next));
  };

  /** Saves a set and updates it on screen without reloading everything. */
  const patchSet = (set: SetRow, patch: SetPatch) => {
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
      // No rest timer after a cardio set.
      if (restSeconds > 0 && (ex?.track ?? 'weight_reps') === 'weight_reps')
        setRest({ id: Date.now(), endAt: Date.now() + restSeconds * 1000, total: restSeconds * 1000, label: ex?.name });
    }
  };

  // Focus mode: a full-screen page; it saves straight to the database, so reload when back.
  const openFocus = async () => {
    await writes.current;
    router.push({ pathname: '/focus/[id]', params: { id: String(workout.id) } });
  };
  // Focus mode asked to finish ("Finish workout" on its last screen): show the normal dialog.
  const [onScreen, setOnScreen] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setOnScreen(true);
      if (takeFinishRequest()) setTimeout(() => finishRef.current(), 350);
      return () => setOnScreen(false);
    }, []),
  );
  const finishRef = useRef(() => {});

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

  finishRef.current = finish;

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

  const scrollRef = useRef<ScrollViewInstance>(null);

  // Swap an exercise (machine taken): open sets move to the new one, with an Undo for a few seconds.
  const [swapping, setSwapping] = useState<WorkoutExercise | null>(null);
  const [undo, setUndo] = useState<{ id: number; swap: SwapResult; from: string; to: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTo = async (target: Exercise) => {
    const ex = swapping;
    setSwapping(null);
    if (!ex) return;
    const swap = await swapWorkoutExercise(db, ex.id, target.id);
    haptic.success();
    await sync();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id: ex.id, swap, from: ex.name, to: target.name });
    undoTimer.current = setTimeout(() => setUndo(null), 7000);
  };
  const undoLast = async () => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    await undoSwap(db, undo.id, undo.swap);
    haptic.tap();
    await sync();
  };

  const addFromPanel = async (exerciseId: number) => {
    await addExerciseToWorkout(db, workout.id, exerciseId);
    await sync();
  };

  const log = (
    <NumberPadProvider>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
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

          {exercises.length > 0 && !desktop ? (
            <Pressable
              onPress={openFocus}
              accessibilityRole="button"
              accessibilityLabel="Start focus mode"
              style={({ pressed }) => [styles.focusButton, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}>
              <View style={styles.focusIcon}>
                <Ionicons name="scan-outline" size={18} color={C.onAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.strong, { color: C.accent }]}>Focus mode</Text>
                <Text style={text.faint}>One set at a time, big numbers, swipe to tick</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.accent} />
            </Pressable>
          ) : null}

          {exercises.length === 0 ? (
            <Empty
              icon="barbell-outline"
              title="Add your first exercise"
              hint={
                desktop ? 'Pick one from the library on the right.' : 'Search for a machine or exercise to get started.'
              }
            />
          ) : null}

          {/* Hold an exercise and drag it: the cards fold while you move it. */}
          <DragSortProvider
            ids={exercises.map((ex) => ex.id)}
            step={FOLDED + S.md}
            scrollRef={scrollRef}
            roomBelow
            onReorder={async (ids) => {
              await setExerciseOrder(db, 'workout_exercises', ids);
              await sync();
            }}>
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                onSwap={() => setSwapping(ex)}
                onNotes={async (notes) => {
                  await setWorkoutExerciseNotes(db, ex.id, notes);
                }}
                onSetKind={async (setId, kind) => {
                  await setSetKind(db, setId, kind);
                  haptic.tap();
                  await sync();
                }}
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
          </DragSortProvider>

          {!desktop ? (
            <Button
              label="Add exercise"
              icon="add"
              kind="primary"
              onPress={() => {
                primeKeyboard();
                router.push({ pathname: '/exercise-picker', params: { workoutId: String(workout.id) } });
              }}
            />
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
          <PadSpacer />
        </ScrollView>

        {rest && onScreen ? (
          <RestBar
            key={rest.id}
            label={rest.label}
            endAt={rest.endAt}
            total={rest.total}
            bottomInset={insets.bottom}
            onAdjust={adjustRest}
            onDone={() => setRest(null)}
          />
        ) : null}
        {undo ? (
          <Animated.View
            entering={SlideInDown.springify().damping(20)}
            exiting={FadeOut.duration(150)}
            style={[styles.undoBar, { bottom: (rest ? 76 : 16) + insets.bottom }]}>
            <Ionicons name="swap-horizontal" size={18} color={C.accent} />
            <Text style={[text.body, { flex: 1 }]} numberOfLines={2}>
              Swapped to <Text style={{ fontFamily: F.semi }}>{undo.to}</Text>
            </Text>
            <Pressable onPress={undoLast} hitSlop={8} accessibilityRole="button" accessibilityLabel="Undo swap">
              <Text style={[text.strong, { color: C.accent }]}>Undo</Text>
            </Pressable>
          </Animated.View>
        ) : null}
        {swapping ? (
          <SwapSheet
            ex={swapping}
            library={library ?? []}
            workoutId={workout.id}
            taken={exercises.map((e) => e.exercise_id)}
            onPick={swapTo}
            onClose={() => setSwapping(null)}
          />
        ) : null}
      </View>
    </NumberPadProvider>
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

/** Letter and colour for the set types; normal sets show their number instead. */
const SET_KIND: Record<Exclude<SetKind, 'normal'>, { letter: string; color: string; name: string }> = {
  warmup: { letter: 'W', color: '#F59E0B', name: 'Warm-up' },
  drop: { letter: 'D', color: '#A78BFA', name: 'Drop set' },
  failure: { letter: 'F', color: '#F87171', name: 'Failure' },
};

function ExerciseCard({
  ex,
  onSwap,
  onNotes,
  onSetKind,
  onPatchSet,
  onAddSet,
  onDeleteSet,
  onRemove,
}: {
  ex: WorkoutExercise;
  onSwap: () => void;
  onNotes: (notes: string) => void;
  onSetKind: (setId: number, kind: SetKind) => void;
  onPatchSet: (set: SetRow, patch: SetPatch) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: number) => void;
  onRemove: () => void;
}) {
  const prs = currentPRs(ex.sets, ex.best);
  const [notes, setNotes] = useState(ex.notes ?? '');
  // Normal sets are numbered 1, 2, 3...; warm-ups, drop sets and failure sets show a letter.
  let n = 0;
  const numbers = ex.sets.map((s) => (s.kind === 'normal' || !s.kind ? ++n : 0));
  const box = useRef<React.ComponentRef<typeof Animated.View>>(null);
  const drag = useDragItem(ex.id, box as unknown as React.RefObject<View | null>);
  return (
    <Animated.View ref={box} style={[styles.dragBox, drag.style]}>
      <Card style={[{ padding: S.md, gap: 2 }, drag.folded && styles.folded, drag.held && styles.held]}>
        <View style={[styles.exHead, drag.folded && { marginBottom: 0 }]}>
          <GestureDetector gesture={drag.gesture} touchAction="pan-y">
            <View style={{ flex: 1, minWidth: 0 }}>
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}
                onPress={() =>
                  !drag.justDragged() &&
                  router.push({ pathname: '/exercise/[id]', params: { id: String(ex.exercise_id) } })
                }
                accessibilityHint="Hold and drag to move the exercise">
                <ExerciseImage name={ex.name} equipment={ex.equipment} size={32} radius={7} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.exName} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text style={text.faint} numberOfLines={1}>
                    {drag.folded ? `${plural(ex.sets.length, 'set')} · ${ex.muscle}` : `${ex.muscle} · ${ex.equipment}`}
                  </Text>
                </View>
              </Pressable>
            </View>
          </GestureDetector>
          {drag.folded ? <Ionicons name="reorder-three" size={24} color={drag.held ? C.accent : C.textDim} /> : null}
          {drag.folded ? null : usesBarbell(ex.equipment, ex.name) ? (
            <PlateButton
              weight={
                ex.sets.find((x) => !x.done && x.weight)?.weight ??
                ex.sets.find((x) => x.weight)?.weight ??
                ex.previous.find((x) => x.weight)?.weight ??
                null
              }
            />
          ) : null}
          {drag.folded ? null : (
            <IconButton icon="swap-horizontal" label={`Swap ${ex.name}`} onPress={onSwap} color={C.accent} size={18} />
          )}
          {drag.folded ? null : (
            <IconButton
              icon="trash-outline"
              label={`Remove ${ex.name}`}
              onPress={onRemove}
              color={C.textFaint}
              size={16}
            />
          )}
        </View>
        {drag.folded ? null : (
          <>
            {/* A note for this exercise in this workout only. */}
            <View style={[styles.noteRow, notes ? styles.noteRowFilled : null]}>
              <Ionicons name="create-outline" size={13} color={notes ? C.gold : C.textFaint} />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                onBlur={() => notes.trim() !== (ex.notes ?? '') && onNotes(notes)}
                placeholder="Add a note for today"
                placeholderTextColor={C.textFaint}
                multiline
                accessibilityLabel={`Note for ${ex.name}`}
                style={styles.noteInput}
              />
            </View>

            <View style={styles.setRow}>
              <Text style={[styles.colHead, styles.colNum]}>Set</Text>
              <Text style={[styles.colHead, { flex: 1 }]}>Previous</Text>
              <Text style={[styles.colHead, styles.colInput]}>
                {ex.track && ex.track !== 'weight_reps' ? 'Min' : 'kg'}
              </Text>
              <Text style={[styles.colHead, styles.colInput]}>
                {ex.track === 'time_floors' ? 'Floors' : ex.track === 'time_distance' ? 'km' : 'Reps'}
              </Text>
              <View style={styles.colCheck} />
            </View>

            {ex.sets.map((set, i) => (
              <SetLine
                key={set.id}
                set={set}
                index={i}
                number={numbers[i]}
                onKind={(kind) => onSetKind(set.id, kind)}
                prev={ex.previous[i]}
                prs={prs[i]}
                exercise={ex.name}
                onPatch={(patch) => onPatchSet(set, patch)}
                onDelete={() => onDeleteSet(set.id)}
                track={ex.track ?? 'weight_reps'}
                barbell={usesBarbell(ex.equipment, ex.name)}
              />
            ))}

            <Button label="Add set" icon="add" kind="ghost" small onPress={onAddSet} style={{ marginTop: 4 }} />
          </>
        )}
      </Card>
    </Animated.View>
  );
}

function SetLine({
  set,
  index,
  number,
  onKind,
  prev,
  prs,
  exercise,
  onPatch,
  onDelete,
  track,
  barbell,
}: {
  set: SetRow;
  index: number;
  /** Shown number for normal sets (0 for warm-up, drop and failure sets). */
  number: number;
  onKind: (kind: SetKind) => void;
  prev: PrevSet | undefined;
  prs: PR[];
  exercise: string;
  onPatch: (patch: SetPatch) => void;
  onDelete: () => void;
  track: Track;
  /** Barbell exercise: the kg keypad shows the plates. */
  barbell: boolean;
}) {
  // Two fields per set: kg and reps, or for cardio minutes and km / floors.
  const cardio = track !== 'weight_reps';
  const floors = track === 'time_floors';
  const fieldA = (x: { weight?: number | null; seconds?: number | null } | undefined) =>
    cardio ? minutesText(x?.seconds) : fmtWeight(x?.weight);
  const fieldB = (x: { reps?: number | null; distance?: number | null } | undefined) =>
    cardio ? fmtWeight(x?.distance) : x?.reps == null ? '' : String(x.reps);
  const patchOf = (a: string, b: string, isDone: boolean): SetPatch => {
    if (!cardio) return { weight: parseNum(a), reps: parseNum(b), done: isDone };
    const min = parseNum(a);
    return { weight: null, reps: null, seconds: min == null ? null : min * 60, distance: parseNum(b), done: isDone };
  };
  const [weightText, setWeightText] = useState(fieldA(set));
  const [repsText, setRepsText] = useState(fieldB(set));
  const prevA = fieldA(prev);
  const prevB = fieldB(prev);
  const colA = cardio ? 'min' : 'kg';
  const colB = cardio ? (floors ? 'floors' : 'km') : 'reps';
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

  const kind = set.kind ?? 'normal';
  const special = kind !== 'normal' ? SET_KIND[kind] : null;
  const label = special ? special.name : `Set ${number}`;

  // Tap the set number: a sheet slides up to choose the set type, see records, or delete the set.
  const [menu, setMenu] = useState(false);
  const openMenu = () => {
    haptic.tap();
    setMenu(true);
  };
  const pickFromMenu = (pick: SetKind | 'records' | 'delete' | null) => {
    setMenu(false);
    if (!pick) return;
    if (pick === 'records') return showRecords(exercise, index, prs);
    if (pick === 'delete') return onDelete();
    if (pick !== kind) onKind(pick);
  };

  // Only numbers: a decimal point for kg, whole numbers for reps.
  const latest = useRef({ w: weightText, r: repsText });
  latest.current = { w: weightText, r: repsText };
  const changeWeight = (raw: string) => {
    const t = cleanNumber(raw, true);
    setWeightText(t);
    latest.current.w = t;
    onPatch(patchOf(t, latest.current.r, done));
  };
  const decimalB = cardio && !floors;
  const changeReps = (raw: string) => {
    const t = cleanNumber(raw, decimalB);
    setRepsText(t);
    latest.current.r = t;
    onPatch(patchOf(latest.current.w, t, done));
  };
  const pad = useNumberPad();
  const keyW = `${set.id}-w`;
  const keyR = `${set.id}-r`;
  // Done on the keypad ticks the set off (if it isn't already).
  const openReps = () =>
    pad.open({
      key: keyR,
      label: `${label} · ${colB}`,
      value: latest.current.r,
      decimal: decimalB,
      onChange: changeReps,
      onDone: () => {
        if (!doneRef.current) toggle();
      },
    });
  const openWeight = () =>
    pad.open({
      key: keyW,
      label: `${label} · ${colA}`,
      value: latest.current.w,
      decimal: true,
      onChange: changeWeight,
      next: openReps,
      plates: barbell && !cardio,
    });

  const doneRef = useRef(done);
  doneRef.current = done;
  const toggle = () => {
    const { w, r } = latest.current;
    if (doneRef.current) {
      onPatch(patchOf(w, r, false));
      return;
    }
    // Empty fields take over the values from last time, like Hevy.
    const a = w || prevA;
    const b = r || prevB;
    const ok = cardio ? (parseNum(a) ?? 0) > 0 || (parseNum(b) ?? 0) > 0 : (parseNum(b) ?? 0) > 0;
    if (!ok) {
      haptic.warning();
      return;
    }
    setWeightText(a);
    setRepsText(b);
    latest.current = { w: a, r: b };
    onPatch(patchOf(a, b, true));
  };

  // Swipe the row to the left: a bin appears behind it, tap it to delete the set.
  const swipeX = useSharedValue(0);
  const swipeStart = useRef(0);
  const swiped = useRef(false);
  const closeSwipe = () => {
    swipeX.value = withSpring(0, { damping: 20, stiffness: 260 });
  };
  const deleteBySwipe = () => {
    haptic.warning();
    swipeX.value = withTiming(-600, { duration: 180 });
    setTimeout(onDelete, 170);
  };
  const swipe = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-12, 12],
    runOnJS: true,
    onActivate: () => {
      swiped.current = true;
      swipeStart.current = swipeX.value;
      pad.close();
    },
    onUpdate: (e) => {
      // Stops a little past the bin: a swipe never deletes on its own.
      const x = swipeStart.current + e.translationX;
      swipeX.value = x > 0 ? x * 0.15 : x < -BIN_WIDTH ? -BIN_WIDTH + (x + BIN_WIDTH) * 0.2 : x;
    },
    onDeactivate: () => {
      const x = swipeX.value;
      if (x < -36) {
        haptic.tap();
        swipeX.value = withSpring(-BIN_WIDTH, { damping: 20, stiffness: 260 });
      } else closeSwipe();
      setTimeout(() => (swiped.current = false), 250);
    },
  });
  const frontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.value }] }));
  const binStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, -swipeX.value / 50) }));
  /** Taps inside the row: ignored right after a swipe; when the bin is showing they just close it. */
  const tap = (fn: () => void) => () => {
    if (swiped.current) return;
    if (swipeX.value < -4) return closeSwipe();
    fn();
  };

  return (
    <View style={styles.swipeWrap}>
      <Animated.View style={[styles.swipeBack, binStyle]}>
        <Pressable
          onPress={deleteBySwipe}
          accessibilityRole="button"
          accessibilityLabel={`Delete set ${index + 1}`}
          style={styles.binButton}>
          <Ionicons name="trash-outline" size={19} color="#fff" />
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={swipe} touchAction="pan-y">
        <Animated.View style={[styles.swipeFront, frontStyle]}>
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
              onPress={tap(openMenu)}
              onLongPress={onDelete}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${label}${pr ? `, ${plural(prs.length, 'record')}` : ''}. Tap to change the set type`}>
              {pr ? (
                <Animated.View entering={ZoomIn.springify().damping(8)}>
                  <Ionicons name="trophy" size={13} color={C.gold} />
                </Animated.View>
              ) : special ? (
                <View style={[styles.kindBadge, { borderColor: special.color }]}>
                  <Text style={[styles.kindText, { color: special.color }]}>{special.letter}</Text>
                </View>
              ) : (
                <View style={[styles.numChip, done && styles.numChipDone]}>
                  <Text style={[styles.setNum, done && { color: C.good }]}>{number}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={styles.colPrev}
              disabled={pr ? false : !prev || done}
              onPress={tap(() => {
                if (pr) return showRecords(exercise, index, prs);
                if (!prev) return;
                setWeightText(prevA);
                setRepsText(prevB);
                latest.current = { w: prevA, r: prevB };
                onPatch(patchOf(prevA, prevB, done));
              })}>
              {pr ? (
                <Text style={[styles.prevText, { color: C.gold, fontFamily: F.semi }]} numberOfLines={1}>
                  {prs.map((p) => PR_LABEL[p.kind]).join(' + ')} PR
                </Text>
              ) : (
                <Text style={styles.prevText} numberOfLines={1}>
                  {prev
                    ? cardio
                      ? fmtCardio(prev.seconds, prev.distance, floors)
                      : fmtSet(prev.weight, prev.reps)
                    : '—'}
                </Text>
              )}
            </Pressable>
            {pad.enabled ? (
              <PadField
                value={weightText}
                placeholder={prevA || '0'}
                active={pad.activeKey === keyW}
                done={done}
                label={cardio ? `Set ${index + 1} minutes` : `Set ${index + 1} weight in kg`}
                onPress={tap(openWeight)}
              />
            ) : (
              <TextInput
                value={weightText}
                onChangeText={changeWeight}
                placeholder={prevA || '0'}
                placeholderTextColor={C.textFaint}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel={cardio ? `Set ${index + 1} minutes` : `Set ${index + 1} weight in kg`}
                style={[styles.colInput, styles.input, done && styles.inputDone]}
              />
            )}
            {pad.enabled ? (
              <PadField
                value={repsText}
                placeholder={prevB || '0'}
                active={pad.activeKey === keyR}
                done={done}
                label={cardio ? `Set ${index + 1} ${colB}` : `Set ${index + 1} reps`}
                onPress={tap(openReps)}
              />
            ) : (
              <TextInput
                value={repsText}
                onChangeText={changeReps}
                placeholder={prevB || '0'}
                placeholderTextColor={C.textFaint}
                keyboardType={decimalB ? 'decimal-pad' : 'number-pad'}
                selectTextOnFocus
                accessibilityLabel={cardio ? `Set ${index + 1} ${colB}` : `Set ${index + 1} reps`}
                style={[styles.colInput, styles.input, done && styles.inputDone]}
              />
            )}
            <Pressable
              onPress={tap(toggle)}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={`Set ${index + 1} done`}
              style={styles.colCheck}>
              <Animated.View style={[styles.check, checkStyle]}>
                <Ionicons name="checkmark" size={18} color={done ? '#06210F' : C.textFaint} />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {menu ? <SetTypeSheet title={label} kind={kind} hasRecords={pr} onPick={pickFromMenu} /> : null}
    </View>
  );
}

/** A kg or reps field on phones: tapping it opens the number keypad instead of the phone keyboard. */
function PadField({
  value,
  placeholder,
  active,
  done,
  label,
  onPress,
}: {
  value: string;
  placeholder: string;
  active: boolean;
  done: boolean;
  label: string;
  onPress: () => void;
}) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    // Keep the field visible above the keypad.
    if (active)
      (ref.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [active]);
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.colInput,
        styles.input,
        styles.padField,
        done && styles.inputDone,
        active && styles.padFieldActive,
      ]}>
      <Text style={[styles.padFieldText, !value && { color: C.textFaint }]}>{value || placeholder}</Text>
    </Pressable>
  );
}

/** Keeps room at the bottom of the workout while the keypad is open. */
function PadSpacer() {
  const pad = useNumberPad();
  return pad.activeKey ? <View style={{ height: PAD_HEIGHT }} /> : null;
}

const KIND_OPTIONS: { kind: SetKind; name: string; hint: string; letter: string; color: string }[] = [
  { kind: 'normal', name: 'Normal set', hint: 'A regular working set', letter: '1', color: C.textDim },
  { kind: 'warmup', name: 'Warm-up', hint: "Doesn't count toward volume or records", letter: 'W', color: '#F59E0B' },
  { kind: 'drop', name: 'Drop set', hint: 'Lighter weight right after a set', letter: 'D', color: '#A78BFA' },
  { kind: 'failure', name: 'Failure', hint: 'Taken until no more reps were possible', letter: 'F', color: '#F87171' },
];

/** Bottom sheet for a set (slides up like in Hevy): set type, records, delete. */
function SetTypeSheet({
  title,
  kind,
  hasRecords,
  onPick,
}: {
  title: string;
  kind: SetKind;
  hasRecords: boolean;
  onPick: (pick: SetKind | 'records' | 'delete' | null) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="none" onRequestClose={() => onPick(null)}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View entering={FadeIn.duration(160)} style={StyleSheet.absoluteFill}>
          <Pressable style={styles.sheetBackdrop} onPress={() => onPick(null)} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(210)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, S.lg) }]}>
          <View style={styles.sheetGrip} />
          <Text style={[text.title, { fontSize: 18, marginBottom: 4 }]}>{title}</Text>
          {KIND_OPTIONS.map((o) => {
            const on = o.kind === kind;
            return (
              <Pressable
                key={o.kind}
                onPress={() => onPick(o.kind)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.sheetRow, on && styles.sheetRowOn, pressed && { opacity: 0.75 }]}>
                <View style={[styles.sheetBadge, { borderColor: o.color }]}>
                  <Text style={[styles.kindText, { color: o.color }]}>{o.letter}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>{o.name}</Text>
                  <Text style={text.faint}>{o.hint}</Text>
                </View>
                {on ? <Ionicons name="checkmark" size={18} color={C.accent} /> : null}
              </Pressable>
            );
          })}
          <View style={styles.sheetDivider} />
          {hasRecords ? (
            <Pressable onPress={() => onPick('records')} style={styles.sheetAction} accessibilityRole="button">
              <Ionicons name="trophy-outline" size={18} color={C.gold} />
              <Text style={text.strong}>Show records</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onPick('delete')} style={styles.sheetAction} accessibilityRole="button">
            <Ionicons name="trash-outline" size={18} color={C.danger} />
            <Text style={[text.strong, { color: C.danger }]}>Delete set</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Sheet to swap an exercise: exercises for the same muscle first (the ones you use
 * most), with what you did last time, or search the whole library.
 */
function SwapSheet({
  ex,
  library,
  workoutId,
  taken,
  onPick,
  onClose,
}: {
  ex: WorkoutExercise;
  library: Exercise[];
  workoutId: number;
  taken: number[];
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [last, setLast] = useState<Map<number, PrevSet>>(new Map());
  const open = ex.sets.filter((x) => !x.done).length;
  const ticked = ex.sets.length - open;

  const options = library.filter((e) => e.id !== ex.exercise_id && !taken.includes(e.id));
  const sameMuscle = options
    .filter((e) => e.muscle === ex.muscle)
    // Ones you use most, then the same kind of equipment (machine for a machine), then A–Z.
    .sort(
      (a, b) =>
        b.use_count - a.use_count ||
        Number(b.equipment === ex.equipment) - Number(a.equipment === ex.equipment) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 10);
  const shown = query.trim() ? searchExercises(query, options).slice(0, 12) : sameMuscle;
  const key = shown.map((e) => e.id).join(',');
  useEffect(() => {
    let live = true;
    lastTimeFor(
      db,
      shown.map((e) => e.id),
      workoutId,
    ).then((m) => live && setLast(m));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const lastText = (e: Exercise) => {
    const p = last.get(e.id);
    if (!p) return 'Not done yet';
    return `Last time ${
      e.track && e.track !== 'weight_reps'
        ? fmtCardio(p.seconds, p.distance, e.track === 'time_floors')
        : fmtSet(p.weight, p.reps)
    }`;
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View entering={FadeIn.duration(160)} style={StyleSheet.absoluteFill}>
          <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(210)}
          style={[styles.sheet, styles.swapSheet, { paddingBottom: Math.max(insets.bottom, S.lg) }]}>
          <View style={styles.sheetGrip} />
          <Text style={[text.title, { fontSize: 18 }]} numberOfLines={1}>
            Swap {ex.name}
          </Text>
          <Text style={[text.faint, { marginBottom: 4 }]}>
            {ticked
              ? `${plural(open, 'open set')} move${open === 1 ? 's' : ''} over. The ${plural(ticked, 'set')} you ticked stay${ticked === 1 ? 's' : ''} with ${ex.name}.`
              : `Your ${plural(open, 'set')} move${open === 1 ? 's' : ''} over, filled with your numbers from last time.`}
          </Text>
          <View style={styles.swapSearch}>
            <Ionicons name="search" size={16} color={C.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search any exercise"
              placeholderTextColor={C.textFaint}
              accessibilityLabel="Search exercises to swap to"
              style={styles.swapInput}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={C.textFaint} />
              </Pressable>
            ) : null}
          </View>
          <Text style={[text.label, { marginTop: 6 }]}>{query.trim() ? 'Results' : `Same muscle · ${ex.muscle}`}</Text>
          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
            {shown.length === 0 ? (
              <Text style={[text.faint, { paddingVertical: S.md }]}>Nothing found. Try another name.</Text>
            ) : (
              shown.map((e, i) => (
                <Pressable
                  key={e.id}
                  onPress={() => onPick(e)}
                  accessibilityRole="button"
                  accessibilityLabel={`Swap to ${e.name}`}
                  style={({ pressed }) => [
                    styles.swapRow,
                    i < shown.length - 1 && styles.swapRowLine,
                    pressed && { backgroundColor: C.cardHi },
                  ]}>
                  <ExerciseImage name={e.name} equipment={e.equipment} size={34} radius={8} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={text.strong} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={text.faint} numberOfLines={1}>
                      {lastText(e)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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
                  {ex.notes ? (
                    <Text style={[text.faint, { color: C.gold }]} numberOfLines={3}>
                      {ex.notes}
                    </Text>
                  ) : null}
                  {ex.sets.map((s, n) => {
                    const special = s.kind && s.kind !== 'normal' ? SET_KIND[s.kind] : null;
                    const number = ex.sets.slice(0, n + 1).filter((x) => !x.kind || x.kind === 'normal').length;
                    return (
                      <View key={s.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        <Text
                          style={[text.faint, { width: 14 }, special && { color: special.color, fontFamily: F.semi }]}>
                          {special ? special.letter : number}
                        </Text>
                        <Text style={[text.dim, prSetIds.has(s.id) && { color: C.gold }]}>
                          {ex.track && ex.track !== 'weight_reps'
                            ? fmtCardio(s.seconds, s.distance, ex.track === 'time_floors')
                            : fmtSet(s.weight, s.reps)}
                        </Text>
                        {prSetIds.has(s.id) ? <Ionicons name="trophy" size={11} color={C.gold} /> : null}
                      </View>
                    );
                  })}
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
  colCheck: { width: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  setNum: { color: C.textDim, fontSize: 13, fontFamily: F.semi, textAlign: 'center' },
  kindBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindText: { fontSize: 12, fontFamily: F.semi },
  numChip: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardHi,
    borderWidth: 1,
    borderColor: C.borderHi,
  },
  numChipDone: { backgroundColor: 'rgba(52,199,123,0.12)', borderColor: 'rgba(52,199,123,0.45)' },
  padField: { justifyContent: 'center', alignItems: 'center' },
  padFieldActive: { borderWidth: 1.5, borderColor: C.accent },
  padFieldText: { color: C.text, fontFamily: F.semi, fontSize: 15, fontVariant: ['tabular-nums'] },
  swipeWrap: { borderRadius: R.sm, overflow: 'hidden' },
  swipeBack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#DC4C4C',
    borderRadius: R.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  binButton: { width: BIN_WIDTH, height: '100%', alignItems: 'center', justifyContent: 'center' },
  swipeFront: { backgroundColor: C.card, borderRadius: R.sm },
  dragBox: { shadowColor: '#000', shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  folded: { height: FOLDED, justifyContent: 'center', paddingVertical: 0 },
  held: { borderColor: C.accent },
  focusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 12,
    paddingHorizontal: S.md,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.accentDim,
  },
  focusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
  },
  undoBar: {
    position: 'absolute',
    left: S.lg,
    right: S.lg,
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 12,
    paddingHorizontal: S.lg,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.accentLine,
    backgroundColor: C.cardHi,
  },
  swapSheet: { maxHeight: '86%' },
  swapSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 42,
    paddingHorizontal: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderHi,
    backgroundColor: C.bg,
  },
  swapInput: { flex: 1, color: C.text, fontFamily: F.regular, fontSize: 15, height: '100%' },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 10, paddingHorizontal: 4 },
  swapRowLine: { borderBottomWidth: 1, borderBottomColor: C.border },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(3,6,8,0.6)' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: S.lg,
    paddingTop: 8,
    backgroundColor: C.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.borderHi,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.borderHi,
    marginBottom: 8,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: R.md },
  sheetRowOn: { backgroundColor: C.accentDim },
  sheetBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDivider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  sheetAction: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 12, paddingHorizontal: S.md },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: R.sm,
  },
  noteRowFilled: { backgroundColor: 'rgba(233,190,88,0.07)' },
  noteInput: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontFamily: F.regular,
    fontSize: 13,
    lineHeight: 18,
    padding: 0,
    marginTop: -1,
  },
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
  check: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
