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
    // Warm-ups never set records (and don't raise the bar for later sets).
    if (!s.done || (s as { kind?: string }).kind === 'warmup') return [];
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

// ── Record book: the best of every exercise, and when each record was set ──

/** One completed set from a finished workout, oldest first. */
export type RecordRow = {
  exercise_id: number;
  name: string;
  equipment: string;
  track: string;
  workout_id: number;
  workout_name: string;
  date: number;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  distance: number | null;
};

export type ExerciseBest = {
  exercise_id: number;
  name: string;
  equipment: string;
  track: string;
  sessions: number;
  last: number;
  /** Strength. */
  heaviest?: { weight: number; reps: number; date: number };
  e1rm?: { value: number; weight: number; reps: number; date: number };
  bestSession?: { volume: number; date: number };
  /** Cardio. */
  longest?: { seconds: number; date: number };
  farthest?: { distance: number; date: number };
};

export type RecordEvent = {
  exercise_id: number;
  name: string;
  equipment: string;
  workout_id: number;
  workout_name: string;
  date: number;
  kind: PRKind | 'time' | 'distance';
  title: string;
  detail: string;
};

/**
 * Bests per exercise plus every time a record was broken (newest first). The first
 * session of an exercise sets the bar but isn't counted as a record.
 */
export function recordBook(rows: RecordRow[]): { bests: ExerciseBest[]; events: RecordEvent[] } {
  // Group into sessions: one exercise in one workout.
  const sessions: RecordRow[][] = [];
  const at = new Map<string, RecordRow[]>();
  for (const r of rows) {
    const key = `${r.exercise_id}:${r.workout_id}`;
    let list = at.get(key);
    if (!list) {
      list = [];
      at.set(key, list);
      sessions.push(list);
    }
    list.push(r);
  }

  const bests = new Map<number, ExerciseBest>();
  const strength = new Map<number, Best>();
  const events: RecordEvent[] = [];

  for (const sets of sessions) {
    const first = sets[0];
    const id = first.exercise_id;
    let b = bests.get(id);
    if (!b) {
      b = { exercise_id: id, name: first.name, equipment: first.equipment, track: first.track, sessions: 0, last: 0 };
      bests.set(id, b);
    }
    const ev = (kind: RecordEvent['kind'], title: string, detail: string) =>
      events.push({
        exercise_id: id,
        name: first.name,
        equipment: first.equipment,
        workout_id: first.workout_id,
        workout_name: first.workout_name,
        date: first.date,
        kind,
        title,
        detail,
      });

    if (first.track !== 'weight_reps') {
      const secs = Math.max(0, ...sets.map((s) => s.seconds ?? 0));
      const dist = Math.max(0, ...sets.map((s) => s.distance ?? 0));
      const floors = first.track === 'time_floors';
      if (secs > 0 && b.sessions > 0 && secs > (b.longest?.seconds ?? 0))
        ev(
          'time',
          'Longest session',
          `${Math.round(secs / 60)} min  ·  was ${Math.round((b.longest?.seconds ?? 0) / 60)} min`,
        );
      if (dist > 0 && b.sessions > 0 && dist > (b.farthest?.distance ?? 0))
        ev(
          'distance',
          floors ? 'Most floors' : 'Farthest distance',
          `${fmtWeight(dist)} ${floors ? 'floors' : 'km'}  ·  was ${fmtWeight(b.farthest?.distance ?? 0)}`,
        );
      if (secs > (b.longest?.seconds ?? 0)) b.longest = { seconds: secs, date: first.date };
      if (dist > (b.farthest?.distance ?? 0)) b.farthest = { distance: dist, date: first.date };
    } else {
      const before = strength.get(id) ?? NO_BEST;
      const prs = currentPRs(
        sets.map((s) => ({ ...s, done: 1 })),
        { ...before, sessions: b.sessions },
      );
      prs.forEach((list) => list.forEach((pr) => ev(pr.kind, pr.title, pr.detail)));
      let best = before;
      let volume = 0;
      for (const s of sets) {
        best = addToBest(best, s);
        const w = s.weight ?? 0;
        const r = s.reps ?? 0;
        volume += w * r;
        if (r > 0 && (!b.heaviest || w > b.heaviest.weight || (w === b.heaviest.weight && r > b.heaviest.reps)))
          b.heaviest = { weight: w, reps: r, date: s.date };
        const e = w > 0 && r > 0 ? est1RM(w, r) : 0;
        if (e > (b.e1rm?.value ?? 0)) b.e1rm = { value: e, weight: w, reps: r, date: s.date };
      }
      strength.set(id, best);
      if (volume > (b.bestSession?.volume ?? 0)) b.bestSession = { volume, date: first.date };
    }
    b.sessions += 1;
    b.last = Math.max(b.last, first.date);
  }

  return {
    bests: [...bests.values()].sort((a, b) => b.last - a.last),
    events: events.reverse(),
  };
}

/** The records from the most recent workout that broke any (events newest first). */
export function latestRecords(events: RecordEvent[]) {
  const top = events[0];
  if (!top) return null;
  return {
    workout_id: top.workout_id,
    workout: top.workout_name,
    date: top.date,
    items: events.filter((e) => e.workout_id === top.workout_id),
  };
}

/** Short names for record kinds (for compact lists). */
export const RECORD_SHORT: Record<RecordEvent['kind'], string> = {
  weight: 'Heaviest',
  reps: 'Most reps',
  e1rm: '1RM',
  time: 'Longest',
  distance: 'Farthest',
};

/** Records grouped per exercise and workout, newest first: "Bench Press · Heaviest + 1RM". */
export function groupRecords(events: RecordEvent[]) {
  const groups: { key: string; name: string; exercise_id: number; date: number; kinds: string[] }[] = [];
  for (const e of events) {
    const key = `${e.workout_id}:${e.exercise_id}`;
    const g = groups.find((x) => x.key === key);
    const label = e.kind === 'distance' && e.title === 'Most floors' ? 'Most floors' : RECORD_SHORT[e.kind];
    if (g) g.kinds.push(label);
    else groups.push({ key, name: e.name, exercise_id: e.exercise_id, date: e.date, kinds: [label] });
  }
  return groups;
}
