import type { SQLiteDatabase } from 'expo-sqlite';

import { CARDIO_EXERCISES, SEED_EXERCISES } from './exercise-data';
import { defaultWorkoutName, est1RM } from './format';
import { addToBest, NO_BEST, type Best, type RecordRow } from './records';
import type { SigilRow } from './sigil';
import type { YearSet } from './year';
import type { PlanItem } from './routine-diff';
import { FOOD_SCHEMA } from './food-db';
import type { StatSet } from './stats';

// ── Types ───────────────────────────────────────────────────────────────

export type Exercise = {
  id: number;
  name: string;
  muscle: string;
  equipment: string;
  aliases: string;
  is_custom: number;
  /** Comma-separated extra muscle groups (custom exercises), e.g. "Triceps,Shoulders". */
  secondary: string;
  /** Own note: seat height, grip, cues. */
  notes: string;
  /** What a set records: kg × reps, or time plus distance / floors for cardio machines. */
  track: Track;
  use_count: number;
};

/** kg × reps for strength work; time + km (treadmill, bike) or time + floors (stair climber) for cardio. */
export type Track = 'weight_reps' | 'time_distance' | 'time_floors';

export type Workout = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number | null;
  routine_id: number | null;
};

/** Normal working set, warm-up (not counted in volume, sets or records), drop set, or set to failure. */
export type SetKind = 'normal' | 'warmup' | 'drop' | 'failure';

export type SetRow = {
  id: number;
  workout_exercise_id: number;
  position: number;
  weight: number | null;
  reps: number | null;
  /** Cardio: how long, in seconds. */
  seconds: number | null;
  /** Cardio: km, or floors on a stair climber. */
  distance: number | null;
  done: number;
  kind: SetKind;
};

export type PrevSet = {
  weight: number | null;
  reps: number | null;
  seconds?: number | null;
  distance?: number | null;
  kind?: SetKind;
};

/** What a set is changed to. Strength sets use weight/reps, cardio sets seconds/distance. */
export type SetPatch = {
  weight: number | null;
  reps: number | null;
  seconds?: number | null;
  distance?: number | null;
  done: boolean;
};

export type WorkoutExercise = {
  id: number; // workout_exercises.id
  exercise_id: number;
  name: string;
  muscle: string;
  equipment: string;
  secondary: string;
  /** Note for this exercise in this workout only. */
  notes: string;
  track: Track;
  sets: SetRow[];
  previous: PrevSet[]; // sets from the last finished session of this exercise
  best: Best; // records from workouts before this one
};

export type WorkoutDetail = { workout: Workout; exercises: WorkoutExercise[] };

export type WorkoutSummary = Workout & {
  exercise_count: number;
  set_count: number;
  volume: number;
  exercise_names: string | null;
};

export type Routine = { id: number; name: string; created_at: number };
export type RoutineSummary = Routine & { exercise_names: string | null; exercise_count: number };
export type RoutineExercise = {
  id: number; // routine_exercises.id
  exercise_id: number;
  name: string;
  muscle: string;
  equipment: string;
  target_sets: number;
};

// ── Schema ──────────────────────────────────────────────────────────────

const SCHEMA_V1 = `
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  muscle TEXT NOT NULL,
  equipment TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '',
  is_custom INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3
);
CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL
);
CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL
);
CREATE TABLE sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  weight REAL,
  reps INTEGER,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX idx_we_workout ON workout_exercises(workout_id);
CREATE INDEX idx_we_exercise ON workout_exercises(exercise_id);
CREATE INDEX idx_sets_we ON sets(workout_exercise_id);
`;

