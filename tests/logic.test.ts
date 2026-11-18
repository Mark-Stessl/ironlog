// Run with: npm test
// Tests search suggestions and the workout database logic against a real SQLite
// database (Node's built-in one), using the same code the app runs.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import * as dbm from '../src/lib/db';
import { SEED_EXERCISES } from '../src/lib/exercise-data';
import { est1RM, fmtDuration, fmtSet, parseNum } from '../src/lib/format';
import { searchExercises, type Searchable } from '../src/lib/search';

// Minimal stand-in for the expo-sqlite database object.
function fakeDb(): any {
  const raw = new DatabaseSync(':memory:');
  const args = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  return {
    execAsync: async (sql: string) => void raw.exec(sql),
    runAsync: async (sql: string, ...p: any[]) => {
      const r = raw.prepare(sql).run(...args(p));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getFirstAsync: async (sql: string, ...p: any[]) => raw.prepare(sql).get(...args(p)) ?? null,
    getAllAsync: async (sql: string, ...p: any[]) => raw.prepare(sql).all(...args(p)),
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

const lib: Searchable[] = SEED_EXERCISES.map(([name, muscle, equipment, aliases], i) => ({
  id: i + 1, name, muscle, equipment, aliases, use_count: 0,
}));
const names = (q: string, f?: any, all = lib) => searchExercises(q, all, f).map((e) => e.name);

test('seed data has unique names and valid categories', async () => {
  const { MUSCLES, EQUIPMENT } = await import('../src/lib/exercise-data');
  assert.equal(new Set(SEED_EXERCISES.map((e) => e[0].toLowerCase())).size, SEED_EXERCISES.length);
  for (const [name, muscle, equipment] of SEED_EXERCISES) {
    assert.ok((MUSCLES as readonly string[]).includes(muscle), `${name}: ${muscle}`);
    assert.ok((EQUIPMENT as readonly string[]).includes(equipment), `${name}: ${equipment}`);
  }
});

test('search: typing "che" suggests chest machines first', () => {
  const r = names('che');
  assert.equal(r[0], 'Chest Dip');
  assert.ok(r.includes('Chest Press (Machine)'));
  assert.ok(r.includes('Pec Deck'), 'muscle match brings in Pec Deck');
  assert.ok(r.includes('Cable Crossover'));
});

test('search: by muscle, body area and German names', () => {
  assert.ok(names('back').includes('Lat Pulldown'));
  assert.ok(names('legs').includes('Leg Press'));
  assert.ok(names('legs').includes('Seated Leg Curl'));
  assert.equal(names('beinpresse')[0], 'Leg Press');
  assert.ok(names('latzug').slice(0, 3).includes('Lat Pulldown'));
  assert.ok(names('butterfly').includes('Pec Deck'));
  assert.ok(names('rücken').includes('Seated Cable Row'));
});

test('search: multiple words, typos, filters, no match', () => {
  assert.equal(names('leg pres')[0], 'Leg Press');
  assert.equal(names('shoulder press machine')[0], 'Shoulder Press (Machine)');
  assert.ok(names('pulldwon').includes('Lat Pulldown'), 'typo tolerated');
  assert.ok(names('', { muscle: 'Calves' }).every((n) => /Calf/.test(n)));
  assert.ok(names('press', { equipment: 'Machine' }).every((n) => !/Barbell|Dumbbell/.test(n)));
  assert.deepEqual(names('xyzxyz'), []);
});

test('search: exercises you use often move up', () => {
  const used = lib.map((e) => (e.name === 'Incline Chest Press (Machine)' ? { ...e, use_count: 12 } : e));
  assert.equal(names('chest', undefined, used)[0], 'Incline Chest Press (Machine)');
  assert.equal(names('', undefined, used)[0], 'Incline Chest Press (Machine)');
});

test('format helpers', () => {
  assert.equal(parseNum('62,5'), 62.5);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('abc'), null);
  assert.equal(est1RM(100, 1), 100);
  assert.equal(est1RM(60, 10), 80);
  assert.equal(fmtSet(60, 8), '60 kg × 8');
  assert.equal(fmtSet(null, 12), '12 reps');
  assert.equal(fmtDuration(75_000), '1:15');
  assert.equal(fmtDuration(3_725_000), '1:02:05');
});

test('database: full workout flow', async (t) => {
  // Freeze the clock so both workouts finish in the same millisecond (the hardest case for ordering).
  t.mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 });
  const db = fakeDb();
  await dbm.migrate(db);
  await dbm.migrate(db); // running twice must be harmless
  const all = await dbm.listExercises(db);
  assert.equal(all.length, SEED_EXERCISES.length);
  const press = all.find((e) => e.name === 'Chest Press (Machine)')!;
  const row = all.find((e) => e.name === 'Seated Cable Row')!;

  // Workout 1: 2 sets of chest press, one row set left unticked.
  const w1 = await dbm.startWorkout(db);
  assert.equal((await dbm.getActiveWorkout(db))!.id, w1);
  await dbm.addExerciseToWorkout(db, w1, press.id);
  await dbm.addExerciseToWorkout(db, w1, row.id);
  let d = (await dbm.getWorkoutDetail(db, w1))!;
  assert.equal(d.exercises.length, 2);
  assert.equal(d.exercises[0].sets.length, 1);
  assert.deepEqual(d.exercises[0].previous, []);
  await dbm.updateSet(db, d.exercises[0].sets[0].id, { weight: 60, reps: 8, done: true });
  await dbm.addSet(db, d.exercises[0].id);
  d = (await dbm.getWorkoutDetail(db, w1))!;
  assert.equal(d.exercises[0].sets[1].weight, 60, 'new set copies the one above');
  assert.equal(d.exercises[0].sets[1].done, 0);
  await dbm.updateSet(db, d.exercises[0].sets[1].id, { weight: 62.5, reps: 6, done: true });
  assert.equal(await dbm.finishWorkout(db, w1), true);
  assert.equal(await dbm.getActiveWorkout(db), null);

  d = (await dbm.getWorkoutDetail(db, w1))!;
  assert.equal(d.exercises.length, 1, 'exercise without ticked sets is dropped');
  assert.equal(d.exercises[0].sets.length, 2);

  const hist = await dbm.listFinishedWorkouts(db);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].set_count, 2);
  assert.equal(hist[0].volume, 60 * 8 + 62.5 * 6);
  assert.equal(hist[0].exercise_names, 'Chest Press (Machine)');

  // Save as routine, start it: sets pre-created, "previous" shows last time.
  const r = await dbm.saveWorkoutAsRoutine(db, w1);
  const routine = (await dbm.getRoutine(db, r))!;
  assert.equal(routine.exercises.length, 1);
  assert.equal(routine.exercises[0].target_sets, 2);
  assert.equal((await dbm.listRoutines(db))[0].exercise_names, 'Chest Press (Machine)');

  const w2 = await dbm.startWorkout(db, r);
  d = (await dbm.getWorkoutDetail(db, w2))!;
  assert.equal(d.workout.name, hist[0].name);
  assert.equal(d.exercises[0].sets.length, 2);
  assert.deepEqual(d.exercises[0].previous.map((p) => ({ ...p })), [
    { weight: 60, reps: 8 },
    { weight: 62.5, reps: 6 },
  ]);
  assert.equal(d.exercises[0].best.weight, 62.5);
  assert.equal(d.exercises[0].best.repsAtWeight, 6);
  assert.equal(d.exercises[0].best.sessions, 1);
  await dbm.updateSet(db, d.exercises[0].sets[0].id, { weight: 65, reps: 5, done: true });
  await dbm.finishWorkout(db, w2);

  // Records and usage count.
  const sessions = await dbm.getExerciseHistory(db, press.id);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].workout_id, w2, 'newest first');
  const rec = dbm.computeRecords(sessions);
  assert.equal(rec.bestWeight!.weight, 65);
  assert.equal(rec.best1RM!.value, est1RM(60, 8));
  assert.equal(rec.bestVolume!.value, 60 * 8 + 62.5 * 6);
  assert.equal((await dbm.getExercise(db, press.id))!.use_count, 2);

  // Empty workout is thrown away on finish.
  const w3 = await dbm.startWorkout(db);
  await dbm.addExerciseToWorkout(db, w3, row.id);
  assert.equal(await dbm.finishWorkout(db, w3), false);
  assert.equal(await dbm.getWorkoutDetail(db, w3), null);

  // Deleting a workout removes its sets (cascade) and the routine survives.
  await dbm.deleteWorkout(db, w1);
  assert.equal((await dbm.getExerciseHistory(db, press.id)).length, 1);
  assert.ok(await dbm.getRoutine(db, r));

  // Custom exercise, duplicate names reuse the existing one.
  const c1 = await dbm.createExercise(db, 'Hammer Strength Row', 'Back', 'Machine', ['Biceps', 'Back', 'Forearms']);
  const custom = (await dbm.getExercise(db, c1))!;
  assert.equal(custom.is_custom, 1);
  assert.equal(custom.secondary, 'Biceps,Forearms', 'primary muscle is not repeated as secondary');
  const c2 = await dbm.createExercise(db, 'hammer strength row ', 'Back', 'Machine');
  assert.equal(c1, c2);

  // Routine editing + settings.
  await dbm.addExerciseToRoutine(db, r, c1);
  let re = (await dbm.getRoutine(db, r))!.exercises;
  assert.equal(re.length, 2);
  await dbm.setRoutineExerciseSets(db, re[1].id, 0);
  re = (await dbm.getRoutine(db, r))!.exercises;
  assert.equal(re[1].target_sets, 1, 'never below 1 set');
  await dbm.removeRoutineExercise(db, re[1].id);
  await dbm.deleteRoutine(db, r);
  assert.equal(await dbm.getRoutine(db, r), null);
  assert.equal(await dbm.getSetting(db, 'rest_seconds', '90'), '90');
  await dbm.setSetting(db, 'rest_seconds', '120');
  await dbm.setSetting(db, 'rest_seconds', '150');
  assert.equal(await dbm.getSetting(db, 'rest_seconds', '90'), '150');
});

