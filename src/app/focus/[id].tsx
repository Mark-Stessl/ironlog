import Ionicons from '@expo/vector-icons/Ionicons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { useCelebrate } from '@/components/celebrate';
import { Elapsed } from '@/components/elapsed';
import { ExerciseImage } from '@/components/exercise-image';
import { NumberPadProvider, useNumberPad } from '@/components/number-pad';
import { PlateLine, usesBarbell } from '@/components/plate-calculator';
import {
  addSet,
  getSetting,
  getWorkoutDetail,
  updateSet,
  type PrevSet,
  type SetPatch,
  type SetRow,
  type WorkoutDetail,
  type WorkoutExercise,
} from '@/lib/db';
import { fmtCardio, fmtDuration, fmtSet, fmtVolume, fmtWeight, minutesText, parseNum } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { addToBest, findPRs, markPRs, type Best } from '@/lib/records';
import { sound } from '@/lib/sound';
import { C, F, R, S } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { adjustRest, getRest, requestFinish, setRest, startRest, useRest } from '@/lib/workout-session';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const KIND: Record<string, { letter: string; color: string; name: string }> = {
  warmup: { letter: 'W', color: '#F59E0B', name: 'Warm-up' },
  drop: { letter: 'D', color: '#A78BFA', name: 'Drop set' },
  failure: { letter: 'F', color: '#F87171', name: 'Failure' },
};

type Step = { ex: WorkoutExercise; set: SetRow; exIndex: number; setIndex: number };

/**
 * Focus mode: the workout one set at a time, made for the gym floor. Huge numbers
 * you can drag up and down, slide to tick the set off, then a full-screen rest
 * timer that already shows what's next. The screen stays awake.
 */
export default function FocusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const [detail, , setDetail] = useFocusData((db) => getWorkoutDetail(db, workoutId), workoutId);
  useKeepAwake();

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade', presentation: 'fullScreenModal' }} />
      <NumberPadProvider>
        <View style={styles.screen}>
          {detail ? (
            <Focus detail={detail} setDetail={setDetail} />
          ) : detail === null ? (
            <Text style={styles.faint}>Workout not found</Text>
          ) : null}
        </View>
      </NumberPadProvider>
    </>
  );
}