/** Runs once on app start (SQLiteProvider onInit). */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(SCHEMA_V1);
      for (const [name, muscle, equipment, aliases] of SEED_EXERCISES) {
        await db.runAsync(
          'INSERT OR IGNORE INTO exercises (name, muscle, equipment, aliases) VALUES (?, ?, ?, ?)',
          name,
          muscle,
          equipment,
          aliases,
        );
      }
      await db.execAsync('PRAGMA user_version = 1');
    });
  }
  if (version < 2) {
    // Custom exercises can say which other muscles they work (for the body map).
    await db.withTransactionAsync(async () => {
      await db.execAsync("ALTER TABLE exercises ADD COLUMN secondary TEXT NOT NULL DEFAULT ''");
      await db.execAsync('PRAGMA user_version = 2');
    });
  }
  if (version < 3) {
    // Rest days in the calendar and body measurements (weight, waist, ...).
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE rest_days (day TEXT PRIMARY KEY);
        CREATE TABLE measurements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          value REAL NOT NULL,
          measured_at INTEGER NOT NULL
        );
        CREATE INDEX measurements_kind ON measurements (kind, measured_at);
        PRAGMA user_version = 3;
      `);
    });
  }
  if (version < 4) {
    // Food tracking: own foods and scanned products, own recipes, food log, water.
    await db.withTransactionAsync(async () => {
      await db.execAsync(FOOD_SCHEMA);
      await db.execAsync('PRAGMA user_version = 4');
    });
  }
  if (version < 5) {
    // Photos: product images, your own photos of foods, recipes and meals.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE foods ADD COLUMN image TEXT;
        ALTER TABLE user_recipes ADD COLUMN image TEXT;
        CREATE TABLE meal_photos (
          day TEXT NOT NULL,
          meal TEXT NOT NULL,
          image TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (day, meal)
        );
        PRAGMA user_version = 5;
      `);
    });
  }
  if (version < 6) {
    // Favourite foods and saved meals ("usual breakfast"), added again with one tap.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE favorites (ref TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
        CREATE TABLE saved_meals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          meal TEXT NOT NULL,
          items TEXT NOT NULL,            -- JSON: [{ ref, name, brand, grams, amount, n }]
          created_at INTEGER NOT NULL,
          used_at INTEGER
        );
        PRAGMA user_version = 6;
      `);
    });
  }
  if (version < 7) {
    // Set types (warm-up, drop set, failure) and a note per exercise.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE sets ADD COLUMN kind TEXT NOT NULL DEFAULT 'normal';
        ALTER TABLE exercises ADD COLUMN notes TEXT NOT NULL DEFAULT '';
        PRAGMA user_version = 7;
      `);
    });
  }
  if (version < 8) {
    // Cardio machines: sets with time and distance (or floors) instead of kg and reps.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE exercises ADD COLUMN track TEXT NOT NULL DEFAULT 'weight_reps';
        ALTER TABLE sets ADD COLUMN seconds INTEGER;
        ALTER TABLE sets ADD COLUMN distance REAL;
      `);
      for (const [name, equipment, track, aliases] of CARDIO_EXERCISES) {
        await db.runAsync(
          `INSERT OR IGNORE INTO exercises (name, muscle, equipment, aliases, track) VALUES (?, 'Cardio', ?, ?, ?)`,
          name,
          equipment,
          aliases,
          track,
        );
      }
      await db.execAsync('PRAGMA user_version = 8');
    });
  }
  if (version < 9) {
    // Notes on an exercise in a workout belong to that workout only.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE workout_exercises ADD COLUMN notes TEXT NOT NULL DEFAULT '';
        PRAGMA user_version = 9;
      `);
    });
  }
  // Future schema changes: add `if (version < 10) { ... }` blocks here.
}

// ── Settings ────────────────────────────────────────────────────────────

export async function getSetting(db: SQLiteDatabase, key: string, fallback: string): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? fallback;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

// ── Exercises ───────────────────────────────────────────────────────────

/** All exercises, each with how often it was used in finished or running workouts. */
export function listExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>(`
    SELECT e.*, COUNT(we.id) AS use_count
    FROM exercises e
    LEFT JOIN workout_exercises we ON we.exercise_id = e.id
    GROUP BY e.id
    ORDER BY e.name COLLATE NOCASE
  `);
}

export function getExercise(db: SQLiteDatabase, id: number): Promise<Exercise | null> {
  return db.getFirstAsync<Exercise>(
    `SELECT e.*, (SELECT COUNT(*) FROM workout_exercises we WHERE we.exercise_id = e.id) AS use_count
     FROM exercises e WHERE e.id = ?`,
    id,
  );
}

/** Returns the new id, or the existing id if an exercise with that name exists. */
export async function createExercise(
  db: SQLiteDatabase,
  name: string,
  muscle: string,
  equipment: string,
  secondary: string[] = [],
  track: Track = 'weight_reps',
): Promise<number> {
  const clean = name.trim();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM exercises WHERE name = ? COLLATE NOCASE',
    clean,
  );
  if (existing) return existing.id;
  const res = await db.runAsync(
    'INSERT INTO exercises (name, muscle, equipment, is_custom, secondary, track) VALUES (?, ?, ?, 1, ?, ?)',
    clean,
    muscle,
    equipment,
    secondary.filter((m) => m !== muscle).join(','),
    track,
  );
  return res.lastInsertRowId;
}

export type ExerciseRecords = {
  bestWeight: { weight: number; reps: number; date: number } | null;
  best1RM: { value: number; weight: number; reps: number; date: number } | null;
  bestVolume: { value: number; date: number } | null; // best total kg in one session
  sessions: number;
};

export type ExerciseSession = {
  workout_id: number;
  workout_name: string;
  date: number;
  sets: PrevSet[];
};

export async function getExerciseHistory(db: SQLiteDatabase, exerciseId: number): Promise<ExerciseSession[]> {
  const rows = await db.getAllAsync<{
    workout_id: number;
    workout_name: string;
    date: number;
    weight: number | null;
    reps: number | null;
    seconds: number | null;
    distance: number | null;
  }>(
    `SELECT w.id AS workout_id, w.name AS workout_name, w.finished_at AS date, s.weight, s.reps, s.seconds, s.distance
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND s.done = 1 AND s.kind != 'warmup' AND w.finished_at IS NOT NULL
     ORDER BY w.finished_at DESC, w.id DESC, we.position, s.position`,
    exerciseId,
  );
  const sessions: ExerciseSession[] = [];
  for (const r of rows) {
    let last = sessions[sessions.length - 1];
    if (!last || last.workout_id !== r.workout_id) {
      last = { workout_id: r.workout_id, workout_name: r.workout_name, date: r.date, sets: [] };
      sessions.push(last);
    }
    last.sets.push({ weight: r.weight, reps: r.reps, seconds: r.seconds, distance: r.distance });
  }
  return sessions;
}