test('exercise media: every entry belongs to a built-in exercise and is complete', async () => {
  const { getMedia, formVideoUrl, imageUrl } = await import('../src/lib/exercise-media');
  const names = new Set(SEED_EXERCISES.map((e) => e[0]));
  const media = (await import('../src/lib/exercise-media.json')).default as Record<string, any>;
  for (const [name, m] of Object.entries(media)) {
    assert.ok(names.has(name), `media for unknown exercise ${name}`);
    assert.ok(m.frames.length >= 1 && m.frames.length <= 2, name);
    assert.ok(m.steps.length >= 2, name);
  }
  assert.ok(Object.keys(media).length >= 95);
  assert.equal(getMedia('Leg Press')!.frames.length, 2);
  assert.equal(getMedia('My Custom Thing'), null);
  assert.equal(imageUrl('leg-press-start.webp'), 'https://exercise-dataset.com/images/flat/leg-press-start.webp');
  assert.ok(formVideoUrl('Chest Press (Machine)').endsWith('Chest%20Press%20Machine%20proper%20form%20tutorial'));
});

test('records: weight, rep and 1RM PRs, checked set by set', async () => {
  const { addToBest, findPR, findPRs, markPRs, currentPRs, NO_BEST } = await import('../src/lib/records');
  let base = NO_BEST;
  for (const s of [{ weight: 60, reps: 8 }, { weight: 60, reps: 10 }, { weight: 50, reps: 12 }]) base = addToBest(base, s);
  base = { ...base, sessions: 1 };
  assert.deepEqual({ ...base }, { weight: 60, repsAtWeight: 10, e1rm: 80, sessions: 1 });

  assert.equal(findPR({ weight: 62.5, reps: 5 }, base)?.kind, 'weight');
  assert.equal(findPR({ weight: 60, reps: 11 }, base)?.kind, 'reps');
  assert.equal(findPR({ weight: 55, reps: 20 }, base)?.kind, 'e1rm'); // 55 x 20 = 91.7 est. 1RM
  assert.equal(findPR({ weight: 60, reps: 10 }, base), null, 'matching is not beating');
  assert.equal(findPR({ weight: 40, reps: 5 }, base), null);
  assert.equal(findPR({ weight: 100, reps: 1 }, NO_BEST), null, 'first time ever is not a record');
  assert.equal(findPR({ weight: 70, reps: 0 }, base), null, 'no reps, no record');

  // Bodyweight: only reps count.
  const bw = { ...addToBest(NO_BEST, { weight: 0, reps: 12 }), sessions: 1 };
  assert.equal(findPR({ weight: null, reps: 15 }, bw)?.kind, 'reps');
  assert.equal(findPR({ weight: null, reps: 12 }, bw), null);

  // In one workout each set must beat everything before it, unticked sets never count.
  const flags = markPRs(
    [
      { weight: 65, reps: 5, done: 1 }, // weight PR (1RM 75.8 is below 80)
      { weight: 65, reps: 5, done: 1 }, // same again: no PR
      { weight: 65, reps: 6, done: 1 }, // more reps at the new top weight: PR
      { weight: 80, reps: 5, done: 0 }, // not done
    ],
    base,
  );
  assert.deepEqual(flags.map((f) => f.map((p) => p.kind)), [['weight'], [], ['reps'], []]);

  // One set can beat several records at once.
  assert.deepEqual(findPRs({ weight: 62.5, reps: 10 }, base).map((p) => p.kind), ['weight', 'e1rm']);
  assert.deepEqual(findPRs({ weight: 60, reps: 12 }, base).map((p) => p.kind), ['reps', 'e1rm']);

  // Only the newest set keeps a record that was beaten again later in the workout.
  const sets = [
    { weight: 65, reps: 5, done: 1 }, // weight + 1RM record
    { weight: 70, reps: 5, done: 1 }, // beats both again
    { weight: 70, reps: 3, done: 1 }, // nothing
  ];
  assert.deepEqual(currentPRs(sets, base).map((f) => f.map((p) => p.kind)), [[], ['weight', 'e1rm'], []]);
  const mixed = [
    { weight: 65, reps: 5, done: 1 }, // weight + 1RM
    { weight: 65, reps: 8, done: 1 }, // reps at 65 + better 1RM
  ];
  assert.deepEqual(currentPRs(mixed, base).map((f) => f.map((p) => p.kind)), [['weight'], ['reps', 'e1rm']]);
});

