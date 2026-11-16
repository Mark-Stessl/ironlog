import type { SQLiteDatabase } from 'expo-sqlite';

import { SEED_EXERCISES } from './exercise-data';
import { defaultWorkoutName, est1RM } from './format';

// ── Types ───────────────────────────────────────────────────────────────

export type Exercise = {
  id: number;
  name: string;
  muscle: string;
  equipment: string;
  aliases: string;
  is_custom: number;
  use_count: number;
};

export type Workout = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number | null;
  routine_id: number | null;
};

export type SetRow = {
  id: number;
  workout_exercise_id: number;
  position: number;
  weight: number | null;
  reps: number | null;
  done: number;
};

export type PrevSet = { weight: number | null; reps: number | null };

export type WorkoutExercise = {
  id: number; // workout_exercises.id
  exercise_id: number;
  name: string;
  muscle: string;
  equipment: string;
  sets: SetRow[];
  previous: PrevSet[]; // sets from the last finished session of this exercise
  bestWeight: number; // heaviest completed set before this workout
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
  // Future schema changes: add `if (version < 2) { ... }` blocks here.
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
): Promise<number> {
  const clean = name.trim();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM exercises WHERE name = ? COLLATE NOCASE',
    clean,
  );
  if (existing) return existing.id;
  const res = await db.runAsync(
    'INSERT INTO exercises (name, muscle, equipment, is_custom) VALUES (?, ?, ?, 1)',
    clean,
    muscle,
    equipment,
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
  }>(
    `SELECT w.id AS workout_id, w.name AS workout_name, w.finished_at AS date, s.weight, s.reps
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND s.done = 1 AND w.finished_at IS NOT NULL
     ORDER BY w.finished_at DESC, we.position, s.position`,
    exerciseId,
  );
  const sessions: ExerciseSession[] = [];
  for (const r of rows) {
    let last = sessions[sessions.length - 1];
    if (!last || last.workout_id !== r.workout_id) {
      last = { workout_id: r.workout_id, workout_name: r.workout_name, date: r.date, sets: [] };
      sessions.push(last);
    }
    last.sets.push({ weight: r.weight, reps: r.reps });
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
      if (w > 0 && (!rec.bestWeight || w > rec.bestWeight.weight || (w === rec.bestWeight.weight && r > rec.bestWeight.reps))) {
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
  return db.getFirstAsync<Workout>(
    'SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
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
          await db.runAsync(
            'INSERT INTO sets (workout_exercise_id, position) VALUES (?, ?)',
            we.lastInsertRowId,
            s,
          );
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
     ORDER BY w.finished_at DESC LIMIT 1`,
    exerciseId,
    excludeWorkoutId,
  );
  if (!last) return [];
  return db.getAllAsync<PrevSet>(
    'SELECT weight, reps FROM sets WHERE workout_exercise_id = ? AND done = 1 ORDER BY position',
    last.id,
  );
}

export async function getWorkoutDetail(db: SQLiteDatabase, workoutId: number): Promise<WorkoutDetail | null> {
  const workout = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', workoutId);
  if (!workout) return null;
  const rows = await db.getAllAsync<Omit<WorkoutExercise, 'sets' | 'previous' | 'bestWeight'>>(
    `SELECT we.id, we.exercise_id, e.name, e.muscle, e.equipment
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
    const best = await db.getFirstAsync<{ best: number | null }>(
      `SELECT MAX(s.weight) AS best FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
       WHERE we.exercise_id = ? AND s.done = 1 AND w.finished_at IS NOT NULL AND w.id != ?`,
      r.exercise_id,
      workoutId,
    );
    exercises.push({
      ...r,
      sets: allSets.filter((s) => s.workout_exercise_id === r.id),
      previous: await previousSets(db, r.exercise_id, workoutId),
      bestWeight: best?.best ?? 0,
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
      await db.runAsync('INSERT INTO sets (workout_exercise_id, position) VALUES (?, ?)', we.lastInsertRowId, i);
    }
  });
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
    'INSERT INTO sets (workout_exercise_id, position, weight, reps) VALUES (?, ?, ?, ?)',
    workoutExerciseId,
    (last?.position ?? -1) + 1,
    last?.weight ?? null,
    last?.reps ?? null,
  );
}

export async function updateSet(
  db: SQLiteDatabase,
  setId: number,
  patch: { weight: number | null; reps: number | null; done: boolean },
): Promise<void> {
  await db.runAsync(
    'UPDATE sets SET weight = ?, reps = ?, done = ? WHERE id = ?',
    patch.weight,
    patch.reps == null ? null : Math.round(patch.reps),
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

export async function deleteWorkout(db: SQLiteDatabase, workoutId: number): Promise<void> {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
}

export function listFinishedWorkouts(db: SQLiteDatabase): Promise<WorkoutSummary[]> {
  return db.getAllAsync<WorkoutSummary>(`
    SELECT w.*,
      (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exercise_count,
      (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
         WHERE we.workout_id = w.id AND s.done = 1) AS set_count,
      (SELECT COALESCE(SUM(COALESCE(s.weight, 0) * COALESCE(s.reps, 0)), 0)
         FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
         WHERE we.workout_id = w.id AND s.done = 1) AS volume,
      (SELECT GROUP_CONCAT(name, ' · ') FROM
         (SELECT e.name FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
          WHERE we.workout_id = w.id ORDER BY we.position)) AS exercise_names
    FROM workouts w
    WHERE w.finished_at IS NOT NULL
    ORDER BY w.finished_at DESC
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

export async function setRoutineExerciseSets(db: SQLiteDatabase, routineExerciseId: number, targetSets: number): Promise<void> {
  await db.runAsync(
    'UPDATE routine_exercises SET target_sets = ? WHERE id = ?',
    Math.min(10, Math.max(1, targetSets)),
    routineExerciseId,
  );
}

export async function removeRoutineExercise(db: SQLiteDatabase, routineExerciseId: number): Promise<void> {
  await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', routineExerciseId);
}

/** Turns a finished workout into a reusable routine. Returns the routine id. */
export async function saveWorkoutAsRoutine(db: SQLiteDatabase, workoutId: number): Promise<number> {
  let routineId = 0;
  await db.withTransactionAsync(async () => {
    const w = await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', workoutId);
    const res = await db.runAsync(
      'INSERT INTO routines (name, created_at) VALUES (?, ?)',
      w?.name ?? 'Routine',
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
