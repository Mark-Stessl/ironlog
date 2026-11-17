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

export const PR_LABEL: Record<PRKind, string> = { weight: 'Weight', reps: 'Reps', e1rm: '1RM' };

/**
 * Every record this completed set beats compared to `before` (up to three:
 * heaviest weight, most reps at the top weight, best estimated 1RM).
 * The first time you ever do an exercise is not a record (there is nothing to beat).
 */
export function findPRs(set: LoggedSet, before: Best): PR[] {
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  if (r <= 0 || before.sessions === 0) return [];
  const prs: PR[] = [];

  if (w > before.weight) {
    prs.push({
      kind: 'weight',
      title: 'Heaviest weight ever',
      detail: `${fmtWeight(w)} kg × ${r}  ·  was ${fmtWeight(before.weight)} kg`,
    });
  } else if (w === before.weight && r > before.repsAtWeight) {
    prs.push({
      kind: 'reps',
      title: w > 0 ? `Most reps at ${fmtWeight(w)} kg` : 'Most reps ever',
      detail: `${r} reps  ·  was ${before.repsAtWeight}`,
    });
  }
  const e = w > 0 ? est1RM(w, r) : 0;
  if (before.e1rm > 0 && e > before.e1rm + 0.05) {
    prs.push({
      kind: 'e1rm',
      title: 'Best estimated 1RM',
      detail: `${fmtWeight(e)} kg  ·  was ${fmtWeight(before.e1rm)} kg`,
    });
  }
  return prs;
}

/** The most important record of a set (for short labels), or null. */
export function findPR(set: LoggedSet, before: Best): PR | null {
  return findPRs(set, before)[0] ?? null;
}

/**
 * Records beaten by each completed set of one exercise in a workout, checking the
 * sets in order so each set has to beat everything before it (incl. earlier sets).
 */
export function markPRs<T extends LoggedSet & { done: number }>(sets: T[], base: Best): PR[][] {
  let best = base;
  return sets.map((s) => {
    if (!s.done) return [];
    const prs = findPRs(s, best);
    best = addToBest(best, s);
    return prs;
  });
}

/**
 * Like markPRs, but only the newest set holds each record: if a later set beats
 * the same record again, the earlier set loses it.
 */
export function currentPRs<T extends LoggedSet & { done: number }>(sets: T[], base: Best): PR[][] {
  const all = markPRs(sets, base);
  const holder: Partial<Record<PRKind, number>> = {};
  all.forEach((prs, i) => prs.forEach((pr) => (holder[pr.kind] = i)));
  return all.map((prs, i) => prs.filter((pr) => holder[pr.kind] === i));
}