test('routine diff: added, removed, set counts, order', async () => {
  const { diffRoutine, hasChanges, describeDiff } = await import('../src/lib/routine-diff');
  const plan = [
    { exercise_id: 1, name: 'Chest Press', sets: 3 },
    { exercise_id: 2, name: 'Pec Deck', sets: 3 },
    { exercise_id: 3, name: 'Tricep Pushdown', sets: 3 },
  ];
  assert.equal(hasChanges(diffRoutine(plan, plan)), false);
  const d = diffRoutine(plan, [
    { exercise_id: 1, name: 'Chest Press', sets: 4 },
    { exercise_id: 3, name: 'Tricep Pushdown', sets: 3 },
    { exercise_id: 9, name: 'Lat Pulldown', sets: 2 },
  ]);
  assert.deepEqual(d.added, ['Lat Pulldown']);
  assert.deepEqual(d.removed, ['Pec Deck']);
  assert.deepEqual(d.sets, [{ name: 'Chest Press', from: 3, to: 4 }]);
  assert.equal(d.reordered, false);
  assert.deepEqual(describeDiff(d).map((l) => l.text), ['Added Lat Pulldown', 'Removed Pec Deck', 'Chest Press: 3 → 4 sets']);
  const swapped = diffRoutine(plan, [plan[1], plan[0], plan[2]]);
  assert.equal(swapped.reordered, true);
  assert.equal(hasChanges(swapped), true);
});