export function computeRecords(sessions: ExerciseSession[]): ExerciseRecords {
  const rec: ExerciseRecords = { bestWeight: null, best1RM: null, bestVolume: null, sessions: sessions.length };
  for (const s of sessions) {
    let volume = 0;
    for (const set of s.sets) {
      const w = set.weight ?? 0;
      const r = set.reps ?? 0;
      if (r <= 0) continue;
      volume += w * r;
      if (
        w > 0 &&
        (!rec.bestWeight || w > rec.bestWeight.weight || (w === rec.bestWeight.weight && r > rec.bestWeight.reps))
      ) {
        rec.bestWeight = { weight: w, reps: r, date: s.date };
      }
      const orm = est1RM(w, r);
      if (w > 0 && (!rec.best1RM || orm > rec.best1RM.value)) {
        rec.best1RM = { value: orm, weight: w, reps: r, date: s.date };
      }
    }
    if (volume > 0 && (!rec.bestVolume || volume > rec.bestVolume.value)) {
      rec.bestVolume = { value: volume, date: s.date };
    }
  }
  return rec;
}

// ── Workouts ────────────────────────────────────────────────────────────

export function getActiveWorkout(db: SQLiteDatabase): Promise<Workout | null> {
  return db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1');
}

/** Starts an empty workout, or one pre-filled from a routine. Returns the workout id. */
export async function startWorkout(db: SQLiteDatabase, routineId?: number): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    let name = defaultWorkoutName(new Date());
    if (routineId != null) {
      const routine = await db.getFirstAsync<Routine>('SELECT * FROM routines WHERE id = ?', routineId);
      if (routine) name = routine.name;
    }
    const res = await db.runAsync(
      'INSERT INTO workouts (name, started_at, routine_id) VALUES (?, ?, ?)',
      name,
      Date.now(),
      routineId ?? null,
    );
    id = res.lastInsertRowId;
    if (routineId != null) {
      const items = await db.getAllAsync<{ exercise_id: number; target_sets: number }>(
        'SELECT exercise_id, target_sets FROM routine_exercises WHERE routine_id = ? ORDER BY position',
        routineId,
      );
      for (let i = 0; i < items.length; i++) {
        const we = await db.runAsync(
          'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)',
          id,
          items[i].exercise_id,
          i,
        );
        for (let s = 0; s < Math.max(1, items[i].target_sets); s++) {
          await db.runAsync('INSERT INTO sets (workout_exercise_id, position) VALUES (?, ?)', we.lastInsertRowId, s);
        }
      }
    }
  });
  return id;
}

async function previousSets(db: SQLiteDatabase, exerciseId: number, excludeWorkoutId: number): Promise<PrevSet[]> {
  const last = await db.getFirstAsync<{ id: number }>(
    `SELECT we.id FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND w.finished_at IS NOT NULL AND w.id != ?
       AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id AND s.done = 1)
     ORDER BY w.finished_at DESC, w.id DESC LIMIT 1`,
    exerciseId,
    excludeWorkoutId,
  );
  if (!last) return [];
  return db.getAllAsync<PrevSet>(
    'SELECT weight, reps, seconds, distance, kind FROM sets WHERE workout_exercise_id = ? AND done = 1 ORDER BY position',
    last.id,
  );
}

/** Records for an exercise from all workouts finished before `workout` started. */
async function bestBefore(db: SQLiteDatabase, exerciseId: number, workout: Workout): Promise<Best> {
  const sets = await db.getAllAsync<{ workout_id: number; weight: number | null; reps: number | null }>(
    `SELECT w.id AS workout_id, s.weight, s.reps FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND s.done = 1 AND s.kind != 'warmup' AND w.finished_at IS NOT NULL
       AND w.id != ? AND w.started_at <= ?`,
    exerciseId,
    workout.id,
    workout.started_at,
  );
  let best = NO_BEST;
  for (const set of sets) best = addToBest(best, set);
  return { ...best, sessions: new Set(sets.map((s) => s.workout_id)).size };
}