function Focus({
  detail,
  setDetail,
}: {
  detail: WorkoutDetail;
  setDetail: (fn: (d: WorkoutDetail | null | undefined) => WorkoutDetail | null | undefined) => void;
}) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const celebrate = useCelebrate();
  const [rest] = useRest();
  const [restSeconds, setRestSeconds] = useState(90);
  useEffect(() => {
    getSetting(db, 'rest_seconds', '90').then((v) => setRestSeconds(Number(v)));
  }, [db]);

  // Every set of the workout in order.
  const steps: Step[] = useMemo(
    () => detail.exercises.flatMap((ex, exIndex) => ex.sets.map((set, setIndex) => ({ ex, set, exIndex, setIndex }))),
    [detail],
  );
  const firstOpen = () => steps.findIndex((s) => !s.set.done);
  const [cursor, setCursor] = useState(() => Math.max(0, firstOpen()));
  const [finished, setFinished] = useState(() => steps.length > 0 && firstOpen() === -1);
  const step = steps[Math.min(cursor, steps.length - 1)];

  // Saves go one after another so they never overtake each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const save = (setId: number, patch: SetPatch) => {
    queue.current = queue.current.then(() => updateSet(db, setId, patch)).catch(() => {});
    setDetail((d) =>
      d
        ? {
            ...d,
            exercises: d.exercises.map((ex) => ({
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch, done: patch.done ? 1 : 0 } : s)),
            })),
          }
        : d,
    );
  };

  const complete = (patch: SetPatch) => {
    if (!step) return;
    const { ex, set } = step;
    save(set.id, { ...patch, done: true });
    const prs =
      markPRs(
        ex.sets.map((s) => (s.id === set.id ? { ...s, ...patch, done: 1 } : s)),
        ex.best,
      )[step.setIndex] ?? [];
    if (prs.length) celebrate(ex.name, prs);
    else haptic.success();
    // What comes next: the next open set after this one, else any open set.
    const after = steps.findIndex((s, i) => i > cursor && !s.set.done);
    const any = steps.findIndex((s, i) => i !== cursor && !s.set.done);
    const next = after >= 0 ? after : any;
    if (next < 0) {
      setFinished(true);
      sound.play('complete');
      return;
    }
    setCursor(next);
    if (restSeconds > 0 && ex.track === 'weight_reps' && set.kind !== 'warmup') startRest(restSeconds, ex.name);
  };

  const undoTick = () => {
    if (!step) return;
    const { set } = step;
    save(set.id, {
      weight: set.weight,
      reps: set.reps,
      seconds: set.seconds,
      distance: set.distance,
      done: false,
    });
  };

  const addOneMore = async () => {
    const ex = (step ?? steps[steps.length - 1])?.ex;
    if (!ex) return;
    await queue.current;
    await addSet(db, ex.id);
    const fresh = await getWorkoutDetail(db, detail.workout.id);
    if (!fresh) return;
    setDetail(() => fresh);
    const all = fresh.exercises.flatMap((e) => e.sets);
    setCursor(all.findIndex((s) => !s.done));
    setFinished(false);
  };

  const close = async () => {
    await queue.current;
    router.back();
  };

  if (!steps.length)
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.faint}>Add an exercise first.</Text>
        <Pressable onPress={close} style={styles.ghostButton}>
          <Text style={styles.ghostText}>Back</Text>
        </Pressable>
      </View>
    );

  const upNext = step && !step.set.done ? step : steps.find((s) => !s.set.done);

  return (
    <View style={[styles.fill, { paddingTop: insets.top + S.sm, paddingBottom: Math.max(insets.bottom, 12) + 22 }]}>
      <TopBar detail={detail} steps={steps} cursor={cursor} finished={finished} onClose={close} onJump={setCursor} />
      {finished ? (
        <AllDone detail={detail} onAddSet={addOneMore} onClose={close} />
      ) : rest && rest.endAt > Date.now() - 1500 ? (
        <RestView key={rest.id} endAt={rest.endAt} total={rest.total} next={upNext} />
      ) : step ? (
        <SetView
          key={step.set.id}
          step={step}
          number={step.ex.sets.filter((s, i) => s.kind === 'normal' && i <= step.setIndex).length}
          total={step.ex.sets.length}
          canBack={cursor > 0}
          canForward={cursor < steps.length - 1}
          onBack={() => setCursor((c) => Math.max(0, c - 1))}
          onForward={() => setCursor((c) => Math.min(steps.length - 1, c + 1))}
          onDraft={(patch) => save(step.set.id, { ...patch, done: false })}
          onComplete={complete}
          onUndo={undoTick}
        />
      ) : null}
    </View>
  );
}

// ── Top: close, time, progress through every set ───────────────────────