test('database: update a routine from a workout, or save a copy', async () => {
  const db = fakeDb();
  await dbm.migrate(db);
  const all = await dbm.listExercises(db);
  const a = all.find((e) => e.name === 'Leg Press')!;
  const b = all.find((e) => e.name === 'Leg Extension')!;
  const c = all.find((e) => e.name === 'Seated Leg Curl')!;
  const r = await dbm.createRoutine(db, 'Leg day');
  await dbm.addExerciseToRoutine(db, r, a.id);
  await dbm.addExerciseToRoutine(db, r, b.id);
  const w = await dbm.startWorkout(db, r); // 3 + 3 empty sets
  let d = (await dbm.getWorkoutDetail(db, w))!;
  assert.equal(d.workout.routine_id, r);
  for (const s of d.exercises[0].sets) await dbm.updateSet(db, s.id, { weight: 100, reps: 10, done: true });
  await dbm.addExerciseToWorkout(db, w, c.id);
  d = (await dbm.getWorkoutDetail(db, w))!;
  await dbm.updateSet(db, d.exercises[2].sets[0].id, { weight: 30, reps: 12, done: true });
  await dbm.finishWorkout(db, w); // Leg Extension had no ticked sets -> dropped

  const plan = await dbm.workoutPlan(db, w);
  assert.deepEqual(plan.map((p) => [p.name, p.sets]), [['Leg Press', 3], ['Seated Leg Curl', 1]]);

  assert.equal(await dbm.freeRoutineName(db, 'Leg day'), 'Leg day 2');
  const copy = await dbm.saveWorkoutAsRoutine(db, w, await dbm.freeRoutineName(db, 'Leg day'));
  assert.equal((await dbm.getRoutine(db, copy))!.routine.name, 'Leg day 2');
  assert.equal(await dbm.freeRoutineName(db, 'Leg day'), 'Leg day 3');

  await dbm.updateRoutineFromWorkout(db, r, w);
  const updated = (await dbm.getRoutine(db, r))!;
  assert.equal(updated.routine.name, 'Leg day');
  assert.deepEqual(updated.exercises.map((e) => [e.name, e.target_sets]), [['Leg Press', 3], ['Seated Leg Curl', 1]]);
});

test('body map: detailed muscles for built-in exercises, groups for custom ones', async () => {
  const { musclesFor } = await import('../src/lib/muscles');
  const media = (await import('../src/lib/exercise-media.json')).default as Record<string, any>;
  // Every detailed muscle in the data must be drawable.
  const known = new Set(['abductors','adductors','anterior_deltoid','biceps_brachii','brachialis','brachioradialis','erector_spinae','forearm_extensors','forearm_flexors','forearms','gastrocnemius','gluteus_maximus','gluteus_medius','hamstrings','hip_flexors','infraspinatus_teres_minor','lateral_deltoid','latissimus_dorsi','obliques','pectoralis_major','posterior_deltoid','quadratus_lumborum','quadriceps','rectus_abdominis','rhomboids','serratus_anterior','soleus','supraspinatus','tibialis_anterior','transverse_abdominis','trapezius','triceps_brachii']);
  for (const [name, m] of Object.entries(media)) {
    for (const mus of [...m.primary, ...m.secondary]) assert.ok(known.has(mus), `${name}: ${mus}`);
    assert.ok(musclesFor({ name, muscle: 'Chest' }).primary.length > 0, `${name} has primary muscles`);
  }

  const lat = musclesFor({ name: 'Lat Pulldown', muscle: 'Back' });
  assert.deepEqual(lat.primary, ['lats']);
  assert.ok(lat.secondary.includes('biceps'));
  assert.deepEqual(lat.primaryLabels, ['Lats']);

  const custom = musclesFor({ name: 'My Gym Row', muscle: 'Back', secondary: 'Biceps,Back,Nonsense' });
  assert.deepEqual(custom.primary, ['lats', 'upperBack', 'traps']);
  assert.deepEqual(custom.secondary, ['biceps']);
  assert.deepEqual(custom.secondaryLabels, ['Biceps']);
});