export async function getWorkoutDetail(db: SQLiteDatabase, workoutId: number): Promise<WorkoutDetail | null> {
  const workout = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', workoutId);
  if (!workout) return null;
  const rows = await db.getAllAsync<Omit<WorkoutExercise, 'sets' | 'previous' | 'best'>>(
    `SELECT we.id, we.exercise_id, e.name, e.muscle, e.equipment, e.secondary, we.notes, e.track
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`,
    workoutId,
  );
  const allSets = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? ORDER BY s.position`,
    workoutId,
  );
  const exercises: WorkoutExercise[] = [];
  for (const r of rows) {
    exercises.push({
      ...r,
      sets: allSets.filter((s) => s.workout_exercise_id === r.id),
      previous: await previousSets(db, r.exercise_id, workoutId),
      best: await bestBefore(db, r.exercise_id, workout),
    });
  }
  return { workout, exercises };
}

export async function renameWorkout(db: SQLiteDatabase, workoutId: number, name: string): Promise<void> {
  await db.runAsync('UPDATE workouts SET name = ? WHERE id = ?', name.trim() || 'Workout', workoutId);
}

/** Adds an exercise with one empty set (or as many as last time). */
export async function addExerciseToWorkout(db: SQLiteDatabase, workoutId: number, exerciseId: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    const pos = await db.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM workout_exercises WHERE workout_id = ?',
      workoutId,
    );
    const we = await db.runAsync(
      'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)',
      workoutId,
      exerciseId,
      pos?.next ?? 0,
    );
    const prev = await previousSets(db, exerciseId, workoutId);
    const count = Math.max(1, prev.length);
    for (let i = 0; i < count; i++) {
      // Same set types as last time (warm-ups first, then working sets...).
      await db.runAsync(
        'INSERT INTO sets (workout_exercise_id, position, kind) VALUES (?, ?, ?)',
        we.lastInsertRowId,
        i,
        prev[i]?.kind ?? 'normal',
      );
    }
  });
}

/** What a swap changed, so it can be undone. */
export type SwapResult = {
  /** The workout_exercises row the new exercise lives in. */
  newId: number;
  /** True when a new row was added (the old exercise kept its ticked sets). */
  created: boolean;
  oldExerciseId: number;
  /** The open sets as they were before the swap. */
  moved: SetRow[];
};

/**
 * Swaps an exercise in a running workout. Ticked sets stay with the old exercise;
 * the open sets move to the new one and get its numbers from last time.
 */
export async function swapWorkoutExercise(
  db: SQLiteDatabase,
  workoutExerciseId: number,
  newExerciseId: number,
): Promise<SwapResult> {
  let result: SwapResult | null = null;
  await db.withTransactionAsync(async () => {
    const we = await db.getFirstAsync<{ workout_id: number; exercise_id: number; position: number }>(
      'SELECT workout_id, exercise_id, position FROM workout_exercises WHERE id = ?',
      workoutExerciseId,
    );
    if (!we) throw new Error('Exercise not in workout');
    const sets = await db.getAllAsync<SetRow>(
      'SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY position',
      workoutExerciseId,
    );
    const open = sets.filter((x) => !x.done);
    const keepsSome = sets.length > open.length;
    let target = workoutExerciseId;
    if (keepsSome) {
      // The ticked sets stay; the new exercise goes right below.
      await db.runAsync(
        'UPDATE workout_exercises SET position = position + 1 WHERE workout_id = ? AND position > ?',
        we.workout_id,
        we.position,
      );
      const ins = await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)',
        we.workout_id,
        newExerciseId,
        we.position + 1,
      );
      target = ins.lastInsertRowId;
    } else {
      await db.runAsync('UPDATE workout_exercises SET exercise_id = ? WHERE id = ?', newExerciseId, workoutExerciseId);
    }
    const prev = await previousSets(db, newExerciseId, we.workout_id);
    const moving = open.length ? open : [];
    for (let i = 0; i < moving.length; i++) {
      const p = prev[i];
      await db.runAsync(
        'UPDATE sets SET workout_exercise_id = ?, position = ?, weight = ?, reps = ?, seconds = ?, distance = ? WHERE id = ?',
        target,
        i,
        p?.weight ?? null,
        p?.reps ?? null,
        p?.seconds ?? null,
        p?.distance ?? null,
        moving[i].id,
      );
    }
    // Nothing left to move (all sets were ticked): start the new exercise with one set.
    if (!moving.length) await db.runAsync('INSERT INTO sets (workout_exercise_id, position) VALUES (?, 0)', target);
    result = { newId: target, created: keepsSome, oldExerciseId: we.exercise_id, moved: open };
  });
  return result!;
}

/** Puts everything back the way it was before `swapWorkoutExercise`. */
export async function undoSwap(db: SQLiteDatabase, workoutExerciseId: number, swap: SwapResult): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const s of swap.moved)
      await db.runAsync(
        'UPDATE sets SET workout_exercise_id = ?, position = ?, weight = ?, reps = ?, seconds = ?, distance = ?, done = 0 WHERE id = ?',
        workoutExerciseId,
        s.position,
        s.weight,
        s.reps,
        s.seconds,
        s.distance,
        s.id,
      );
    if (swap.created) {
      const we = await db.getFirstAsync<{ workout_id: number; position: number }>(
        'SELECT workout_id, position FROM workout_exercises WHERE id = ?',
        swap.newId,
      );
      await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', swap.newId);
      if (we)
        await db.runAsync(
          'UPDATE workout_exercises SET position = position - 1 WHERE workout_id = ? AND position > ?',
          we.workout_id,
          we.position,
        );
    } else {
      // Sets added for the new exercise go; the moved ones are back.
      const keep = swap.moved.map((s) => s.id);
      await db.runAsync(
        `DELETE FROM sets WHERE workout_exercise_id = ? ${keep.length ? `AND id NOT IN (${keep.map(() => '?').join(',')})` : ''}`,
        workoutExerciseId,
        ...keep,
      );
      await db.runAsync(
        'UPDATE workout_exercises SET exercise_id = ? WHERE id = ?',
        swap.oldExerciseId,
        workoutExerciseId,
      );
    }
  });
}

/** For the swap sheet: what you did last time on each exercise (first set of the last session). */
export async function lastTimeFor(
  db: SQLiteDatabase,
  exerciseIds: number[],
  excludeWorkoutId: number,
): Promise<Map<number, PrevSet>> {
  const out = new Map<number, PrevSet>();
  for (const id of exerciseIds) {
    const prev = await previousSets(db, id, excludeWorkoutId);
    const first = prev.find((p) => p.kind !== 'warmup') ?? prev[0];
    if (first) out.set(id, first);
  }
  return out;
}

/** Saves the note of one exercise in one workout. */
export async function setWorkoutExerciseNotes(db: SQLiteDatabase, workoutExerciseId: number, notes: string) {
  await db.runAsync('UPDATE workout_exercises SET notes = ? WHERE id = ?', notes.trim(), workoutExerciseId);
}

export async function removeWorkoutExercise(db: SQLiteDatabase, workoutExerciseId: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', workoutExerciseId);
}

export async function addSet(db: SQLiteDatabase, workoutExerciseId: number): Promise<void> {
  const last = await db.getFirstAsync<SetRow>(
    'SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY position DESC LIMIT 1',
    workoutExerciseId,
  );
  // A new set starts with the values of the set above it.
  await db.runAsync(
    'INSERT INTO sets (workout_exercise_id, position, weight, reps, seconds, distance) VALUES (?, ?, ?, ?, ?, ?)',
    workoutExerciseId,
    (last?.position ?? -1) + 1,
    last?.weight ?? null,
    last?.reps ?? null,
    last?.seconds ?? null,
    last?.distance ?? null,
  );
}

export async function updateSet(db: SQLiteDatabase, setId: number, patch: SetPatch): Promise<void> {
  await db.runAsync(
    'UPDATE sets SET weight = ?, reps = ?, seconds = ?, distance = ?, done = ? WHERE id = ?',
    patch.weight,
    patch.reps == null ? null : Math.round(patch.reps),
    patch.seconds == null ? null : Math.round(patch.seconds),
    patch.distance ?? null,
    patch.done ? 1 : 0,
    setId,
  );
}

export async function deleteSet(db: SQLiteDatabase, setId: number): Promise<void> {
  await db.runAsync('DELETE FROM sets WHERE id = ?', setId);
}

/**
 * Finishes a workout: unticked sets and exercises without any ticked set are dropped.
 * Returns false (and deletes the workout) if nothing was logged at all.
 */
export async function finishWorkout(db: SQLiteDatabase, workoutId: number): Promise<boolean> {
  let kept = false;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM sets WHERE done = 0 AND workout_exercise_id IN
         (SELECT id FROM workout_exercises WHERE workout_id = ?)`,
      workoutId,
    );
    await db.runAsync(
      `DELETE FROM workout_exercises WHERE workout_id = ?
         AND NOT EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = workout_exercises.id)`,
      workoutId,
    );
    const left = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM workout_exercises WHERE workout_id = ?',
      workoutId,
    );
    if ((left?.n ?? 0) === 0) {
      await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
    } else {
      await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', Date.now(), workoutId);
      kept = true;
    }
  });
  return kept;
}

