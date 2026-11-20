// "Year in Iron": your training year as a story. Pure functions, tested in
// tests/logic.test.ts.
import type { RecordEvent } from './records';

export type YearSet = {
  workout_id: number;
  started_at: number;
  finished_at: number;
  exercise: string;
  muscle: string;
  track: string;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  distance: number | null;
};

export type YearStory = {
  year: number;
  workouts: number;
  hours: number;
  sets: number;
  reps: number;
  kg: number;
  /** "That's 3.4 elephants." */
  compare: { count: number; thing: string; things: string } | null;
  favourite: { name: string; sets: number; heaviest: number } | null;
  topMuscles: { muscle: string; share: number }[];
  records: number;
  bestRecords: RecordEvent[];
  /** Most weeks in a row with at least one workout. */
  weekStreak: number;
  favouriteDay: string | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null;
  busiestMonth: { month: string; workouts: number } | null;
  cardio: { minutes: number; km: number; floors: number };
  workoutIds: number[];
};

const THINGS = [
  { kg: 1_500, thing: 'car', things: 'cars' },
  { kg: 6_000, thing: 'elephant', things: 'elephants' },
  { kg: 40_000, thing: 'loaded truck', things: 'loaded trucks' },
  { kg: 150_000, thing: 'blue whale', things: 'blue whales' },
  { kg: 410_000, thing: 'jumbo jet', things: 'jumbo jets' },
  { kg: 7_300_000, thing: 'Eiffel Tower', things: 'Eiffel Towers' },
];

/** The biggest thing you've lifted at least one of. */
export function compareWeight(kg: number) {
  let pick = null as YearStory['compare'];
  for (const t of THINGS)
    if (kg >= t.kg) pick = { count: Math.round((kg / t.kg) * 10) / 10, thing: t.thing, things: t.things };
  return pick;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekIndex(t: number) {
  const d = new Date(t);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return Math.round(monday.getTime() / (7 * 86_400_000));
}

export function yearStory(year: number, sets: YearSet[], events: RecordEvent[]): YearStory {
  const inYear = (t: number) => new Date(t).getFullYear() === year;
  const rows = sets.filter((s) => inYear(s.finished_at));
  const workouts = new Map<number, { start: number; end: number }>();
  for (const s of rows) workouts.set(s.workout_id, { start: s.started_at, end: s.finished_at });
  const list = [...workouts.values()];

  const strength = rows.filter((s) => s.track === 'weight_reps');
  const kg = strength.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);

  // Favourite exercise: the most sets.
  const byExercise = new Map<string, { sets: number; heaviest: number }>();
  for (const s of strength) {
    const e = byExercise.get(s.exercise) ?? { sets: 0, heaviest: 0 };
    e.sets += 1;
    e.heaviest = Math.max(e.heaviest, s.weight ?? 0);
    byExercise.set(s.exercise, e);
  }
  const fav = [...byExercise.entries()].sort((a, b) => b[1].sets - a[1].sets)[0];

  const byMuscle = new Map<string, number>();
  for (const s of strength) byMuscle.set(s.muscle, (byMuscle.get(s.muscle) ?? 0) + 1);
  const topMuscles = [...byMuscle.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([muscle, n]) => ({ muscle, share: n / Math.max(1, strength.length) }));

  // Weeks in a row.
  const weeks = [...new Set(list.map((w) => weekIndex(w.start)))].sort((a, b) => a - b);
  let weekStreak = 0;
  let run = 0;
  weeks.forEach((w, i) => {
    run = i > 0 && w === weeks[i - 1] + 1 ? run + 1 : 1;
    weekStreak = Math.max(weekStreak, run);
  });

  const top = <K>(items: K[]) => {
    const m = new Map<K, number>();
    for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  };
  const day = top(list.map((w) => new Date(w.start).getDay()));
  const part = top(
    list.map((w) => {
      const h = new Date(w.start).getHours();
      return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night';
    }),
  );
  const month = top(list.map((w) => new Date(w.start).getMonth()));

  const yearEvents = events.filter((e) => inYear(e.date));
  const bestRecords = yearEvents
    .filter((e) => e.kind === 'weight')
    .sort((a, b) => b.date - a.date)
    .filter((e, i, all) => all.findIndex((x) => x.exercise_id === e.exercise_id) === i)
    .slice(0, 3);

  const cardioRows = rows.filter((s) => s.track !== 'weight_reps');
  return {
    year,
    workouts: list.length,
    hours: Math.round((list.reduce((sum, w) => sum + (w.end - w.start), 0) / 3_600_000) * 10) / 10,
    sets: rows.length,
    reps: strength.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    kg,
    compare: compareWeight(kg),
    favourite: fav ? { name: fav[0], sets: fav[1].sets, heaviest: fav[1].heaviest } : null,
    topMuscles,
    records: yearEvents.length,
    bestRecords,
    weekStreak,
    favouriteDay: day ? DAYS[day[0]] : null,
    timeOfDay: part ? (part[0] as YearStory['timeOfDay']) : null,
    busiestMonth: month
      ? {
          month: new Date(year, month[0], 1).toLocaleDateString('en-US', { month: 'long' }),
          workouts: month[1],
        }
      : null,
    cardio: {
      minutes: Math.round(cardioRows.reduce((sum, s) => sum + (s.seconds ?? 0), 0) / 60),
      km:
        Math.round(
          cardioRows.filter((s) => s.track === 'time_distance').reduce((sum, s) => sum + (s.distance ?? 0), 0) * 10,
        ) / 10,
      floors: Math.round(
        cardioRows.filter((s) => s.track === 'time_floors').reduce((sum, s) => sum + (s.distance ?? 0), 0),
      ),
    },
    workoutIds: [...workouts.keys()],
  };
}