test('muscle stats: sets per group and area, primary 1 and secondary 0.5', async () => {
  const { muscleStats, heat, topRegions, periodRange } = await import('../src/lib/stats');
  const set = (name: string, muscle: string, workout_id = 1, secondary = '') => ({ name, muscle, secondary, weight: 50, reps: 10, workout_id });
  const st = muscleStats([
    set('Lat Pulldown', 'Back'), // lats 1; biceps, rear delts, upper back 0.5
    set('Lat Pulldown', 'Back'),
    set('Chest Press (Machine)', 'Chest', 2),
    set('My Row', 'Back', 2, 'Biceps'), // custom: back areas 1, biceps 0.5
  ]);
  assert.equal(st.sets, 4);
  assert.equal(st.workouts, 2);
  assert.equal(st.volume, 2000);
  assert.equal(st.groups.Back, 3, 'back counted once per set even though several back areas are hit');
  assert.equal(st.groups.Arms, 2, 'biceps 0.5 + 0.5 + 0.5 (rows) and triceps 0.5 (chest press)');
  assert.equal(st.groups.Legs, 0);
  assert.equal(st.regions.lats, 3);
  assert.equal(st.regions.biceps, 1.5);
  assert.equal(heat(st.regions).lats, 1);
  assert.equal(topRegions(st.regions, 1)[0].region, 'lats');
  assert.deepEqual(heat({}), {});

  const r = periodRange('month', new Date(2026, 10, 18, 15, 0));
  assert.equal(new Date(r.from).getDate(), 1);
  assert.equal(new Date(r.prevFrom).getMonth(), 9);
  const w = periodRange('week', new Date(2026, 10, 18, 15, 0)); // a Wednesday
  assert.equal(new Date(w.from).getDay(), 1);
});

test('database: stat sets for a period and a single workout', async () => {
  const db = fakeDb();
  await dbm.migrate(db);
  const lp = (await dbm.listExercises(db)).find((e) => e.name === 'Leg Press')!;
  const w = await dbm.startWorkout(db);
  await dbm.addExerciseToWorkout(db, w, lp.id);
  let d = (await dbm.getWorkoutDetail(db, w))!;
  await dbm.updateSet(db, d.exercises[0].sets[0].id, { weight: 100, reps: 10, done: true });
  await dbm.addSet(db, d.exercises[0].id); // left unticked
  await dbm.finishWorkout(db, w);
  const sets = await dbm.statSets(db, 0, Date.now() + 1000);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].name, 'Leg Press');
  assert.equal((await dbm.statSets(db, 0, Date.now() + 1000, w)).length, 1);
  assert.equal((await dbm.statSets(db, 0, Date.now() + 1000, w + 99)).length, 0);
  assert.equal((await dbm.statSets(db, Date.now() + 5000, Date.now() + 9000)).length, 0);
  assert.ok((await dbm.trainingTime(db, 0, Date.now() + 1000)) >= 0);
});

test('calendar: month grid, day keys and streak with rest days', async () => {
  const { monthGrid, dayKey, dayStreak } = await import('../src/lib/calendar');
  const nov = monthGrid(2026, 10); // November 2026 starts on a Sunday
  assert.deepEqual(nov[0].slice(5), [null, '2026-11-01']);
  assert.equal(nov.flat().filter(Boolean).length, 30);
  assert.equal(nov.every((w) => w.length === 7), true);
  const now = new Date(2026, 10, 18, 15).getTime();
  assert.equal(dayKey(now), '2026-11-18');
  // Trained 16th, rest 17th, today (18th) not done yet: streak still 2.
  assert.equal(dayStreak(new Set(['2026-11-16', '2026-11-17']), now), 2);
  assert.equal(dayStreak(new Set(['2026-11-16', '2026-11-17', '2026-11-18']), now), 3);
  assert.equal(dayStreak(new Set(['2026-11-15']), now), 0);
});