/** How many workouts were finished up to and including this one (1 = first ever). */
export async function workoutNumber(db: SQLiteDatabase, workout: Workout): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workouts WHERE finished_at IS NOT NULL AND (started_at < ? OR (started_at = ? AND id <= ?))',
    workout.started_at,
    workout.started_at,
    workout.id,
  );
  return row?.n ?? 1;
}

/** Completed sets of finished workouts between two times (for statistics). */
export function statSets(db: SQLiteDatabase, from: number, to: number, workoutId?: number): Promise<StatSet[]> {
  return db.getAllAsync<StatSet>(
    `SELECT e.name, e.muscle, e.secondary, s.weight, s.reps, w.id AS workout_id
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     WHERE s.done = 1 AND s.kind != 'warmup' AND w.finished_at IS NOT NULL AND w.finished_at >= ? AND w.finished_at < ?
       AND (? IS NULL OR w.id = ?)`,
    from,
    to,
    workoutId ?? null,
    workoutId ?? null,
  );
}

/** Total training time of finished workouts in a time range. */
export async function trainingTime(db: SQLiteDatabase, from: number, to: number): Promise<number> {
  const row = await db.getFirstAsync<{ ms: number | null }>(
    'SELECT SUM(finished_at - started_at) AS ms FROM workouts WHERE finished_at IS NOT NULL AND finished_at >= ? AND finished_at < ?',
    from,
    to,
  );
  return row?.ms ?? 0;
}

