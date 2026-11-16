// Personal records (PRs). Pure functions, tested in tests/logic.test.ts.
import { est1RM, fmtWeight } from './format';

export type LoggedSet = { weight: number | null; reps: number | null };

/** Best performance of one exercise so far. */
export type Best = {
  weight: number; // heaviest weight lifted
  repsAtWeight: number; // most reps done with that heaviest weight
  e1rm: number; // best estimated one-rep max
  sessions: number; // finished workouts with this exercise
};

export const NO_BEST: Best = { weight: 0, repsAtWeight: 0, e1rm: 0, sessions: 0 };

export type PRKind = 'weight' | 'reps' | 'e1rm';

export type PR = { kind: PRKind; title: string; detail: string };

/** Adds one completed set to a best. */
export function addToBest(best: Best, set: LoggedSet): Best {
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  if (r <= 0) return best;
  const next = { ...best };
  if (w > next.weight) {
    next.weight = w;
    next.repsAtWeight = r;
  } else if (w === next.weight && r > next.repsAtWeight) {
    next.repsAtWeight = r;
  }
  if (w > 0) next.e1rm = Math.max(next.e1rm, est1RM(w, r));
  return next;
}

/**
 * Is this completed set a new record compared to `before`?
 * The first time you ever do an exercise is not a record (there is nothing to beat).
 */
export function findPR(set: LoggedSet, before: Best): PR | null {
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  if (r <= 0 || before.sessions === 0) return null;

  if (w > before.weight) {
    return {
      kind: 'weight',
      title: 'Heaviest weight ever',
      detail: `${fmtWeight(w)} kg × ${r}  ·  was ${fmtWeight(before.weight)} kg`,
    };
  }
  if (w === before.weight && r > before.repsAtWeight) {
    return {
      kind: 'reps',
      title: w > 0 ? `Most reps at ${fmtWeight(w)} kg` : 'Most reps ever',
      detail: `${r} reps  ·  was ${before.repsAtWeight}`,
    };
  }
  const e = w > 0 ? est1RM(w, r) : 0;
  if (e > before.e1rm + 0.05 && before.e1rm > 0) {
    return {
      kind: 'e1rm',
      title: 'Best estimated 1RM',
      detail: `${fmtWeight(e)} kg  ·  was ${fmtWeight(before.e1rm)} kg`,
    };
  }
  return null;
}

/**
 * Marks which completed sets of one exercise in a workout were records,
 * checking them in order so each set has to beat everything before it.
 */
export function markPRs<T extends LoggedSet & { done: number }>(sets: T[], base: Best): (PR | null)[] {
  let best = base;
  return sets.map((s) => {
    if (!s.done) return null;
    const pr = findPR(s, best);
    best = addToBest(best, s);
    return pr;
  });
}