test('database: rest days, measurements and profile totals', async () => {
  const db = fakeDb();
  await dbm.migrate(db);
  await dbm.setRestDay(db, '2026-11-17', true);
  await dbm.setRestDay(db, '2026-11-17', true); // twice is harmless
  assert.deepEqual(await dbm.listRestDays(db), ['2026-11-17']);
  await dbm.setRestDay(db, '2026-11-17', false);
  assert.deepEqual(await dbm.listRestDays(db), []);

  await dbm.addMeasurement(db, 'weight', 82.4, 1000);
  await dbm.addMeasurement(db, 'weight', 81.9, 2000);
  await dbm.addMeasurement(db, 'waist', 84, 1500);
  const w = await dbm.listMeasurements(db, 'weight');
  assert.deepEqual(w.map((m) => m.value), [82.4, 81.9]);
  const latest = await dbm.latestMeasurements(db);
  assert.equal(latest.weight.value, 81.9);
  assert.equal(latest.weight.prev, 82.4);
  assert.equal(latest.waist.prev, null);
  await dbm.deleteMeasurement(db, w[1].id);
  assert.equal((await dbm.latestMeasurements(db)).weight.value, 82.4);

  assert.deepEqual(await dbm.profileTotals(db), { workouts: 0, first: null, sets: 0, volume: 0 });
  const lp = (await dbm.listExercises(db)).find((e) => e.name === 'Leg Press')!;
  const id = await dbm.startWorkout(db);
  await dbm.addExerciseToWorkout(db, id, lp.id);
  const d = (await dbm.getWorkoutDetail(db, id))!;
  await dbm.updateSet(db, d.exercises[0].sets[0].id, { weight: 100, reps: 10, done: true });
  await dbm.finishWorkout(db, id);
  const totals = await dbm.profileTotals(db);
  assert.equal(totals.workouts, 1);
  assert.equal(totals.sets, 1);
  assert.equal(totals.volume, 1000);
  assert.ok(totals.first);
  assert.equal((await dbm.workoutsBetween(db, 0, Date.now() + 1000)).length, 1);
});

test('measures: formatting and typo check', async () => {
  const { fmtMeasure, fmtChange, validMeasure } = await import('../src/lib/measures');
  assert.equal(fmtMeasure(82.44, 'kg'), '82.4 kg');
  assert.equal(fmtMeasure(38, 'cm'), '38 cm');
  assert.equal(fmtChange(-0.5, 'kg'), '−0.5 kg');
  assert.equal(fmtChange(0.02, 'kg'), 'No change');
  assert.equal(validMeasure(824, 'kg'), false);
  assert.equal(validMeasure(82.4, 'kg'), true);
});

test('food data: BLS foods and recipes are complete and plausible', async () => {
  const { BUILTIN_FOODS, BUILTIN_RECIPES } = await import('../src/lib/foods');
  const { kcalFromMacros } = await import('../src/lib/nutrition');
  assert.ok(BUILTIN_FOODS.length >= 140);
  assert.ok(BUILTIN_FOODS.every((f) => f.source === 'bls')); // German national database only
  for (const f of BUILTIN_FOODS) {
    for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) assert.ok(f.per100[k] != null, `${f.name} ${k}`);
    assert.ok(f.servings.length > 0 && f.servings[0].g > 0, `${f.name} serving`);
  }
  // Atwater check: energy matches protein/carbs/fat within 20 % (skips drinks with alcohol and near-zero foods).
  for (const f of BUILTIN_FOODS.filter((x) => (x.per100.kcal ?? 0) > 40 && !/wine|vinegar/i.test(x.name))) {
    // Carbs exclude fibre (EU convention, as in BLS); fibre counts 2 kcal/g.
    const est = kcalFromMacros(f.per100) + (f.per100.fiber ?? 0) * 2;
    assert.ok(Math.abs(est - f.per100.kcal!) / f.per100.kcal! < 0.2, `${f.name}: ${f.per100.kcal} vs ${est}`);
  }
  const meals = new Set(BUILTIN_RECIPES.map((r) => r.recipe!.meal));
  assert.deepEqual([...meals].sort(), ['breakfast', 'dinner', 'lunch', 'snack']);
  for (const r of BUILTIN_RECIPES) {
    const kcal = (r.per100.kcal! * r.servings[0].g) / 100;
    assert.ok(kcal > 150 && kcal < 1100, `${r.name}: ${kcal} kcal`);
  }
  const shake = BUILTIN_RECIPES.find((r) => r.ref === 'r:protein-shake')!;
  const protein = (shake.per100.protein! * shake.servings[0].g) / 100;
  assert.ok(protein > 28 && protein < 40, `shake protein ${protein}`); // 200 g skyr + 250 g milk + banana
});

test('food search: German names, recipes by ingredient, typos', async () => {
  const { BUILTIN_FOODS, BUILTIN_RECIPES, searchFoods } = await import('../src/lib/foods');
  const all = [...BUILTIN_RECIPES, ...BUILTIN_FOODS];
  const top = (q: string, n = 3) => searchFoods(q, all).slice(0, n).map((f) => f.name);
  assert.equal(top('banane')[0], 'Banana');
  assert.equal(top('haferflocken')[0], 'Rolled oats');
  assert.ok(top('chicken', 10).includes('Chicken, rice and broccoli bowl'));
  assert.equal(top('paradeiser')[0], 'Tomato');
  assert.equal(top('brokoli')[0], 'Broccoli');
  assert.ok(searchFoods('lachs', all).some((f) => f.name === 'Salmon with potatoes and asparagus'));
});