export async function deleteWorkout(db: SQLiteDatabase, workoutId: number): Promise<void> {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
}

export function listFinishedWorkouts(db: SQLiteDatabase): Promise<WorkoutSummary[]> {
  return db.getAllAsync<WorkoutSummary>(`
    SELECT w.*,
      (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exercise_count,
      (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
         WHERE we.workout_id = w.id AND s.done = 1 AND s.kind != 'warmup') AS set_count,
      (SELECT COALESCE(SUM(COALESCE(s.weight, 0) * COALESCE(s.reps, 0)), 0)
         FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
         WHERE we.workout_id = w.id AND s.done = 1 AND s.kind != 'warmup') AS volume,
      (SELECT GROUP_CONCAT(name, ' · ') FROM
         (SELECT e.name FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
          WHERE we.workout_id = w.id ORDER BY we.position)) AS exercise_names
    FROM workouts w
    WHERE w.finished_at IS NOT NULL
    ORDER BY w.finished_at DESC, w.id DESC
  `);
}

// ── Routines ────────────────────────────────────────────────────────────

export function listRoutines(db: SQLiteDatabase): Promise<RoutineSummary[]> {
  return db.getAllAsync<RoutineSummary>(`
    SELECT r.*,
      (SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id) AS exercise_count,
      (SELECT GROUP_CONCAT(name, ' · ') FROM
         (SELECT e.name FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
          WHERE re.routine_id = r.id ORDER BY re.position)) AS exercise_names
    FROM routines r
    ORDER BY r.created_at
  `);
}

export async function createRoutine(db: SQLiteDatabase, name: string): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO routines (name, created_at) VALUES (?, ?)',
    name.trim() || 'New Routine',
    Date.now(),
  );
  return res.lastInsertRowId;
}

export async function getRoutine(
  db: SQLiteDatabase,
  routineId: number,
): Promise<{ routine: Routine; exercises: RoutineExercise[] } | null> {
  const routine = await db.getFirstAsync<Routine>('SELECT * FROM routines WHERE id = ?', routineId);
  if (!routine) return null;
  const exercises = await db.getAllAsync<RoutineExercise>(
    `SELECT re.id, re.exercise_id, re.target_sets, e.name, e.muscle, e.equipment
     FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
     WHERE re.routine_id = ? ORDER BY re.position`,
    routineId,
  );
  return { routine, exercises };
}

export async function renameRoutine(db: SQLiteDatabase, routineId: number, name: string): Promise<void> {
  await db.runAsync('UPDATE routines SET name = ? WHERE id = ?', name.trim() || 'Routine', routineId);
}

export async function deleteRoutine(db: SQLiteDatabase, routineId: number): Promise<void> {
  await db.runAsync('DELETE FROM routines WHERE id = ?', routineId);
}

export async function addExerciseToRoutine(db: SQLiteDatabase, routineId: number, exerciseId: number): Promise<void> {
  const pos = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM routine_exercises WHERE routine_id = ?',
    routineId,
  );
  await db.runAsync(
    'INSERT INTO routine_exercises (routine_id, exercise_id, position) VALUES (?, ?, ?)',
    routineId,
    exerciseId,
    pos?.next ?? 0,
  );
}

export async function setRoutineExerciseSets(
  db: SQLiteDatabase,
  routineExerciseId: number,
  targetSets: number,
): Promise<void> {
  await db.runAsync(
    'UPDATE routine_exercises SET target_sets = ? WHERE id = ?',
    Math.min(10, Math.max(1, targetSets)),
    routineExerciseId,
  );
}

export async function removeRoutineExercise(db: SQLiteDatabase, routineExerciseId: number): Promise<void> {
  await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', routineExerciseId);
}

/** Exercises and set counts of a workout, in order (what you actually did). */
export function workoutPlan(db: SQLiteDatabase, workoutId: number): Promise<PlanItem[]> {
  return db.getAllAsync<PlanItem>(
    `SELECT we.exercise_id, e.name,
       (SELECT COUNT(*) FROM sets s WHERE s.workout_exercise_id = we.id) AS sets
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`,
    workoutId,
  );
}

/** Replaces a routine's exercises with what you did in a workout (keeps its name). */
export async function updateRoutineFromWorkout(
  db: SQLiteDatabase,
  routineId: number,
  workoutId: number,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', routineId);
    await db.runAsync(
      `INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets)
       SELECT ?, we.exercise_id, we.position,
         MAX(1, (SELECT COUNT(*) FROM sets s WHERE s.workout_exercise_id = we.id))
       FROM workout_exercises we WHERE we.workout_id = ? ORDER BY we.position`,
      routineId,
      workoutId,
    );
  });
}