function TopBar({
  detail,
  steps,
  cursor,
  finished,
  onClose,
  onJump,
}: {
  detail: WorkoutDetail;
  steps: Step[];
  cursor: number;
  finished: boolean;
  onClose: () => void;
  onJump: (i: number) => void;
}) {
  const done = steps.filter((s) => s.set.done).length;
  return (
    <View style={styles.top}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Leave focus mode"
          style={styles.roundButton}>
          <Ionicons name="chevron-down" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {detail.workout.name}
          </Text>
          <Elapsed since={detail.workout.started_at} style={styles.topTime} />
        </View>
        <View style={styles.roundButtonGhost}>
          <Text style={styles.topCount}>
            {done}/{steps.length}
          </Text>
        </View>
      </View>
      {/* One segment per set, grouped per exercise. Tap one to jump there. */}
      <View style={styles.progress}>
        {detail.exercises.map((ex) => (
          <View key={ex.id} style={styles.progressGroup}>
            {ex.sets.map((s) => {
              const i = steps.findIndex((x) => x.set.id === s.id);
              const current = !finished && i === cursor;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onJump(i)}
                  hitSlop={{ top: 10, bottom: 10 }}
                  accessibilityLabel={`Go to ${ex.name} set ${ex.sets.indexOf(s) + 1}`}
                  style={[styles.seg, s.done ? styles.segDone : null, current && styles.segCurrent]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── One set: huge numbers, drag to change, slide to tick ───────────────

function SetView({
  step,
  number,
  total,
  canBack,
  canForward,
  onBack,
  onForward,
  onDraft,
  onComplete,
  onUndo,
}: {
  step: Step;
  number: number;
  total: number;
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onDraft: (patch: SetPatch) => void;
  onComplete: (patch: SetPatch) => void;
  onUndo: () => void;
}) {
  const { ex, set, setIndex } = step;
  const cardio = ex.track !== 'weight_reps';
  const floors = ex.track === 'time_floors';
  const prev: PrevSet | undefined = ex.previous[setIndex];
  const kind = KIND[set.kind];

  // Start from what's saved, else from last time, else from the set before this one today.
  const before1 = ex.sets[setIndex - 1];
  const startA = cardio
    ? [set.seconds, prev?.seconds, before1?.seconds].find((v) => v != null)
    : [set.weight, prev?.weight, before1?.weight].find((v) => v != null);
  const startB = cardio
    ? [set.distance, prev?.distance, before1?.distance].find((v) => v != null)
    : [set.reps, prev?.reps, before1?.reps].find((v) => v != null);
  const [a, setA] = useState<number | null>(cardio ? (startA != null ? startA / 60 : null) : (startA ?? null));
  const [b, setB] = useState<number | null>(startB ?? null);

  const patchOf = (va: number | null, vb: number | null): SetPatch =>
    cardio
      ? { weight: null, reps: null, seconds: va == null ? null : Math.round(va * 60), distance: vb, done: false }
      : { weight: va, reps: vb == null ? null : Math.round(vb), done: false };
  const draft = (va: number | null, vb: number | null) => onDraft(patchOf(va, vb));

  const stepA = cardio ? 1 : ex.equipment === 'Dumbbell' || ex.equipment === 'Bodyweight' ? 1 : 2.5;
  const stepB = cardio ? (floors ? 1 : 0.1) : 1;
  const canTick = cardio ? (a ?? 0) > 0 || (b ?? 0) > 0 : (b ?? 0) > 0;

  // Live record radar: before this set, the best so far (old records + sets done today).
  const before: Best = ex.sets.reduce(
    (best, s, i) => (s.done && i !== setIndex && s.kind !== 'warmup' ? addToBest(best, s) : best),
    ex.best,
  );
  const pr = !cardio && set.kind !== 'warmup' && b ? findPRs({ weight: a, reps: b }, before)[0] : undefined;
  const almost =
    !pr && !cardio && set.kind !== 'warmup' && b ? findPRs({ weight: a, reps: b + 1 }, before)[0] : undefined;

  const prevText = prev
    ? cardio
      ? fmtCardio(prev.seconds, prev.distance, floors)
      : fmtSet(prev.weight, prev.reps)
    : null;

  return (
    <Animated.View
      entering={SlideInRight.springify().damping(22).stiffness(200)}
      exiting={FadeOut.duration(120)}
      style={styles.inner}>
      <View style={styles.exHead}>
        <ExerciseImage name={ex.name} equipment={ex.equipment} size={44} radius={10} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.exName} numberOfLines={2}>
            {ex.name}
          </Text>
          <View style={styles.setRow}>
            <Pressable
              onPress={onBack}
              disabled={!canBack}
              hitSlop={10}
              accessibilityLabel="Previous set"
              style={[styles.navButton, !canBack && { opacity: 0.25 }]}>
              <Ionicons name="chevron-back" size={16} color={C.text} />
            </Pressable>
            {kind ? (
              <View style={[styles.kindChip, { borderColor: kind.color }]}>
                <Text style={[styles.kindText, { color: kind.color }]}>{kind.name}</Text>
              </View>
            ) : (
              <Text style={styles.setLabel}>
                Set {number} <Text style={styles.faint}>of {total}</Text>
              </Text>
            )}
            <Pressable
              onPress={onForward}
              disabled={!canForward}
              hitSlop={10}
              accessibilityLabel="Next set"
              style={[styles.navButton, !canForward && { opacity: 0.25 }]}>
              <Ionicons name="chevron-forward" size={16} color={C.text} />
            </Pressable>
          </View>
        </View>
      </View>

      {ex.notes ? (
        <View style={styles.note}>
          <Ionicons name="create-outline" size={13} color={C.gold} />
          <Text style={styles.noteText} numberOfLines={2}>
            {ex.notes}
          </Text>
        </View>
      ) : null}

      <View style={styles.numbers}>
        <BigNumber
          id={`${set.id}-a`}
          label={cardio ? 'minutes' : 'kg'}
          value={a}
          step={stepA}
          decimal
          format={(v) => (cardio ? minutesText(Math.round(v * 60)) : fmtWeight(v))}
          onChange={(v) => {
            setA(v);
            draft(v, b);
          }}
          disabled={!!set.done}
          plates={!cardio && usesBarbell(ex.equipment, ex.name)}
        />
        <Text style={styles.times}>{cardio ? '·' : '×'}</Text>
        <BigNumber
          id={`${set.id}-b`}
          label={cardio ? (floors ? 'floors' : 'km') : 'reps'}
          value={b}
          step={stepB}
          decimal={cardio && !floors}
          format={(v) => (cardio && !floors ? fmtWeight(Math.round(v * 10) / 10) : String(Math.round(v)))}
          onChange={(v) => {
            setB(v);
            draft(a, v);
          }}
          disabled={!!set.done}
        />
      </View>

      <View style={styles.hints}>
        {prevText ? (
          <Text style={styles.ghost}>
            <Ionicons name="time-outline" size={13} color={C.textFaint} /> Last time {prevText}
          </Text>
        ) : (
          <Text style={styles.ghost}>First time: whatever you do sets the bar</Text>
        )}
        {pr && !set.done ? (
          <Animated.View entering={ZoomIn.springify()} style={styles.prBadge}>
            <Ionicons name="trophy" size={14} color={C.gold} />
            <Text style={styles.prText}>Record pace · {pr.title}</Text>
          </Animated.View>
        ) : almost && !set.done ? (
          <Text style={styles.almost}>
            <Ionicons name="trophy-outline" size={13} color={C.gold} /> 1 more rep and it's a record
          </Text>
        ) : null}
      </View>

      <View style={{ flex: 1 }} />

      {set.done ? (
        <Animated.View entering={FadeIn} style={styles.doneBox}>
          <View style={styles.doneRow}>
            <Ionicons name="checkmark-circle" size={22} color={C.good} />
            <Text style={styles.doneText}>Done</Text>
          </View>
          <Pressable onPress={onUndo} accessibilityRole="button" style={styles.ghostButton}>
            <Text style={styles.ghostText}>Untick to change it</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <SlideToDone
          enabled={canTick}
          label={canTick ? 'Slide to complete set' : cardio ? 'Enter a time first' : 'Enter your reps first'}
          onDone={() => onComplete({ ...patchOf(a, b), done: true })}
        />
      )}
    </Animated.View>
  );
}

/**
 * A huge number: drag up/down on it to change it in steps (it rolls like a dial),
 * tap the − / + buttons, or tap the number to type it.
 */
function BigNumber({
  id,
  label,
  value,
  step,
  decimal,
  format,
  onChange,
  disabled,
  plates,
}: {
  id: string;
  label: string;
  value: number | null;
  step: number;
  decimal: boolean;
  format: (v: number) => string;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  plates?: boolean;
}) {
  const pad = useNumberPad();
  const latest = useRef(value);
  latest.current = value;
  const start = useRef(0);
  const lastSteps = useRef(0);
  const nudge = useSharedValue(0);
  const active = useSharedValue(0);
  const PX = 26; // finger travel per step

  const set = (v: number | null) => {
    const clean = v == null ? null : Math.max(0, Math.round(v * 100) / 100);
    onChange(clean);
  };
  const bump = (dir: number) => {
    nudge.value = withSequence(withTiming(-dir * 10, { duration: 60 }), withSpring(0, { damping: 12, stiffness: 300 }));
  };
  const stepBy = (n: number) => {
    set((latest.current ?? 0) + n * step);
    haptic.tap();
    bump(Math.sign(n));
  };

  const drag = usePanGesture({
    enabled: !disabled,
    activeOffsetY: [-6, 6],
    failOffsetX: [-24, 24],
    runOnJS: true,
    onActivate: () => {
      start.current = latest.current ?? 0;
      lastSteps.current = 0;
      active.value = withTiming(1, { duration: 120 });
      pad.close();
    },
    onUpdate: (e) => {
      const n = Math.round(-e.translationY / PX);
      if (n === lastSteps.current) return;
      bump(Math.sign(n - lastSteps.current));
      lastSteps.current = n;
      haptic.tap();
      set(start.current + n * step);
    },
    onDeactivate: () => {
      active.value = withTiming(0, { duration: 180 });
    },
  });

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: nudge.value }, { scale: interpolate(active.value, [0, 1], [1, 1.06]) }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: active.value }));

  const openPad = () =>
    pad.open({
      key: id,
      label: label === 'kg' ? 'Weight · kg' : label[0].toUpperCase() + label.slice(1),
      value: value == null ? '' : decimal ? fmtWeight(value) : String(Math.round(value)),
      decimal,
      onChange: (t) => set(parseNum(t)),
      plates,
    });

  return (
    <View style={styles.big}>
      <GestureDetector gesture={drag} touchAction="none">
        <View style={styles.bigTouch}>
          <Animated.View style={[styles.bigGlow, glow]} pointerEvents="none" />
          <Ionicons name="chevron-up" size={18} color={disabled ? 'transparent' : C.textFaint} />
          <Pressable
            onPress={disabled ? undefined : openPad}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value == null ? 'empty' : format(value)}. Drag up or down to change, tap to type`}>
            <Animated.Text
              style={[
                styles.bigValue,
                sizeFor(value == null ? '–' : format(value)),
                value == null && { color: C.textFaint },
                numStyle,
              ]}
              numberOfLines={1}>
              {value == null ? '–' : format(value)}
            </Animated.Text>
          </Pressable>
          <Ionicons name="chevron-down" size={18} color={disabled ? 'transparent' : C.textFaint} />
        </View>
      </GestureDetector>
      <Text style={styles.bigLabel}>{label}</Text>
      {/* Same height on both sides so the − / + buttons line up. */}
      <View style={styles.plateSlot}>{plates && value ? <PlateLine kg={value} /> : null}</View>
      {disabled ? null : (
        <View style={styles.steppers}>
          <Pressable
            onPress={() => stepBy(-1)}
            accessibilityRole="button"
            accessibilityLabel={`${label} minus ${fmtWeight(step)}`}
            style={({ pressed }) => [styles.stepper, pressed && styles.stepperPressed]}>
            <Ionicons name="remove" size={22} color={C.text} />
          </Pressable>
          <Pressable
            onPress={() => stepBy(1)}
            accessibilityRole="button"
            accessibilityLabel={`${label} plus ${fmtWeight(step)}`}
            style={({ pressed }) => [styles.stepper, pressed && styles.stepperPressed]}>
            <Ionicons name="add" size={22} color={C.text} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Big numbers shrink a little as they get longer, so "102.5" still fits next to the reps. */
function sizeFor(text: string) {
  const size = text.length <= 2 ? 88 : text.length === 3 ? 76 : text.length === 4 ? 62 : 52;
  return { fontSize: size };
}

/** Slide the knob all the way to tick the set off: no accidental taps with sweaty hands. */
function SlideToDone({ enabled, label, onDone }: { enabled: boolean; label: string; onDone: () => void }) {
  const [width, setWidth] = useState(0);
  const KNOB = 64;
  const max = Math.max(1, width - KNOB - 8);
  const x = useSharedValue(0);
  const fired = useRef(false);

  const finish = () => {
    if (fired.current) return;
    fired.current = true;
    onDone();
  };

  const pan = usePanGesture({
    enabled,
    activeOffsetX: [-4, 4],
    runOnJS: true,
    onUpdate: (e) => {
      x.value = Math.max(0, Math.min(max, e.translationX));
    },
    onDeactivate: () => {
      if (x.value > max * 0.72) {
        x.value = withTiming(max, { duration: 90 });
        setTimeout(finish, 90);
      } else x.value = withSpring(0, { damping: 18, stiffness: 240 });
    },
  });

  // A slow shimmer on the arrow so it's clear it wants to be slid.
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = enabled
      ? withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1)
      : withTiming(0);
    return () => cancelAnimation(shimmer);
  }, [enabled, shimmer]);

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value + shimmer.value * 6 }] }));
  const trail = useAnimatedStyle(() => ({ width: x.value + KNOB + 4 }));
  const text = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, max * 0.5], [1, 0], 'clamp') }));

  return (
    <View
      style={[styles.slide, !enabled && { opacity: 0.45 }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Complete set"
      accessibilityHint="Slide right to tick off the set"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => enabled && finish()}>
      <Animated.View style={[styles.slideTrail, trail]} />
      <Animated.Text style={[styles.slideText, text]}>{label}</Animated.Text>
      <GestureDetector gesture={pan} touchAction="none">
        <Animated.View style={[styles.knob, knob]}>
          <Ionicons name="checkmark" size={30} color={C.onAccent} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ── Rest: a full-screen ring, and what's next ──────────────────────────

function RestView({ endAt, total, next }: { endAt: number; total: number; next?: Step }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 80, 300);
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [now, setNow] = useState(() => Date.now());
  const [go, setGo] = useState(false);
  const left = Math.max(0, endAt - now);

  const progress = useSharedValue(Math.min(1, left / total));
  useEffect(() => {
    const rest = Math.max(0, endAt - Date.now());
    progress.value = Math.min(1, rest / total);
    progress.value = withTiming(0, { duration: rest, easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [endAt, total, progress]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  // Time's up: a soft chime, a green flash, then the next set slides in.
  const ended = useRef(false);
  useEffect(() => {
    if (left > 0 || ended.current) return;
    ended.current = true;
    sound.play('rest');
    haptic.success();
    setGo(true);
    const t = setTimeout(() => {
      // Only clear our own break (a new one may have started).
      if (getRest()?.endAt === endAt) setRest(null);
    }, 900);
    return () => clearTimeout(t);
  }, [left, endAt]);

  const ring = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - progress.value) }));
  const last = left > 0 && left <= 3500;
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = last
      ? withRepeat(withSequence(withTiming(1.08, { duration: 180 }), withTiming(1, { duration: 320 })), -1)
      : withTiming(1);
  }, [last, pulse]);
  const timeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const skip = () => setRest(null);

  const nx = next;
  const nextLine = nx ? describeNext(nx) : '';

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.inner, styles.restWrap]}>
      <Text style={styles.restLabel}>{go ? 'Go' : 'Rest'}</Text>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.border} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={go ? C.good : last ? C.accent : '#1E9DB3'}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            animatedProps={ring}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        {go ? (
          <Animated.View entering={ZoomIn.springify()}>
            <Ionicons name="flash" size={72} color={C.good} />
          </Animated.View>
        ) : (
          <Animated.Text
            style={[styles.restTime, last && { color: C.accent }, timeStyle]}
            accessibilityLabel="Rest time left">
            {fmtDuration(left)}
          </Animated.Text>
        )}
      </View>
      <View style={styles.restButtons}>
        <Pressable onPress={() => adjustRest(-15000)} accessibilityLabel="15 seconds less" style={styles.restButton}>
          <Text style={styles.restButtonText}>−15</Text>
        </Pressable>
        <Pressable onPress={skip} accessibilityLabel="Skip rest" style={[styles.restButton, styles.restSkip]}>
          <Text style={[styles.restButtonText, { color: C.onAccent }]}>Skip</Text>
        </Pressable>
        <Pressable onPress={() => adjustRest(15000)} accessibilityLabel="15 seconds more" style={styles.restButton}>
          <Text style={styles.restButtonText}>+15</Text>
        </Pressable>
      </View>
      {nx ? (
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.upNext}>
          <ExerciseImage name={nx.ex.name} equipment={nx.ex.equipment} size={40} radius={9} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.upNextLabel}>Up next</Text>
            <Text style={styles.upNextName} numberOfLines={1}>
              {nx.ex.name}
            </Text>
            <Text style={styles.faint} numberOfLines={1}>
              Set {nx.setIndex + 1} {nextLine && nextLine !== '—' ? `· ${nextLine}` : ''}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** "62.5 kg × 8" for the up-next card: saved values, else last time, else the set before. */
function describeNext({ ex, set, setIndex }: Step) {
  const pick = (k: 'weight' | 'reps' | 'seconds' | 'distance') =>
    [set[k], ex.previous[setIndex]?.[k], ex.sets[setIndex - 1]?.[k]].find((v) => v != null) ?? null;
  return ex.track !== 'weight_reps'
    ? fmtCardio(pick('seconds'), pick('distance'), ex.track === 'time_floors')
    : fmtSet(pick('weight'), pick('reps'));
}

// ── Every set done ──────────────────────────────────────────────────────

function AllDone({ detail, onAddSet, onClose }: { detail: WorkoutDetail; onAddSet: () => void; onClose: () => void }) {
  const sets = detail.exercises.flatMap((e) => e.sets).filter((s) => s.done);
  const volume = sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.inner, styles.center, { gap: S.lg }]}>
      <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.doneBadge}>
        <Ionicons name="checkmark" size={56} color={C.onAccent} />
      </Animated.View>
      <Text style={styles.doneTitle}>Every set done</Text>
      <View style={styles.doneStats}>
        <DoneStat value={String(sets.length)} label="sets" />
        <DoneStat value={volume ? fmtVolume(volume) : '–'} label="volume" />
        <DoneStat value={<Elapsed since={detail.workout.started_at} style={styles.doneStatValue} />} label="time" />
      </View>
      <View style={{ width: '100%', gap: S.sm, marginTop: S.md }}>
        <Pressable
          onPress={() => {
            requestFinish();
            onClose();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.finishButton, pressed && { opacity: 0.85 }]}>
          <Ionicons name="flag" size={18} color={C.onAccent} />
          <Text style={styles.finishText}>Finish workout</Text>
        </Pressable>
        <Pressable onPress={onAddSet} accessibilityRole="button" style={styles.ghostButton}>
          <Text style={styles.ghostText}>One more set</Text>
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.ghostButton}>
          <Text style={styles.ghostText}>Back to the list</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function DoneStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      {typeof value === 'string' ? <Text style={styles.doneStatValue}>{value}</Text> : value}
      <Text style={styles.faint}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.backdrop },
  fill: { flex: 1, paddingHorizontal: S.xl },
  inner: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  faint: { color: C.textFaint, fontFamily: F.regular, fontSize: 13 },

  top: { gap: S.md, marginBottom: S.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  topTitle: { color: C.textDim, fontFamily: F.medium, fontSize: 13 },
  topTime: { color: C.text, fontFamily: F.displaySemi, fontSize: 16, fontVariant: ['tabular-nums'] },
  topCount: { color: C.textDim, fontFamily: F.semi, fontSize: 13, fontVariant: ['tabular-nums'] },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardHi,
  },
  roundButtonGhost: { minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6 },
  progressGroup: { flex: 1, flexDirection: 'row', gap: 2 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.border },
  segDone: { backgroundColor: C.good },
  segCurrent: { backgroundColor: C.accent, height: 7, marginTop: -1 },

  exHead: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  exName: { color: C.text, fontFamily: F.display, fontSize: 24, lineHeight: 28 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: 4 },
  setLabel: { color: C.text, fontFamily: F.semi, fontSize: 15 },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardHi,
  },
  kindChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  kindText: { fontFamily: F.semi, fontSize: 13 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: S.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.md,
    backgroundColor: 'rgba(233,190,88,0.08)',
  },
  noteText: { color: C.text, fontFamily: F.regular, fontSize: 13, flex: 1 },

  numbers: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginTop: S.xl },
  times: { color: C.textFaint, fontFamily: F.display, fontSize: 40, marginTop: 64, marginHorizontal: 2 },
  big: { flex: 1, alignItems: 'center' },
  bigTouch: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 24,
    ...(Platform.OS === 'web' ? ({ cursor: 'ns-resize', userSelect: 'none' } as object) : null),
  },
  bigGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 24,
    backgroundColor: C.accentDim,
  },
  bigValue: {
    color: C.text,
    fontFamily: F.display,
    fontSize: 84,
    height: 100,
    lineHeight: 100,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  bigLabel: { color: C.textDim, fontFamily: F.semi, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' },
  plateSlot: { height: 24, justifyContent: 'center' },
  steppers: { flexDirection: 'row', gap: S.md, marginTop: 4 },
  stepper: {
    width: 56,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardHi,
    borderWidth: 1,
    borderColor: C.border,
  },
  stepperPressed: { backgroundColor: C.accentDim, borderColor: C.accentLine },

  hints: { alignItems: 'center', gap: S.sm, marginTop: S.xl },
  ghost: { color: C.textDim, fontFamily: F.medium, fontSize: 14 },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(233,190,88,0.5)',
    backgroundColor: 'rgba(233,190,88,0.12)',
  },
  prText: { color: C.gold, fontFamily: F.semi, fontSize: 13 },
  almost: { color: C.gold, fontFamily: F.medium, fontSize: 13, opacity: 0.85 },

  slide: {
    height: 72,
    borderRadius: 36,
    padding: 4,
    justifyContent: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderHi,
    overflow: 'hidden',
  },
  slideTrail: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 36, backgroundColor: C.accentDim },
  slideText: {
    position: 'absolute',
    left: 72,
    right: 16,
    textAlign: 'center',
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 15,
  },
  knob: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
  },
  doneBox: { alignItems: 'center', gap: S.sm },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneText: { color: C.good, fontFamily: F.display, fontSize: 22 },

  restWrap: { alignItems: 'center', justifyContent: 'center', gap: S.xl },
  restLabel: { color: C.textDim, fontFamily: F.semi, fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' },
  restTime: { color: C.text, fontFamily: F.display, fontSize: 76, fontVariant: ['tabular-nums'] },
  restButtons: { flexDirection: 'row', gap: S.md },
  restButton: {
    minWidth: 76,
    height: 52,
    paddingHorizontal: S.lg,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardHi,
    borderWidth: 1,
    borderColor: C.border,
  },
  restSkip: { backgroundColor: C.accent, borderColor: C.accent, minWidth: 96 },
  restButtonText: { color: C.text, fontFamily: F.semi, fontSize: 16 },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    alignSelf: 'stretch',
    padding: S.md,
    borderRadius: R.lg,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  upNextLabel: { color: C.accent, fontFamily: F.semi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  upNextName: { color: C.text, fontFamily: F.semi, fontSize: 16 },

  doneBadge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.good,
  },
  doneTitle: { color: C.text, fontFamily: F.display, fontSize: 30 },
  doneStats: { flexDirection: 'row', alignSelf: 'stretch' },
  doneStatValue: { color: C.text, fontFamily: F.display, fontSize: 22, fontVariant: ['tabular-nums'] },
  finishButton: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    gap: S.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
  },
  finishText: { color: C.onAccent, fontFamily: F.semi, fontSize: 17 },
  ghostButton: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  ghostText: { color: C.textDim, fontFamily: F.semi, fontSize: 15 },
});