test('nutrition goals: EU reference without profile, Henry x PAL with one', async () => {
  const { computeGoals, restingEnergy, EU_REFERENCE } = await import('../src/lib/nutrition');
  const eu = computeGoals(null);
  assert.equal(eu.kcal, 2000);
  assert.equal(eu.protein, 50);
  assert.equal(eu.waterMl, 2000);
  assert.equal(EU_REFERENCE.salt, 6);
  // Man, 25, 180 cm, 80 kg: 14.4*80 + 3.13*180 + 113 = 1828.4
  assert.equal(Math.round(restingEnergy({ sex: 'male', age: 25, heightCm: 180, weightKg: 80 })), 1828);
  const g = computeGoals({ sex: 'male', age: 25, heightCm: 180, weightKg: 80, pal: 1.6, aim: 'maintain', proteinPerKg: 1.8 });
  assert.equal(g.kcal, 2930); // 1828.4 * 1.6 = 2925 -> rounded to 10
  assert.equal(g.protein, 144);
  assert.equal(g.fat, Math.round((2930 * 0.3) / 9));
  assert.ok(Math.abs(g.protein * 4 + g.carbs * 4 + g.fat * 9 - g.kcal) < 10);
  const carbsShare = (g.carbs * 4) / g.kcal;
  assert.ok(carbsShare >= 0.45 && carbsShare <= 0.6, `carbs ${carbsShare}`); // EFSA 45-60 %
  const w = computeGoals({ sex: 'female', age: 35, heightCm: 165, weightKg: 60, pal: 1.4, aim: 'lose', proteinPerKg: 1.6 });
  assert.equal(w.waterMl, 1600);
  assert.ok(w.kcal < 1800 && w.kcal > 1000);
});

test('open food facts: parsing per-100 g values and units', async () => {
  const { parseProduct, isBarcode } = await import('../src/lib/off');
  const p = parseProduct({
    code: '9001234567890',
    product_name: 'Joghurt Natur',
    brands: 'Ja! Natürlich, Rewe',
    serving_quantity: '150',
    serving_size: '1 Becher (150 g)',
    nutriments: {
      'energy-kj_100g': 268,
      proteins_100g: 3.4,
      carbohydrates_100g: 4.6,
      sugars_100g: 4.6,
      fat_100g: 3.6,
      'saturated-fat_100g': 2.3,
      sodium_100g: 0.04,
      calcium_100g: 0.12,
      'vitamin-d_100g': 0.0000001,
    },
  })!;
  assert.equal(p.brand, 'Ja! Natürlich');
  assert.equal(p.per100.kcal, 64.1); // 268 kJ / 4.184
  assert.equal(p.per100.salt, 0.1); // sodium x 2.5
  assert.equal(p.per100.calcium, 120); // g -> mg
  assert.equal(p.per100.vitD, 0.1); // g -> µg
  assert.equal(p.servingG, 150);
  assert.equal(p.incomplete, false);
  assert.equal(parseProduct({ code: '1', product_name: '' }), null);
  assert.equal(parseProduct({ code: '4000000000000', product_name: 'X', nutriments: {} })!.incomplete, true);
  assert.ok(isBarcode('9001234567890') && isBarcode('40084107') && !isBarcode('12ab') && !isBarcode('123'));
});

