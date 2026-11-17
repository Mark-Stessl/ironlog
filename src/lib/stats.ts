// Training statistics: how much each muscle was trained. Pure functions,
// tested in tests/logic.test.ts.
import { musclesFor, type Region } from './muscles';

/** The six axes of the muscle distribution chart (like Hevy's). */
export const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] as const;
export type Group = (typeof GROUPS)[number];

const REGION_GROUP: Record<Region, Group> = {
  chest: 'Chest',
  traps: 'Back',
  upperBack: 'Back',
  lats: 'Back',
  lowerBack: 'Back',
  frontDelts: 'Shoulders',
  sideDelts: 'Shoulders',
  rearDelts: 'Shoulders',
  rotatorCuff: 'Shoulders',
  biceps: 'Arms',
  triceps: 'Arms',
  forearms: 'Arms',
  abs: 'Core',
  obliques: 'Core',
  serratus: 'Core',
  hipFlexors: 'Legs',
  glutes: 'Legs',
  sideGlutes: 'Legs',
  adductors: 'Legs',
  quads: 'Legs',
  hamstrings: 'Legs',
  calves: 'Legs',
  shins: 'Legs',
};

/** One completed set and the exercise it belongs to. */
export type StatSet = {
  name: string;
  muscle: string;
  secondary?: string;
  weight: number | null;
  reps: number | null;
  workout_id: number;
};

export type MuscleStats = {
  /** Sets per muscle group. A set counts 1 for its main muscles and 0.5 where it only helps. */
  groups: Record<Group, number>;
  /** Same counting per body map area (for the heatmap). */
  regions: Partial<Record<Region, number>>;
  sets: number;
  volume: number;
  workouts: number;
};

export function muscleStats(sets: StatSet[]): MuscleStats {
  const groups = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  const regions: Partial<Record<Region, number>> = {};
  const cache = new Map<string, ReturnType<typeof musclesFor>>();
  let volume = 0;

  for (const s of sets) {
    const key = `${s.name}|${s.muscle}|${s.secondary ?? ''}`;
    let m = cache.get(key);
    if (!m) cache.set(key, (m = musclesFor(s)));
    // Per set, each group/area counts once, with the strongest involvement.
    const groupShare: Partial<Record<Group, number>> = {};
    const regionShare: Partial<Record<Region, number>> = {};
    for (const r of m.secondary) regionShare[r] = 0.5;
    for (const r of m.primary) regionShare[r] = 1;
    for (const [r, w] of Object.entries(regionShare) as [Region, number][]) {
      regions[r] = (regions[r] ?? 0) + w;
      const g = REGION_GROUP[r];
      groupShare[g] = Math.max(groupShare[g] ?? 0, w);
    }
    for (const [g, w] of Object.entries(groupShare) as [Group, number][]) groups[g] += w;
    volume += (s.weight ?? 0) * (s.reps ?? 0);
  }

  return { groups, regions, sets: sets.length, volume, workouts: new Set(sets.map((s) => s.workout_id)).size };
}

/** Areas scaled to 0..1 for the heatmap (1 = most trained). */
export function heat(regions: Partial<Record<Region, number>>): Partial<Record<Region, number>> {
  const max = Math.max(0, ...Object.values(regions).map((v) => v ?? 0));
  if (!max) return {};
  return Object.fromEntries(Object.entries(regions).map(([r, v]) => [r, (v ?? 0) / max]));
}

/** Readable name of a body map area. */
export const REGION_LABEL: Record<Region, string> = {
  chest: 'Chest',
  traps: 'Traps',
  upperBack: 'Upper back',
  lats: 'Lats',
  lowerBack: 'Lower back',
  frontDelts: 'Front delts',
  sideDelts: 'Side delts',
  rearDelts: 'Rear delts',
  rotatorCuff: 'Rotator cuff',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  serratus: 'Serratus',
  hipFlexors: 'Hip flexors',
  glutes: 'Glutes',
  sideGlutes: 'Side glutes',
  adductors: 'Inner thighs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  shins: 'Shins',
};

/** Areas sorted by how much they were trained, most first. */
export function topRegions(regions: Partial<Record<Region, number>>, count = 6): { region: Region; sets: number }[] {
  return (Object.entries(regions) as [Region, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([region, sets]) => ({ region, sets }));
}

export type Period = 'week' | 'month' | 'year';

/** Start/end of the current period and of the one before it (local time). */
export function periodRange(period: Period, now = new Date()): { from: number; to: number; prevFrom: number; label: string; prevLabel: string } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === 'week') {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    const from = d.getTime();
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 7);
    return { from, to: now.getTime(), prevFrom: prev.getTime(), label: 'This week', prevLabel: 'Last week' };
  }
  if (period === 'month') {
    d.setDate(1);
    const from = d.getTime();
    const prev = new Date(d);
    prev.setMonth(prev.getMonth() - 1);
    const label = d.toLocaleDateString('en-US', { month: 'long' });
    const prevLabel = prev.toLocaleDateString('en-US', { month: 'long' });
    return { from, to: now.getTime(), prevFrom: prev.getTime(), label, prevLabel };
  }
  d.setMonth(0, 1);
  const from = d.getTime();
  const prev = new Date(d);
  prev.setFullYear(prev.getFullYear() - 1);
  return { from, to: now.getTime(), prevFrom: prev.getTime(), label: String(d.getFullYear()), prevLabel: String(prev.getFullYear()) };
}
