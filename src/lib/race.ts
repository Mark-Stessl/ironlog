// "Race your past self": today's volume against last time's at the same point.
// Pure functions, tested in tests/logic.test.ts.
import type { PrevSet, SetRow } from './db';

type RaceExercise = { track?: string; sets: Pick<SetRow, 'weight' | 'reps' | 'done' | 'kind'>[]; previous: PrevSet[] };

export type Race = {
  /** Your working volume so far, on exercises you've done before. */
  you: number;
  /** What you had lifted last time after the same number of sets. */
  ghost: number;
  /** Last time's whole volume on these exercises. */
  ghostTotal: number;
  /** you / ghost − 1, or null when there's nothing to compare yet. */
  delta: number | null;
};

const vol = (s: { weight?: number | null; reps?: number | null }) => (s.weight ?? 0) * (s.reps ?? 0);

/**
 * Compares set by set: after your 3rd bench set, the ghost has done its 3rd bench
 * set too. Exercises you've never done don't count on either side; extra sets
 * beyond last time's count for you.
 */
export function raceAgainstLastTime(exercises: RaceExercise[]): Race {
  let you = 0;
  let ghost = 0;
  let ghostTotal = 0;
  for (const ex of exercises) {
    if (ex.track && ex.track !== 'weight_reps') continue;
    const before = ex.previous.filter((p) => p.kind !== 'warmup');
    if (!before.length) continue;
    const done = ex.sets.filter((s) => s.done && s.kind !== 'warmup');
    you += done.reduce((sum, s) => sum + vol(s), 0);
    ghost += before.slice(0, done.length).reduce((sum, s) => sum + vol(s), 0);
    ghostTotal += before.reduce((sum, s) => sum + vol(s), 0);
  }
  return { you, ghost, ghostTotal, delta: ghost > 0 ? you / ghost - 1 : null };
}

/** "+4 %", "−3 %", or "level" for under half a percent. */
export function fmtDelta(delta: number): string {
  const pct = Math.round(delta * 100);
  if (pct === 0) return 'level';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`;
}
