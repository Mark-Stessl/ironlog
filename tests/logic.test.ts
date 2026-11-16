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
  assert.equal(d.exercises[0].bestWeight, 62.5);
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
  const c1 = await dbm.createExercise(db, 'Hammer Strength Row', 'Back', 'Machine');
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