/** "Push day" -> "Push day 2" (or 3, ...) if the name is taken. */
export async function freeRoutineName(db: SQLiteDatabase, base: string): Promise<string> {
  const taken = new Set(
    (await db.getAllAsync<{ name: string }>('SELECT name FROM routines')).map((r) => r.name.toLowerCase()),
  );
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/** Turns a finished workout into a reusable routine. Returns the routine id. */
export async function saveWorkoutAsRoutine(db: SQLiteDatabase, workoutId: number, name?: string): Promise<number> {
  let routineId = 0;
  await db.withTransactionAsync(async () => {
    const w = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', workoutId);
    const res = await db.runAsync(
      'INSERT INTO routines (name, created_at) VALUES (?, ?)',
      name ?? w?.name ?? 'Routine',
      Date.now(),
    );
    routineId = res.lastInsertRowId;
    await db.runAsync(
      `INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets)
       SELECT ?, we.exercise_id, we.position,
         MAX(1, (SELECT COUNT(*) FROM sets s WHERE s.workout_exercise_id = we.id))
       FROM workout_exercises we WHERE we.workout_id = ? ORDER BY we.position`,
      routineId,
      workoutId,
    );
  });
  return routineId;
}

// ── Profile, calendar and measurements ─────────────────────────────────

export type ProfileTotals = {
  workouts: number;
  volume: number;
  sets: number;
  first: number | null;
};

/** Everything since the first workout. */
export async function profileTotals(db: SQLiteDatabase): Promise<ProfileTotals> {
  const w = await db.getFirstAsync<{ n: number; first: number | null }>(
    'SELECT COUNT(*) AS n, MIN(started_at) AS first FROM workouts WHERE finished_at IS NOT NULL',
  );
  const s = await db.getFirstAsync<{ sets: number; volume: number | null }>(
    `SELECT COUNT(*) AS sets, SUM(COALESCE(s.weight, 0) * COALESCE(s.reps, 0)) AS volume
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE s.done = 1 AND s.kind != 'warmup' AND w.finished_at IS NOT NULL`,
  );
  return {
    workouts: w?.n ?? 0,
    first: w?.first ?? null,
    sets: s?.sets ?? 0,
    volume: s?.volume ?? 0,
  };
}

/** Every completed working set of finished workouts, oldest first (for the record book). */
export function recordRows(db: SQLiteDatabase): Promise<RecordRow[]> {
  return db.getAllAsync<RecordRow>(
    `SELECT e.id AS exercise_id, e.name, e.equipment, e.track, w.id AS workout_id, w.name AS workout_name,
            w.finished_at AS date, s.weight, s.reps, s.seconds, s.distance
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     WHERE s.done = 1 AND s.kind != 'warmup' AND w.finished_at IS NOT NULL
     ORDER BY w.finished_at, w.id, we.position, s.position`,
  );
}

/** Working sets of the last `days` days with what each exercise trains (for the muscle map). */
export function recentMuscleSets(db: SQLiteDatabase, days = 8) {
  return db.getAllAsync<{ name: string; muscle: string; secondary: string; date: number }>(
    `SELECT e.name, e.muscle, e.secondary, w.finished_at AS date
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     WHERE s.done = 1 AND s.kind != 'warmup' AND e.track = 'weight_reps'
       AND w.finished_at IS NOT NULL AND w.finished_at >= ?`,
    Date.now() - days * 86_400_000,
  );
}

/** Every routine with the exercises in it (name and muscles). */
export async function routinesWithExercises(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ id: number; rname: string; name: string; muscle: string; secondary: string }>(
    `SELECT r.id, r.name AS rname, e.name, e.muscle, e.secondary
     FROM routines r
     JOIN routine_exercises re ON re.routine_id = r.id
     JOIN exercises e ON e.id = re.exercise_id
     ORDER BY r.id, re.position`,
  );
  const out = new Map<
    number,
    { id: number; name: string; exercises: { name: string; muscle: string; secondary: string }[] }
  >();
  for (const r of rows) {
    if (!out.has(r.id)) out.set(r.id, { id: r.id, name: r.rname, exercises: [] });
    out.get(r.id)!.exercises.push({ name: r.name, muscle: r.muscle, secondary: r.secondary });
  }
  return [...out.values()];
}

/** Working sets of finished workouts, newest workout first, for drawing sigils. */
export function sigilRows(db: SQLiteDatabase, workoutId?: number) {
  return db.getAllAsync<SigilRow>(
    `SELECT w.id AS workout_id, w.name AS workout_name, w.started_at, w.finished_at,
            e.name AS exercise, e.muscle, s.weight, s.reps
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     WHERE s.done = 1 AND s.kind != 'warmup' AND w.finished_at IS NOT NULL ${workoutId != null ? 'AND w.id = ?' : ''}
     ORDER BY w.finished_at DESC, w.id, we.position, s.position`,
    ...(workoutId != null ? [workoutId] : []),
  );
}

/** Every working set of a year's finished workouts (for Year in Iron). */
export function yearSets(db: SQLiteDatabase, year: number) {
  return db.getAllAsync<YearSet>(
    `SELECT w.id AS workout_id, w.started_at, w.finished_at, e.name AS exercise, e.muscle, e.track,
            s.weight, s.reps, s.seconds, s.distance
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     WHERE s.done = 1 AND s.kind != 'warmup' AND w.finished_at IS NOT NULL
       AND w.finished_at >= ? AND w.finished_at < ?
     ORDER BY w.finished_at`,
    new Date(year, 0, 1).getTime(),
    new Date(year + 1, 0, 1).getTime(),
  );
}