test('database: food log, water, own foods, products and recipes', async () => {
  const fdb = await import('../src/lib/food-db');
  const db = fakeDb();
  await dbm.migrate(db);
  const items = await fdb.allFoodItems(db);
  const banana = items.find((f) => f.ref === 'f:banana')!;
  const porridge = items.find((f) => f.ref === 'r:protein-porridge')!;
  await fdb.logFood(db, { day: '2026-11-18', meal: 'breakfast', item: porridge, grams: porridge.servings[0].g, amount: '1 serving' });
  const id = await fdb.logFood(db, { day: '2026-11-18', meal: 'snack', item: banana, grams: 118, amount: '1 medium' });
  await fdb.logFood(db, { day: '2026-11-17', meal: 'snack', item: banana, grams: 118, amount: '1 medium' });
  const log = await fdb.dayLog(db, '2026-11-18');
  assert.equal(log.length, 2);
  const bananaKcal = (banana.per100.kcal! * 118) / 100;
  assert.ok(Math.abs(log[1].n.kcal! - bananaKcal) < 0.01);
  await fdb.updateLogAmount(db, id, banana, 236, '2 × 1 medium');
  const totals = await fdb.dailyTotals(db, '2026-11-17', '2026-11-18');
  assert.ok(Math.abs(totals.get('2026-11-17')!.kcal! - bananaKcal) < 0.01);
  assert.ok(totals.get('2026-11-18')!.kcal! > 500);
  assert.deepEqual(await fdb.recentRefs(db, 'snack'), ['f:banana']);
  assert.equal(await fdb.copyMeal(db, '2026-11-18', '2026-11-19', 'breakfast'), 1);
  await fdb.deleteLogEntry(db, id);
  assert.equal((await fdb.dayLog(db, '2026-11-18')).length, 1);

  await fdb.addWater(db, '2026-11-18', 250);
  await fdb.addWater(db, '2026-11-18', 500);
  assert.equal(await fdb.dayWater(db, '2026-11-18'), 750);
  await fdb.undoWater(db, '2026-11-18');
  assert.equal(await fdb.dayWater(db, '2026-11-18'), 250);

  // Scanned product: saved once, updated on the second scan.
  const product = { barcode: '9001234567890', name: 'Skyr', brand: 'Milfina', per100: { kcal: 63, protein: 11 }, servingG: 150, servingLabel: '1 cup', incomplete: false };
  const ref = await fdb.saveProduct(db, product);
  assert.equal(await fdb.saveProduct(db, { ...product, name: 'Skyr Natur' }), ref);
  const found = (await fdb.foodByBarcode(db, '9001234567890'))!;
  assert.equal(found.name, 'Skyr Natur');
  assert.equal(found.servings[0].g, 150);

  const own = await fdb.createCustomFood(db, { name: 'Mum’s Gulasch', brand: '', barcode: null, per100: { kcal: 150, protein: 12, carbs: 5, fat: 9 }, serving: { label: '1 plate', g: 350 } });
  const recipe = await fdb.createRecipe(db, {
    name: 'Gulasch with bread',
    meal: 'dinner',
    servings: 2,
    ingredients: [
      { item: (await fdb.getFoodItem(db, own))!, g: 700 },
      { item: banana, g: 0 },
      { item: (await fdb.getFoodItem(db, 'f:roll'))!, g: 100 },
    ],
    steps: 'Warm up\nServe',
  });
  const r = (await fdb.getFoodItem(db, recipe))!;
  assert.equal(r.servings[0].g, 400); // (700 + 100) / 2
  assert.equal(r.recipe!.steps.length, 2);
  const perServing = (r.per100.kcal! * r.servings[0].g) / 100;
  assert.ok(Math.abs(perServing - (1050 + 279) / 2) < 1, `${perServing}`);
  const all = await fdb.allFoodItems(db);
  assert.ok(all.some((f) => f.ref === recipe) && all.some((f) => f.ref === own));
  assert.equal(all.find((f) => f.ref === 'f:banana')!.useCount, 1);

  // Goals: stored profile and own numbers.
  assert.equal((await fdb.getGoals(db)).kcal, 2000);
  await fdb.setGoalSettings(db, { profile: null, custom: { kcal: 2600, waterMl: 3000 } });
  const goals = await fdb.getGoals(db);
  assert.equal(goals.kcal, 2600);
  assert.equal(goals.waterMl, 3000);
  assert.equal(goals.protein, 50);
});

test('BLS 4.0: whole database searchable, Austrian words, everyday foods first, fast', async () => {
  const { BUILTIN_FOODS, BUILTIN_RECIPES, allBlsFoods, searchFoods } = await import('../src/lib/foods');
  const fdb = await import('../src/lib/food-db');
  const bls = allBlsFoods();
  assert.ok(bls.length > 6900, `${bls.length}`);
  const all = [...BUILTIN_RECIPES, ...BUILTIN_FOODS, ...bls];
  const top = (q: string) => searchFoods(q, all)[0]?.name;
  assert.equal(top('topfen'), 'Low-fat quark (Topfen)');
  assert.equal(top('semmel'), 'Bread roll');
  assert.equal(top('banane'), 'Banana');
  assert.equal(top('leberkäse'), 'Leberkäse');
  // Long-tail foods are found by their German name and by Austrian words.
  assert.ok(searchFoods('kaiserschmarrn', all).length > 0 || searchFoods('schmarrn', all).length > 0);
  assert.ok(searchFoods('marillenknödel', all).length + searchFoods('marille', all).length > 1);
  assert.ok(searchFoods('karfiol', all).some((f) => /Blumenkohl/.test(f.altName ?? f.words)));
  const t0 = performance.now();
  for (const q of ['hühnerbrust', 'vollkornbrot', 'joghurt', 'griesbrei', 'xyzzy']) searchFoods(q, all);
  const ms = (performance.now() - t0) / 5;
  assert.ok(ms < 150, `search took ${ms.toFixed(0)} ms`);
  const db = fakeDb();
  await dbm.migrate(db);
  const item = (await fdb.getFoodItem(db, bls[0].ref))!;
  assert.equal(item.name, bls[0].name);
  assert.equal(item.source, 'bls');
});