export type CalendarWorkout = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number;
  /** Ticked sets and their volume (kg × reps). */
  sets: number;
  volume: number;
};

/** Finished workouts that started between two times. */
export function workoutsBetween(db: SQLiteDatabase, from: number, to: number): Promise<CalendarWorkout[]> {
  return db.getAllAsync<CalendarWorkout>(
    `SELECT w.id, w.name, w.started_at, w.finished_at,
            COUNT(s.id) AS sets, COALESCE(SUM(COALESCE(s.weight, 0) * COALESCE(s.reps, 0)), 0) AS volume
     FROM workouts w
     LEFT JOIN workout_exercises we ON we.workout_id = w.id
     LEFT JOIN sets s ON s.workout_exercise_id = we.id AND s.done = 1 AND s.kind != 'warmup'
     WHERE w.finished_at IS NOT NULL AND w.started_at >= ? AND w.started_at < ?
     GROUP BY w.id
     ORDER BY w.started_at`,
    from,
    to,
  );
}

/** Rest days as "YYYY-MM-DD" keys. */
export async function listRestDays(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>('SELECT day FROM rest_days ORDER BY day');
  return rows.map((r) => r.day);
}

export async function setRestDay(db: SQLiteDatabase, day: string, rest: boolean): Promise<void> {
  if (rest) await db.runAsync('INSERT OR IGNORE INTO rest_days (day) VALUES (?)', day);
  else await db.runAsync('DELETE FROM rest_days WHERE day = ?', day);
}

export type Measurement = {
  id: number;
  kind: string;
  value: number;
  measured_at: number;
};

export function listMeasurements(db: SQLiteDatabase, kind: string): Promise<Measurement[]> {
  return db.getAllAsync<Measurement>('SELECT * FROM measurements WHERE kind = ? ORDER BY measured_at, id', kind);
}

/** Latest and previous value of every kind that has entries. */
export async function latestMeasurements(
  db: SQLiteDatabase,
): Promise<Record<string, { value: number; prev: number | null; at: number; count: number }>> {
  const rows = await db.getAllAsync<Measurement>('SELECT * FROM measurements ORDER BY measured_at, id');
  const out: Record<string, { value: number; prev: number | null; at: number; count: number }> = {};
  for (const r of rows) {
    const cur = out[r.kind];
    out[r.kind] = {
      value: r.value,
      prev: cur ? cur.value : null,
      at: r.measured_at,
      count: (cur?.count ?? 0) + 1,
    };
  }
  return out;
}

export async function addMeasurement(db: SQLiteDatabase, kind: string, value: number, at = Date.now()): Promise<void> {
  await db.runAsync('INSERT INTO measurements (kind, value, measured_at) VALUES (?, ?, ?)', kind, value, at);
}

export async function deleteMeasurement(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM measurements WHERE id = ?', id);
}

export async function setSetKind(db: SQLiteDatabase, setId: number, kind: SetKind): Promise<void> {
  await db.runAsync('UPDATE sets SET kind = ? WHERE id = ?', kind, setId);
}

export async function setExerciseNotes(db: SQLiteDatabase, exerciseId: number, notes: string): Promise<void> {
  await db.runAsync('UPDATE exercises SET notes = ? WHERE id = ?', notes.trim(), exerciseId);
}

/** Swaps an exercise with its neighbour in a workout (-1 = up, +1 = down). */
export async function moveWorkoutExercise(db: SQLiteDatabase, workoutExerciseId: number, dir: -1 | 1): Promise<void> {
  await swapPosition(db, 'workout_exercises', 'workout_id', workoutExerciseId, dir);
}

/** Swaps an exercise with its neighbour in a routine (-1 = up, +1 = down). */
export async function moveRoutineExercise(db: SQLiteDatabase, routineExerciseId: number, dir: -1 | 1): Promise<void> {
  await swapPosition(db, 'routine_exercises', 'routine_id', routineExerciseId, dir);
}

async function swapPosition(
  db: SQLiteDatabase,
  table: 'workout_exercises' | 'routine_exercises',
  parent: 'workout_id' | 'routine_id',
  id: number,
  dir: -1 | 1,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM ${table} WHERE ${parent} = (SELECT ${parent} FROM ${table} WHERE id = ?) ORDER BY position, id`,
      id,
    );
    const i = rows.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    // Renumber 0..n-1 so earlier gaps or duplicate positions can't get in the way.
    for (const [pos, r] of rows.entries())
      await db.runAsync(`UPDATE ${table} SET position = ? WHERE id = ?`, pos, r.id);
  });
}

/** Saves a new exercise order (ids of workout_exercises or routine_exercises, top to bottom). */
export async function setExerciseOrder(
  db: SQLiteDatabase,
  table: 'workout_exercises' | 'routine_exercises',
  ids: number[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [pos, id] of ids.entries()) await db.runAsync(`UPDATE ${table} SET position = ? WHERE id = ?`, pos, id);
  });
}
